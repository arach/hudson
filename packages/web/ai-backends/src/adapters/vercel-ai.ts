// ---------------------------------------------------------------------------
// vercel-ai adapter — wraps the Vercel AI SDK's streamText() so it satisfies
// the Hudson Backend interface.
//
// Two surfaces:
//   * stream(req): the Backend interface — yields Hudson StreamEvent.
//   * streamUI(req): returns a Next-compatible Response carrying the standard
//     UIMessageStream. Hudson's chat route uses this fast path so the client
//     hooks (useHudsonAI / useChat) see the SDK-native stream shape verbatim
//     (text-deltas, tool-input-streaming, etc).
//
// The model is supplied at dispatch time by an injected resolveModel() — the
// package itself never imports a specific provider. Toolsets can be passed
// in directly via VercelAiConfig.tools/system OR resolved via the registry
// using the toolset id in the request.
// ---------------------------------------------------------------------------

import {
  streamText,
  stepCountIs,
  createUIMessageStreamResponse,
  type ModelMessage,
} from 'ai';

/**
 * Default tool-call budget per request.
 *
 * Vercel AI SDK's default is `stepCountIs(1)` — model can do exactly one
 * round of tool calls, then stops. That's wrong for any agentic workflow
 * where the model needs to call multiple tools (or the same tool N times)
 * before producing the final response.
 *
 * 12 is comfortable headroom for "iterate on N picks → N create_template
 * calls + 1 summary" type flows without letting a runaway model loop.
 */
const DEFAULT_MAX_STEPS = 12;

import type {
  Backend,
  DispatchRequest,
  DispatchResult,
  StreamEvent,
  Message,
} from '../types';
import { aggregateStream } from '../dispatch';
import type { ToolsetDefinition } from '../toolsets/types';
import type { ToolsetRegistry } from '../toolsets/registry';
import { defaultRegistry } from '../toolsets/registry';

// ---------------------------------------------------------------------------
// Config + meta types
// ---------------------------------------------------------------------------

export interface VercelAiConfig {
  provider: string;
  model: string;
  /**
   * Resolve a (provider, model) pair to a Vercel AI SDK LanguageModel.
   * Injected by the caller so this package stays free of provider deps.
   */
  resolveModel: (provider: string, model: string) => unknown;
  /** Optional toolset id; resolved via the registry. */
  toolset?: string;
  /** Optional context passed to toolset.context() and toolset.tools(). */
  context?: Record<string, unknown>;
}

export interface VercelAiMeta {
  finishReason?: string;
  totalTokens?: number;
}

export interface VercelAiBackendOptions {
  registry?: ToolsetRegistry;
}

// ---------------------------------------------------------------------------
// Pre-resolved request shape (for streamUI fast path).
//
// The route already calls Hudson's loadToolset() before invoking the backend,
// so we accept the tools/system pre-resolved. This keeps the adapter free of
// `loadToolset`-specific concerns (Zod schemas, toolPrompt, etc.).
// ---------------------------------------------------------------------------

export interface VercelAiUIFinishEvent {
  text: string;
  finishReason?: string;
  totalTokens?: number;
}

export interface VercelAiUIRequest {
  messages: ModelMessage[];
  system?: string;
  tools?: Record<string, unknown>;
  config: VercelAiConfig;
  signal?: AbortSignal;
  /** Max number of streamText steps. Defaults to {@link DEFAULT_MAX_STEPS}. */
  maxSteps?: number;
  /** Fires once the upstream streamText() completes. Mirrors streamText.onFinish. */
  onFinish?: (event: VercelAiUIFinishEvent) => void;
}

// ---------------------------------------------------------------------------
// Hudson Message[] → Vercel ModelMessage[] conversion
// (used by the stream() path; streamUI() takes ModelMessage[] directly)
// ---------------------------------------------------------------------------

function toModelMessages(messages: Message[], input: string): ModelMessage[] {
  const result: ModelMessage[] = [];

  for (const msg of messages) {
    const text = typeof msg.content === 'string'
      ? msg.content
      : msg.content.filter((p) => p.type === 'text').map((p) => p.text ?? '').join('');

    if (msg.role === 'user') {
      result.push({ role: 'user', content: text });
    } else if (msg.role === 'assistant') {
      result.push({ role: 'assistant', content: text });
    } else if (msg.role === 'system') {
      result.push({ role: 'system', content: text });
    }
    // tool role messages skipped — they only make sense paired with a prior tool call
  }

  if (input) {
    result.push({ role: 'user', content: input });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Toolset → Vercel tools compilation (for stream() path)
// ---------------------------------------------------------------------------

interface CompiledToolset {
  tools?: Record<string, unknown>;
  system?: string;
}

function compileToolset(
  req: DispatchRequest<VercelAiConfig>,
  registry: ToolsetRegistry,
): CompiledToolset {
  const toolsetRef = req.toolset ?? req.config.toolset;
  if (!toolsetRef) return {};

  let definition: ToolsetDefinition | null = null;
  if (typeof toolsetRef === 'string') {
    definition = registry.resolve(toolsetRef);
  } else {
    definition = toolsetRef;
  }
  if (!definition) return {};

  const ctx = req.config.context ?? {};
  const tools = definition.tools(ctx);
  const systemSuffix = [definition.system, definition.context(ctx)]
    .filter(Boolean)
    .join('\n\n');

  return {
    tools: Object.keys(tools).length > 0 ? tools : undefined,
    system: systemSuffix || undefined,
  };
}

// ---------------------------------------------------------------------------
// Event translation: TextStreamPart → Hudson StreamEvent
// ---------------------------------------------------------------------------

type AnyChunk = { type: string; [key: string]: unknown };

function* translateChunk(chunk: AnyChunk): Iterable<StreamEvent<VercelAiMeta>> {
  switch (chunk.type) {
    case 'text-delta':
      yield { type: 'text', delta: String(chunk.text ?? '') };
      break;

    case 'reasoning-delta':
      yield { type: 'reasoning', delta: String(chunk.text ?? '') };
      break;

    case 'tool-call':
      yield {
        type: 'tool_call',
        id: String(chunk.toolCallId ?? ''),
        name: String(chunk.toolName ?? ''),
        input: chunk.input,
      };
      break;

    case 'tool-result':
      yield {
        type: 'tool_result',
        id: String(chunk.toolCallId ?? ''),
        output: chunk.output,
      };
      break;

    case 'tool-error':
      yield {
        type: 'tool_result',
        id: String(chunk.toolCallId ?? ''),
        output: undefined,
        error: chunk.error instanceof Error ? chunk.error.message : String(chunk.error),
      };
      break;

    case 'finish': {
      const usage = chunk.totalUsage as { inputTokens?: number; outputTokens?: number; totalTokens?: number } | undefined;
      yield {
        type: 'usage',
        input: usage?.inputTokens ?? 0,
        output: usage?.outputTokens ?? 0,
      };
      yield {
        type: 'done',
        meta: {
          finishReason: chunk.finishReason as string | undefined,
          totalTokens: usage?.totalTokens,
        },
      };
      break;
    }

    case 'error': {
      const err = chunk.error;
      yield {
        type: 'error',
        message: err instanceof Error ? err.message : String(err ?? 'unknown error'),
        recoverable: false,
      };
      break;
    }

    case 'abort':
      yield {
        type: 'error',
        message: 'Stream aborted',
        recoverable: true,
      };
      break;

    // text-start, text-end, reasoning-start/end, tool-input-*, start, start-step,
    // finish-step, source, file, raw — no Hudson StreamEvent equivalent, skip
  }
}

// ---------------------------------------------------------------------------
// Extended Backend interface — adds the UIMessageStream fast path
// ---------------------------------------------------------------------------

export interface VercelAiBackend extends Backend<VercelAiConfig, VercelAiMeta> {
  /**
   * Fast path: run streamText() and return a UIMessageStream-shaped Response
   * directly. Preserves full SDK fidelity (partial tool inputs, reasoning
   * tokens, all UIMessageChunk variants) which the StreamEvent translator
   * would otherwise drop.
   */
  streamUI(req: VercelAiUIRequest): Response;
}

// ---------------------------------------------------------------------------
// Backend factory
// ---------------------------------------------------------------------------

export function createVercelAiBackend(opts?: VercelAiBackendOptions): VercelAiBackend {
  const registry = opts?.registry ?? defaultRegistry;

  const backend: VercelAiBackend = {
    id: 'vercel-ai',
    label: 'Vercel AI SDK',
    surface: 'chat',
    capabilities: {
      streaming: true,
      sessions: false,
      auth: 'api-key',
      relay: 'none',
      models: true,
    },

    async *stream(req: DispatchRequest<VercelAiConfig>): AsyncIterable<StreamEvent<VercelAiMeta>> {
      const { provider, model: modelId, resolveModel } = req.config;

      let model: unknown;
      try {
        model = resolveModel(provider, modelId);
      } catch (err) {
        yield {
          type: 'error',
          message: err instanceof Error ? err.message : String(err),
          recoverable: false,
        };
        return;
      }

      const systemParts: string[] = [];
      if (req.system) systemParts.push(req.system);

      const compiled = compileToolset(req, registry);
      if (compiled.system) systemParts.push(compiled.system);

      const result = streamText({
        model: model as Parameters<typeof streamText>[0]['model'],
        system: systemParts.join('\n\n') || undefined,
        messages: toModelMessages(req.messages, req.input),
        tools: compiled.tools as Parameters<typeof streamText>[0]['tools'],
        stopWhen: stepCountIs(DEFAULT_MAX_STEPS),
        abortSignal: req.signal,
      });

      for await (const chunk of result.fullStream) {
        if (req.signal?.aborted) return;
        for (const translated of translateChunk(chunk as AnyChunk)) {
          yield translated;
        }
      }
    },

    async dispatch(req: DispatchRequest<VercelAiConfig>): Promise<DispatchResult<VercelAiMeta>> {
      return aggregateStream(backend, req);
    },

    streamUI(req: VercelAiUIRequest): Response {
      const { provider, model: modelId, resolveModel } = req.config;
      const resolvedModel = resolveModel(provider, modelId);

      const result = streamText({
        model: resolvedModel as Parameters<typeof streamText>[0]['model'],
        system: req.system,
        messages: req.messages,
        tools: req.tools as Parameters<typeof streamText>[0]['tools'],
        stopWhen: stepCountIs(req.maxSteps ?? DEFAULT_MAX_STEPS),
        abortSignal: req.signal,
        onFinish: req.onFinish
          ? ({ text, finishReason, totalUsage }) => {
              req.onFinish!({
                text,
                finishReason,
                totalTokens: totalUsage?.totalTokens,
              });
            }
          : undefined,
      });

      return createUIMessageStreamResponse({
        stream: result.toUIMessageStream(),
      });
    },
  };

  return backend;
}
