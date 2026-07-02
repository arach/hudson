import { describe, expect, it, vi } from 'vitest';
import {
  ackTerminalData,
  createTerminalFlowControlState,
  enqueueTerminalData,
  resetTerminalFlowControl,
} from '../src/relay/flow';
import { buildZellijAttachArgs, createZellijLayoutFile } from '../src/relay/zellij';
import { readFileSync, rmSync } from 'fs';
import { dirname } from 'path';

function createSocket() {
  const sent: unknown[] = [];
  return {
    socket: {
      readyState: 1,
      send: (payload: string | Buffer) => {
        sent.push(JSON.parse(String(payload)));
      },
    },
    sent,
  };
}

describe('terminal relay ACK flow control', () => {
  it('sequences terminal:data and flushes queued output only after ACKs', () => {
    const state = createTerminalFlowControlState({ highWaterBytes: 10, lowWaterBytes: 4, maxQueuedBytes: 100 });
    const { socket, sent } = createSocket();
    const pause = vi.fn();
    const resume = vi.fn();

    const seq1 = enqueueTerminalData(state, socket, '1234567890', { pause, resume });
    const seq2 = enqueueTerminalData(state, socket, 'abc', { pause, resume });

    expect(seq1).toBe(1);
    expect(seq2).toBe(2);
    expect(sent).toEqual([{ type: 'terminal:data', data: '1234567890', seq: 1 }]);
    expect(state.inFlightBytes).toBe(10);
    expect(state.queuedBytes).toBe(3);
    expect(pause).toHaveBeenCalledTimes(1);

    expect(ackTerminalData(state, socket, 1, { pause, resume })).toBe(true);

    expect(sent).toEqual([
      { type: 'terminal:data', data: '1234567890', seq: 1 },
      { type: 'terminal:data', data: 'abc', seq: 2 },
    ]);
    expect(state.inFlightBytes).toBe(3);
    expect(state.queuedBytes).toBe(0);
    expect(resume).toHaveBeenCalledTimes(1);

    expect(ackTerminalData(state, socket, 1, { pause, resume })).toBe(false);
  });

  it('resets pending ACKs and resumes PTY state on detach/reconnect', () => {
    const state = createTerminalFlowControlState({ highWaterBytes: 4, lowWaterBytes: 2, maxQueuedBytes: 100 });
    const { socket } = createSocket();
    const pause = vi.fn();
    const resume = vi.fn();

    enqueueTerminalData(state, socket, '1234', { pause, resume });
    enqueueTerminalData(state, socket, 'queued', { pause, resume });
    expect(state.pendingAcks.size).toBe(1);
    expect(state.queue.length).toBe(1);
    expect(state.paused).toBe(true);

    resetTerminalFlowControl(state, { resume });

    expect(state.pendingAcks.size).toBe(0);
    expect(state.queue.length).toBe(0);
    expect(state.inFlightBytes).toBe(0);
    expect(state.queuedBytes).toBe(0);
    expect(state.paused).toBe(false);
    expect(resume).toHaveBeenCalledTimes(1);
  });
});

describe('zellij relay helpers', () => {
  it('builds attach/create and observe args without advertising unsupported fallbacks', () => {
    expect(buildZellijAttachArgs({
      sessionName: 'hudson-main',
      layoutPath: '/tmp/layout.kdl',
      cwd: '/Users/example/dev',
    })).toEqual([
      'attach',
      '--create',
      'hudson-main',
      'options',
      '--default-layout',
      '/tmp/layout.kdl',
      '--default-cwd',
      '/Users/example/dev',
    ]);

    expect(buildZellijAttachArgs({
      sessionName: 'hudson-main',
      controlMode: 'observe',
    })).toEqual(['watch', 'hudson-main']);
  });

  it('creates a zellij layout with cwd, command, and args', () => {
    const layoutPath = createZellijLayoutFile({
      cwd: '/tmp/work',
      commandBin: '/bin/zsh',
      commandArgs: ['-l'],
    });

    try {
      const layout = readFileSync(layoutPath, 'utf8');
      expect(layout).toContain('pane command="/bin/zsh"');
      expect(layout).toContain('cwd "/tmp/work"');
      expect(layout).toContain('args "-l"');
    } finally {
      rmSync(dirname(layoutPath), { recursive: true, force: true });
    }
  });
});
