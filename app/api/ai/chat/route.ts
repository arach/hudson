import { streamText, createUIMessageStreamResponse } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { loadToolset } from '../toolsets';
import { streamFromCLI } from './cli';

export async function POST(req: Request) {
  const { messages, toolset, context = {}, mode: requestedMode } = await req.json();
  const mode = requestedMode ?? process.env.AI_DEFAULT_MODE ?? 'cli';

  if (mode === 'cli') {
    return streamFromCLI(messages, toolset, context);
  }

  const { tools, system } = loadToolset(toolset, context);

  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system,
    messages,
    tools: tools as Parameters<typeof streamText>[0]['tools'],
  });

  return createUIMessageStreamResponse({
    stream: result.toUIMessageStream(),
  });
}
