// ---------------------------------------------------------------------------
// API Inspector — Domain Types
// ---------------------------------------------------------------------------

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface KeyValuePair {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface ApiRequest {
  method: HttpMethod;
  url: string;
  headers: KeyValuePair[];
  params: KeyValuePair[];
  body: string;
  bodyType: 'json' | 'text' | 'none';
}

export interface ApiResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  bodyType: 'json' | 'text' | 'html' | 'xml' | 'binary';
  size: number;
  timing: ResponseTiming;
}

export interface ResponseTiming {
  startedAt: number;
  completedAt: number;
  durationMs: number;
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  request: ApiRequest;
  response: ApiResponse | null;
  error?: string;
}

export type RequestTab = 'params' | 'headers' | 'body';
export type ResponseTab = 'body' | 'headers';

export const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'text-emerald-400',
  POST: 'text-amber-400',
  PUT: 'text-blue-400',
  PATCH: 'text-cyan-400',
  DELETE: 'text-red-400',
  HEAD: 'text-neutral-400',
  OPTIONS: 'text-neutral-400',
};

export const METHOD_BG_COLORS: Record<HttpMethod, string> = {
  GET: 'bg-emerald-500/10 border-emerald-500/20',
  POST: 'bg-amber-500/10 border-amber-500/20',
  PUT: 'bg-blue-500/10 border-blue-500/20',
  PATCH: 'bg-cyan-500/10 border-cyan-500/20',
  DELETE: 'bg-red-500/10 border-red-500/20',
  HEAD: 'bg-neutral-500/10 border-neutral-500/20',
  OPTIONS: 'bg-neutral-500/10 border-neutral-500/20',
};

export const STATUS_COLORS: Record<string, string> = {
  '2': 'text-emerald-400',
  '3': 'text-blue-400',
  '4': 'text-amber-400',
  '5': 'text-red-400',
};

export function getStatusColor(status: number): string {
  return STATUS_COLORS[String(status)[0]] ?? 'text-neutral-400';
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function emptyKeyValue(): KeyValuePair {
  return { id: newId(), key: '', value: '', enabled: true };
}

export function defaultRequest(): ApiRequest {
  return {
    method: 'GET',
    url: '',
    headers: [emptyKeyValue()],
    params: [emptyKeyValue()],
    body: '',
    bodyType: 'none',
  };
}
