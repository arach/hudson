/** Minimal WebSocket interface — satisfied by both `ws` and Bun's ServerWebSocket. */
export interface RelaySocket {
  readonly readyState: number;
  send(data: string | Buffer): void;
}

export interface SessionInitMessage {
  type: 'session:init';
  cols: number;
  rows: number;
  systemPrompt?: string;
  /** Working directory for the PTY session. Defaults to $HOME. */
  cwd?: string;
  /** Files to bootstrap in the CWD before spawning the CLI. Keys are relative paths, values are file contents. Only written if the file doesn't already exist. */
  workspaceFiles?: Record<string, string>;
  /** How long (ms) to keep the PTY alive after the client disconnects. Defaults to 30 min. */
  orphanTTL?: number;
  /** PTY backend. 'pty' spawns a fresh process (default). 'tmux' attaches to a named tmux session. */
  backend?: 'pty' | 'tmux';
  /** For tmux backend: the tmux session name. Required when backend is 'tmux'. */
  tmuxSession?: string;
  /** CLI agent to spawn. 'claude' (default) or 'pi'. */
  agent?: 'claude' | 'pi';
  /** For pi agent: provider name (e.g. 'minimax', 'openai'). */
  provider?: string;
  /** For pi agent: model ID (e.g. 'MiniMax-M1'). */
  model?: string;
}

export interface SessionReconnectMessage {
  type: 'session:reconnect';
  sessionId: string;
  cols?: number;
  rows?: number;
}

export interface TerminalInputMessage {
  type: 'terminal:input';
  data: string;
}

export interface TerminalResizeMessage {
  type: 'terminal:resize';
  cols: number;
  rows: number;
}

export type ClientMessage =
  | SessionInitMessage
  | SessionReconnectMessage
  | TerminalInputMessage
  | TerminalResizeMessage;
