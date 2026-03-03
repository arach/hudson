export interface SessionInitMessage {
  type: 'session:init';
  cols: number;
  rows: number;
  systemPrompt?: string;
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
