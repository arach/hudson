import { describe, expect, it } from 'vitest';
import {
  HudsonVoiceClientError,
  createHudsonVoiceDaemonClient,
  createHudsonVoiceClient,
  parseHudsonVoiceNdjson,
  probeHudsonVoiceAvailability,
} from '@/packages/web/hudsonkit/src/lib/hudsonVoiceClient';

function ndjsonResponse(lines: unknown[]) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`${lines.map(line => JSON.stringify(line)).join('\n')}\n`));
      controller.close();
    },
  });

  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'application/x-ndjson' },
  });
}

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  static instances: MockWebSocket[] = [];

  readonly sent: string[] = [];
  readonly url: string;
  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  constructor(url: string | URL) {
    this.url = url.toString();
    MockWebSocket.instances.push(this);
    queueMicrotask(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.({} as Event);
    });
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({} as CloseEvent);
  }

  emit(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent);
  }
}

function resetMockSockets() {
  MockWebSocket.instances = [];
}

async function waitForSent(index: number) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (MockWebSocket.instances[index]?.sent.length) break;
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  expect(MockWebSocket.instances[index]?.sent.length).toBeGreaterThan(0);
  const socket = MockWebSocket.instances[index]!;
  return {
    socket,
    request: JSON.parse(socket.sent[0]!) as { id: string; method: string; params?: Record<string, unknown> },
  };
}

describe('Hudson voice client', () => {
  it('parses live-session NDJSON and normalizes session ids from event data', () => {
    const events = parseHudsonVoiceNdjson([
      JSON.stringify({ event: 'session.started', data: { sessionId: 'voice_1', state: 'starting' } }),
      JSON.stringify({ event: 'session.partial', sessionId: 'voice_1', data: { text: 'open' } }),
      JSON.stringify({ event: 'session.final', data: { sessionId: 'voice_1', text: 'Open the terminal.' } }),
      '',
    ].join('\n'));

    expect(events).toEqual([
      { event: 'session.started', sessionId: 'voice_1', data: { sessionId: 'voice_1', state: 'starting' } },
      { event: 'session.partial', sessionId: 'voice_1', data: { text: 'open' } },
      { event: 'session.final', sessionId: 'voice_1', data: { sessionId: 'voice_1', text: 'Open the terminal.' } },
    ]);
  });

  it('sends Hudson-owned health requests with caller auth headers', async () => {
    const calls: Array<{ url: string; auth: string | null }> = [];
    const client = createHudsonVoiceClient({
      baseUrl: 'http://127.0.0.1:42138',
      token: 'local-token',
      fetch: async (url, init) => {
        calls.push({
          url: String(url),
          auth: new Headers(init?.headers).get('Authorization'),
        });
        return Response.json({
          service: 'hudson-voice',
          status: 'ready',
          permissions: { microphone: 'granted' },
        });
      },
    });

    await expect(client.health()).resolves.toMatchObject({
      service: 'hudson-voice',
      status: 'ready',
    });
    expect(calls).toEqual([
      { url: 'http://127.0.0.1:42138/health', auth: 'Bearer local-token' },
    ]);
  });

  it('maps health states to Hudson voice availability', async () => {
    await expect(probeHudsonVoiceAvailability({
      health: async () => ({
        service: 'hudson-voice',
        status: 'ready',
        permissions: { microphone: 'granted' },
      }),
    })).resolves.toBe('connected');

    await expect(probeHudsonVoiceAvailability({
      health: async () => ({
        service: 'hudson-voice',
        status: 'warming',
        permissions: { microphone: 'granted' },
      }),
    })).resolves.toBe('warming');

    await expect(probeHudsonVoiceAvailability({
      health: async () => ({
        service: 'hudson-voice',
        status: 'ready',
        permissions: { microphone: 'denied' },
      }),
    })).resolves.toBe('permission-denied');
  });

  it('streams live events and posts stop to the emitted session id', async () => {
    const calls: Array<{ url: string; method: string; body: unknown }> = [];
    const client = createHudsonVoiceClient({
      baseUrl: 'http://127.0.0.1:42138',
      clientId: 'hudson-web',
      fetch: async (url, init) => {
        calls.push({
          url: String(url),
          method: init?.method ?? 'GET',
          body: init?.body ? JSON.parse(String(init.body)) : null,
        });

        if (String(url).endsWith('/v1/voice/live')) {
          return ndjsonResponse([
            { event: 'session.started', data: { sessionId: 'voice_1', state: 'starting' } },
            { event: 'session.final', data: { sessionId: 'voice_1', text: 'Open the terminal.' } },
          ]);
        }

        return new Response(null, { status: 204 });
      },
    });

    const session = await client.startLiveSession({ surface: 'terminal' });
    const events = [];
    for await (const event of session.events) events.push(event);

    expect(session.sessionId).toBe('voice_1');
    expect(events).toHaveLength(2);

    await session.stop();

    expect(calls).toEqual([
      {
        url: 'http://127.0.0.1:42138/v1/voice/live',
        method: 'POST',
        body: { clientId: 'hudson-web', surface: 'terminal' },
      },
      {
        url: 'http://127.0.0.1:42138/v1/voice/live/voice_1/stop',
        method: 'POST',
        body: { clientId: 'hudson-web' },
      },
    ]);
  });

  it('reports HTTP failures as typed Hudson voice client errors', async () => {
    const client = createHudsonVoiceClient({
      baseUrl: 'http://127.0.0.1:42138',
      fetch: async () => new Response('not ready', { status: 503 }),
    });

    await expect(client.health()).rejects.toMatchObject({
      name: 'HudsonVoiceClientError',
      code: 'http_error',
      status: 503,
      message: 'not ready',
    } satisfies Partial<HudsonVoiceClientError>);
  });

  it('talks to the Hudson-owned daemon over WebSocket health RPC', async () => {
    resetMockSockets();
    const client = createHudsonVoiceDaemonClient({
      clientId: 'hudson-web',
      WebSocket: MockWebSocket as unknown as typeof WebSocket,
    });

    const healthPromise = client.health();
    const { socket, request } = await waitForSent(0);
    expect(socket.url).toBe('ws://127.0.0.1:42138');
    expect(request.method).toBe('health');

    socket.emit({
      id: request.id,
      result: {
        service: 'Vox',
        version: '0.3.3',
        port: 42138,
        pid: 123,
        startedAt: '2026-06-01T01:42:04Z',
      },
    });

    await expect(healthPromise).resolves.toMatchObject({
      service: 'Hudson',
      status: 'ready',
      voxRuntime: {
        service: 'Vox',
        port: 42138,
      },
    });
  });

  it('preserves daemon health status and permission details', async () => {
    resetMockSockets();
    const client = createHudsonVoiceDaemonClient({
      clientId: 'hudson-web',
      WebSocket: MockWebSocket as unknown as typeof WebSocket,
    });

    const healthPromise = client.health();
    const healthRequest = await waitForSent(0);
    expect(healthRequest.request.method).toBe('health');

    healthRequest.socket.emit({
      id: healthRequest.request.id,
      result: {
        service: 'hudson-voice',
        status: 'warming',
        version: '0.1.0',
        permissions: { microphone: 'denied' },
        voxRuntime: { status: 'starting', version: '0.3.3' },
      },
    });

    await expect(healthPromise).resolves.toMatchObject({
      service: 'Hudson',
      status: 'warming',
      permissions: { microphone: 'denied' },
      voxRuntime: {
        status: 'starting',
        version: '0.3.3',
      },
    });

    const availabilityPromise = client.availability();
    const availabilityRequest = await waitForSent(1);
    expect(availabilityRequest.request.method).toBe('health');
    availabilityRequest.socket.emit({
      id: availabilityRequest.request.id,
      result: {
        status: 'warming',
        permissions: { microphone: 'denied' },
      },
    });

    await expect(availabilityPromise).resolves.toBe('permission-denied');
  });

  it('starts daemon live sessions and stops by emitted session id', async () => {
    resetMockSockets();
    const client = createHudsonVoiceDaemonClient({
      clientId: 'hudson-web',
      WebSocket: MockWebSocket as unknown as typeof WebSocket,
    });

    const startPromise = client.startLiveSession({ surface: 'terminal' });
    const started = await waitForSent(0);
    expect(started.request.method).toBe('transcribe.startSession');
    expect(started.request.params).toMatchObject({
      clientId: 'hudson-web',
      surface: 'terminal',
    });

    started.socket.emit({
      id: started.request.id,
      event: 'session.state',
      sessionId: 'voice_1',
      data: { state: 'recording' },
    });

    const session = await startPromise;
    expect(session.sessionId).toBe('voice_1');
    const eventsPromise = (async () => {
      const events = [];
      for await (const event of session.events) events.push(event);
      return events;
    })();

    const stopPromise = session.stop();
    const stopped = await waitForSent(1);
    expect(stopped.request.method).toBe('transcribe.stopSession');
    expect(stopped.request.params).toMatchObject({
      clientId: 'hudson-web',
      sessionId: 'voice_1',
    });
    stopped.socket.emit({ id: stopped.request.id, result: { stopped: true, sessionId: 'voice_1' } });
    await expect(stopPromise).resolves.toBeUndefined();

    started.socket.emit({
      id: started.request.id,
      event: 'session.final',
      sessionId: 'voice_1',
      data: { text: 'Open the terminal.' },
    });
    started.socket.emit({ id: started.request.id, result: { sessionId: 'voice_1', text: 'Open the terminal.' } });

    await expect(eventsPromise).resolves.toEqual([
      { event: 'session.state', sessionId: 'voice_1', data: { state: 'recording' } },
      { event: 'session.final', sessionId: 'voice_1', data: { text: 'Open the terminal.' } },
    ]);
  });

  it('closes daemon live streams cleanly after a final event', async () => {
    resetMockSockets();
    const client = createHudsonVoiceDaemonClient({
      clientId: 'hudson-web',
      WebSocket: MockWebSocket as unknown as typeof WebSocket,
    });

    const startPromise = client.startLiveSession({ surface: 'terminal' });
    const started = await waitForSent(0);
    started.socket.emit({
      id: started.request.id,
      event: 'session.state',
      sessionId: 'voice_1',
      data: { state: 'recording' },
    });

    const session = await startPromise;
    const eventsPromise = (async () => {
      const events = [];
      for await (const event of session.events) events.push(event);
      return events;
    })();

    started.socket.emit({
      id: started.request.id,
      event: 'session.final',
      sessionId: 'voice_1',
      data: { text: 'Open the terminal.' },
    });
    started.socket.close();

    await expect(eventsPromise).resolves.toEqual([
      { event: 'session.state', sessionId: 'voice_1', data: { state: 'recording' } },
      { event: 'session.final', sessionId: 'voice_1', data: { text: 'Open the terminal.' } },
    ]);
  });
});
