'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RelayStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type TerminalBackend = 'pty' | 'tmux' | 'zellij';
export type TerminalControlMode = 'owner' | 'takeover' | 'observe';
export type TerminalAgent = 'claude' | 'pi' | 'shell';

export const HUDSON_TERMINAL_CLIENT_CAPABILITIES = ['terminal:ack'] as const;

export interface TerminalFlowControlOptions {
  /** Max output to buffer before a renderer is attached. Dropped sequenced chunks are ACKed. */
  maxBufferedBytes?: number;
}

export interface TerminalSessionInitMessage {
  type: 'session:init';
  cols: number;
  rows: number;
  clientCapabilities?: string[];
  systemPrompt?: string;
  cwd?: string;
  workspaceFiles?: Record<string, string>;
  orphanTTL?: number;
  backend?: TerminalBackend;
  /** Client intent; older relays may ignore this until observe/takeover support lands server-side. */
  controlMode?: TerminalControlMode;
  tmuxSession?: string;
  zellijSession?: string;
  zellijSocketDir?: string;
  agent?: TerminalAgent;
  provider?: string;
  model?: string;
}

export interface TerminalSessionReconnectMessage {
  type: 'session:reconnect';
  sessionId: string;
  /** Ownership proof issued in session:ready. Relays refuse reconnects without it. */
  reconnectToken?: string;
  cols?: number;
  rows?: number;
  clientCapabilities?: string[];
  controlMode?: TerminalControlMode;
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

export type TerminalRelayClientMessage =
  | TerminalSessionInitMessage
  | TerminalSessionReconnectMessage
  | TerminalInputMessage
  | TerminalResizeMessage
  | TerminalAckMessage;

export interface TerminalSessionReadyMessage {
  type: 'session:ready';
  sessionId: string;
  /** Ownership proof to present on session:reconnect. */
  reconnectToken?: string;
  reconnected?: boolean;
  capabilities?: string[];
}

export interface TerminalSessionExpiredMessage {
  type: 'session:expired';
  sessionId?: string;
}

export interface TerminalSessionErrorMessage {
  type: 'session:error';
  error?: string;
}

export interface TerminalDataMessage {
  type: 'terminal:data';
  data: string;
  /** Monotonic sequence for flow-controlled relays. Client ACKs after renderer write. */
  seq?: number;
}

export interface TerminalSessionExitMessage {
  type: 'session:exit';
  exitCode?: number;
  reason?: string;
}

export interface TerminalSessionDetachedMessage {
  type: 'session:detached';
}

export type TerminalRelayServerMessage =
  | TerminalSessionReadyMessage
  | TerminalSessionExpiredMessage
  | TerminalSessionErrorMessage
  | TerminalDataMessage
  | TerminalSessionExitMessage
  | TerminalSessionDetachedMessage;

export interface UseTerminalRelayOptions {
  /** WebSocket URL. Defaults to ws://localhost:3600 */
  url?: string;
  /** Optional HTTP health URL used for the pre-flight relay probe. Defaults to `${url}/health` over http(s). */
  healthUrl?: string;
  /** Auth token for relays started with HUDSON_RELAY_TOKEN. Sent as a `token` query param on the WebSocket URL. */
  token?: string;
  /** System prompt to pass to the CLI agent session. Ignored by shell sessions. */
  systemPrompt?: string;
  /** Working directory for the PTY session. Defaults to $HOME on the server. */
  cwd?: string;
  /** Files to bootstrap in the CWD before spawning. Keys are relative paths, values are content. Only created if missing. */
  workspaceFiles?: Record<string, string>;
  /** Auto-connect on mount. Defaults to false. */
  autoConnect?: boolean;
  /** Stable key for persisting the sessionId across reloads and browser restarts.
   *  If provided, the hook will attempt to reconnect to the previous session on mount. */
  sessionKey?: string;
  /** How long (ms) the server keeps the PTY alive after disconnect. Defaults to 30 min. */
  orphanTTL?: number;
  /** PTY backend: 'pty' (default) spawns a fresh process, 'tmux' attaches to a persistent tmux session. */
  backend?: TerminalBackend;
  /** Client control intent. `observe` also marks the returned handle read-only for TerminalRelay. */
  controlMode?: TerminalControlMode;
  /** For tmux backend: the named tmux session to create/attach to. */
  tmuxSession?: string;
  /** For zellij backend: the named zellij session to create/attach to. */
  zellijSession?: string;
  /** For zellij backend: optional socket directory. */
  zellijSocketDir?: string;
  /** Process to spawn. 'claude' (default), 'pi', or 'shell' for a normal login shell. */
  agent?: TerminalAgent;
  /** For pi agent: provider name (e.g. 'minimax', 'openai-codex'). */
  provider?: string;
  /** For pi agent: model ID (e.g. 'MiniMax-M1'). */
  model?: string;
  /** Flow-control and pre-render buffering knobs. */
  flowControl?: TerminalFlowControlOptions;
}

export type TerminalRelayOutputAck = () => void;
export type TerminalRelayOutputHandler = (data: string, ack: TerminalRelayOutputAck) => void;

interface PendingOutput {
  data: string;
  seq: number | null;
  ack: TerminalRelayOutputAck;
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
  /** Current working directory (editable before connecting) */
  cwd: string;
  /** Client control intent. `observe` should be treated as read-only by renderers. */
  controlMode: TerminalControlMode;
  /** Update the CWD — only takes effect on next connect/session:init */
  setCwd: (cwd: string) => void;
  /**
   * Register the **primary** data sink — typically the `TerminalRelay`
   * component's xterm writer. Pass `null` to clear. Data buffered before
   * registration is flushed to the new sink on registration. For
   * additional, non-claiming listeners (e.g. tail-previews, activity
   * trackers) use `subscribeData` instead.
   */
  onData: (cb: TerminalRelayOutputHandler | null) => void;
  /**
   * Subscribe to incoming PTY data without claiming the primary sink slot.
   * Returns an unsubscribe function. Multiple subscribers allowed; called
   * after the primary sink on every chunk. Subscribers do NOT receive
   * buffered output from before the subscription — they see live data
   * only.
   */
  subscribeData: (cb: (data: string) => void) => () => void;
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
  /** Kill the current session and start a fresh one (new agent/model/settings take effect) */
  restart: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTerminalRelay(options: UseTerminalRelayOptions = {}): TerminalRelayHandle {
  const {
    url = 'ws://localhost:3600',
    healthUrl,
    token,
    systemPrompt,
    cwd: initialCwd,
    workspaceFiles,
    autoConnect = false,
    sessionKey,
    orphanTTL,
    backend,
    controlMode = 'owner',
    tmuxSession,
    zellijSession,
    zellijSocketDir,
    agent,
    provider,
    model,
    flowControl,
  } = options;

  // Persist sessionId in localStorage so it survives reload + browser restart.
  // The relay server keeps the PTY alive for orphanTTL (default 30 min).
  const storageKey = sessionKey ? `hudson.relay.${sessionKey}` : null;
  const readPersistedSession = (): { id: string; reconnectToken: string | null } | null => {
    if (!storageKey) return null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      if (raw.startsWith('{')) {
        const parsed = JSON.parse(raw) as { id?: unknown; reconnectToken?: unknown };
        if (typeof parsed.id !== 'string') return null;
        return {
          id: parsed.id,
          reconnectToken: typeof parsed.reconnectToken === 'string' ? parsed.reconnectToken : null,
        };
      }
      // Legacy format: bare session id from before reconnect tokens existed.
      return { id: raw, reconnectToken: null };
    } catch { return null; }
  };
  const persistSession = useCallback((id: string | null, reconnectToken: string | null = null) => {
    if (!storageKey) return;
    try {
      if (id) localStorage.setItem(storageKey, JSON.stringify({ id, reconnectToken }));
      else localStorage.removeItem(storageKey);
    } catch {}
  }, [storageKey]);

  const [status, setStatus] = useState<RelayStatus>('disconnected');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [cwd, setCwd] = useState(initialCwd || '~');

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dimsRef = useRef({ cols: 80, rows: 24 });
  const initSentRef = useRef(false);
  const pendingOutputRef = useRef<PendingOutput[]>([]);
  const pendingOutputCharsRef = useRef(0);
  // Guard async connect races so stale StrictMode/dev remount attempts
  // cannot steal wsRef or leave a later socket uninitialized.
  const connectAttemptRef = useRef(0);
  const cwdRef = useRef(cwd);
  cwdRef.current = cwd;
  // Persist sessionId (+ ownership token) across reconnects so we can resume
  const persistedRef = useRef(readPersistedSession());
  const sessionIdRef = useRef<string | null>(persistedRef.current?.id ?? null);
  const reconnectTokenRef = useRef<string | null>(persistedRef.current?.reconnectToken ?? null);
  // Primary data callback (typically the TerminalRelay xterm writer).
  const dataCallbackRef = useRef<TerminalRelayOutputHandler | null>(null);
  // Additional, non-claiming subscribers (tail previews, activity trackers).
  // We fan out to them on every chunk, after the primary sink.
  const subscribersRef = useRef<Set<(data: string) => void>>(new Set());
  const maxPendingOutput = flowControl?.maxBufferedBytes ?? 512 * 1024;

  const send = useCallback((data: TerminalRelayClientMessage | Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }, []);

  const ackOutput = useCallback((seq: number | null) => {
    if (typeof seq !== 'number') return;
    send({ type: 'terminal:ack', seq });
  }, [send]);

  const pushOutput = useCallback((data: string, seq: number | null = null) => {
    if (!data) {
      ackOutput(seq);
      return;
    }
    let acked = false;
    const ack = () => {
      if (acked) return;
      acked = true;
      ackOutput(seq);
    };
    if (dataCallbackRef.current) {
      try {
        dataCallbackRef.current(data, ack);
      } catch {
        ack();
      }
    } else {
      pendingOutputRef.current.push({ data, seq, ack });
      pendingOutputCharsRef.current += data.length;
      while (pendingOutputCharsRef.current > maxPendingOutput && pendingOutputRef.current.length > 0) {
        const dropped = pendingOutputRef.current.shift();
        if (!dropped) break;
        pendingOutputCharsRef.current -= dropped.data.length;
        dropped.ack();
      }
    }
    // Fan out to passive subscribers regardless of whether the primary
    // sink is bound. They never get buffered output — only live chunks.
    if (subscribersRef.current.size > 0) {
      for (const cb of subscribersRef.current) {
        try { cb(data); } catch { /* one bad subscriber shouldn't break the others */ }
      }
    }
  }, [ackOutput, maxPendingOutput]);

  const closeCurrentSocket = useCallback(() => {
    const ws = wsRef.current;
    if (ws) {
      ws.close();
      wsRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    connectAttemptRef.current += 1;
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    closeCurrentSocket();
    initSentRef.current = false;
    setStatus('disconnected');
    // Keep sessionId so we can reconnect — don't clear it
  }, [closeCurrentSocket]);

  const buildInitMessage = useCallback(() => {
    const activeCwd = cwdRef.current;
    return {
      type: 'session:init' as const,
      cols: dimsRef.current.cols,
      rows: dimsRef.current.rows,
      clientCapabilities: [...HUDSON_TERMINAL_CLIENT_CAPABILITIES],
      ...(systemPrompt ? { systemPrompt } : {}),
      ...(activeCwd ? { cwd: activeCwd } : {}),
      ...(workspaceFiles ? { workspaceFiles } : {}),
      ...(orphanTTL ? { orphanTTL } : {}),
      ...(backend ? { backend } : {}),
      ...(controlMode !== 'owner' ? { controlMode } : {}),
      ...(tmuxSession ? { tmuxSession } : {}),
      ...(zellijSession ? { zellijSession } : {}),
      ...(zellijSocketDir ? { zellijSocketDir } : {}),
      ...(agent ? { agent } : {}),
      ...(provider ? { provider } : {}),
      ...(model ? { model } : {}),
    };
  }, [
    agent,
    backend,
    controlMode,
    model,
    orphanTTL,
    provider,
    systemPrompt,
    tmuxSession,
    workspaceFiles,
    zellijSession,
    zellijSocketDir,
  ]);

  const sendInitOrReconnect = useCallback(() => {
    if (initSentRef.current) return;
    initSentRef.current = true;

    if (sessionIdRef.current) {
      // Try to reconnect to existing session
      send({
        type: 'session:reconnect',
        sessionId: sessionIdRef.current,
        ...(reconnectTokenRef.current ? { reconnectToken: reconnectTokenRef.current } : {}),
        cols: dimsRef.current.cols,
        rows: dimsRef.current.rows,
        clientCapabilities: [...HUDSON_TERMINAL_CLIENT_CAPABILITIES],
        ...(controlMode !== 'owner' ? { controlMode } : {}),
      });
    } else {
      send(buildInitMessage());
    }
  }, [send, buildInitMessage, controlMode]);

  const connect = useCallback(async () => {
    const attempt = connectAttemptRef.current + 1;
    connectAttemptRef.current = attempt;

    closeCurrentSocket();

    initSentRef.current = false;
    setStatus('connecting');
    setError(null);
    setExitCode(null);

    // Pre-flight: check if the relay server is reachable before opening WebSocket
    const resolvedHealthUrl = healthUrl || `${url.replace(/^ws(s?):\/\//, 'http$1://')}/health`;
    try {
      await fetch(resolvedHealthUrl, { signal: AbortSignal.timeout(2000) });
    } catch {
      if (connectAttemptRef.current !== attempt) return;
      setStatus('error');
      setError('Relay service is not running');
      return;
    }

    if (connectAttemptRef.current !== attempt) {
      return;
    }

    closeCurrentSocket();

    const wsUrl = token
      ? `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
      : url;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    const isCurrentAttempt = () => connectAttemptRef.current === attempt && wsRef.current === ws;

    ws.onopen = () => {
      if (!isCurrentAttempt()) {
        ws.close();
        return;
      }
      // Don't set 'connected' yet — wait for session:ready.
      // This prevents showing an empty terminal while session is being created.
      sendInitOrReconnect();
    };

    ws.onmessage = (event) => {
      if (!isCurrentAttempt()) {
        return;
      }
      try {
        const msg = JSON.parse(event.data as string);
        switch (msg.type) {
          case 'session:ready':
            sessionIdRef.current = msg.sessionId;
            reconnectTokenRef.current = typeof msg.reconnectToken === 'string' ? msg.reconnectToken : null;
            persistSession(msg.sessionId, reconnectTokenRef.current);
            setSessionId(msg.sessionId);
            setStatus('connected');
            setError(null);
            setExitCode(null);
            break;

          case 'session:expired': {
            // Old session was reaped — silently create a new one with same config
            sessionIdRef.current = null;
            reconnectTokenRef.current = null;
            persistSession(null);
            initSentRef.current = false;
            // Clear the terminal so stale content doesn't show
            pushOutput('\x1b[2J\x1b[H', null); // clear screen + cursor home
            send(buildInitMessage());
            initSentRef.current = true;
            break;
          }

          case 'session:error':
            // Pre-flight failure — session was never created
            setStatus('error');
            setError(msg.error || 'Session failed to start');
            break;

          case 'terminal:data':
            // Forward raw terminal data to the registered callback
            pushOutput(msg.data || '', typeof msg.seq === 'number' ? msg.seq : null);
            break;

          case 'session:exit':
            sessionIdRef.current = null;
            reconnectTokenRef.current = null;
            persistSession(null);
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
            reconnectTokenRef.current = null;
            persistSession(null);
            setSessionId(null);
            break;
        }
      } catch {}
    };

    ws.onclose = () => {
      if (!isCurrentAttempt()) {
        return;
      }
      wsRef.current = null;
      initSentRef.current = false;
      // Don't overwrite an error status on close
      setStatus((prev) => prev === 'error' ? prev : 'disconnected');
    };

    ws.onerror = () => {
      if (!isCurrentAttempt()) {
        return;
      }
      setStatus('error');
      setError('Could not connect to relay');
    };
  }, [url, healthUrl, token, sendInitOrReconnect, closeCurrentSocket, send, pushOutput, buildInitMessage, persistSession]);

  const sendInput = useCallback((data: string) => {
    if (controlMode === 'observe') return;
    send({ type: 'terminal:input', data });
  }, [controlMode, send]);

  const sendLine = useCallback((text: string) => {
    if (controlMode === 'observe') return;
    send({ type: 'terminal:input', data: text + '\r' });
  }, [controlMode, send]);

  const resize = useCallback((cols: number, rows: number) => {
    dimsRef.current = { cols, rows };
    if (initSentRef.current) {
      send({ type: 'terminal:resize', cols, rows });
    }
  }, [send]);

  const onData = useCallback((cb: TerminalRelayOutputHandler | null) => {
    dataCallbackRef.current = cb;
    if (!cb || pendingOutputRef.current.length === 0) return;
    const pending = pendingOutputRef.current;
    pendingOutputRef.current = [];
    pendingOutputCharsRef.current = 0;
    for (const output of pending) {
      cb(output.data, output.ack);
    }
  }, []);

  const subscribeData = useCallback((cb: (data: string) => void) => {
    subscribersRef.current.add(cb);
    return () => {
      subscribersRef.current.delete(cb);
    };
  }, []);

  useEffect(() => {
    // Only auto-connect if explicitly requested — don't auto-reconnect
    // just because a stale session ID exists in localStorage
    if (autoConnect) {
      connect();
    }
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restart: disconnect, clear session, reconnect fresh
  const restart = useCallback(() => {
    disconnect();
    sessionIdRef.current = null;
    reconnectTokenRef.current = null;
    setSessionId(null);
    persistSession(null);
    setError(null);
    setExitCode(null);
    // Small delay to let the WebSocket close before reconnecting
    setTimeout(() => connect(), 200);
  }, [disconnect, connect, persistSession]);

  return {
    status,
    sessionId,
    error,
    exitCode,
    cwd,
    controlMode,
    setCwd,
    onData,
    subscribeData,
    sendInput,
    sendLine,
    resize,
    connect,
    disconnect,
    restart,
  };
}
