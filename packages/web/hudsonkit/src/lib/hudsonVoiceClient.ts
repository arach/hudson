export type HudsonVoiceDaemonStatus =
  | 'ready'
  | 'starting'
  | 'warming'
  | 'unavailable'
  | 'error'
  | string;

export type HudsonVoicePermissionStatus =
  | 'not-determined'
  | 'granted'
  | 'denied'
  | 'restricted'
  | 'unavailable'
  | 'unknown'
  | string;

export type HudsonVoiceAvailability =
  | 'connected'
  | 'warming'
  | 'permission-denied'
  | 'unreachable'
  | 'error';

export const HUDSON_VOICE_DAEMON_DEFAULT_HOST = '127.0.0.1';
export const HUDSON_VOICE_DAEMON_DEFAULT_PORT = 42138;
export const HUDSON_VOICE_DAEMON_DEFAULT_WS_URL =
  `ws://${HUDSON_VOICE_DAEMON_DEFAULT_HOST}:${HUDSON_VOICE_DAEMON_DEFAULT_PORT}`;
export const HUDSON_VOICE_API_PATHS = {
  health: '/health',
  settings: '/v1/voice/settings',
  live: '/v1/voice/live',
  devices: '/v1/voice/devices',
  defaultDevice: '/v1/voice/devices/default',
  liveStop: (sessionId: string) => `/v1/voice/live/${encodeURIComponent(sessionId)}/stop`,
  liveCancel: (sessionId: string) => `/v1/voice/live/${encodeURIComponent(sessionId)}/cancel`,
} as const;
const HUDSON_VOICE_DAEMON_REQUEST_TIMEOUT_MS = 30_000;

export interface HudsonVoiceRuntimeHealth {
  status: HudsonVoiceDaemonStatus;
  version?: string;
  [key: string]: unknown;
}

export interface HudsonVoiceInputState {
  selectedDeviceId?: string | null;
  selectedDeviceName?: string | null;
  [key: string]: unknown;
}

export interface HudsonVoiceHealth {
  service: string;
  status: HudsonVoiceDaemonStatus;
  version?: string;
  pid?: number;
  startedAt?: string;
  voxRuntime?: HudsonVoiceRuntimeHealth;
  permissions?: {
    microphone?: HudsonVoicePermissionStatus;
    [key: string]: HudsonVoicePermissionStatus | undefined;
  };
  input?: HudsonVoiceInputState;
  activeSession?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface HudsonVoiceDevice {
  id: string;
  name: string;
  isDefault?: boolean;
  isSelected?: boolean;
  [key: string]: unknown;
}

export interface HudsonVoiceDeviceList {
  devices: HudsonVoiceDevice[];
  selectedDeviceId?: string | null;
  defaultDeviceId?: string | null;
  [key: string]: unknown;
}

export interface HudsonVoicePreferencesPayload {
  schemaVersion: number;
  preferredInputDeviceId: string | null;
  preferredOutputDeviceId: string | null;
  preferredTranscriptionModelId: string | null;
  preferredSynthesisModelId: string | null;
  preferredLanguage: string | null;
  mode: string;
}

export type HudsonVoiceMode = 'push_to_talk' | 'always_on' | string;

export interface HudsonVoiceLiveSessionRequest {
  clientId?: string;
  surface?: string;
  modelId?: string;
  language?: string;
  mode?: HudsonVoiceMode;
  metadata?: Record<string, unknown>;
  deviceId?: string;
}

export interface HudsonVoiceLiveEvent<TData = Record<string, unknown>> {
  event: string;
  sessionId?: string;
  data: TData;
}

export interface HudsonVoiceLiveSession {
  readonly sessionId: string | null;
  events: AsyncIterable<HudsonVoiceLiveEvent>;
  stop: () => Promise<void>;
  cancel: () => Promise<void>;
}

export interface HudsonVoiceClient {
  health: () => Promise<HudsonVoiceHealth>;
  probe: () => Promise<boolean>;
  availability: () => Promise<HudsonVoiceAvailability>;
  getSettings: () => Promise<{ settings: HudsonVoicePreferencesPayload }>;
  updateSettings: (
    patch: Partial<HudsonVoicePreferencesPayload> | Record<string, string | null>,
  ) => Promise<{ settings: HudsonVoicePreferencesPayload }>;
  listDevices: () => Promise<HudsonVoiceDeviceList>;
  setDefaultDevice: (deviceId: string) => Promise<HudsonVoiceDeviceList>;
  startLiveSession: (request?: HudsonVoiceLiveSessionRequest) => Promise<HudsonVoiceLiveSession>;
  stopLiveSession: (sessionId: string) => Promise<void>;
  cancelLiveSession: (sessionId: string) => Promise<void>;
}

export interface HudsonVoiceProbeClient {
  health: () => Promise<HudsonVoiceHealth>;
}

export type HudsonVoiceFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface HudsonVoiceClientOptions {
  baseUrl: string | URL;
  clientId?: string;
  fetch?: HudsonVoiceFetch;
  token?: string;
  headers?: HeadersInit;
}

export interface HudsonVoiceDaemonClientOptions {
  webSocketUrl?: string | URL;
  clientId?: string;
  token?: string;
  WebSocket?: typeof WebSocket;
  requestTimeoutMs?: number;
}

export type HudsonVoiceClientErrorCode =
  | 'http_error'
  | 'network_error'
  | 'daemon_error'
  | 'invalid_response'
  | 'stream_unavailable'
  | 'session_id_missing';

export class HudsonVoiceClientError extends Error {
  readonly code: HudsonVoiceClientErrorCode;
  readonly status?: number;
  readonly endpoint?: string;
  readonly cause?: unknown;

  constructor(
    code: HudsonVoiceClientErrorCode,
    message: string,
    options: { status?: number; endpoint?: string; cause?: unknown } = {},
  ) {
    super(message);
    this.name = 'HudsonVoiceClientError';
    this.code = code;
    this.status = options.status;
    this.endpoint = options.endpoint;
    this.cause = options.cause;
  }
}

function createEndpoint(baseUrl: string | URL, path: string): string {
  const base = typeof baseUrl === 'string' ? baseUrl : baseUrl.toString();
  const normalizedPath = path.replace(/^\/+/, '');

  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(base)) {
    const normalizedBase = base.endsWith('/') ? base : `${base}/`;
    return new URL(normalizedPath, normalizedBase).toString();
  }

  const normalizedBase = base.replace(/\/+$/, '');
  return normalizedBase ? `${normalizedBase}/${normalizedPath}` : `/${normalizedPath}`;
}

function createHudsonVoiceDaemonEndpoint(webSocketUrl?: string | URL): string {
  return (webSocketUrl ?? HUDSON_VOICE_DAEMON_DEFAULT_WS_URL).toString();
}

function createDaemonParams(
  options: HudsonVoiceDaemonClientOptions,
  params: Record<string, unknown>,
): Record<string, unknown> {
  if (!options.token) return params;
  return { ...params, authToken: options.token };
}

function getWebSocket(options: HudsonVoiceDaemonClientOptions): typeof WebSocket {
  const WebSocketImpl = options.WebSocket ?? globalThis.WebSocket;
  if (!WebSocketImpl) {
    throw new HudsonVoiceClientError('network_error', 'Hudson voice client requires a WebSocket implementation.');
  }
  return WebSocketImpl;
}

function getFetch(options: HudsonVoiceClientOptions): HudsonVoiceFetch {
  const fetchImpl = options.fetch ?? globalThis.fetch?.bind(globalThis);
  if (!fetchImpl) {
    throw new HudsonVoiceClientError('network_error', 'Hudson voice client requires a fetch implementation.');
  }
  return fetchImpl;
}

function createHeaders(options: HudsonVoiceClientOptions, extra?: HeadersInit): Headers {
  const headers = new Headers(options.headers);
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);

  if (extra) {
    new Headers(extra).forEach((value, key) => headers.set(key, value));
  }

  return headers;
}

async function responseText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

function normalizeNetworkError(error: unknown, endpoint: string): HudsonVoiceClientError {
  if (error instanceof HudsonVoiceClientError) return error;
  return new HudsonVoiceClientError(
    'network_error',
    'Hudson voice service is not reachable.',
    { endpoint, cause: error },
  );
}

function parseJsonResponse<T>(value: unknown, endpoint: string): T {
  if (!value || typeof value !== 'object') {
    throw new HudsonVoiceClientError(
      'invalid_response',
      'Hudson voice service returned an invalid response.',
      { endpoint },
    );
  }
  return value as T;
}

function extractSessionId(event: HudsonVoiceLiveEvent): string | null {
  if (typeof event.sessionId === 'string' && event.sessionId) return event.sessionId;
  const data = event.data;
  if (data && typeof data === 'object' && 'sessionId' in data) {
    const sessionId = (data as { sessionId?: unknown }).sessionId;
    if (typeof sessionId === 'string' && sessionId) return sessionId;
  }
  return null;
}

interface HudsonVoiceDaemonRpcEnvelope {
  id?: unknown;
  event?: unknown;
  sessionId?: unknown;
  data?: unknown;
  result?: unknown;
  error?: unknown;
}

class AsyncEventQueue<T> implements AsyncIterable<T> {
  private items: T[] = [];
  private waiters: Array<{
    resolve: (result: IteratorResult<T>) => void;
    reject: (error: unknown) => void;
  }> = [];
  private closed = false;
  private failure: unknown = null;

  push(item: T) {
    if (this.closed) return;
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter.resolve({ value: item, done: false });
      return;
    }
    this.items.push(item);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    const waiters = this.waiters.splice(0);
    for (const waiter of waiters) {
      waiter.resolve({ value: undefined, done: true });
    }
  }

  fail(error: unknown) {
    if (this.closed) return;
    this.failure = error;
    this.closed = true;
    const waiters = this.waiters.splice(0);
    for (const waiter of waiters) {
      waiter.reject(error);
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => {
        if (this.items.length > 0) {
          return Promise.resolve({ value: this.items.shift()!, done: false });
        }
        if (this.failure) {
          return Promise.reject(this.failure);
        }
        if (this.closed) {
          return Promise.resolve({ value: undefined, done: true });
        }
        return new Promise<IteratorResult<T>>((resolve, reject) => {
          this.waiters.push({ resolve, reject });
        });
      },
    };
  }
}

function readWebSocketMessageData(data: unknown): string {
  if (typeof data === 'string') return data;
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  return '';
}

function parseDaemonEnvelope(raw: string, endpoint: string): HudsonVoiceDaemonRpcEnvelope | null {
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw) as unknown;
    if (!payload || typeof payload !== 'object') return null;
    return payload as HudsonVoiceDaemonRpcEnvelope;
  } catch (error) {
    throw new HudsonVoiceClientError(
      'invalid_response',
      'Hudson voice daemon returned invalid JSON.',
      { endpoint, cause: error },
    );
  }
}

function normalizeDaemonEvent(payload: HudsonVoiceDaemonRpcEnvelope): HudsonVoiceLiveEvent | null {
  if (typeof payload.event !== 'string' || !payload.event) return null;
  const data = payload.data && typeof payload.data === 'object'
    ? payload.data as Record<string, unknown>
    : {};
  const sessionId = typeof payload.sessionId === 'string'
    ? payload.sessionId
    : (typeof data.sessionId === 'string' ? data.sessionId : undefined);
  return {
    event: payload.event,
    sessionId,
    data,
  };
}

function isTerminalVoiceEvent(event: HudsonVoiceLiveEvent): boolean {
  if (event.event === 'session.final' || event.event === 'session.cancelled' || event.event === 'session.error') {
    return true;
  }
  if (event.event !== 'session.state') return false;
  const state = event.data && typeof event.data.state === 'string' ? event.data.state : '';
  return state === 'done' || state === 'cancelled' || state === 'error';
}

async function callHudsonVoiceDaemonRpc(
  options: HudsonVoiceDaemonClientOptions,
  method: string,
  params: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const endpoint = createHudsonVoiceDaemonEndpoint(options.webSocketUrl);
  const WebSocketImpl = getWebSocket(options);
  const timeoutMs = options.requestTimeoutMs ?? HUDSON_VOICE_DAEMON_REQUEST_TIMEOUT_MS;
  const id = `hudson-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const socket = new WebSocketImpl(endpoint);

  return new Promise<Record<string, unknown>>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      rejectOnce(new HudsonVoiceClientError(
        'network_error',
        `Hudson voice daemon did not answer ${method} within ${timeoutMs}ms.`,
        { endpoint },
      ));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      if (socket.readyState === WebSocketImpl.OPEN || socket.readyState === WebSocketImpl.CONNECTING) {
        socket.close();
      }
    };

    const rejectOnce = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(normalizeNetworkError(error, endpoint));
    };

    const resolveOnce = (result: Record<string, unknown>) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    socket.onopen = () => {
      socket.send(JSON.stringify({ id, method, params: createDaemonParams(options, params) }));
    };

    socket.onmessage = (event: MessageEvent) => {
      let payload: HudsonVoiceDaemonRpcEnvelope | null;
      try {
        payload = parseDaemonEnvelope(readWebSocketMessageData(event.data), endpoint);
      } catch (error) {
        rejectOnce(error);
        return;
      }
      if (!payload || payload.id !== id || payload.event) return;
      if (payload.error) {
        rejectOnce(new HudsonVoiceClientError(
          'daemon_error',
          typeof payload.error === 'string' ? payload.error : JSON.stringify(payload.error),
          { endpoint },
        ));
        return;
      }
      resolveOnce(payload.result && typeof payload.result === 'object'
        ? payload.result as Record<string, unknown>
        : {});
    };

    socket.onerror = () => {
      rejectOnce(new HudsonVoiceClientError(
        'network_error',
        'Hudson voice daemon is not reachable.',
        { endpoint },
      ));
    };

    socket.onclose = () => {
      rejectOnce(new HudsonVoiceClientError(
        'network_error',
        'Hudson voice daemon closed the connection before replying.',
        { endpoint },
      ));
    };
  });
}

function normalizeDaemonHealth(result: Record<string, unknown>): HudsonVoiceHealth {
  const status: HudsonVoiceDaemonStatus =
    typeof result.status === 'string' && result.status ? result.status : 'ready';
  const version = typeof result.version === 'string' ? result.version : undefined;
  const pid = typeof result.pid === 'number' ? result.pid : undefined;
  const startedAt = typeof result.startedAt === 'string' ? result.startedAt : undefined;
  const rawVoxRuntime = result.voxRuntime && typeof result.voxRuntime === 'object'
    ? result.voxRuntime as Record<string, unknown>
    : result;
  const voxStatus = typeof rawVoxRuntime.status === 'string' && rawVoxRuntime.status
    ? rawVoxRuntime.status
    : status;

  return {
    ...result,
    service: 'Hudson',
    status,
    version,
    pid,
    startedAt,
    voxRuntime: {
      status: voxStatus,
      ...rawVoxRuntime,
    },
  } as HudsonVoiceHealth;
}

async function startHudsonVoiceDaemonLiveSession(
  options: HudsonVoiceDaemonClientOptions,
  request: HudsonVoiceLiveSessionRequest,
): Promise<HudsonVoiceLiveSession> {
  const endpoint = createHudsonVoiceDaemonEndpoint(options.webSocketUrl);
  const WebSocketImpl = getWebSocket(options);
  const timeoutMs = options.requestTimeoutMs ?? HUDSON_VOICE_DAEMON_REQUEST_TIMEOUT_MS;
  const clientId = request.clientId ?? options.clientId ?? 'hudsonkit';
  const id = `hudson-live-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const socket = new WebSocketImpl(endpoint);
  const queue = new AsyncEventQueue<HudsonVoiceLiveEvent>();
  let sessionId: string | null = null;
  let ready = false;
  let manuallyClosing = false;
  let terminalEventReceived = false;

  return new Promise<HudsonVoiceLiveSession>((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new HudsonVoiceClientError(
        'network_error',
        `Hudson voice daemon did not start a live session within ${timeoutMs}ms.`,
        { endpoint },
      );
      fail(error);
    }, timeoutMs);

    const cleanupHandlers = () => {
      clearTimeout(timer);
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
    };

    const makeSession = (): HudsonVoiceLiveSession => ({
      get sessionId() {
        return sessionId;
      },
      events: queue,
      stop: async () => {
        if (!sessionId) {
          throw new HudsonVoiceClientError(
            'session_id_missing',
            'Hudson voice session has not emitted a session id yet.',
            { endpoint },
          );
        }
        await callHudsonVoiceDaemonRpc(options, 'transcribe.stopSession', { clientId, sessionId });
      },
      cancel: async () => {
        if (!sessionId) {
          manuallyClosing = true;
          cleanupHandlers();
          queue.close();
          socket.close();
          return;
        }
        try {
          await callHudsonVoiceDaemonRpc(options, 'transcribe.cancelSession', { clientId, sessionId });
        } finally {
          manuallyClosing = true;
          cleanupHandlers();
          queue.close();
          socket.close();
        }
      },
    });

    const resolveReady = () => {
      if (ready) return;
      ready = true;
      clearTimeout(timer);
      resolve(makeSession());
    };

    const fail = (error: unknown) => {
      cleanupHandlers();
      queue.fail(error);
      if (!ready) {
        reject(normalizeNetworkError(error, endpoint));
      }
      if (socket.readyState === WebSocketImpl.OPEN || socket.readyState === WebSocketImpl.CONNECTING) {
        socket.close();
      }
    };

    socket.onopen = () => {
      socket.send(JSON.stringify({
        id,
        method: 'transcribe.startSession',
        params: {
          clientId,
          surface: request.surface,
          modelId: request.modelId,
          language: request.language,
          mode: request.mode,
          deviceId: request.deviceId,
          metadata: request.metadata,
          ...(options.token ? { authToken: options.token } : {}),
        },
      }));
    };

    socket.onmessage = (event: MessageEvent) => {
      let payload: HudsonVoiceDaemonRpcEnvelope | null;
      try {
        payload = parseDaemonEnvelope(readWebSocketMessageData(event.data), endpoint);
      } catch (error) {
        fail(error);
        return;
      }
      if (!payload || payload.id !== id) return;

      if (payload.event) {
        const liveEvent = normalizeDaemonEvent(payload);
        if (!liveEvent) return;
        sessionId = sessionId ?? extractSessionId(liveEvent);
        terminalEventReceived = terminalEventReceived || isTerminalVoiceEvent(liveEvent);
        queue.push(liveEvent);
        if (sessionId || liveEvent.event === 'session.state') resolveReady();
        return;
      }

      if (payload.error) {
        fail(new HudsonVoiceClientError(
          'daemon_error',
          typeof payload.error === 'string' ? payload.error : JSON.stringify(payload.error),
          { endpoint },
        ));
        return;
      }

      const result = payload.result && typeof payload.result === 'object'
        ? payload.result as Record<string, unknown>
        : {};
      if (!sessionId && typeof result.sessionId === 'string' && result.sessionId) {
        sessionId = result.sessionId;
      }
      if (typeof result.text === 'string' && !terminalEventReceived) {
        const liveEvent: HudsonVoiceLiveEvent = {
          event: 'session.final',
          sessionId: sessionId ?? (typeof result.sessionId === 'string' ? result.sessionId : undefined),
          data: result,
        };
        sessionId = sessionId ?? extractSessionId(liveEvent);
        terminalEventReceived = true;
        queue.push(liveEvent);
      }
      resolveReady();
      if (terminalEventReceived) {
        manuallyClosing = true;
        cleanupHandlers();
        queue.close();
        socket.close();
      }
    };

    socket.onerror = () => {
      fail(new HudsonVoiceClientError(
        'network_error',
        'Hudson voice daemon is not reachable.',
        { endpoint },
      ));
    };

    socket.onclose = () => {
      if (manuallyClosing) return;
      if (terminalEventReceived) {
        cleanupHandlers();
        queue.close();
        return;
      }
      const error = new HudsonVoiceClientError(
        'network_error',
        ready
          ? 'Hudson voice session ended before a final transcript was returned.'
          : 'Hudson voice daemon closed the connection before the session started.',
        { endpoint },
      );
      if (ready) queue.fail(error);
      else fail(error);
    };
  });
}

async function requestJson<T>(
  options: HudsonVoiceClientOptions,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const endpoint = createEndpoint(options.baseUrl, path);
  const fetchImpl = getFetch(options);
  const headers = createHeaders(options, init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  let response: Response;
  try {
    response = await fetchImpl(endpoint, { ...init, headers });
  } catch (error) {
    throw normalizeNetworkError(error, endpoint);
  }

  if (!response.ok) {
    const body = await responseText(response);
    throw new HudsonVoiceClientError(
      'http_error',
      body || `Hudson voice service returned HTTP ${response.status}.`,
      { status: response.status, endpoint },
    );
  }

  if (response.status === 204) return undefined as T;

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    throw new HudsonVoiceClientError(
      'invalid_response',
      'Hudson voice service returned invalid JSON.',
      { endpoint, cause: error },
    );
  }

  return parseJsonResponse<T>(payload, endpoint);
}

async function requestStream(
  options: HudsonVoiceClientOptions,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const endpoint = createEndpoint(options.baseUrl, path);
  const fetchImpl = getFetch(options);
  const headers = createHeaders(options, init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  let response: Response;
  try {
    response = await fetchImpl(endpoint, { ...init, headers });
  } catch (error) {
    throw normalizeNetworkError(error, endpoint);
  }

  if (!response.ok) {
    const body = await responseText(response);
    throw new HudsonVoiceClientError(
      'http_error',
      body || `Hudson voice service returned HTTP ${response.status}.`,
      { status: response.status, endpoint },
    );
  }

  if (!response.body) {
    throw new HudsonVoiceClientError(
      'stream_unavailable',
      'Hudson voice service did not return a stream.',
      { endpoint },
    );
  }

  return response;
}

export function parseHudsonVoiceEventLine(line: string): HudsonVoiceLiveEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const payload = JSON.parse(trimmed) as {
    event?: unknown;
    sessionId?: unknown;
    data?: unknown;
  };

  if (typeof payload.event !== 'string' || !payload.event) {
    throw new HudsonVoiceClientError(
      'invalid_response',
      'Hudson voice stream event is missing an event name.',
    );
  }

  const data = payload.data && typeof payload.data === 'object'
    ? payload.data as Record<string, unknown>
    : {};
  const sessionId = typeof payload.sessionId === 'string'
    ? payload.sessionId
    : (typeof data.sessionId === 'string' ? data.sessionId : undefined);

  return {
    event: payload.event,
    sessionId,
    data,
  };
}

export function parseHudsonVoiceNdjson(input: string): HudsonVoiceLiveEvent[] {
  return input
    .split('\n')
    .map(parseHudsonVoiceEventLine)
    .filter((event): event is HudsonVoiceLiveEvent => event !== null);
}

export async function* parseHudsonVoiceEventStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<HudsonVoiceLiveEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (value) buffer += decoder.decode(value, { stream: !done });

      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        const event = parseHudsonVoiceEventLine(line);
        if (event) yield event;
        newlineIndex = buffer.indexOf('\n');
      }

      if (done) break;
    }

    buffer += decoder.decode();
    const trailingEvent = parseHudsonVoiceEventLine(buffer);
    if (trailingEvent) yield trailingEvent;
  } finally {
    reader.releaseLock();
  }
}

export async function probeHudsonVoiceAvailability(
  clientOrOptions: HudsonVoiceProbeClient | HudsonVoiceClientOptions,
): Promise<HudsonVoiceAvailability> {
  const client = 'health' in clientOrOptions
    ? clientOrOptions
    : createHudsonVoiceClient(clientOrOptions);

  try {
    const health = await client.health();
    const microphone = health.permissions?.microphone?.toLowerCase();
    if (microphone === 'denied' || microphone === 'restricted') return 'permission-denied';

    const status = health.status.toLowerCase();
    if (status === 'ready') return 'connected';
    if (status === 'starting' || status === 'warming') return 'warming';
    return 'error';
  } catch (error) {
    if (error instanceof HudsonVoiceClientError && error.code === 'http_error') return 'error';
    return 'unreachable';
  }
}

export function createHudsonVoiceClient(options: HudsonVoiceClientOptions): HudsonVoiceClient {
  const clientId = options.clientId ?? 'hudsonkit';

  const stopLiveSession = async (sessionId: string) => {
    await requestJson<void>(options, HUDSON_VOICE_API_PATHS.liveStop(sessionId), {
      method: 'POST',
      body: JSON.stringify({ clientId }),
    });
  };

  const cancelLiveSession = async (sessionId: string) => {
    await requestJson<void>(options, HUDSON_VOICE_API_PATHS.liveCancel(sessionId), {
      method: 'POST',
      body: JSON.stringify({ clientId }),
    });
  };

  return {
    health: () => requestJson<HudsonVoiceHealth>(options, HUDSON_VOICE_API_PATHS.health),

    probe: async () => {
      const availability = await probeHudsonVoiceAvailability(createHudsonVoiceClient(options));
      return availability === 'connected';
    },

    availability: () => probeHudsonVoiceAvailability(createHudsonVoiceClient(options)),

    getSettings: () => requestJson<{ settings: HudsonVoicePreferencesPayload }>(
      options,
      HUDSON_VOICE_API_PATHS.settings,
    ),

    updateSettings: (patch) =>
      requestJson<{ settings: HudsonVoicePreferencesPayload }>(options, HUDSON_VOICE_API_PATHS.settings, {
        method: 'PUT',
        body: JSON.stringify({ settings: patch }),
      }),

    listDevices: () => requestJson<HudsonVoiceDeviceList>(options, HUDSON_VOICE_API_PATHS.devices),

    setDefaultDevice: (deviceId: string) =>
      requestJson<HudsonVoiceDeviceList>(options, HUDSON_VOICE_API_PATHS.defaultDevice, {
        method: 'PUT',
        body: JSON.stringify({ clientId, deviceId }),
      }),

    startLiveSession: async (request: HudsonVoiceLiveSessionRequest = {}) => {
      const response = await requestStream(options, HUDSON_VOICE_API_PATHS.live, {
        method: 'POST',
        body: JSON.stringify({
          clientId,
          ...request,
        }),
      });
      let sessionId: string | null = null;

      const events = (async function* () {
        for await (const event of parseHudsonVoiceEventStream(response.body!)) {
          sessionId = sessionId ?? extractSessionId(event);
          yield event;
        }
      })();

      return {
        get sessionId() {
          return sessionId;
        },
        events,
        stop: async () => {
          if (!sessionId) {
            throw new HudsonVoiceClientError(
              'session_id_missing',
              'Hudson voice session has not emitted a session id yet.',
            );
          }
          await stopLiveSession(sessionId);
        },
        cancel: async () => {
          if (!sessionId) {
            throw new HudsonVoiceClientError(
              'session_id_missing',
              'Hudson voice session has not emitted a session id yet.',
            );
          }
          await cancelLiveSession(sessionId);
        },
      };
    },

    stopLiveSession,
    cancelLiveSession,
  };
}

export function createHudsonVoiceDaemonClient(
  options: HudsonVoiceDaemonClientOptions = {},
): HudsonVoiceClient {
  const clientId = options.clientId ?? 'hudsonkit';

  const stopLiveSession = async (sessionId: string) => {
    await callHudsonVoiceDaemonRpc(options, 'transcribe.stopSession', { clientId, sessionId });
  };

  const cancelLiveSession = async (sessionId: string) => {
    await callHudsonVoiceDaemonRpc(options, 'transcribe.cancelSession', { clientId, sessionId });
  };

  return {
    health: async () => normalizeDaemonHealth(await callHudsonVoiceDaemonRpc(options, 'health')),

    probe: async () => {
      const availability = await probeHudsonVoiceAvailability(createHudsonVoiceDaemonClient(options));
      return availability === 'connected';
    },

    availability: () => probeHudsonVoiceAvailability(createHudsonVoiceDaemonClient(options)),

    getSettings: async () => {
      throw new HudsonVoiceClientError(
        'unsupported',
        'Hudson voice settings are available through the /api/hudson-voice proxy.',
      );
    },

    updateSettings: async () => {
      throw new HudsonVoiceClientError(
        'unsupported',
        'Hudson voice settings are available through the /api/hudson-voice proxy.',
      );
    },

    listDevices: async () => ({ devices: [] }),

    setDefaultDevice: async (deviceId: string) => ({
      devices: [],
      selectedDeviceId: deviceId,
    }),

    startLiveSession: (request: HudsonVoiceLiveSessionRequest = {}) =>
      startHudsonVoiceDaemonLiveSession(options, {
        clientId,
        ...request,
      }),

    stopLiveSession,
    cancelLiveSession,
  };
}
