// ---------------------------------------------------------------------------
// Core types for @hudsonkit/ai
// Spec: specs/hud-006-ai-backends.md § Core API
// ---------------------------------------------------------------------------

// ---- Messages ----

export interface ContentPart {
  type: 'text' | 'image';
  text?: string;
  url?: string;
}

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | ContentPart[];
}

// ---- Capabilities ----

export interface BackendCapabilities {
  /** Stream events as they arrive (default true). */
  streaming?: boolean;
  /** Maintains persistent sessions across dispatches. */
  sessions?: boolean;
  /** How credentials are sourced. */
  auth?: 'none' | 'api-key' | 'oauth';
  /** Whether a relay service is required. */
  relay?: 'required' | 'optional' | 'none';
  /** Multi-provider — exposes a model picker in the UI. */
  models?: boolean;
}

// ---- Stream events ----

export type StreamEvent<TMeta = unknown> =
  | { type: 'text'; delta: string }
  | { type: 'reasoning'; delta: string }
  | { type: 'tool_call'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; id: string; output: unknown; error?: string }
  | { type: 'usage'; input: number; output: number; cost?: number }
  | { type: 'session'; sessionRef: string }
  | { type: 'error'; message: string; recoverable: boolean }
  | { type: 'done'; meta?: TMeta };

// ---- Dispatch request ----

export interface DispatchRequest<Cfg = unknown> {
  conversationId: string;
  sessionRef?: string;
  cwd?: string;
  messages: Message[];
  system?: string;
  input: string;
  toolset?: string | import('./toolsets/types').ToolsetDefinition;
  intents?: AppIntent[];
  config: Cfg;
  signal?: AbortSignal;
}

export interface AppIntent {
  commandId: string;
  title: string;
  description: string;
  category?: string;
  keywords?: string[];
  shortcut?: string;
  dangerous?: boolean;
  params?: {
    name: string;
    description: string;
    type: string;
    optional?: boolean;
    enum?: string[];
  }[];
}

// ---- Dispatch result ----

export interface DispatchResult<TMeta = unknown> {
  reply: string;
  toolCalls?: { id: string; name: string; input: unknown; output?: unknown }[];
  usage?: { input: number; output: number; cost?: number };
  sessionRef?: string;
  meta?: TMeta;
}

// ---- Backend interface ----

export interface Backend<Cfg = unknown, TMeta = unknown> {
  id: string;
  label: string;
  surface: 'chat' | 'terminal';
  capabilities: BackendCapabilities;

  /** Availability check. Returns `{ available: false, reason }` to drive UI affordances. */
  status?(config: Cfg): Promise<{ available: boolean; reason?: string }>;

  /** Streaming dispatch — the primary path. */
  stream(req: DispatchRequest<Cfg>): AsyncIterable<StreamEvent<TMeta>>;

  /** Non-streaming dispatch. Default: consume stream() and aggregate. */
  dispatch?(req: DispatchRequest<Cfg>): Promise<DispatchResult<TMeta>>;

  /** Session forking — only when capabilities.sessions is true. */
  fork?(req: { sessionRef?: string }): Promise<{ sessionRef?: string }>;
}
