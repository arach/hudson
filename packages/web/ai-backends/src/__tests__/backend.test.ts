import { describe, it, expect } from 'vitest';
import type { Backend, DispatchRequest, StreamEvent } from '../types';
import { aggregateStream } from '../dispatch';
import {
  supportsStreaming,
  supportsSessions,
  requiresRelay,
  requiresAuth,
  checkStatus,
  unavailableAffordance,
} from '../capabilities';
import { createToolsetRegistry, buildIntentsToolset } from '../toolsets/registry';

// ---------------------------------------------------------------------------
// Fake in-memory backend that echoes input through the StreamEvent stream
// ---------------------------------------------------------------------------

function createEchoBackend(): Backend {
  return {
    id: 'echo',
    label: 'Echo Backend',
    surface: 'chat',
    capabilities: {
      streaming: true,
      sessions: false,
      auth: 'none',
      relay: 'none',
    },

    async *stream(req: DispatchRequest): AsyncIterable<StreamEvent> {
      // Check abort before starting
      if (req.signal?.aborted) return;

      // Emit text deltas — split input into words
      const words = req.input.split(' ');
      for (const word of words) {
        if (req.signal?.aborted) return;
        yield { type: 'text', delta: word + ' ' };
      }

      yield { type: 'usage', input: req.input.length, output: req.input.length };
      yield { type: 'done', meta: undefined };
    },
  };
}

function makeRequest(input: string, signal?: AbortSignal): DispatchRequest {
  return {
    conversationId: 'test-conv-1',
    messages: [],
    input,
    config: {},
    signal,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Backend stream()', () => {
  it('yields semantic stream events for text input', async () => {
    const backend = createEchoBackend();
    const events: StreamEvent[] = [];

    for await (const event of backend.stream(makeRequest('hello world'))) {
      events.push(event);
    }

    // Should have 2 text deltas + usage + done
    expect(events).toHaveLength(4);
    expect(events[0]).toEqual({ type: 'text', delta: 'hello ' });
    expect(events[1]).toEqual({ type: 'text', delta: 'world ' });
    expect(events[2]).toMatchObject({ type: 'usage', input: 11, output: 11 });
    expect(events[3]).toMatchObject({ type: 'done' });
  });

  it('respects abort signal', async () => {
    const backend = createEchoBackend();
    const controller = new AbortController();
    const events: StreamEvent[] = [];

    // Abort immediately
    controller.abort();

    for await (const event of backend.stream(makeRequest('hello world', controller.signal))) {
      events.push(event);
    }

    expect(events).toHaveLength(0);
  });

  it('aborts mid-stream', async () => {
    const backend = createEchoBackend();
    const controller = new AbortController();
    const events: StreamEvent[] = [];

    for await (const event of backend.stream(makeRequest('one two three', controller.signal))) {
      events.push(event);
      if (events.length === 1) controller.abort();
    }

    // Should have stopped after first text delta
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'text', delta: 'one ' });
  });
});

describe('aggregateStream() — default dispatch()', () => {
  it('aggregates stream into a DispatchResult', async () => {
    const backend = createEchoBackend();
    const result = await aggregateStream(backend, makeRequest('hello world'));

    expect(result.reply).toBe('hello world ');
    expect(result.usage).toEqual({ input: 11, output: 11 });
    expect(result.toolCalls).toBeUndefined();
    expect(result.sessionRef).toBeUndefined();
  });

  it('aggregates tool calls and results', async () => {
    const backend: Backend = {
      ...createEchoBackend(),
      async *stream(): AsyncIterable<StreamEvent> {
        yield { type: 'text', delta: 'Calling tool. ' };
        yield { type: 'tool_call', id: 'tc1', name: 'dispatch', input: { commandId: 'foo' } };
        yield { type: 'tool_result', id: 'tc1', output: { applied: true } };
        yield { type: 'text', delta: 'Done.' };
        yield { type: 'done', meta: undefined };
      },
    };

    const result = await aggregateStream(backend, makeRequest('do foo'));
    expect(result.reply).toBe('Calling tool. Done.');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls![0]).toEqual({
      id: 'tc1',
      name: 'dispatch',
      input: { commandId: 'foo' },
      output: { applied: true },
    });
  });

  it('throws on non-recoverable error events', async () => {
    const backend: Backend = {
      ...createEchoBackend(),
      async *stream(): AsyncIterable<StreamEvent> {
        yield { type: 'text', delta: 'partial ' };
        yield { type: 'error', message: 'provider exploded', recoverable: false };
      },
    };

    await expect(aggregateStream(backend, makeRequest('boom'))).rejects.toThrow('provider exploded');
  });

  it('continues past recoverable error events', async () => {
    const backend: Backend = {
      ...createEchoBackend(),
      async *stream(): AsyncIterable<StreamEvent> {
        yield { type: 'text', delta: 'before ' };
        yield { type: 'error', message: 'rate limit', recoverable: true };
        yield { type: 'text', delta: 'after' };
        yield { type: 'done', meta: undefined };
      },
    };

    const result = await aggregateStream(backend, makeRequest('retry'));
    expect(result.reply).toBe('before after');
  });

  it('captures session ref from stream', async () => {
    const backend: Backend = {
      ...createEchoBackend(),
      async *stream(): AsyncIterable<StreamEvent> {
        yield { type: 'session', sessionRef: 'sess-abc' };
        yield { type: 'text', delta: 'hi' };
        yield { type: 'done', meta: undefined };
      },
    };

    const result = await aggregateStream(backend, makeRequest('hello'));
    expect(result.sessionRef).toBe('sess-abc');
  });
});

describe('Capability helpers', () => {
  it('supportsStreaming defaults to true', () => {
    expect(supportsStreaming({})).toBe(true);
    expect(supportsStreaming({ streaming: true })).toBe(true);
    expect(supportsStreaming({ streaming: false })).toBe(false);
  });

  it('supportsSessions', () => {
    expect(supportsSessions({})).toBe(false);
    expect(supportsSessions({ sessions: true })).toBe(true);
  });

  it('requiresRelay', () => {
    expect(requiresRelay({})).toBe(false);
    expect(requiresRelay({ relay: 'required' })).toBe(true);
    expect(requiresRelay({ relay: 'optional' })).toBe(false);
  });

  it('requiresAuth', () => {
    expect(requiresAuth({})).toBe(false);
    expect(requiresAuth({ auth: 'none' })).toBe(false);
    expect(requiresAuth({ auth: 'api-key' })).toBe(true);
    expect(requiresAuth({ auth: 'oauth' })).toBe(true);
  });

  it('checkStatus returns available when no status method', async () => {
    const backend = createEchoBackend();
    const result = await checkStatus(backend, {});
    expect(result).toEqual({ available: true });
  });

  it('unavailableAffordance returns null when available', () => {
    expect(unavailableAffordance({}, { available: true })).toBeNull();
  });

  it('unavailableAffordance returns start-relay CTA', () => {
    const result = unavailableAffordance(
      { relay: 'required' },
      { available: false, reason: 'Relay not running' },
    );
    expect(result).toEqual({ cta: 'start-relay', reason: 'Relay not running' });
  });

  it('unavailableAffordance returns configure-api-key CTA', () => {
    const result = unavailableAffordance(
      { auth: 'api-key' },
      { available: false, reason: 'No API key' },
    );
    expect(result).toEqual({ cta: 'configure-api-key', reason: 'No API key' });
  });
});

describe('Toolset registry', () => {
  it('register and resolve', () => {
    const registry = createToolsetRegistry();
    const toolset = { system: 'test', context: () => '', tools: () => ({}) };

    registry.register('test', toolset);
    expect(registry.resolve('test')).toBe(toolset);
    expect(registry.resolve('nonexistent')).toBeNull();
  });

  it('list returns all registered toolsets', () => {
    const registry = createToolsetRegistry();
    const a = { system: 'a', context: () => '', tools: () => ({}) };
    const b = { system: 'b', context: () => '', tools: () => ({}) };

    registry.register('a', a);
    registry.register('b', b);

    const list = registry.list();
    expect(list).toHaveLength(2);
    expect(list.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('buildIntentsToolset creates a valid toolset from intents', () => {
    const toolset = buildIntentsToolset([
      {
        commandId: 'grid-view',
        title: 'Grid View',
        description: 'Switch to grid layout',
        keywords: ['grid', 'layout'],
      },
    ]);

    expect(toolset.system).toContain('in-app Assistant');

    const ctx = toolset.context({ appName: 'Hero', appId: 'hero' });
    expect(ctx).toContain('Hero');
    expect(ctx).toContain('grid-view');
    expect(ctx).toContain('Grid View');

    const tools = toolset.tools({});
    expect(tools).toHaveProperty('dispatch');
  });

  it('buildIntentsToolset handles empty intents', () => {
    const toolset = buildIntentsToolset([]);
    const ctx = toolset.context({});
    expect(ctx).toContain('none declared');
  });
});
