import { loadToolset } from './app/api/ai/toolsets';

const DEFAULT_WORKERS_AI_MODEL = '@cf/meta/llama-3.1-8b-instruct';

interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
  AI?: {
    run(model: string, input: Record<string, unknown>): Promise<unknown>;
  };
}

interface ChatRequestBody {
  messages?: Array<{
    role?: string;
    content?: string;
    parts?: Array<Record<string, unknown>>;
  }>;
  toolset?: string;
  context?: Record<string, unknown>;
  mode?: string;
  provider?: string;
  model?: string;
}

type ChatMessage = NonNullable<ChatRequestBody['messages']>[number];

interface WorkerAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

type UIMessageChunk =
  | { type: 'start'; messageId?: string }
  | { type: 'start-step' }
  | { type: 'text-start'; id: string }
  | { type: 'text-delta'; id: string; delta: string }
  | { type: 'text-end'; id: string }
  | { type: 'tool-input-available'; toolCallId: string; toolName: string; input: unknown; dynamic: true }
  | { type: 'tool-output-available'; toolCallId: string; output: unknown; dynamic: true }
  | { type: 'finish-step' }
  | { type: 'finish'; finishReason?: 'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other' }
  | { type: 'error'; errorText: string };

type ToolExecutable = {
  execute?: (input: Record<string, unknown>) => unknown | Promise<unknown>;
};

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function extractMessageText(message: ChatMessage): string {
  if (typeof message.content === 'string') return message.content;

  const parts = Array.isArray(message.parts) ? message.parts : [];
  const text: string[] = [];

  for (const part of parts) {
    if (part.type === 'text' && typeof part.text === 'string') {
      text.push(part.text);
    } else if (part.type === 'file') {
      const filename = typeof part.filename === 'string' ? part.filename : 'attachment';
      const mediaType = typeof part.mediaType === 'string' ? part.mediaType : 'file';
      text.push(`[Attached ${mediaType}: ${filename}]`);
    }
  }

  return text.join('\n').trim();
}

function toWorkerMessages(
  messages: ChatRequestBody['messages'] = [],
  systemPrompt: string,
): WorkerAIMessage[] {
  const workerMessages: WorkerAIMessage[] = systemPrompt
    ? [{ role: 'system', content: systemPrompt }]
    : [];

  for (const message of messages) {
    const role = message.role === 'assistant' || message.role === 'system'
      ? message.role
      : 'user';
    const content = extractMessageText(message);
    if (!content) continue;
    workerMessages.push({ role, content });
  }

  return workerMessages;
}

function pickWorkersAIModel(model?: string) {
  return model?.startsWith('@cf/') ? model : DEFAULT_WORKERS_AI_MODEL;
}

function extractWorkersAIText(result: unknown): string {
  if (typeof result === 'string') return result;
  if (!result || typeof result !== 'object') return '';

  const record = result as Record<string, unknown>;
  if (typeof record.response === 'string') return record.response;
  if (typeof record.text === 'string') return record.text;
  if (typeof record.output === 'string') return record.output;

  const nested = record.result;
  if (nested && typeof nested === 'object') {
    const nestedRecord = nested as Record<string, unknown>;
    if (typeof nestedRecord.response === 'string') return nestedRecord.response;
    if (typeof nestedRecord.text === 'string') return nestedRecord.text;
  }

  return JSON.stringify(result);
}

function createUIStreamResponse(
  producer: (write: (chunk: UIMessageChunk) => void) => Promise<void>,
  init?: ResponseInit,
) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (chunk: UIMessageChunk) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      };

      try {
        await producer(write);
      } catch (error) {
        write({
          type: 'error',
          errorText: error instanceof Error ? error.message : String(error),
        });
      } finally {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    ...init,
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'x-vercel-ai-ui-message-stream': 'v1',
      'x-accel-buffering': 'no',
      ...init?.headers,
    },
  });
}

async function executeTool(
  tools: Record<string, ToolExecutable>,
  toolName: string,
  input: Record<string, unknown>,
) {
  const tool = tools[toolName];
  if (!tool?.execute) return { error: `Unknown tool: ${toolName}` };
  try {
    return await tool.execute(input);
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

async function writeAssistantResponse(
  write: (chunk: UIMessageChunk) => void,
  text: string,
  tools: Record<string, ToolExecutable>,
) {
  write({ type: 'start', messageId: createId('msg') });
  write({ type: 'start-step' });

  const toolTag = /<tool\s+name="([^"]+)">([\s\S]*?)<\/tool>/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  const writeText = (value: string) => {
    if (!value) return;
    const id = createId('text');
    write({ type: 'text-start', id });
    write({ type: 'text-delta', id, delta: value });
    write({ type: 'text-end', id });
  };

  while ((match = toolTag.exec(text)) !== null) {
    writeText(text.slice(cursor, match.index));

    const toolName = match[1];
    const inputText = match[2].trim();
    let input: Record<string, unknown>;
    try {
      input = JSON.parse(inputText) as Record<string, unknown>;
    } catch {
      writeText(match[0]);
      cursor = match.index + match[0].length;
      continue;
    }

    const toolCallId = createId('tool');
    write({
      type: 'tool-input-available',
      toolCallId,
      toolName,
      input,
      dynamic: true,
    });
    write({
      type: 'tool-output-available',
      toolCallId,
      output: await executeTool(tools, toolName, input),
      dynamic: true,
    });

    cursor = match.index + match[0].length;
  }

  writeText(text.slice(cursor));
  write({ type: 'finish-step' });
  write({ type: 'finish', finishReason: 'stop' });
}

async function handleAIChat(request: Request, env: Env) {
  if (!env.AI) {
    return createUIStreamResponse(async write => {
      write({ type: 'start', messageId: createId('msg') });
      write({ type: 'error', errorText: 'Workers AI binding is not configured for this deployment.' });
      write({ type: 'finish', finishReason: 'error' });
    }, { status: 503 });
  }

  const body = await request.json() as ChatRequestBody;
  const toolset = body.toolset ?? 'workspace';
  const context = body.context ?? {};
  const workersModel = pickWorkersAIModel(body.model);
  const { system, toolPrompt, tools } = loadToolset(toolset, context);
  const deploymentNote = [
    `This HudsonKit demo is deployed on Cloudflare and answers through Workers AI model ${workersModel}.`,
    body.mode === 'cli'
      ? 'The local CLI/PTTY relay is not available in this hosted demo; use tool calls to act through the Hudson shell instead.'
      : '',
    body.provider && body.provider !== 'workers-ai'
      ? `The browser requested provider "${body.provider}", but this deployment is pinned to Workers AI.`
      : '',
  ].filter(Boolean).join(' ');
  const systemPrompt = [system, toolPrompt, deploymentNote].filter(Boolean).join('\n\n---\n\n');
  const messages = toWorkerMessages(body.messages, systemPrompt);

  if (messages.length === 0) {
    return createUIStreamResponse(async write => {
      await writeAssistantResponse(write, 'Send a prompt and I can help with the HudsonKit workspace.', {});
    });
  }

  return createUIStreamResponse(async write => {
    const result = await env.AI!.run(workersModel, {
      messages,
      max_tokens: 900,
      temperature: 0.35,
    });
    const text = extractWorkersAIText(result);
    await writeAssistantResponse(
      write,
      text || 'Workers AI returned an empty response.',
      tools as Record<string, ToolExecutable>,
    );
  });
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/ai/health') {
      return Response.json({
        provider: 'workers-ai',
        model: DEFAULT_WORKERS_AI_MODEL,
        available: Boolean(env.AI),
      });
    }

    if (url.pathname === '/api/ai/chat' && request.method === 'POST') {
      return handleAIChat(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
