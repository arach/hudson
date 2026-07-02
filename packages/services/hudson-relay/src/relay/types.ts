/** Minimal WebSocket interface — satisfied by both `ws` and Bun's ServerWebSocket. */
export interface RelaySocket {
  readonly readyState: number;
  send(data: string | Buffer): void;
}

export interface SessionInitMessage {
  type: 'session:init';
  cols: number;
  rows: number;
  /** Client-supported protocol capabilities, eg. terminal:ack. */
  clientCapabilities?: string[];
  systemPrompt?: string;
  /** Working directory for the PTY session. Defaults to $HOME. */
  cwd?: string;
  /** Files to bootstrap in the CWD before spawning the CLI. Keys are relative paths, values are file contents. Only written if the file doesn't already exist. */
  workspaceFiles?: Record<string, string>;
  /** How long (ms) to keep the PTY alive after the client disconnects. Defaults to 30 min. */
  orphanTTL?: number;
  /** PTY backend. 'pty' spawns a fresh process; 'tmux'/'zellij' attach to named multiplexers. */
  backend?: 'pty' | 'tmux' | 'zellij';
  /** Client control intent. Current local relay treats this as advisory. */
  controlMode?: 'owner' | 'takeover' | 'observe';
  /** For tmux backend: the tmux session name. Required when backend is 'tmux'. */
  tmuxSession?: string;
  /** For zellij backend: the zellij session name. */
  zellijSession?: string;
  /** For zellij backend: optional shorter socket directory (useful on macOS). */
  zellijSocketDir?: string;
  /** Process to spawn. 'claude' (default), 'pi', or 'shell' for a normal login shell. */
  agent?: 'claude' | 'pi' | 'shell';
  /** For pi agent: provider name (e.g. 'minimax', 'github-copilot'). */
  provider?: string;
  /** For pi agent: model ID (e.g. 'MiniMax-M1'). */
  model?: string;
}

export interface SessionReconnectMessage {
  type: 'session:reconnect';
  sessionId: string;
  /** Ownership proof issued in session:ready. Reconnects without it are refused. */
  reconnectToken?: string;
  cols?: number;
  rows?: number;
  /** Client-supported protocol capabilities, eg. terminal:ack. */
  clientCapabilities?: string[];
  /** Client control intent. Current local relay treats this as advisory. */
  controlMode?: 'owner' | 'takeover' | 'observe';
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

export interface TerminalAckMessage {
  type: 'terminal:ack';
  seq: number;
}

export type ClientMessage =
  | SessionInitMessage
  | SessionReconnectMessage
  | TerminalInputMessage
  | TerminalResizeMessage
  | TerminalAckMessage;
