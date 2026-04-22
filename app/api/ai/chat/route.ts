import { streamText, createUIMessageStreamResponse, convertToModelMessages } from 'ai';
import { loadToolset } from '../toolsets';
import { resolveModel } from '../providers';
import { streamFromCLI } from './cli';

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[${ts}] ai/chat: ${msg}`);
}

export async function POST(req: Request) {
  const { messages, toolset, context = {}, mode: requestedMode, sessionId, provider, model } = await req.json();
  const mode = requestedMode ?? process.env.AI_DEFAULT_MODE ?? 'api';

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

    const resolvedModel = resolveModel(provider, model);
    log(`model resolved: ${resolvedModel.modelId ?? 'unknown'}`);

    const result = streamText({
      model: resolvedModel,
      system,
      messages: modelMessages,
      tools: tools as Parameters<typeof streamText>[0]['tools'],
      onFinish: ({ text, finishReason, usage }) => {
        log(`finished: reason=${finishReason} | tokens=${usage?.totalTokens ?? '?'} | text=${text.length} chars`);
      },
    });

    return createUIMessageStreamResponse({
      stream: result.toUIMessageStream(),
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
