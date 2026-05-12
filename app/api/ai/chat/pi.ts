import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  type UIMessage,
} from 'ai';
import {
  streamSimple,
  type Api,
  type AssistantMessage,
  type Context as PiContext,
  type ImageContent,
  type Message as PiMessage,
  type Model,
  type TextContent,
  type Tool as PiTool,
  type ToolCall,
} from '@earendil-works/pi-ai';
import { z } from 'zod';
import { loadToolset } from '../toolsets';
import { resolveApiKey, resolveModel } from '../providers';

interface HudsonTool {
  description?: string;
  inputSchema?: z.ZodType;
  execute?: (args: Record<string, unknown>) => Promise<unknown>;
}

interface UIMessageLike {
  id?: string;
  role: string;
  parts?: Array<Record<string, unknown>>;
}

const EMPTY_USAGE: AssistantMessage['usage'] = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    total: 0,
  },
};

const MAX_TOOL_STEPS = 5;

function textFromParts(parts: Array<Record<string, unknown>> | undefined): string {
  return (parts ?? [])
    .filter(part => part.type === 'text' && typeof part.text === 'string')
    .map(part => part.text as string)
    .join('\n')
    .trim();
}

function imageFromDataUrl(url: unknown, mediaType: unknown): ImageContent | null {
  if (typeof url !== 'string' || !url.startsWith('data:')) return null;
  const match = /^data:([^;,]+);base64,([\s\S]*)$/.exec(url);
  if (!match) return null;

  return {
    type: 'image',
    mimeType: typeof mediaType === 'string' ? mediaType : match[1],
    data: match[2],
  };
}

function imagePartsFromMessage(message: UIMessageLike): ImageContent[] {
  return (message.parts ?? [])
    .filter(part => part.type === 'file')
    .map(part => imageFromDataUrl(part.url, part.mediaType))
    .filter((part): part is ImageContent => part !== null);
}

function assistantMessageFromText(text: string, model: Model<Api>): AssistantMessage {
  return {
    role: 'assistant',
    content: [{ type: 'text', text }],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: EMPTY_USAGE,
    stopReason: 'stop',
    timestamp: Date.now(),
  };
}

function convertMessages(messages: UIMessageLike[], model: Model<Api>): PiMessage[] {
  const converted: PiMessage[] = [];

  for (const message of messages) {
    const text = textFromParts(message.parts);

    if (message.role === 'user') {
      const images = imagePartsFromMessage(message);
      if (!text && images.length === 0) continue;

      const content: string | (TextContent | ImageContent)[] = images.length > 0
        ? [
            ...(text ? [{ type: 'text' as const, text }] : []),
            ...images,
          ]
        : text;

      converted.push({
        role: 'user',
        content,
        timestamp: Date.now(),
      });
      continue;
    }

    if (message.role === 'assistant' && text) {
      converted.push(assistantMessageFromText(text, model));
    }
  }

  return converted;
}

function schemaForTool(tool: HudsonTool): Record<string, unknown> {
  if (!tool.inputSchema) {
    return {
      type: 'object',
      properties: {},
      additionalProperties: false,
    };
  }

  try {
    return z.toJSONSchema(tool.inputSchema) as Record<string, unknown>;
  } catch {
    return {
      type: 'object',
      properties: {},
      additionalProperties: true,
    };
  }
}

function convertTools(tools: Record<string, HudsonTool>): PiTool[] {
  return Object.entries(tools).map(([name, tool]) => ({
    name,
    description: tool.description ?? '',
    parameters: schemaForTool(tool) as PiTool['parameters'],
  }));
}

async function executeTool(
  tools: Record<string, HudsonTool>,
  toolName: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  const tool = tools[toolName];
  if (!tool?.execute) return { error: `Unknown tool: ${toolName}` };

  try {
    return await tool.execute(input);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

function toolResultMessage(toolCall: ToolCall, output: unknown): PiMessage {
  return {
    role: 'toolResult',
    toolCallId: toolCall.id,
    toolName: toolCall.name,
    content: [{
      type: 'text',
      text: typeof output === 'string' ? output : JSON.stringify(output),
    }],
    isError: Boolean(output && typeof output === 'object' && 'error' in output),
    timestamp: Date.now(),
  };
}

export function streamFromPiAI(
  messages: UIMessage[],
  toolset: string,
  context: Record<string, unknown>,
  sessionId?: string,
  provider?: string,
  model?: string,
  signal?: AbortSignal,
): Response {
  const piModel = resolveModel(provider, model);
  const apiKey = resolveApiKey(piModel.provider);
  const { system, tools } = loadToolset(toolset, context);
  const hudsonTools = tools as Record<string, HudsonTool>;

  const piContext: PiContext = {
    systemPrompt: system,
    messages: convertMessages(messages as UIMessageLike[], piModel),
    tools: convertTools(hudsonTools),
  };

  const stream = createUIMessageStream({
    originalMessages: messages,
    execute: async ({ writer }) => {
      for (let step = 0; step < MAX_TOOL_STEPS; step++) {
        const textPartIds = new Map<number, string>();
        const reasoningPartIds = new Map<number, string>();
        const toolResults: PiMessage[] = [];
        let finalMessage: AssistantMessage | null = null;

        const textPartId = (contentIndex: number) => {
          let id = textPartIds.get(contentIndex);
          if (!id) {
            id = generateId();
            textPartIds.set(contentIndex, id);
          }
          return id;
        };

        const reasoningPartId = (contentIndex: number) => {
          let id = reasoningPartIds.get(contentIndex);
          if (!id) {
            id = generateId();
            reasoningPartIds.set(contentIndex, id);
          }
          return id;
        };

        const piStream = streamSimple(piModel, piContext, {
          apiKey,
          sessionId,
          signal,
          reasoning: 'low',
        });

        for await (const event of piStream) {
          switch (event.type) {
            case 'text_start':
              writer.write({ type: 'text-start', id: textPartId(event.contentIndex) });
              break;
            case 'text_delta':
              writer.write({
                type: 'text-delta',
                id: textPartId(event.contentIndex),
                delta: event.delta,
              });
              break;
            case 'text_end':
              writer.write({ type: 'text-end', id: textPartId(event.contentIndex) });
              break;
            case 'thinking_start':
              writer.write({ type: 'reasoning-start', id: reasoningPartId(event.contentIndex) });
              break;
            case 'thinking_delta':
              writer.write({
                type: 'reasoning-delta',
                id: reasoningPartId(event.contentIndex),
                delta: event.delta,
              });
              break;
            case 'thinking_end':
              writer.write({ type: 'reasoning-end', id: reasoningPartId(event.contentIndex) });
              break;
            case 'toolcall_end': {
              writer.write({
                type: 'tool-input-available',
                toolCallId: event.toolCall.id,
                toolName: event.toolCall.name,
                input: event.toolCall.arguments,
                dynamic: true,
              });

              const output = await executeTool(hudsonTools, event.toolCall.name, event.toolCall.arguments);
              writer.write({
                type: 'tool-output-available',
                toolCallId: event.toolCall.id,
                output,
                dynamic: true,
              });
              toolResults.push(toolResultMessage(event.toolCall, output));
              break;
            }
            case 'error':
              finalMessage = event.error;
              writer.write({
                type: 'error',
                errorText: event.error.errorMessage ?? 'PiAI request failed.',
              });
              return;
            case 'done':
              finalMessage = event.message;
              break;
          }
        }

        finalMessage ??= await piStream.result();
        piContext.messages.push(finalMessage);

        if (finalMessage.stopReason !== 'toolUse' || toolResults.length === 0) {
          return;
        }

        piContext.messages.push(...toolResults);
      }

      writer.write({
        type: 'error',
        errorText: `Hudson AI stopped after ${MAX_TOOL_STEPS} tool rounds.`,
      });
    },
  });

  return createUIMessageStreamResponse({ stream });
}
