export interface HostEnvelope<T = unknown> {
  v: 1; requestId: string | null; subjectId: string | null; revision: string | null;
  kind: string; payload: T;
}
export interface HostTransport {
  request(message: HostEnvelope): Promise<unknown>;
  subscribe(listener: (message: unknown) => void): () => void;
}
export class HostBridgeError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}
export function isHostEnvelope(value: unknown): value is HostEnvelope {
  if (!value || typeof value !== 'object') return false;
  const m = value as Record<string, unknown>;
  return m.v === 1 && (m.requestId === null || typeof m.requestId === 'string') &&
    (m.subjectId === null || typeof m.subjectId === 'string') &&
    (m.revision === null || typeof m.revision === 'string') && typeof m.kind === 'string' &&
    !!m.payload && typeof m.payload === 'object' && !Array.isArray(m.payload);
}
/** Hash revisions are equality tokens; generation also guards same-revision refreshes. */
export function createRevisionGuard() {
  let generation = 0;
  let revision: string | null = null;
  return {
    invalidate(next: string | null = revision) { revision = next; generation += 1; },
    capture: () => ({ generation, revision }),
    accepts: (token: { generation: number; revision: string | null }, replyRevision: string | null) =>
      token.generation === generation && (token.revision === null || token.revision === replyRevision),
  };
}
export function createHostBridge(transport: HostTransport, timeoutMs = 8000) {
  let sequence = 0;
  let disposed = false;
  const prefix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  const listeners = new Set<(event: HostEnvelope) => void>();
  const cancellations = new Set<() => void>();
  const unsubscribe = transport.subscribe(message => {
    if (!disposed && isHostEnvelope(message) && message.requestId === null) listeners.forEach(fn => fn(message));
  });
  return {
    subscribe(listener: (event: HostEnvelope) => void) {
      listeners.add(listener); return () => { listeners.delete(listener); };
    },
    async request<T>(kind: string, subjectId: string | null, revision: string | null, payload: object = {}): Promise<HostEnvelope<T>> {
      if (disposed) throw new HostBridgeError('disposed', 'Bridge is closed');
      const requestId = `${prefix}:${++sequence}`;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let cancel = () => {};
      try {
        const deadline = new Promise<never>((_, reject) => {
          cancel = () => reject(new HostBridgeError('disposed', 'Bridge is closed'));
          cancellations.add(cancel);
          timer = setTimeout(() => reject(new HostBridgeError('timeout', 'Host did not reply')), timeoutMs);
        });
        const reply = await Promise.race([transport.request({ v: 1, requestId, subjectId, revision, kind, payload }), deadline]);
        if (!isHostEnvelope(reply) || reply.requestId !== requestId ||
          (subjectId !== null && reply.subjectId !== subjectId) ||
          ![`${kind}.result`, 'error'].includes(reply.kind)) {
          throw new HostBridgeError('invalid_reply', 'Host reply did not match the request');
        }
        if (reply.kind === 'error') {
          const error = reply.payload as { code?: string; message?: string };
          throw new HostBridgeError(error.code ?? 'host_error', error.message ?? 'Host request failed');
        }
        if (revision !== null && reply.revision !== revision && kind === 'preview.project') {
          throw new HostBridgeError('stale_revision', 'Host reply used a different revision');
        }
        return reply as HostEnvelope<T>;
      } finally { clearTimeout(timer); cancellations.delete(cancel); }
    },
    dispose() { disposed = true; unsubscribe(); listeners.clear(); cancellations.forEach(cancel => cancel()); cancellations.clear(); },
  };
}
export type HostBridge = ReturnType<typeof createHostBridge>;
/** Adapter accepts an injected realm, making it usable without an ambient browser global. */
export function createWKReplyTransport(
  realm: EventTarget & { webkit?: { messageHandlers?: Record<string, { postMessage(message: HostEnvelope): Promise<unknown> }> } },
  handlerName = 'hudsonEditor',
  eventName = 'hudson:host-event',
): HostTransport {
  return {
    request(message) {
      const handler = realm.webkit?.messageHandlers?.[handlerName];
      if (!handler) return Promise.reject(new HostBridgeError('unsupported', 'Host handler unavailable'));
      return Promise.resolve(handler.postMessage(message));
    },
    subscribe(listener) {
      const receive = (event: Event) => listener((event as CustomEvent).detail);
      realm.addEventListener(eventName, receive);
      return () => realm.removeEventListener(eventName, receive);
    },
  };
}
