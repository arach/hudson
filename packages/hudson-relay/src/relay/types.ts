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
