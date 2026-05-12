import { streamFromCLI } from './cli';
import { streamFromPiAI } from './pi';

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
    return streamFromPiAI(messages, toolset, context, sessionId, provider, model, req.signal);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`ERROR: ${message}`);
    return new Response(message || 'Unknown error in /api/ai/chat', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}
