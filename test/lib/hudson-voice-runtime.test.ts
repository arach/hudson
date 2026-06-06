import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  HUDSON_VOICE_RUNTIME_PATH_ENV,
  assertHudsonVoiceSameOriginRequest,
  createHudsonVoiceRpcPayload,
  readHudsonVoiceRuntimeCapability,
} from '@/app/lib/hudsonVoiceRuntime';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function writeRuntimeFile(overrides: Record<string, unknown> = {}, mode = 0o600) {
  const dir = mkdtempSync(join(tmpdir(), 'hudson-voice-runtime-'));
  tempDirs.push(dir);
  const filePath = join(dir, 'hudson-voice-runtime.json');
  writeFileSync(filePath, JSON.stringify({
    schemaVersion: 1,
    service: 'hudson-voice',
    transport: 'ws+json-rpc',
    host: '127.0.0.1',
    port: 54321,
    webSocketUrl: 'ws://127.0.0.1:54321',
    authToken: 'a'.repeat(43),
    pid: process.pid,
    startedAt: new Date().toISOString(),
    ...overrides,
  }));
  chmodSync(filePath, mode);
  return filePath;
}

function envForRuntime(filePath: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    [HUDSON_VOICE_RUNTIME_PATH_ENV]: filePath,
  };
}

describe('Hudson voice runtime capability', () => {
  it('reads a private loopback runtime file', () => {
    const filePath = writeRuntimeFile();
    const runtime = readHudsonVoiceRuntimeCapability(envForRuntime(filePath));

    expect(runtime).toMatchObject({
      service: 'hudson-voice',
      host: '127.0.0.1',
      port: 54321,
      authToken: 'a'.repeat(43),
    });
  });

  it('rejects world-readable runtime capabilities', () => {
    const filePath = writeRuntimeFile({}, 0o644);

    expect(() => readHudsonVoiceRuntimeCapability(envForRuntime(filePath))).toThrow(/not private/);
  });

  it('rejects non-loopback endpoints', () => {
    const filePath = writeRuntimeFile({
      host: '0.0.0.0',
      webSocketUrl: 'ws://0.0.0.0:54321',
    });

    expect(() => readHudsonVoiceRuntimeCapability(envForRuntime(filePath))).toThrow(/loopback/);
  });

  it('adds the private token to runtime RPC payloads', () => {
    const filePath = writeRuntimeFile();
    const runtime = readHudsonVoiceRuntimeCapability(envForRuntime(filePath));

    expect(createHudsonVoiceRpcPayload(runtime, 'health', { clientId: 'hudson-web' })).toMatchObject({
      method: 'health',
      params: {
        clientId: 'hudson-web',
        authToken: 'a'.repeat(43),
      },
    });
  });
});

describe('Hudson voice same-origin guard', () => {
  it('allows same-origin requests', () => {
    expect(() => assertHudsonVoiceSameOriginRequest(new Request('http://localhost:3500/api/hudson-voice/health', {
      headers: {
        origin: 'http://localhost:3500',
        'sec-fetch-site': 'same-origin',
      },
    }))).not.toThrow();
  });

  it('rejects cross-origin requests', () => {
    expect(() => assertHudsonVoiceSameOriginRequest(new Request('http://localhost:3500/api/hudson-voice/health', {
      headers: {
        origin: 'http://evil.example',
        'sec-fetch-site': 'cross-site',
      },
    }))).toThrow(/same-origin/);
  });
});
