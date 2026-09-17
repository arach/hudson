import { ConversationError } from './types';

// ---------------------------------------------------------------------------
// Small wire helpers shared by the provider clients. Environment-neutral:
// they work in browsers and in Node without touching provider specifics.
// ---------------------------------------------------------------------------

export function toBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
}

export function fromBase64(text: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(text);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }
  return new Uint8Array(Buffer.from(text, 'base64'));
}

export function assertPCMChunk(chunk: Uint8Array): void {
  if (chunk.byteLength === 0 || chunk.byteLength % 2 !== 0) {
    throw new ConversationError(
      'invalid-audio-chunk',
      'Audio chunks must be complete little-endian PCM16 samples.',
    );
  }
}

/**
 * Resolve when the socket opens; reject on error, close-before-open, or a
 * bounded timeout. Injected transports that are already open (readyState 1)
 * resolve immediately.
 */
export function socketReady(
  socket: {
    addEventListener: (type: 'open' | 'error' | 'close', cb: () => void) => void;
    readyState?: number;
  },
  timeoutMs: number,
): Promise<void> {
  if (socket.readyState === 1) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (error?: ConversationError) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve();
    };
    const timer = setTimeout(
      () => settle(new ConversationError('connection-failed', 'The socket did not open in time.')),
      timeoutMs,
    );
    socket.addEventListener('open', () => settle());
    socket.addEventListener('error', () =>
      settle(new ConversationError('connection-failed', 'The socket failed to open.')));
    socket.addEventListener('close', () =>
      settle(new ConversationError('connection-failed', 'The socket closed before opening.')));
  });
}

function parseJSONObject(text: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function parseMessage(data: unknown): Record<string, unknown> | null {
  if (typeof data !== 'string') return null;
  return parseJSONObject(data);
}

async function decodeWireData(data: unknown): Promise<Record<string, unknown> | null> {
  if (typeof data === 'string') return parseJSONObject(data);
  try {
    if (data instanceof ArrayBuffer) {
      return parseJSONObject(new TextDecoder().decode(data));
    }
    if (ArrayBuffer.isView(data)) {
      return parseJSONObject(new TextDecoder().decode(data as Uint8Array));
    }
    const blobLike = data as { text?: () => Promise<string> } | null;
    if (blobLike && typeof blobLike.text === 'function') {
      return parseJSONObject(await blobLike.text());
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Message listener that decodes string, ArrayBuffer, typed-array, and Blob
 * frames, preserving arrival order even though Blob decoding is asynchronous.
 * Handler failures surface through `onFailure` as a safe correlated error —
 * they are never swallowed and never become unhandled rejections.
 */
export function createMessagePump(
  handler: (message: Record<string, unknown> | null) => void,
  onFailure?: (error: ConversationError) => void,
): (event: { data?: unknown }) => void {
  let chain: Promise<void> = Promise.resolve();
  return (event) => {
    chain = chain
      .then(async () => handler(await decodeWireData(event.data)))
      .catch(() => {
        onFailure?.(new ConversationError('provider-error', 'Message handling failed.'));
      });
  };
}

export function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
