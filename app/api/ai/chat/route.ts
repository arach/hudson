import { streamText, createUIMessageStreamResponse } from 'ai';
import { loadToolset } from '../toolsets';
import { resolveModel } from '../providers';
import { streamFromCLI } from './cli';

export async function POST(req: Request) {
  const { messages, toolset, context = {}, mode: requestedMode, sessionId, provider, model } = await req.json();
  const mode = requestedMode ?? process.env.AI_DEFAULT_MODE ?? 'api';

  if (mode === 'cli') {
    return streamFromCLI(messages, toolset, context, sessionId);
  }

  const { tools, system } = loadToolset(toolset, context);

  const result = streamText({
    model: resolveModel(provider, model),
    system,
    messages,
    tools: tools as Parameters<typeof streamText>[0]['tools'],
  });

  return createUIMessageStreamResponse({
    stream: result.toUIMessageStream(),
  });
}
