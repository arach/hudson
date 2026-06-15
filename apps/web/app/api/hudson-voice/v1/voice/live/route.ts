import {
  HUDSON_VOICE_PROXY_STREAM_CONTENT_TYPE,
  assertHudsonVoiceSameOriginRequest,
  createHudsonVoiceRpcPayload,
  jsonHudsonVoiceError,
  openHudsonVoiceRuntimeSocket,
  parseHudsonVoiceRpcEnvelope,
  readHudsonVoiceRuntimeCapability,
  type HudsonVoiceRpcEnvelope,
} from '@/app/lib/hudsonVoiceRuntime';
import {
  createHudsonVoiceSessionDefaults,
  readHudsonVoicePreferences,
} from '@/app/lib/hudsonVoicePreferences';

export const runtime = 'nodejs';

interface HudsonVoiceLiveEvent {
  event: string;
  sessionId?: string;
  data: Record<string, unknown>;
}

export async function POST(request: Request) {
  try {
    assertHudsonVoiceSameOriginRequest(request);
    const body = await readJsonObject(request);
    const preferences = readHudsonVoicePreferences();
    const params = {
      ...createHudsonVoiceSessionDefaults(preferences),
      ...cleanLiveSessionRequest(body),
    };
    const runtimeCapability = readHudsonVoiceRuntimeCapability();
    const rpc = createHudsonVoiceRpcPayload(runtimeCapability, 'transcribe.startSession', params);
    const encoder = new TextEncoder();
    const socket = openHudsonVoiceRuntimeSocket(runtimeCapability);
    let cleanupOnCancel = () => {
      socket.close();
    };

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;
        let sessionId: string | null = null;
        const timeout = setTimeout(() => {
          emitError('Hudson voice runtime did not start a session in time.');
          close();
        }, 30_000);

        const emit = (event: HudsonVoiceLiveEvent) => {
          if (closed) return;
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        };

        const emitError = (message: string) => {
          emit({
            event: 'session.error',
            sessionId: sessionId ?? undefined,
            data: { message },
          });
        };

        const cleanup = () => {
          if (closed) return;
          closed = true;
          clearTimeout(timeout);
          socket.removeAllListeners();
          if (socket.readyState === 0 || socket.readyState === 1) {
            socket.close();
          }
        };

        const close = () => {
          if (closed) return;
          cleanup();
          controller.close();
        };

        cleanupOnCancel = cleanup;

        socket.on('open', () => {
          socket.send(JSON.stringify(rpc));
        });

        socket.on('message', (raw) => {
          let payload: HudsonVoiceRpcEnvelope | null;
          try {
            payload = parseHudsonVoiceRpcEnvelope(raw);
          } catch (error) {
            emitError(error instanceof Error ? error.message : 'Hudson voice runtime returned invalid JSON.');
            close();
            return;
          }
          if (!payload || payload.id !== rpc.id) return;

          if (payload.error) {
            emitError(typeof payload.error === 'string' ? payload.error : JSON.stringify(payload.error));
            close();
            return;
          }

          const event = normalizeLiveEvent(payload);
          if (event) {
            sessionId = sessionId ?? extractSessionId(event);
            emit(event);
            if (isTerminalLiveEvent(event)) close();
            return;
          }

          const result = payload.result && typeof payload.result === 'object'
            ? payload.result as Record<string, unknown>
            : {};
          if (!sessionId && typeof result.sessionId === 'string') {
            sessionId = result.sessionId;
          }
          if (typeof result.text === 'string') {
            emit({
              event: 'session.final',
              sessionId: sessionId ?? undefined,
              data: result,
            });
            close();
          }
        });

        socket.on('error', (error) => {
          emitError(error instanceof Error ? error.message : 'Hudson voice runtime connection failed.');
          close();
        });

        socket.on('close', () => {
          if (closed) return;
          emitError('Hudson voice runtime closed the session.');
          close();
        });
      },
      cancel() {
        cleanupOnCancel();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': HUDSON_VOICE_PROXY_STREAM_CONTENT_TYPE,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return jsonHudsonVoiceError(error);
  }
}

function cleanLiveSessionRequest(body: Record<string, unknown>): Record<string, unknown> {
  const next = { ...body };
  for (const key of ['deviceId', 'modelId', 'language', 'mode']) {
    if (typeof next[key] === 'string' && next[key].trim()) {
      next[key] = next[key].trim();
    } else if (next[key] == null || next[key] === '') {
      delete next[key];
    }
  }
  return next;
}

async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => ({}));
  return body && typeof body === 'object' && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};
}

function normalizeLiveEvent(payload: HudsonVoiceRpcEnvelope): HudsonVoiceLiveEvent | null {
  if (typeof payload.event !== 'string' || !payload.event) return null;
  const data = payload.data && typeof payload.data === 'object'
    ? payload.data as Record<string, unknown>
    : {};
  const sessionId = typeof payload.sessionId === 'string'
    ? payload.sessionId
    : (typeof data.sessionId === 'string' ? data.sessionId : undefined);
  return { event: payload.event, sessionId, data };
}

function extractSessionId(event: HudsonVoiceLiveEvent): string | null {
  if (event.sessionId) return event.sessionId;
  const sessionId = event.data.sessionId;
  return typeof sessionId === 'string' ? sessionId : null;
}

function isTerminalLiveEvent(event: HudsonVoiceLiveEvent): boolean {
  if (event.event === 'session.final' || event.event === 'session.cancelled' || event.event === 'session.error') {
    return true;
  }
  if (event.event !== 'session.state') return false;
  const state = event.data.state;
  return state === 'done' || state === 'cancelled' || state === 'error';
}
