import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ackSessionOutput,
  attachSession,
  chunkReplayData,
  destroy,
  detachSession,
  markMuxSessionDetached,
  markMuxSessionInUse,
  reapExpiredMuxSessions,
  sessionOwnsSocket,
  sessions,
  trackCreatedMuxSession,
  trackedMuxSessions,
  truncateOutputBuffer,
  verifyReconnectToken,
  writeSession,
  type Session,
  type TrackedMuxSession,
} from '../src/relay/session';
import { createTerminalFlowControlState, TERMINAL_ACK_CAPABILITY } from '../src/relay/flow';
import type { RelaySocket } from '../src/relay/types';

// ---------------------------------------------------------------------------
// Fakes — everything here runs without a real PTY.
// ---------------------------------------------------------------------------

function fakeSocket() {
  const frames: Array<Record<string, unknown>> = [];
  const ws: RelaySocket = {
    readyState: 1,
    send: (payload: string | Buffer) => {
      frames.push(JSON.parse(String(payload)));
    },
  };
  return { ws, frames };
}

function fakePty() {
  return {
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
  } as unknown as Session['pty'];
}

function fakeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: `test-${Math.random().toString(36).slice(2, 10)}`,
    pty: fakePty(),
    ws: null,
    outputBuffer: '',
    cols: 80,
    rows: 24,
    reapTimer: null,
    orphanTTL: 30 * 60 * 1000,
    reconnectToken: 'a'.repeat(32),
    backend: 'pty',
    controlMode: 'owner',
    flowControl: createTerminalFlowControlState(),
    flowControlEnabled: false,
    exited: false,
    exitCode: null,
    ...overrides,
  };
}

afterEach(() => {
  sessions.clear();
  trackedMuxSessions.clear();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Replay chunking (flow-control safety on reconnect)
// ---------------------------------------------------------------------------

describe('chunkReplayData', () => {
  it('returns the data untouched when it fits the byte budget', () => {
    expect(chunkReplayData('hello', 1024)).toEqual(['hello']);
    expect(chunkReplayData('', 1024)).toEqual([]);
  });

  it('splits ASCII data into chunks of at most maxBytes that reassemble losslessly', () => {
    const data = 'x'.repeat(25);
    const chunks = chunkReplayData(data, 10);
    expect(chunks.map((c) => c.length)).toEqual([10, 10, 5]);
    expect(chunks.join('')).toBe(data);
    for (const chunk of chunks) {
      expect(Buffer.byteLength(chunk, 'utf8')).toBeLessThanOrEqual(10);
    }
  });

  it('never splits a surrogate pair across chunks', () => {
    const data = '😀'.repeat(10); // each emoji: 2 UTF-16 units, 4 UTF-8 bytes
    const chunks = chunkReplayData(data, 5);
    expect(chunks.join('')).toBe(data);
    for (const chunk of chunks) {
      expect(Buffer.byteLength(chunk, 'utf8')).toBeLessThanOrEqual(5);
      const first = chunk.charCodeAt(0);
      const last = chunk.charCodeAt(chunk.length - 1);
      expect(first >= 0xdc00 && first <= 0xdfff).toBe(false); // no leading low surrogate
      expect(last >= 0xd800 && last <= 0xdbff).toBe(false); // no trailing high surrogate
    }
  });
});

describe('attachSession replay', () => {
  it('replays the buffer in chunks bounded by highWaterBytes for flow-control clients', () => {
    const highWaterBytes = 10;
    const buffer = 'abcdefghij0123456789XYZ'; // 23 bytes -> 3 chunks
    const session = fakeSession({
      outputBuffer: buffer,
      flowControl: createTerminalFlowControlState({ highWaterBytes, lowWaterBytes: 4, maxQueuedBytes: 1024 }),
    });
    const { ws, frames } = fakeSocket();

    attachSession(session, ws, undefined, undefined, [TERMINAL_ACK_CAPABILITY]);

    // First chunk goes out immediately; hitting the high-water mark pauses the
    // rest in the queue instead of blasting one giant frame.
    const dataFrames = () => frames.filter((f) => f.type === 'terminal:data');
    expect(dataFrames()).toHaveLength(1);
    expect(Buffer.byteLength(String(dataFrames()[0].data), 'utf8')).toBeLessThanOrEqual(highWaterBytes);

    // ACK each chunk; the rest drain in order and reassemble the buffer.
    for (let i = 0; i < 4 && dataFrames().length > 0; i++) {
      const pending = dataFrames();
      const lastSeq = Number(pending[pending.length - 1].seq);
      if (!ackSessionOutput(session, lastSeq)) break;
    }
    const replayed = dataFrames().map((f) => f.data).join('');
    expect(replayed).toBe(buffer);
    for (const frame of dataFrames()) {
      expect(Buffer.byteLength(String(frame.data), 'utf8')).toBeLessThanOrEqual(highWaterBytes);
    }
  });

  it('replays the buffer as a single frame for clients without ACK support', () => {
    const session = fakeSession({ outputBuffer: 'plain output' });
    const { ws, frames } = fakeSocket();

    attachSession(session, ws, undefined, undefined, undefined);

    const dataFrames = frames.filter((f) => f.type === 'terminal:data');
    expect(dataFrames).toEqual([{ type: 'terminal:data', data: 'plain output' }]);
  });
});

// ---------------------------------------------------------------------------
// Output buffer truncation (multibyte / ANSI safety)
// ---------------------------------------------------------------------------

describe('truncateOutputBuffer', () => {
  it('returns the buffer unchanged when under the cap', () => {
    expect(truncateOutputBuffer('short', 100)).toBe('short');
  });

  it('resumes at the next newline so the first replayed line is whole', () => {
    const buffer = 'A'.repeat(30) + 'line1\n' + 'B'.repeat(30);
    const result = truncateOutputBuffer(buffer, 40);
    expect(result).toBe('B'.repeat(30));
  });

  it('resumes at an ESC so an ANSI sequence is never torn', () => {
    const buffer = 'C'.repeat(30) + '\x1b[31mred' + 'D'.repeat(30);
    const result = truncateOutputBuffer(buffer, 40);
    expect(result.startsWith('\x1b[31m')).toBe(true);
  });

  it('never starts the kept buffer on the low half of a surrogate pair', () => {
    const buffer = '😀'.repeat(40); // 80 UTF-16 units
    const result = truncateOutputBuffer(buffer, 15); // odd cut lands mid-pair
    expect(result.length).toBeLessThanOrEqual(15);
    const first = result.charCodeAt(0);
    expect(first >= 0xdc00 && first <= 0xdfff).toBe(false);
    // Round-trips through UTF-8 without replacement characters.
    expect(Buffer.from(result, 'utf8').toString('utf8')).toBe(result);
  });

  it('hard-cuts when no newline or ESC appears in the scan window', () => {
    const buffer = 'z'.repeat(100);
    expect(truncateOutputBuffer(buffer, 40)).toBe('z'.repeat(40));
  });
});

// ---------------------------------------------------------------------------
// Ownership + reconnect-token enforcement
// ---------------------------------------------------------------------------

describe('socket ownership', () => {
  it('only the attached socket owns the session', () => {
    const { ws: ws1 } = fakeSocket();
    const { ws: ws2 } = fakeSocket();
    const session = fakeSession({ ws: ws1 });

    expect(sessionOwnsSocket(session, ws1)).toBe(true);
    expect(sessionOwnsSocket(session, ws2)).toBe(false);

    attachSession(session, ws2);
    expect(sessionOwnsSocket(session, ws1)).toBe(false);
    expect(sessionOwnsSocket(session, ws2)).toBe(true);
  });
});

describe('reconnect token enforcement', () => {
  it('rejects wrong, truncated, empty, and non-string tokens', () => {
    const session = fakeSession({ reconnectToken: 'deadbeef'.repeat(4) });

    expect(verifyReconnectToken(session, 'deadbeef'.repeat(4))).toBe(true);
    expect(verifyReconnectToken(session, 'deadbeef'.repeat(4).slice(0, -1))).toBe(false);
    expect(verifyReconnectToken(session, 'attacker'.repeat(4))).toBe(false);
    expect(verifyReconnectToken(session, '')).toBe(false);
    expect(verifyReconnectToken(session, undefined)).toBe(false);
    expect(verifyReconnectToken(session, 12345 as unknown as string)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Detach / destroy lifecycle
// ---------------------------------------------------------------------------

describe('session lifecycle', () => {
  it('writeSession refuses writes after exit', () => {
    const session = fakeSession({ exited: true });
    expect(writeSession(session, 'ls\n')).toBe(false);
    expect(session.pty.write).not.toHaveBeenCalled();
  });

  it('detachSession orphans the session and destroy fires after the TTL', () => {
    vi.useFakeTimers();
    const session = fakeSession({ orphanTTL: 5_000 });
    const { ws } = fakeSocket();
    session.ws = ws;
    sessions.set(session.id, session);

    detachSession(session);
    expect(session.ws).toBeNull();
    expect(sessions.has(session.id)).toBe(true);

    vi.advanceTimersByTime(5_001);
    expect(sessions.has(session.id)).toBe(false);
    expect(session.pty.kill).toHaveBeenCalled();
  });

  it('reattaching cancels the pending reap', () => {
    vi.useFakeTimers();
    const session = fakeSession({ orphanTTL: 5_000 });
    sessions.set(session.id, session);

    detachSession(session);
    const { ws } = fakeSocket();
    attachSession(session, ws);

    vi.advanceTimersByTime(60_000);
    expect(sessions.has(session.id)).toBe(true);
    expect(session.pty.kill).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Mux session TTL reaper
// ---------------------------------------------------------------------------

describe('mux session reaper', () => {
  const TTL = 60_000;

  it('reaps tracked sessions detached longer than the TTL', () => {
    const kill = vi.fn();
    const now = Date.now();
    trackCreatedMuxSession('tmux', 'hudson-old');
    markMuxSessionDetached('tmux', 'hudson-old', now - TTL - 1);

    const reaped = reapExpiredMuxSessions(TTL, now, kill);

    expect(reaped).toEqual(['hudson-old']);
    expect(kill).toHaveBeenCalledTimes(1);
    expect(kill.mock.calls[0][0]).toMatchObject({ backend: 'tmux', name: 'hudson-old' });
    expect(trackedMuxSessions.size).toBe(0);
  });

  it('leaves sessions alone before the TTL and while marked in use', () => {
    const kill = vi.fn();
    const now = Date.now();
    trackCreatedMuxSession('tmux', 'hudson-fresh');
    markMuxSessionDetached('tmux', 'hudson-fresh', now - TTL + 1000); // not expired yet
    trackCreatedMuxSession('zellij', 'hudson-active'); // never detached

    expect(reapExpiredMuxSessions(TTL, now, kill)).toEqual([]);
    expect(kill).not.toHaveBeenCalled();
    expect(trackedMuxSessions.size).toBe(2);
  });

  it('never reaps a session that a live bridge still references', () => {
    const kill = vi.fn();
    const now = Date.now();
    trackCreatedMuxSession('tmux', 'hudson-busy');
    markMuxSessionDetached('tmux', 'hudson-busy', now - TTL - 1);

    const bridge = fakeSession({ backend: 'tmux', tmuxSession: 'hudson-busy' });
    sessions.set(bridge.id, bridge);

    expect(reapExpiredMuxSessions(TTL, now, kill)).toEqual([]);
    expect(kill).not.toHaveBeenCalled();
    // Marked in-use again rather than left ticking toward the TTL.
    const record = [...trackedMuxSessions.values()][0] as TrackedMuxSession;
    expect(record.detachedAt).toBeNull();
  });

  it('ignores detach marks for sessions the relay did not create', () => {
    const kill = vi.fn();
    markMuxSessionDetached('tmux', 'users-precious-session', Date.now() - TTL * 10);
    expect(trackedMuxSessions.size).toBe(0);
    expect(reapExpiredMuxSessions(TTL, Date.now(), kill)).toEqual([]);
    expect(kill).not.toHaveBeenCalled();
  });

  it('destroying a tmux bridge marks its tracked mux session detached', () => {
    trackCreatedMuxSession('tmux', 'hudson-bridge');
    markMuxSessionInUse('tmux', 'hudson-bridge');
    const bridge = fakeSession({ backend: 'tmux', tmuxSession: 'hudson-bridge' });
    sessions.set(bridge.id, bridge);

    destroy(bridge.id);

    expect(sessions.has(bridge.id)).toBe(false);
    const record = trackedMuxSessions.get('tmux:hudson-bridge');
    expect(record?.detachedAt).toEqual(expect.any(Number));
  });
});
