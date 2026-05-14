import { convertToModelMessages } from 'ai';
import { createVercelAiBackend } from '@hudson/ai-backends';
import type { VercelAiUIFinishEvent } from '@hudson/ai-backends';
import { loadToolset } from '../toolsets';
import { resolveModel } from '../providers';
import { streamFromCLI } from './cli';

const backend = createVercelAiBackend();

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[${ts}] ai/chat: ${msg}`);
}

// CLI mode only works for providers that have a local CLI binary speaking
// stream-json. Everything else (copilot, openai, minimax, …) must go API.
const CLI_CAPABLE_PROVIDERS = new Set(['anthropic', 'claude']);

export async function POST(req: Request) {
  const { messages, toolset, context = {}, mode: requestedMode, sessionId, provider, model } = await req.json();
  const requested = requestedMode ?? process.env.AI_DEFAULT_MODE ?? 'api';

  // If the caller asked for CLI but their provider isn't CLI-capable, fall
  // back to API. Picking copilot/gemini + CLI mode used to silently spawn
  // `claude` with the wrong model and fail.
  const useCli = requested === 'cli' && (!provider || CLI_CAPABLE_PROVIDERS.has(provider));
  const mode = useCli ? 'cli' : 'api';
  if (requested === 'cli' && !useCli) {
    log(`forcing api mode: provider "${provider}" is not CLI-capable`);
  }

  log(`${mode} | ${provider ?? 'default'}/${model ?? 'default'} | toolset=${toolset} | ${messages.length} messages`);

  if (mode === 'cli') {
    return streamFromCLI(messages, toolset, context, sessionId);
  }

  try {
    const { tools, system } = loadToolset(toolset, context);
    const toolNames = Object.keys(tools);
    log(`tools: [${toolNames.join(', ')}] | system: ${system?.length ?? 0} chars`);

    const modelMessages = await convertToModelMessages(messages);
    log(`converted ${messages.length} UI messages → ${modelMessages.length} model messages`);

    // Probe resolveModel synchronously so we can log + 500 on credential
    // errors before opening the stream.
    const resolvedModel = resolveModel(provider, model) as { modelId?: string };
    log(`model resolved: ${resolvedModel.modelId ?? 'unknown'}`);

    return backend.streamUI({
      messages: modelMessages,
      system,
      tools,
      config: { provider, model, resolveModel },
      onFinish: ({ text, finishReason, totalTokens }: VercelAiUIFinishEvent) => {
        log(`finished: reason=${finishReason} | tokens=${totalTokens ?? '?'} | text=${text.length} chars`);
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`ERROR: ${message}`);
    return new Response(message || 'Unknown error in /api/ai/chat', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}
