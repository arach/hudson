'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RelayStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface UseTerminalRelayOptions {
  /** WebSocket URL. Defaults to ws://localhost:3600 */
  url?: string;
  /** System prompt to pass to the Claude CLI session */
  systemPrompt?: string;
  /** Working directory for the PTY session. Defaults to $HOME on the server. */
  cwd?: string;
  /** Files to bootstrap in the CWD before spawning. Keys are relative paths, values are content. Only created if missing. */
  workspaceFiles?: Record<string, string>;
  /** Auto-connect on mount. Defaults to false. */
  autoConnect?: boolean;
}

export interface TerminalRelayHandle {
  /** Connection status */
  status: RelayStatus;
  /** Session ID assigned by server */
  sessionId: string | null;
  /** Human-readable error when session fails or crashes */
  error: string | null;
  /** Exit code from the last session (null if still running or never started) */
  exitCode: number | null;
  /** Register a callback for incoming terminal data */
  onData: (cb: (data: string) => void) => void;
  /** Send raw keystrokes (for keyboard events) */
  sendInput: (data: string) => void;
  /** Send a line of text (appends \r) */
  sendLine: (text: string) => void;
  /** Resize the remote terminal — also used to set initial size before connect */
  resize: (cols: number, rows: number) => void;
  /** Open the WebSocket connection and init or reconnect a session */
  connect: () => void;
  /** Close the WebSocket connection (session stays alive on server) */
  disconnect: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTerminalRelay(options: UseTerminalRelayOptions = {}): TerminalRelayHandle {
  const {
    url = 'ws://localhost:3600',
    systemPrompt,
    cwd,
    workspaceFiles,
    autoConnect = false,
  } = options;

  const [status, setStatus] = useState<RelayStatus>('disconnected');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exitCode, setExitCode] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dimsRef = useRef({ cols: 80, rows: 24 });
  const initSentRef = useRef(false);
  // Persist sessionId across reconnects so we can resume
  const sessionIdRef = useRef<string | null>(null);
  // Data callback registered by the TerminalRelay component
  const dataCallbackRef = useRef<((data: string) => void) | null>(null);

  const send = useCallback((data: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    const ws = wsRef.current;
    if (ws) {
      ws.close();
      wsRef.current = null;
    }
    initSentRef.current = false;
    setStatus('disconnected');
    // Keep sessionId so we can reconnect — don't clear it
  }, []);

  const sendInitOrReconnect = useCallback(() => {
    if (initSentRef.current) return;
    initSentRef.current = true;

    if (sessionIdRef.current) {
      // Try to reconnect to existing session
      send({
        type: 'session:reconnect',
        sessionId: sessionIdRef.current,
        cols: dimsRef.current.cols,
        rows: dimsRef.current.rows,
      });
    } else {
      // Start a new session
      send({
        type: 'session:init',
        cols: dimsRef.current.cols,
        rows: dimsRef.current.rows,
        ...(systemPrompt ? { systemPrompt } : {}),
        ...(cwd ? { cwd } : {}),
        ...(workspaceFiles ? { workspaceFiles } : {}),
      });
    }
  }, [send, systemPrompt, cwd, workspaceFiles]);

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    initSentRef.current = false;
    setStatus('connecting');
    setError(null);
    setExitCode(null);

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      sendInitOrReconnect();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        switch (msg.type) {
          case 'session:ready':
            sessionIdRef.current = msg.sessionId;
            setSessionId(msg.sessionId);
            setError(null);
            setExitCode(null);
            break;

          case 'session:expired':
            // Our old session is gone — start fresh
            sessionIdRef.current = null;
            initSentRef.current = false;
            send({
              type: 'session:init',
              cols: dimsRef.current.cols,
              rows: dimsRef.current.rows,
              ...(systemPrompt ? { systemPrompt } : {}),
              ...(cwd ? { cwd } : {}),
              ...(workspaceFiles ? { workspaceFiles } : {}),
            });
            initSentRef.current = true;
            break;

          case 'session:error':
            // Pre-flight failure — session was never created
            setStatus('error');
            setError(msg.error || 'Session failed to start');
            break;

          case 'terminal:data':
            // Forward raw terminal data to the registered callback
            if (dataCallbackRef.current && msg.data) {
              dataCallbackRef.current(msg.data);
            }
            break;

          case 'session:exit':
            sessionIdRef.current = null;
            setSessionId(null);
            setExitCode(msg.exitCode ?? null);
            if (msg.exitCode !== 0) {
              setStatus('error');
              setError(msg.reason || `Process exited with code ${msg.exitCode}`);
            } else {
              setStatus('disconnected');
            }
            break;

          case 'session:detached':
            // Another client took over our session
            sessionIdRef.current = null;
            setSessionId(null);
            break;
        }
      } catch {}
    };

    ws.onclose = () => {
      wsRef.current = null;
      initSentRef.current = false;
      // Don't overwrite an error status on close
      setStatus((prev) => prev === 'error' ? prev : 'disconnected');
    };

    ws.onerror = () => {
      setStatus('error');
      setError('Could not connect to relay');
    };
  }, [url, sendInitOrReconnect, send, systemPrompt, cwd, workspaceFiles]);

  const sendInput = useCallback((data: string) => {
    send({ type: 'terminal:input', data });
  }, [send]);

  const sendLine = useCallback((text: string) => {
    send({ type: 'terminal:input', data: text + '\r' });
  }, [send]);

  const resize = useCallback((cols: number, rows: number) => {
    dimsRef.current = { cols, rows };
    if (initSentRef.current) {
      send({ type: 'terminal:resize', cols, rows });
    }
  }, [send]);

  const onData = useCallback((cb: (data: string) => void) => {
    dataCallbackRef.current = cb;
  }, []);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    status,
    sessionId,
    error,
    exitCode,
    onData,
    sendInput,
    sendLine,
    resize,
    connect,
    disconnect,
  };
}
