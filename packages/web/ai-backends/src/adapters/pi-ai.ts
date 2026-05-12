// ---------------------------------------------------------------------------
// pi-ai adapter — in-process dispatch via @earendil-works/pi-ai
//
// Streaming-first: translates pi-ai's AssistantMessageEvent stream into
// Hudson's 8 semantic StreamEvent types. Stateless — no sessions.
// ---------------------------------------------------------------------------

import {
  stream as piAiStream,
  getModel,
  getEnvApiKey,
  type AssistantMessageEvent,
  type Context,
  type Message as PiAiMessage,
  type UserMessage,
  type AssistantMessage as PiAiAssistantMessage,
  type TextContent,
  type Tool as PiAiTool,
} from '@earendil-works/pi-ai';

import type {
  Backend,
  DispatchRequest,
  DispatchResult,
  StreamEvent,
  Message,
} from '../types';
import type { CredentialResolver } from '../credentials';
import { hudVaultResolver } from '../credentials';
import { aggregateStream } from '../dispatch';
import type { ToolsetDefinition } from '../toolsets/types';
import type { ToolsetRegistry } from '../toolsets/registry';
import { defaultRegistry } from '../toolsets/registry';

// ---------------------------------------------------------------------------
// Config + meta types
// ---------------------------------------------------------------------------

export interface PiAiConfig {
  provider: string;
  model: string;
  systemPrompt?: string;
  apiKey?: string;
}

export interface PiAiMeta {
  responseId?: string;
  responseModel?: string;
  stopReason?: string;
}

export interface PiAiBackendOptions {
  credentials?: CredentialResolver;
  registry?: ToolsetRegistry;
}

// ---------------------------------------------------------------------------
// Message conversion: Hudson Message[] → pi-ai Message[]
// ---------------------------------------------------------------------------

function toPiAiMessages(messages: Message[], input: string): PiAiMessage[] {
  const now = Date.now();
  const result: PiAiMessage[] = [];

  for (const msg of messages) {
    const text = typeof msg.content === 'string'
      ? msg.content
      : msg.content.filter((p) => p.type === 'text').map((p) => p.text ?? '').join('');

    if (msg.role === 'user') {
      result.push({ role: 'user', content: text, timestamp: now } satisfies UserMessage);
    } else if (msg.role === 'assistant') {
      result.push({
        role: 'assistant',
        content: [{ type: 'text', text }],
        api: 'anthropic-messages',
        provider: 'anthropic',
        model: '(historical)',
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
        stopReason: 'stop',
        timestamp: now,
      } satisfies PiAiAssistantMessage);
    }
    // system messages are handled via systemPrompt; tool messages are skipped
  }

  // Append current user input
  result.push({ role: 'user', content: input, timestamp: now } satisfies UserMessage);

  return result;
}

// ---------------------------------------------------------------------------
// Toolset → pi-ai Tool[] compilation
// ---------------------------------------------------------------------------

function compileTools(
  req: DispatchRequest<PiAiConfig>,
  registry: ToolsetRegistry,
): { tools?: PiAiTool[]; systemSuffix?: string } {
  const toolsetRef = req.toolset;
  if (!toolsetRef) return {};

  let definition: ToolsetDefinition | null = null;
  if (typeof toolsetRef === 'string') {
    definition = registry.resolve(toolsetRef);
  } else {
    definition = toolsetRef;
  }
  if (!definition) return {};

  const ctx: Record<string, unknown> = {};
  const rawTools = definition.tools(ctx);
  const systemSuffix = [definition.system, definition.context(ctx)].filter(Boolean).join('\n\n');

  const tools: PiAiTool[] = Object.entries(rawTools).map(([name, def]) => {
    const d = def as { description?: string; inputSchema?: unknown };
    return {
      name,
      description: d.description ?? '',
      parameters: (d.inputSchema ?? { type: 'object', properties: {} }) as PiAiTool['parameters'],
    };
  });

  return { tools: tools.length > 0 ? tools : undefined, systemSuffix };
}

// ---------------------------------------------------------------------------
// Event translation: pi-ai AssistantMessageEvent → Hudson StreamEvent
// ---------------------------------------------------------------------------

function* translateEvent(event: AssistantMessageEvent): Iterable<StreamEvent<PiAiMeta>> {
  switch (event.type) {
    case 'text_delta':
      yield { type: 'text', delta: event.delta };
      break;

    case 'thinking_delta':
      yield { type: 'reasoning', delta: event.delta };
      break;

    case 'toolcall_end':
      yield {
        type: 'tool_call',
        id: event.toolCall.id,
        name: event.toolCall.name,
        input: event.toolCall.arguments,
      };
      break;

    case 'done': {
      const msg = event.message;
      yield {
        type: 'usage',
        input: msg.usage.input,
        output: msg.usage.output,
        cost: msg.usage.cost.total,
      };
      yield {
        type: 'done',
        meta: {
          responseId: msg.responseId,
          responseModel: msg.responseModel,
          stopReason: msg.stopReason,
        },
      };
      break;
    }

    case 'error': {
      const err = event.error;
      yield {
        type: 'error',
        message: err.errorMessage ?? `Stream error: ${event.reason}`,
        recoverable: event.reason === 'aborted',
      };
      break;
    }

    // start, text_start, text_end, thinking_start, thinking_end, toolcall_start,
    // toolcall_delta — no Hudson StreamEvent equivalent, skip
  }
}

// ---------------------------------------------------------------------------
// Backend factory
// ---------------------------------------------------------------------------

export function createPiAiBackend(opts?: PiAiBackendOptions): Backend<PiAiConfig, PiAiMeta> {
  const credentials = opts?.credentials ?? hudVaultResolver;
  const registry = opts?.registry ?? defaultRegistry;

  return {
    id: 'pi-ai',
    label: 'Pi AI',
    surface: 'chat',
    capabilities: {
      streaming: true,
      sessions: false,
      auth: 'api-key',
      relay: 'none',
      models: true,
    },

    async status(config: PiAiConfig) {
      // If caller provided an apiKey directly, we're good
      if (config.apiKey) return { available: true };

      // Try env key
      const envKey = getEnvApiKey(config.provider);
      if (envKey) return { available: true };

      // Try injected credential resolver
      const cred = await credentials({ provider: config.provider });
      if (cred?.apiKey) return { available: true };

      return {
        available: false,
        reason: `No API key for ${config.provider}. Set ${config.provider.toUpperCase().replace(/-/g, '_')}_API_KEY or configure credentials.`,
      };
    },

    async *stream(req: DispatchRequest<PiAiConfig>): AsyncIterable<StreamEvent<PiAiMeta>> {
      const { provider, model: modelId, systemPrompt, apiKey: configKey } = req.config;

      // Resolve API key: config > env > credential resolver
      let apiKey = configKey;
      if (!apiKey) apiKey = getEnvApiKey(provider);
      if (!apiKey) {
        const cred = await credentials({ provider });
        apiKey = cred?.apiKey;
      }
      if (!apiKey) {
        yield {
          type: 'error',
          message: `No API key for ${provider}`,
          recoverable: false,
        };
        return;
      }

      const model = getModel(provider as never, modelId as never);

      // Build system prompt
      const systemParts: string[] = [];
      if (req.system) systemParts.push(req.system);
      if (systemPrompt) systemParts.push(systemPrompt);

      // Compile toolset
      const { tools, systemSuffix } = compileTools(req, registry);
      if (systemSuffix) systemParts.push(systemSuffix);

      const context: Context = {
        systemPrompt: systemParts.join('\n\n') || undefined,
        messages: toPiAiMessages(req.messages, req.input),
        tools,
      };

      const eventStream = piAiStream(model, context, {
        apiKey,
        cacheRetention: 'short',
        signal: req.signal,
      });

      for await (const event of eventStream) {
        if (req.signal?.aborted) return;
        for (const translated of translateEvent(event)) {
          yield translated;
        }
      }
    },

    async dispatch(req: DispatchRequest<PiAiConfig>): Promise<DispatchResult<PiAiMeta>> {
      return aggregateStream(this as Backend<PiAiConfig, PiAiMeta>, req);
    },
  };
}
