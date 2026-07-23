import { HObservability, HObservabilityDefault } from './core';

const DEFAULT_MAX_ENTRIES = 100;
const DEFAULT_MAX_BODY_BYTES = 64 * 1024;
const STREAM_CONTENT_TYPES = ['text/event-stream', 'application/x-ndjson'];
const EXPORT_REDACTED_HEADERS = new Set([
  'authorization',
  'cookie',
  'proxy-authorization',
  'set-cookie',
  'x-api-key',
]);
const EXPORT_REDACTED_FIELDS = new Set([
  'access_token',
  'api_key',
  'password',
  'refresh_token',
  'secret',
  'token',
]);

export type HudsonNetworkStatus = 'pending' | 'ok' | 'error';

export interface HudsonCapturedBody {
  text: string;
  capturedSize: number;
  originalSize?: number;
  mimeType?: string;
  truncated: boolean;
  unavailable?: 'stream' | 'opaque' | 'unreadable';
}

export interface HudsonNetworkTiming {
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
}

export interface HudsonNetworkRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: HudsonCapturedBody;
}

export interface HudsonNetworkResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body?: HudsonCapturedBody;
  size?: number;
}

export interface HudsonNetworkEntry {
  schemaVersion: 1;
  id: string;
  requestId: string;
  traceId: string;
  timestamp: number;
  status: HudsonNetworkStatus;
  request: HudsonNetworkRequest;
  response?: HudsonNetworkResponse;
  timing: HudsonNetworkTiming;
  error?: { name?: string; message: string };
}

export interface HudsonNetworkStoreOptions {
  maxEntries?: number;
}

export type HudsonNetworkListener = () => void;
export type HudsonFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class HudsonNetworkStore {
  private entries: HudsonNetworkEntry[] = [];
  private readonly listeners = new Set<HudsonNetworkListener>();
  private readonly maxEntries: number;

  constructor(options: HudsonNetworkStoreOptions = {}) {
    this.maxEntries = Math.max(0, options.maxEntries ?? DEFAULT_MAX_ENTRIES);
  }

  snapshot() {
    return this.entries;
  }

  subscribe(listener: HudsonNetworkListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  add(entry: HudsonNetworkEntry) {
    if (this.maxEntries === 0) return entry;
    this.entries = [entry, ...this.entries].slice(0, this.maxEntries);
    this.notify();
    return entry;
  }

  update(id: string, update: (entry: HudsonNetworkEntry) => HudsonNetworkEntry) {
    let changed = false;
    this.entries = this.entries.map((entry) => {
      if (entry.id !== id) return entry;
      changed = true;
      return update(entry);
    });
    if (changed) this.notify();
  }

  clear() {
    if (this.entries.length === 0) return;
    this.entries = [];
    this.notify();
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        // Inspector listeners must never affect product requests.
      }
    }
  }
}

export interface HudsonFetchCaptureOptions {
  store?: HudsonNetworkStore;
  observability?: HObservability;
  maxBodyBytes?: number;
  now?: () => number;
  shouldCapture?: (request: Request) => boolean;
}

function headersToRecord(headers: Headers) {
  return Object.fromEntries(headers.entries());
}

function serializeError(error: unknown) {
  if (error instanceof Error) return { name: error.name, message: error.message };
  return { message: String(error) };
}

function contentLength(headers: Headers) {
  const raw = headers.get('content-length');
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function unavailableBody(
  unavailable: HudsonCapturedBody['unavailable'],
  headers: Headers,
): HudsonCapturedBody {
  return {
    text: '',
    capturedSize: 0,
    originalSize: contentLength(headers),
    mimeType: headers.get('content-type') ?? undefined,
    truncated: false,
    unavailable,
  };
}

async function readBoundedBody(
  message: Request | Response,
  maxBodyBytes: number,
): Promise<HudsonCapturedBody | undefined> {
  if (!message.body) return undefined;
  const mimeType = message.headers.get('content-type') ?? undefined;
  if (mimeType && STREAM_CONTENT_TYPES.some((type) => mimeType.includes(type))) {
    return unavailableBody('stream', message.headers);
  }
  if (message instanceof Response && message.type === 'opaque') {
    return unavailableBody('opaque', message.headers);
  }

  try {
    const reader = message.body.getReader();
    const chunks: Uint8Array[] = [];
    let capturedSize = 0;
    let truncated = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      const remaining = Math.max(0, maxBodyBytes - capturedSize);
      if (value.byteLength > remaining) {
        if (remaining > 0) chunks.push(value.slice(0, remaining));
        capturedSize += remaining;
        truncated = true;
        void reader.cancel().catch(() => undefined);
        break;
      }
      chunks.push(value);
      capturedSize += value.byteLength;
      if (capturedSize === maxBodyBytes) {
        const next = await reader.read();
        if (!next.done) {
          truncated = true;
          void reader.cancel().catch(() => undefined);
        }
        break;
      }
    }

    const bytes = new Uint8Array(capturedSize);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return {
      text: new TextDecoder().decode(bytes),
      capturedSize,
      originalSize: contentLength(message.headers),
      mimeType,
      truncated,
    };
  } catch {
    return unavailableBody('unreadable', message.headers);
  }
}

function cloneRequestForCapture(input: RequestInfo | URL, init?: RequestInit) {
  try {
    return new Request(input, init);
  } catch {
    return null;
  }
}

export function createHudsonFetchCapture(
  originalFetch: HudsonFetch,
  options: HudsonFetchCaptureOptions = {},
): HudsonFetch {
  const store = options.store ?? HudsonNetworkCaptureDefault;
  const observability = options.observability ?? HObservabilityDefault;
  const maxBodyBytes = Math.max(0, options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES);
  const now = options.now ?? (() => performance.now());

  return async function hudsonCapturedFetch(input, init) {
    const request = cloneRequestForCapture(input, init);
    if (!request || options.shouldCapture?.(request) === false) {
      return originalFetch(input, init);
    }

    const startedAt = now();
    const span = observability.trace.start('http.fetch', {
      category: 'network',
      data: { method: request.method, url: request.url },
    });
    const requestId = span.event.id;
    const entry: HudsonNetworkEntry = {
      schemaVersion: 1,
      id: requestId,
      requestId,
      traceId: span.event.traceId,
      timestamp: Date.now(),
      status: 'pending',
      request: {
        method: request.method,
        url: request.url,
        headers: headersToRecord(request.headers),
      },
      timing: { startedAt },
    };
    store.add(entry);

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      void readBoundedBody(request, maxBodyBytes).then((body) => {
        if (!body) return;
        store.update(requestId, (current) => ({
          ...current,
          request: { ...current.request, body },
        }));
      });
    }

    try {
      const response = await originalFetch(input, init);
      const completedAt = now();
      const durationMs = Math.max(0, completedAt - startedAt);
      const responseSucceeded = response.ok || response.type === 'opaque';
      store.update(requestId, (current) => ({
        ...current,
        status: responseSucceeded ? 'ok' : 'error',
        response: {
          status: response.status,
          statusText: response.statusText,
          headers: headersToRecord(response.headers),
          size: contentLength(response.headers),
        },
        timing: { ...current.timing, completedAt, durationMs },
      }));

      if (responseSucceeded) {
        span.end({
          requestId,
          status: response.status,
          durationMs,
          ...(response.type === 'opaque' ? { opaque: true } : {}),
        });
      } else {
        span.error(new Error(`HTTP ${response.status}`), {
          requestId,
          status: response.status,
          durationMs,
        });
      }

      void readBoundedBody(response.clone(), maxBodyBytes).then((body) => {
        if (!body) return;
        store.update(requestId, (current) => ({
          ...current,
          response: current.response ? { ...current.response, body } : current.response,
        }));
      });

      return response;
    } catch (error) {
      const completedAt = now();
      const durationMs = Math.max(0, completedAt - startedAt);
      store.update(requestId, (current) => ({
        ...current,
        status: 'error',
        timing: { ...current.timing, completedAt, durationMs },
        error: serializeError(error),
      }));
      span.error(error, { requestId, durationMs });
      throw error;
    }
  };
}

let browserInstall: {
  original: HudsonFetch;
  wrapped: HudsonFetch;
  refs: number;
} | null = null;

export function installHudsonFetchCapture(options: HudsonFetchCaptureOptions = {}) {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return () => undefined;

  if (browserInstall && window.fetch === browserInstall.wrapped) {
    browserInstall.refs += 1;
    return () => uninstallBrowserCapture();
  }

  const original = window.fetch;
  const invokeOriginal: HudsonFetch = (input, init) => original.call(window, input, init);
  const wrapped = createHudsonFetchCapture(invokeOriginal, options);
  browserInstall = { original, wrapped, refs: 1 };
  window.fetch = wrapped as typeof window.fetch;
  return () => uninstallBrowserCapture();
}

function uninstallBrowserCapture() {
  if (!browserInstall || typeof window === 'undefined') return;
  browserInstall.refs -= 1;
  if (browserInstall.refs > 0) return;
  if (window.fetch === browserInstall.wrapped) {
    window.fetch = browserInstall.original as typeof window.fetch;
  }
  browserInstall = null;
}

function sanitizeHeaders(headers: Record<string, string>) {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [
    key,
    EXPORT_REDACTED_HEADERS.has(key.toLowerCase()) ? '[redacted]' : value,
  ]));
}

function isExportRedactedField(key: string) {
  return EXPORT_REDACTED_FIELDS.has(key.toLowerCase().replace(/-/g, '_'));
}

function sanitizeStructuredValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeStructuredValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [
    key,
    isExportRedactedField(key) ? '[redacted]' : sanitizeStructuredValue(child),
  ]));
}

function sanitizeBody(body?: HudsonCapturedBody) {
  if (!body?.text) return body;
  try {
    return { ...body, text: JSON.stringify(sanitizeStructuredValue(JSON.parse(body.text)), null, 2) };
  } catch {
    return body;
  }
}

function sanitizeUrl(url: string) {
  try {
    const parsed = new URL(url);
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (isExportRedactedField(key)) parsed.searchParams.set(key, '[redacted]');
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export function sanitizeHudsonNetworkEntry(entry: HudsonNetworkEntry): HudsonNetworkEntry {
  return {
    ...entry,
    request: {
      ...entry.request,
      url: sanitizeUrl(entry.request.url),
      headers: sanitizeHeaders(entry.request.headers),
      body: sanitizeBody(entry.request.body),
    },
    response: entry.response ? {
      ...entry.response,
      headers: sanitizeHeaders(entry.response.headers),
      body: sanitizeBody(entry.response.body),
    } : undefined,
  };
}

function formatHeaders(headers: Record<string, string>) {
  const entries = Object.entries(headers);
  return entries.length === 0 ? '_None_' : entries.map(([key, value]) => `- ${key}: ${value}`).join('\n');
}

function formatBody(body?: HudsonCapturedBody) {
  if (!body) return '_None_';
  if (body.unavailable) return `_Body not captured (${body.unavailable})._`;
  const suffix = body.truncated ? '\n\n_[truncated]_' : '';
  return `\`\`\`\n${body.text}\n\`\`\`${suffix}`;
}

export function formatHudsonNetworkEntryForAgent(entry: HudsonNetworkEntry) {
  const safe = sanitizeHudsonNetworkEntry(entry);
  const responseLine = safe.response
    ? `${safe.response.status} ${safe.response.statusText}`.trim()
    : safe.error?.message ?? safe.status;
  return [
    '# Hudson network capture',
    '',
    `- Request ID: ${safe.requestId}`,
    `- Trace ID: ${safe.traceId}`,
    `- Request: ${safe.request.method} ${safe.request.url}`,
    `- Result: ${responseLine}`,
    `- Duration: ${safe.timing.durationMs?.toFixed(1) ?? 'pending'} ms`,
    '',
    '## Request headers',
    '',
    formatHeaders(safe.request.headers),
    '',
    '## Request body',
    '',
    formatBody(safe.request.body),
    '',
    '## Response headers',
    '',
    formatHeaders(safe.response?.headers ?? {}),
    '',
    '## Response body',
    '',
    formatBody(safe.response?.body),
    '',
  ].join('\n');
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function formatHudsonNetworkEntryAsCurl(entry: HudsonNetworkEntry) {
  const safe = sanitizeHudsonNetworkEntry(entry);
  const parts = ['curl', '-X', safe.request.method, shellQuote(safe.request.url)];
  for (const [key, value] of Object.entries(safe.request.headers)) {
    parts.push('-H', shellQuote(`${key}: ${value}`));
  }
  if (safe.request.body?.text) parts.push('--data-raw', shellQuote(safe.request.body.text));
  return parts.join(' ');
}

export const HudsonNetworkCaptureDefault = new HudsonNetworkStore();
