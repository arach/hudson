import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tool } from 'ai';
import { z } from 'zod';
import type { StreamEvent } from '../types';

// ---------------------------------------------------------------------------
// Mock @earendil-works/pi-ai before importing the adapter
// ---------------------------------------------------------------------------

const { mockStream, mockStreamSimple, mockGetModel, mockGetEnvApiKey } = vi.hoisted(() => ({
  mockStream: vi.fn(),
  mockStreamSimple: vi.fn(),
  mockGetModel: vi.fn(),
  mockGetEnvApiKey: vi.fn(),
}));

vi.mock('@earendil-works/pi-ai', () => ({
  stream: mockStream,
  streamSimple: mockStreamSimple,
  getModel: mockGetModel,
  getEnvApiKey: mockGetEnvApiKey,
}));

import { createPiAiBackend, type PiAiConfig, type PiAiMeta, type HudsonTool } from '../adapters/pi-ai';
import { createToolsetRegistry, buildIntentsToolset } from '../toolsets/registry';
import type { CredentialResolver } from '../credentials';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a fake AssistantMessageEventStream (async iterable of events). */
function fakeEventStream(events: unknown[]): AsyncIterable<unknown> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const e of events) yield e;
    },
    result: () => Promise.resolve(events[events.length - 1]),
  } as AsyncIterable<unknown>;
}

function makeUsage() {
  return {
    input: 100,
    output: 50,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 150,
    cost: { input: 0.001, output: 0.0005, cacheRead: 0, cacheWrite: 0, total: 0.0015 },
  };
}

function makeAssistantMessage(text: string) {
  return {
    role: 'assistant',
    content: [{ type: 'text', text }],
    api: 'anthropic-messages',
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    usage: makeUsage(),
    stopReason: 'stop',
    timestamp: Date.now(),
    errorMessage: undefined as string | undefined,
  };
}

const defaultConfig: PiAiConfig = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
  apiKey: 'test-key',
};

function makeRequest(input: string, overrides?: Partial<Parameters<ReturnType<typeof createPiAiBackend>['stream']>[0]>) {
  return {
    conversationId: 'test-conv',
    messages: [],
    input,
    config: defaultConfig,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockStreamSimple.mockImplementation((model, context, options) => (
    mockStream(model, context, options)
  ));
  mockGetModel.mockReturnValue({ provider: 'anthropic', modelId: 'claude-sonnet-4-6' });
  mockGetEnvApiKey.mockReturnValue(undefined);
});

describe('createPiAiBackend', () => {
  it('returns a backend with correct metadata', () => {
    const backend = createPiAiBackend();
    expect(backend.id).toBe('pi-ai');
    expect(backend.label).toBe('Pi AI');
    expect(backend.surface).toBe('chat');
    expect(backend.capabilities).toEqual({
      streaming: true,
      sessions: false,
      auth: 'api-key',
      relay: 'none',
      models: true,
    });
  });
});

describe('status()', () => {
  it('returns available when config has apiKey', async () => {
    const backend = createPiAiBackend();
    const result = await backend.status!(defaultConfig);
    expect(result).toEqual({ available: true });
  });

  it('returns available when env key exists', async () => {
    mockGetEnvApiKey.mockReturnValue('env-key');
    const backend = createPiAiBackend();
    const result = await backend.status!({ provider: 'anthropic', model: 'claude-sonnet-4-6' });
    expect(result).toEqual({ available: true });
    expect(mockGetEnvApiKey).toHaveBeenCalledWith('anthropic');
  });

  it('returns available when credential resolver provides key', async () => {
    const creds: CredentialResolver = async ({ provider }) => ({ apiKey: `resolved-${provider}` });
    const backend = createPiAiBackend({ credentials: creds });
    const result = await backend.status!({ provider: 'openai', model: 'gpt-4o' });
    expect(result).toEqual({ available: true });
  });

  it('returns unavailable with reason when no key found', async () => {
    const backend = createPiAiBackend();
    const result = await backend.status!({ provider: 'anthropic', model: 'claude-sonnet-4-6' });
    expect(result.available).toBe(false);
    expect(result.reason).toContain('No API key for anthropic');
  });
});

describe('stream() — event translation', () => {
  it('translates text_delta to text StreamEvent', async () => {
    mockStream.mockReturnValue(fakeEventStream([
      { type: 'text_delta', contentIndex: 0, delta: 'Hello', partial: {} },
      { type: 'done', reason: 'stop', message: makeAssistantMessage('Hello') },
    ]));

    const backend = createPiAiBackend();
    const events: StreamEvent<PiAiMeta>[] = [];
    for await (const e of backend.stream(makeRequest('hi'))) events.push(e);

    expect(events[0]).toEqual({ type: 'text', delta: 'Hello' });
  });

  it('translates thinking_delta to reasoning StreamEvent', async () => {
    mockStream.mockReturnValue(fakeEventStream([
      { type: 'thinking_delta', contentIndex: 0, delta: 'Let me think...', partial: {} },
      { type: 'done', reason: 'stop', message: makeAssistantMessage('') },
    ]));

    const backend = createPiAiBackend();
    const events: StreamEvent<PiAiMeta>[] = [];
    for await (const e of backend.stream(makeRequest('think'))) events.push(e);

    expect(events[0]).toEqual({ type: 'reasoning', delta: 'Let me think...' });
  });

  it('translates toolcall_end to tool_call StreamEvent', async () => {
    const toolCall = { type: 'toolCall', id: 'tc1', name: 'dispatch', arguments: { commandId: 'grid-view' } };
    mockStream.mockReturnValue(fakeEventStream([
      { type: 'toolcall_end', contentIndex: 0, toolCall, partial: {} },
      { type: 'done', reason: 'toolUse', message: makeAssistantMessage('') },
    ]));

    const backend = createPiAiBackend();
    const events: StreamEvent<PiAiMeta>[] = [];
    for await (const e of backend.stream(makeRequest('do it'))) events.push(e);

    expect(events[0]).toEqual({
      type: 'tool_call',
      id: 'tc1',
      name: 'dispatch',
      input: { commandId: 'grid-view' },
    });
  });

  it('translates done to usage + done StreamEvents', async () => {
    mockStream.mockReturnValue(fakeEventStream([
      { type: 'done', reason: 'stop', message: makeAssistantMessage('Reply') },
    ]));

    const backend = createPiAiBackend();
    const events: StreamEvent<PiAiMeta>[] = [];
    for await (const e of backend.stream(makeRequest('hi'))) events.push(e);

    expect(events[0]).toMatchObject({ type: 'usage', input: 100, output: 50, cost: 0.0015 });
    expect(events[1]).toMatchObject({ type: 'done', meta: { stopReason: 'stop' } });
  });

  it('translates error events', async () => {
    const errMsg = makeAssistantMessage('');
    errMsg.stopReason = 'error';
    errMsg.errorMessage = 'Rate limited';
    mockStream.mockReturnValue(fakeEventStream([
      { type: 'error', reason: 'error', error: errMsg },
    ]));

    const backend = createPiAiBackend();
    const events: StreamEvent<PiAiMeta>[] = [];
    for await (const e of backend.stream(makeRequest('hi'))) events.push(e);

    expect(events[0]).toEqual({ type: 'error', message: 'Rate limited', recoverable: false });
  });

  it('translates aborted error as recoverable', async () => {
    const errMsg = makeAssistantMessage('');
    errMsg.stopReason = 'aborted';
    errMsg.errorMessage = 'Aborted by user';
    mockStream.mockReturnValue(fakeEventStream([
      { type: 'error', reason: 'aborted', error: errMsg },
    ]));

    const backend = createPiAiBackend();
    const events: StreamEvent<PiAiMeta>[] = [];
    for await (const e of backend.stream(makeRequest('hi'))) events.push(e);

    expect(events[0]).toEqual({ type: 'error', message: 'Aborted by user', recoverable: true });
  });

  it('skips non-translatable events (start, text_start, etc.)', async () => {
    mockStream.mockReturnValue(fakeEventStream([
      { type: 'start', partial: {} },
      { type: 'text_start', contentIndex: 0, partial: {} },
      { type: 'text_delta', contentIndex: 0, delta: 'hi', partial: {} },
      { type: 'text_end', contentIndex: 0, content: 'hi', partial: {} },
      { type: 'done', reason: 'stop', message: makeAssistantMessage('hi') },
    ]));

    const backend = createPiAiBackend();
    const events: StreamEvent<PiAiMeta>[] = [];
    for await (const e of backend.stream(makeRequest('hi'))) events.push(e);

    // Should only have: text + usage + done
    expect(events).toHaveLength(3);
    expect(events.map(e => e.type)).toEqual(['text', 'usage', 'done']);
  });
});

describe('stream() — abort signal', () => {
  it('propagates signal to pi-ai stream call', async () => {
    const controller = new AbortController();
    mockStream.mockReturnValue(fakeEventStream([
      { type: 'done', reason: 'stop', message: makeAssistantMessage('hi') },
    ]));

    const backend = createPiAiBackend();
    const events: StreamEvent<PiAiMeta>[] = [];
    for await (const e of backend.stream(makeRequest('hi', { signal: controller.signal }))) {
      events.push(e);
    }

    // Verify signal was passed to pi-ai stream()
    expect(mockStream).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it('stops yielding when signal is aborted mid-stream', async () => {
    const controller = new AbortController();

    // Create a stream that yields multiple events
    mockStream.mockReturnValue(fakeEventStream([
      { type: 'text_delta', contentIndex: 0, delta: 'one', partial: {} },
      { type: 'text_delta', contentIndex: 0, delta: 'two', partial: {} },
      { type: 'done', reason: 'stop', message: makeAssistantMessage('onetwo') },
    ]));

    const backend = createPiAiBackend();
    const events: StreamEvent<PiAiMeta>[] = [];
    for await (const e of backend.stream(makeRequest('hi', { signal: controller.signal }))) {
      events.push(e);
      if (events.length === 1) controller.abort();
    }

    // Should stop after first event
    expect(events).toHaveLength(1);
  });
});

describe('stream() — credential resolution', () => {
  it('calls credential resolver when no config key or env key', async () => {
    const creds: CredentialResolver = vi.fn(async () => ({ apiKey: 'resolved-key' }));
    mockStream.mockReturnValue(fakeEventStream([
      { type: 'done', reason: 'stop', message: makeAssistantMessage('hi') },
    ]));

    const backend = createPiAiBackend({ credentials: creds });
    const events: StreamEvent<PiAiMeta>[] = [];
    const req = makeRequest('hi', { config: { provider: 'openai', model: 'gpt-4o' } });
    for await (const e of backend.stream(req)) events.push(e);

    expect(creds).toHaveBeenCalledWith({ provider: 'openai' });
    // Verify resolved key was passed to pi-ai
    expect(mockStream).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ apiKey: 'resolved-key' }),
    );
  });

  it('yields error when no key from any source', async () => {
    const backend = createPiAiBackend();
    const events: StreamEvent<PiAiMeta>[] = [];
    const req = makeRequest('hi', { config: { provider: 'anthropic', model: 'claude-sonnet-4-6' } });
    for await (const e of backend.stream(req)) events.push(e);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: 'error',
      message: 'No API key for anthropic',
      recoverable: false,
    });
    expect(mockStream).not.toHaveBeenCalled();
  });
});

describe('stream() — toolset compilation', () => {
  it('resolves toolset from registry and passes tools to pi-ai', async () => {
    const registry = createToolsetRegistry();
    const toolset = buildIntentsToolset([
      { commandId: 'grid-view', title: 'Grid View', description: 'Switch to grid layout' },
    ]);
    registry.register('intents', toolset);

    mockStream.mockReturnValue(fakeEventStream([
      { type: 'done', reason: 'stop', message: makeAssistantMessage('dispatched') },
    ]));

    const backend = createPiAiBackend({ registry });
    const req = makeRequest('show grid', { toolset: 'intents' });
    const events: StreamEvent<PiAiMeta>[] = [];
    for await (const e of backend.stream(req)) events.push(e);

    // Verify tools were compiled and passed to pi-ai
    const [, context] = mockStream.mock.calls[0];
    expect(context.tools).toBeDefined();
    expect(context.tools).toHaveLength(1);
    expect(context.tools[0].name).toBe('dispatch');
    // System prompt should include toolset system
    expect(context.systemPrompt).toContain('in-app Assistant');
  });

  it('accepts inline toolset definition', async () => {
    mockStream.mockReturnValue(fakeEventStream([
      { type: 'done', reason: 'stop', message: makeAssistantMessage('ok') },
    ]));

    const inlineToolset = {
      system: 'You are a helper',
      context: () => 'current state',
      tools: () => ({
        myTool: { description: 'Does a thing', inputSchema: { type: 'object' as const, properties: {} } },
      }),
    };

    const backend = createPiAiBackend();
    const req = makeRequest('do thing', { toolset: inlineToolset });
    for await (const _e of backend.stream(req)) { /* consume */ }

    const [, context] = mockStream.mock.calls[0];
    expect(context.tools).toHaveLength(1);
    expect(context.tools[0].name).toBe('myTool');
  });
});

describe('streamUI() — tool validation', () => {
  it('emits tool-input-error instead of success for invalid tool arguments', async () => {
    const toolCall = { type: 'toolCall', id: 'tc-invalid', name: 'update_template', arguments: { description: 'missing id' } };
    mockStream.mockReturnValue(fakeEventStream([
      { type: 'toolcall_end', contentIndex: 0, toolCall, partial: {} },
      { type: 'done', reason: 'toolUse', message: makeAssistantMessage('') },
    ]));

    const backend = createPiAiBackend();
    const response = backend.streamUI({
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'update it' }] }],
      toolset: 'logo-test',
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      maxSteps: 1,
      loadCredentials: () => ({ anthropic: 'test-key' }),
      loadToolset: () => ({
        system: 'test',
        tools: {
          update_template: tool({
            description: 'update template',
            inputSchema: z.object({
              templateId: z.string(),
              description: z.string().optional(),
            }),
            execute: vi.fn(async args => ({ applied: true, ...args })),
          }) as unknown as HudsonTool,
        },
      }),
    });

    const body = await response.text();
    expect(body).toContain('tool-input-error');
    expect(body).toContain('templateId');
    expect(body).not.toContain('tool-output-available');
  });
});

describe('streamUI() — schema compilation', () => {
  it('preserves a raw JSON-Schema tool (no toJSONSchema) through to pi-ai', async () => {
    // Portable, AI-SDK-free toolsets (like the built-in `intents` toolset) pass
    // a plain JSON Schema. It must reach pi-ai intact, not collapse to an empty
    // object — same behavior the lower-level stream() path already has.
    mockStream.mockReturnValue(fakeEventStream([
      { type: 'done', reason: 'stop', message: makeAssistantMessage('ok') },
    ]));

    const backend = createPiAiBackend();
    const response = backend.streamUI({
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'go' }] }],
      toolset: 'raw',
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      maxSteps: 1,
      loadCredentials: () => ({ anthropic: 'test-key' }),
      loadToolset: () => ({
        system: 'test',
        tools: {
          dispatch: {
            description: 'dispatch',
            inputSchema: {
              type: 'object' as const,
              properties: { commandId: { type: 'string' } },
              required: ['commandId'],
            },
            execute: async (a: Record<string, unknown>) => ({ ok: true, ...a }),
          },
        },
      }),
    });

    await response.text();
    const [, context] = mockStream.mock.calls[0] as [unknown, { tools: { name: string; parameters: Record<string, unknown> }[] }];
    expect(context.tools).toHaveLength(1);
    expect(context.tools[0].name).toBe('dispatch');
    expect(context.tools[0].parameters).toMatchObject({
      type: 'object',
      properties: { commandId: { type: 'string' } },
    });
  });
});

describe('streamUI() — reasoning effort', () => {
  it.each([
    [undefined, undefined],
    ['off', undefined],
    ['low', 'low'],
    ['medium', 'medium'],
    ['high', 'high'],
  ] as const)('maps effort %s through pi-ai streamSimple', async (effort, reasoning) => {
    mockStream.mockReturnValue(fakeEventStream([
      { type: 'done', reason: 'stop', message: makeAssistantMessage('ok') },
    ]));

    const backend = createPiAiBackend();
    const response = backend.streamUI({
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'think' }] }],
      toolset: 'none',
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      maxSteps: 1,
      effort,
      loadCredentials: () => ({ anthropic: 'test-key' }),
      loadToolset: () => ({ system: 'test', tools: {} }),
    });

    await response.text();

    expect(mockStreamSimple).toHaveBeenCalledOnce();
    const options = mockStreamSimple.mock.calls[0]?.[2];
    expect(options).toEqual({
      apiKey: 'test-key',
      ...(reasoning ? { reasoning } : {}),
    });
  });
});
