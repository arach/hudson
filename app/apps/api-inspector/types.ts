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
  GET: 'text-emerald-700 dark:text-emerald-400',
  POST: 'text-amber-700 dark:text-amber-400',
  PUT: 'text-blue-700 dark:text-blue-400',
  PATCH: 'text-cyan-700 dark:text-cyan-400',
  DELETE: 'text-red-700 dark:text-red-400',
  HEAD: 'text-muted-foreground',
  OPTIONS: 'text-muted-foreground',
};

export const METHOD_BG_COLORS: Record<HttpMethod, string> = {
  GET: 'bg-emerald-700/10 dark:bg-emerald-500/10 border-emerald-700/30 dark:border-emerald-500/20',
  POST: 'bg-amber-700/10 dark:bg-amber-500/10 border-amber-700/30 dark:border-amber-500/20',
  PUT: 'bg-blue-700/10 dark:bg-blue-500/10 border-blue-700/30 dark:border-blue-500/20',
  PATCH: 'bg-cyan-700/10 dark:bg-cyan-500/10 border-cyan-700/30 dark:border-cyan-500/20',
  DELETE: 'bg-red-700/10 dark:bg-red-500/10 border-red-700/30 dark:border-red-500/20',
  HEAD: 'bg-muted/40 border-border/40',
  OPTIONS: 'bg-muted/40 border-border/40',
};

export const STATUS_COLORS: Record<string, string> = {
  '2': 'text-emerald-700 dark:text-emerald-400',
  '3': 'text-blue-700 dark:text-blue-400',
  '4': 'text-amber-700 dark:text-amber-400',
  '5': 'text-red-700 dark:text-red-400',
};

export function getStatusColor(status: number): string {
  return STATUS_COLORS[String(status)[0]] ?? 'text-muted-foreground';
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
