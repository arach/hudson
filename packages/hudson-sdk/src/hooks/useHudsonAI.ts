'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useEffect, useRef, useMemo } from 'react';
import { usePersistentState } from './usePersistentState';

type AIMode = 'cli' | 'api';

export interface UseHudsonAIOptions {
  /** Toolset ID — matches a registered toolset on the server */
  toolset: string;
  /** Dynamic context sent with each request (current app state) */
  context?: Record<string, unknown>;
  /** Called when the model invokes a tool — apply state changes here */
  onToolCall?: (toolName: string, args: Record<string, unknown>) => void;
  /** Override inference mode per-call. If omitted, reads the platform default from settings. */
  mode?: AIMode;
}

export type HudsonAIChat = ReturnType<typeof useHudsonAI>;

/** Check if a message part is a tool invocation (type starts with "tool-") */
function isToolPart(part: { type: string }): part is {
  type: string;
  toolCallId: string;
  input: unknown;
  state: string;
} {
  return part.type.startsWith('tool-');
}

export function useHudsonAI({ toolset, context, onToolCall, mode }: UseHudsonAIOptions) {
  const onToolCallRef = useRef(onToolCall);
  onToolCallRef.current = onToolCall;

  // Read platform-level AI mode preference; per-call `mode` overrides it
  const [settings] = usePersistentState<{ aiMode?: AIMode }>('hudson.settings', {});
  const resolvedMode = mode ?? settings.aiMode ?? 'cli';

  const transport = useMemo(
    () => new DefaultChatTransport({
      api: '/api/ai/chat',
      body: { toolset, context, mode: resolvedMode },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toolset, resolvedMode, JSON.stringify(context)],
  );

  const chat = useChat({ transport });

  // Watch for tool parts in messages and fire the callback
  const { messages } = chat;
  const processedRef = useRef(new Set<string>());

  useEffect(() => {
    if (!onToolCallRef.current) return;

    for (const msg of messages) {
      if (msg.role !== 'assistant') continue;
      for (const part of msg.parts) {
        if (isToolPart(part)) {
          const key = part.toolCallId;
          if (!processedRef.current.has(key)) {
            processedRef.current.add(key);
            const toolName = part.type.replace(/^tool-/, '');
            onToolCallRef.current(
              toolName,
              (part.input ?? {}) as Record<string, unknown>,
            );
          }
        }
      }
    }
  }, [messages]);

  return {
    messages,
    sendMessage: chat.sendMessage,
    stop: chat.stop,
    status: chat.status,
    setMessages: chat.setMessages,
    error: chat.error,
    /** The resolved AI mode for this chat (platform default or per-call override) */
    mode: resolvedMode,
  };
}
