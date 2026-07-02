import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTerminalRelay, type TerminalRelayHandle } from '../src/hooks/useTerminalRelay';
import {
  HUDSON_TERMINAL_VOICE_TRANSCRIPT_EVENT,
  TerminalRelay,
  type TerminalRelayRef,
} from '../src/components/TerminalRelay';

interface MockTerminalInstance {
  cols: number;
  rows: number;
  options: Record<string, unknown>;
  writes: Array<{ data: string; callback?: () => void }>;
  dataHandler: ((data: string) => void) | null;
  disposed: boolean;
  focused: boolean;
  cleared: boolean;
}

interface MockAttachableAddon {
  _attachTerminal?: (terminal: MockTerminalInstance) => void;
}

const terminalMock = vi.hoisted((): {
  instances: MockTerminalInstance[];
  nextFitSize: { cols: number; rows: number };
  fitCalls: number;
} => ({
  instances: [],
  nextFitSize: { cols: 80, rows: 24 },
  fitCalls: 0,
}));

const resizeObserverMock = vi.hoisted((): { instances: MockResizeObserver[] } => ({
  instances: [],
}));

vi.mock('@xterm/xterm', () => {
  class Terminal {
    cols = 80;
    rows = 24;
    options: Record<string, unknown>;
    writes: Array<{ data: string; callback?: () => void }> = [];
    dataHandler: ((data: string) => void) | null = null;
    disposed = false;
    focused = false;
    cleared = false;

    constructor(options: Record<string, unknown>) {
      this.options = { ...options };
      terminalMock.instances.push(this);
    }

    loadAddon(addon: MockAttachableAddon | null | undefined) {
      addon?._attachTerminal?.(this);
    }

    open() {}

    attachCustomKeyEventHandler() {}

    onData(cb: (data: string) => void) {
      this.dataHandler = cb;
      return { dispose: () => { this.dataHandler = null; } };
    }

    write(data: string, callback?: () => void) {
      this.writes.push({ data, callback });
    }

    focus() {
      this.focused = true;
    }

    clear() {
      this.cleared = true;
    }

    dispose() {
      this.disposed = true;
    }
  }

  return { Terminal };
});

vi.mock('@xterm/addon-fit', () => {
  class FitAddon {
    terminal: MockTerminalInstance | null = null;

    _attachTerminal(terminal: MockTerminalInstance) {
      this.terminal = terminal;
    }

    fit() {
      terminalMock.fitCalls += 1;
      if (this.terminal) {
        this.terminal.cols = terminalMock.nextFitSize.cols;
        this.terminal.rows = terminalMock.nextFitSize.rows;
      }
    }
  }

  return { FitAddon };
});

vi.mock('@xterm/addon-webgl', () => ({
  WebglAddon: class WebglAddon {
    onContextLoss() {}
    dispose() {}
  },
}));

class MockResizeObserver {
  callback: ResizeObserverCallback;
  observe = vi.fn();
  disconnect = vi.fn();

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    resizeObserverMock.instances.push(this);
  }

  trigger() {
    this.callback([], this as unknown as ResizeObserver);
  }
}

function createRelay(overrides: Partial<TerminalRelayHandle> = {}) {
  let outputHandler: Parameters<TerminalRelayHandle['onData']>[0] = null;
  const relay: TerminalRelayHandle = {
    status: 'connected',
    sessionId: 'session-1',
    error: null,
    exitCode: null,
    cwd: '~',
    controlMode: 'owner',
    setCwd: vi.fn(),
    onData: vi.fn((cb) => {
      outputHandler = cb;
    }),
    subscribeData: vi.fn(() => () => {}),
    sendInput: vi.fn(),
    sendLine: vi.fn(),
    resize: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    restart: vi.fn(),
    ...overrides,
  };

  return {
    relay,
    getOutputHandler: () => outputHandler,
  };
}

let rafQueue: FrameRequestCallback[] = [];

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  static instances: MockWebSocket[] = [];

  readonly url: string;
  readyState = MockWebSocket.CONNECTING;
  sent: unknown[] = [];
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
    this.sent.push(JSON.parse(String(data)));
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  }

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  message(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }
}

function flushRaf() {
  const queue = rafQueue;
  rafQueue = [];
  act(() => {
    for (const cb of queue) cb(performance.now());
  });
}

beforeEach(() => {
  terminalMock.instances.length = 0;
  terminalMock.nextFitSize = { cols: 80, rows: 24 };
  terminalMock.fitCalls = 0;
  resizeObserverMock.instances.length = 0;
  MockWebSocket.instances.length = 0;
  rafQueue = [];

  vi.stubGlobal('ResizeObserver', MockResizeObserver);
  vi.stubGlobal('WebSocket', MockWebSocket);
  window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    rafQueue.push(cb);
    return rafQueue.length;
  }) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = ((id: number) => {
    rafQueue[id - 1] = () => {};
  }) as typeof window.cancelAnimationFrame;

  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    width: 320,
    height: 200,
    top: 0,
    left: 0,
    right: 320,
    bottom: 200,
    toJSON: () => ({}),
  } as DOMRect);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('TerminalRelay', () => {
  it('sends terminal:ack only after xterm write when driven by useTerminalRelay', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    function Harness() {
      const relay = useTerminalRelay({
        url: 'ws://relay.test',
        healthUrl: 'http://relay.test/health',
        autoConnect: true,
      });
      return <TerminalRelay relay={relay} renderer="dom" />;
    }

    render(<Harness />);

    await waitFor(() => expect(MockWebSocket.instances).toHaveLength(1));
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.open();
    });

    await waitFor(() => expect(ws.sent).toContainEqual(expect.objectContaining({
      type: 'session:init',
      cols: 80,
      rows: 24,
      cwd: '~',
      clientCapabilities: ['terminal:ack'],
    })));

    act(() => {
      ws.message({ type: 'session:ready', sessionId: 'session-ack' });
    });

    await waitFor(() => expect(terminalMock.instances).toHaveLength(1));
    act(() => {
      ws.message({ type: 'terminal:data', data: 'sequenced', seq: 7 });
    });

    const terminal = terminalMock.instances[0];
    await waitFor(() => expect(terminal.writes).toHaveLength(1));
    expect(ws.sent).not.toContainEqual({ type: 'terminal:ack', seq: 7 });

    act(() => {
      terminal.writes[0].callback?.();
      terminal.writes[0].callback?.();
    });

    expect(ws.sent.filter((msg) => (
      typeof msg === 'object' &&
      msg !== null &&
      (msg as { type?: string }).type === 'terminal:ack'
    ))).toEqual([{ type: 'terminal:ack', seq: 7 }]);
  });

  it('ACKs output only after xterm write callback and only once', async () => {
    const { relay, getOutputHandler } = createRelay();

    render(<TerminalRelay relay={relay} renderer="dom" />);

    await waitFor(() => expect(getOutputHandler()).toBeTruthy());
    const ack = vi.fn();

    act(() => {
      getOutputHandler()?.('hello', ack);
    });

    const terminal = terminalMock.instances[0];
    expect(terminal.writes).toHaveLength(1);
    expect(terminal.writes[0].data).toBe('hello');
    expect(ack).not.toHaveBeenCalled();

    act(() => {
      terminal.writes[0].callback?.();
      terminal.writes[0].callback?.();
    });

    expect(ack).toHaveBeenCalledTimes(1);
  });

  it('blocks voice, image paste upload, and drop upload in read-only / observe mode', async () => {
    const file = new File(['img'], 'image.png', { type: 'image/png' });
    const fetchSpy = vi.fn().mockResolvedValue({ json: async () => ({ path: '/tmp/image.png' }) });
    vi.stubGlobal('fetch', fetchSpy);
    const { relay } = createRelay({ status: 'disconnected', controlMode: 'observe' });

    const { getByRole } = render(<TerminalRelay relay={relay} renderer="dom" />);
    const wrapper = getByRole('application');

    await waitFor(() => expect(terminalMock.instances).toHaveLength(1));
    expect(wrapper).toHaveAttribute('data-readonly', 'true');

    act(() => {
      window.dispatchEvent(new CustomEvent(HUDSON_TERMINAL_VOICE_TRANSCRIPT_EVENT, {
        detail: { transcript: 'echo nope', submit: true },
      }));
    });

    expect(relay.connect).not.toHaveBeenCalled();
    expect(relay.sendInput).not.toHaveBeenCalled();

    fireEvent.paste(wrapper, {
      clipboardData: {
        items: [{ type: 'image/png', getAsFile: () => file }],
      },
    });

    fireEvent.dragEnter(wrapper, { dataTransfer: { types: ['Files'] } });
    fireEvent.drop(wrapper, { dataTransfer: { files: [file] } });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(relay.sendInput).not.toHaveBeenCalled();
  });

  it('dedupes/coalesces resize observer fits and exposes imperative fit()', async () => {
    const ref = createRef<TerminalRelayRef>();
    const { relay } = createRelay();

    render(<TerminalRelay ref={ref} relay={relay} renderer="dom" />);

    await waitFor(() => expect(relay.resize).toHaveBeenCalledTimes(1));
    expect(relay.resize).toHaveBeenLastCalledWith(80, 24);
    await waitFor(() => expect(resizeObserverMock.instances).toHaveLength(1));

    const observer = resizeObserverMock.instances[0] as MockResizeObserver;

    act(() => {
      observer.trigger();
      observer.trigger();
    });
    flushRaf();
    expect(relay.resize).toHaveBeenCalledTimes(1);

    terminalMock.nextFitSize = { cols: 100, rows: 30 };
    act(() => {
      observer.trigger();
      observer.trigger();
    });
    flushRaf();
    expect(relay.resize).toHaveBeenCalledTimes(2);
    expect(relay.resize).toHaveBeenLastCalledWith(100, 30);

    let sameDims: { cols: number; rows: number } | null = null;
    act(() => {
      sameDims = ref.current?.fit() ?? null;
    });
    expect(sameDims).toEqual({ cols: 100, rows: 30 });
    expect(relay.resize).toHaveBeenCalledTimes(2);

    terminalMock.nextFitSize = { cols: 120, rows: 40 };
    let nextDims: { cols: number; rows: number } | null = null;
    act(() => {
      nextDims = ref.current?.fit() ?? null;
    });
    expect(nextDims).toEqual({ cols: 120, rows: 40 });
    expect(relay.resize).toHaveBeenCalledTimes(3);
    expect(relay.resize).toHaveBeenLastCalledWith(120, 40);
  });

  it('does not recreate xterm when readOnly changes', async () => {
    const { relay } = createRelay();
    const { rerender } = render(<TerminalRelay relay={relay} renderer="dom" readOnly={false} />);

    await waitFor(() => expect(terminalMock.instances).toHaveLength(1));
    const terminal = terminalMock.instances[0];

    rerender(<TerminalRelay relay={relay} renderer="dom" readOnly />);

    expect(terminalMock.instances).toHaveLength(1);
    expect(terminal.disposed).toBe(false);

    act(() => {
      terminal.dataHandler?.('blocked');
    });

    expect(relay.sendInput).not.toHaveBeenCalled();
  });
});
