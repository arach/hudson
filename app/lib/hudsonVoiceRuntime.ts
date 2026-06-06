import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import WebSocket, { type RawData } from 'ws';
import { HUDSON_VOICE_API_BASE_PATH } from '@/packages/web/hudsonkit/src/lib/hudsonVoiceClient';

export const HUDSON_VOICE_RUNTIME_PATH_ENV = 'HUDSON_VOICE_RUNTIME_PATH';
export const HUDSON_VOICE_RUNTIME_FILE_NAME = 'hudson-voice-runtime.json';
export const HUDSON_VOICE_RUNTIME_DEFAULT_PATH = join(
  homedir(),
  'Library',
  'Application Support',
  'Hudson',
  'Vox',
  HUDSON_VOICE_RUNTIME_FILE_NAME,
);
export const HUDSON_VOICE_PROXY_BASE_PATH = HUDSON_VOICE_API_BASE_PATH;
export const HUDSON_VOICE_PROXY_STREAM_CONTENT_TYPE = 'application/x-ndjson; charset=utf-8';
export const HUDSON_VOICE_RPC_TIMEOUT_MS = 30_000;

export interface HudsonVoiceRuntimeCapability {
  schemaVersion: number;
  service: 'hudson-voice';
  transport: string;
  host: string;
  port: number;
  webSocketUrl: string;
  authToken: string;
  pid?: number;
  startedAt?: string;
  voxRuntimePath?: string;
}

export interface HudsonVoiceRpcEnvelope {
  id?: unknown;
  event?: unknown;
  sessionId?: unknown;
  data?: unknown;
  result?: unknown;
  error?: unknown;
}

export class HudsonVoiceRuntimeError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(code: string, message: string, status = 503) {
    super(message);
    this.name = 'HudsonVoiceRuntimeError';
    this.code = code;
    this.status = status;
  }
}

export function resolveHudsonVoiceRuntimePath(env: NodeJS.ProcessEnv = process.env): string {
  return env[HUDSON_VOICE_RUNTIME_PATH_ENV] || HUDSON_VOICE_RUNTIME_DEFAULT_PATH;
}

export function assertHudsonVoiceSameOriginRequest(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).origin !== requestOrigin) {
    throw new HudsonVoiceRuntimeError(
      'forbidden_origin',
      'Hudson voice API only accepts same-origin requests.',
      403,
    );
  }

  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    throw new HudsonVoiceRuntimeError(
      'forbidden_fetch_site',
      'Hudson voice API rejected this cross-origin request.',
      403,
    );
  }
}

export function readHudsonVoiceRuntimeCapability(
  env: NodeJS.ProcessEnv = process.env,
): HudsonVoiceRuntimeCapability {
  const filePath = resolveHudsonVoiceRuntimePath(env);
  if (!existsSync(filePath)) {
    throw new HudsonVoiceRuntimeError(
      'runtime_missing',
      'Hudson voice runtime is not available. Launch Hudson Menu and try again.',
    );
  }

  assertCapabilityFileIsPrivate(filePath);

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
  } catch (error) {
    throw new HudsonVoiceRuntimeError(
      'runtime_invalid_json',
      error instanceof Error ? error.message : 'Hudson voice runtime file is invalid JSON.',
    );
  }

  const capability = normalizeRuntimeCapability(parsed);
  if (capability.pid && !isProcessAlive(capability.pid)) {
    throw new HudsonVoiceRuntimeError(
      'runtime_stale',
      'Hudson voice runtime is stale. Relaunch Hudson Menu and try again.',
    );
  }
  return capability;
}

export function createHudsonVoiceRpcPayload(
  runtime: HudsonVoiceRuntimeCapability,
  method: string,
  params: Record<string, unknown> = {},
) {
  return {
    id: randomUUID(),
    method,
    params: {
      ...params,
      authToken: runtime.authToken,
    },
  };
}

export async function callHudsonVoiceRuntimeRpc(
  method: string,
  params: Record<string, unknown> = {},
  options: { timeoutMs?: number; env?: NodeJS.ProcessEnv } = {},
): Promise<Record<string, unknown>> {
  const runtime = readHudsonVoiceRuntimeCapability(options.env);
  const request = createHudsonVoiceRpcPayload(runtime, method, params);
  const timeoutMs = options.timeoutMs ?? HUDSON_VOICE_RPC_TIMEOUT_MS;
  const socket = new WebSocket(runtime.webSocketUrl, {
    perMessageDeflate: false,
  });

  return await new Promise<Record<string, unknown>>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      rejectOnce(new HudsonVoiceRuntimeError(
        'runtime_timeout',
        `Hudson voice runtime did not answer ${method} within ${timeoutMs}ms.`,
      ));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      socket.removeAllListeners();
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    };

    const rejectOnce = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(toRuntimeError(error, 'runtime_rpc_failed'));
    };

    const resolveOnce = (result: Record<string, unknown>) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    socket.on('open', () => {
      socket.send(JSON.stringify(request));
    });

    socket.on('message', (data) => {
      let payload: HudsonVoiceRpcEnvelope | null;
      try {
        payload = parseHudsonVoiceRpcEnvelope(data);
      } catch (error) {
        rejectOnce(error);
        return;
      }
      if (!payload || payload.id !== request.id || payload.event) return;
      if (payload.error) {
        rejectOnce(new HudsonVoiceRuntimeError(
          'runtime_error',
          typeof payload.error === 'string' ? payload.error : JSON.stringify(payload.error),
        ));
        return;
      }
      resolveOnce(payload.result && typeof payload.result === 'object'
        ? payload.result as Record<string, unknown>
        : {});
    });

    socket.on('error', (error) => {
      rejectOnce(error);
    });

    socket.on('close', () => {
      rejectOnce(new HudsonVoiceRuntimeError(
        'runtime_closed',
        'Hudson voice runtime closed the connection before replying.',
      ));
    });
  });
}

export function openHudsonVoiceRuntimeSocket(runtime: HudsonVoiceRuntimeCapability): WebSocket {
  return new WebSocket(runtime.webSocketUrl, {
    perMessageDeflate: false,
  });
}

export function parseHudsonVoiceRpcEnvelope(data: RawData): HudsonVoiceRpcEnvelope | null {
  const raw = readRawData(data);
  if (!raw) return null;
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object') return null;
  return parsed as HudsonVoiceRpcEnvelope;
}

export function normalizeHudsonVoiceRuntimeHealth(
  result: Record<string, unknown>,
  runtime: HudsonVoiceRuntimeCapability,
) {
  const status = typeof result.status === 'string' && result.status ? result.status : 'ready';
  const version = typeof result.version === 'string' ? result.version : undefined;
  const startedAt = typeof result.startedAt === 'string' ? result.startedAt : runtime.startedAt;
  const pid = typeof result.pid === 'number' ? result.pid : runtime.pid;

  return {
    service: 'Hudson',
    status,
    version,
    pid,
    startedAt,
    runtime: {
      authenticated: true,
      host: runtime.host,
      port: runtime.port,
      pid: runtime.pid,
      startedAt: runtime.startedAt,
    },
    voxRuntime: {
      ...result,
      service: 'Vox',
      status,
      authenticated: true,
    },
  };
}

export function jsonHudsonVoiceError(error: unknown): Response {
  const normalized = toRuntimeError(error, 'runtime_error');
  return Response.json(
    {
      error: normalized.message,
      code: normalized.code,
    },
    { status: normalized.status },
  );
}

function normalizeRuntimeCapability(value: unknown): HudsonVoiceRuntimeCapability {
  if (!value || typeof value !== 'object') {
    throw new HudsonVoiceRuntimeError('runtime_invalid', 'Hudson voice runtime file is invalid.');
  }

  const raw = value as Record<string, unknown>;
  const host = typeof raw.host === 'string' ? raw.host : '';
  const port = Number(raw.port);
  const webSocketUrl = typeof raw.webSocketUrl === 'string' ? raw.webSocketUrl : `ws://${host}:${port}`;
  const authToken = typeof raw.authToken === 'string' ? raw.authToken : '';
  const pid = typeof raw.pid === 'number' ? raw.pid : undefined;
  const startedAt = typeof raw.startedAt === 'string' ? raw.startedAt : undefined;
  const voxRuntimePath = typeof raw.voxRuntimePath === 'string' ? raw.voxRuntimePath : undefined;

  if (raw.service !== 'hudson-voice') {
    throw new HudsonVoiceRuntimeError('runtime_invalid_service', 'Hudson voice runtime service is invalid.');
  }
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new HudsonVoiceRuntimeError('runtime_invalid_port', 'Hudson voice runtime port is invalid.');
  }
  if (!isLoopbackHost(host)) {
    throw new HudsonVoiceRuntimeError('runtime_invalid_host', 'Hudson voice runtime must use a loopback host.');
  }
  if (authToken.length < 32) {
    throw new HudsonVoiceRuntimeError('runtime_invalid_token', 'Hudson voice runtime token is invalid.');
  }

  let endpoint: URL;
  try {
    endpoint = new URL(webSocketUrl);
  } catch {
    throw new HudsonVoiceRuntimeError('runtime_invalid_endpoint', 'Hudson voice runtime endpoint is invalid.');
  }
  if (endpoint.protocol !== 'ws:' || !isLoopbackHost(endpoint.hostname) || Number(endpoint.port) !== port) {
    throw new HudsonVoiceRuntimeError('runtime_invalid_endpoint', 'Hudson voice runtime endpoint is invalid.');
  }

  return {
    schemaVersion: Number(raw.schemaVersion) || 1,
    service: 'hudson-voice',
    transport: typeof raw.transport === 'string' ? raw.transport : 'ws+json-rpc',
    host,
    port,
    webSocketUrl,
    authToken,
    pid,
    startedAt,
    voxRuntimePath,
  };
}

function assertCapabilityFileIsPrivate(filePath: string) {
  if (process.platform === 'win32') return;
  const stat = statSync(filePath);
  if (typeof process.getuid === 'function' && stat.uid !== process.getuid()) {
    throw new HudsonVoiceRuntimeError(
      'runtime_wrong_owner',
      'Hudson voice runtime capability is owned by another user. Relaunch Hudson Menu to recreate it.',
    );
  }
  if ((stat.mode & 0o077) !== 0) {
    throw new HudsonVoiceRuntimeError(
      'runtime_insecure_permissions',
      'Hudson voice runtime capability is not private. Relaunch Hudson Menu to recreate it.',
    );
  }
}

function readRawData(data: RawData): string {
  if (typeof data === 'string') return data;
  if (Buffer.isBuffer(data)) return data.toString('utf8');
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  return '';
}

function isLoopbackHost(host: string) {
  const normalized = host.trim().toLowerCase().replace(/^\[(.*)\]$/, '$1');
  return normalized === 'localhost'
    || normalized === '::1'
    || normalized === '0:0:0:0:0:0:0:1'
    || normalized.startsWith('127.');
}

function isProcessAlive(pid: number) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return typeof error === 'object'
      && error !== null
      && 'code' in error
      && (error as { code?: string }).code === 'EPERM';
  }
}

function toRuntimeError(error: unknown, fallbackCode: string): HudsonVoiceRuntimeError {
  if (error instanceof HudsonVoiceRuntimeError) return error;
  if (error instanceof Error) {
    return new HudsonVoiceRuntimeError(fallbackCode, error.message);
  }
  return new HudsonVoiceRuntimeError(fallbackCode, 'Hudson voice runtime request failed.');
}
