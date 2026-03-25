'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isToolUIPart, getToolName } from 'ai';
import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { usePersistentState } from './usePersistentState';

type AIMode = 'cli' | 'api';

export interface AIAttachment {
  /** Short label shown on the toggle (e.g. "SVG", "State", "Screenshot") */
  label: string;
  /** Called at send time to produce the content. Can return string, object, or null to skip. */
  content: () => string | Record<string, unknown> | null;
}

export interface UseHudsonAIOptions {
  /** Toolset ID — matches a registered toolset on the server */
  toolset: string;
  /** Dynamic context sent with each request (current app state) */
  context?: Record<string, unknown>;
  /** Called when the model invokes a tool — apply state changes here */
  onToolCall?: (toolName: string, args: Record<string, unknown>) => void | Promise<void>;
  /** Override inference mode per-call. If omitted, reads the platform default from settings. */
  mode?: AIMode;
  /** Attachable context the user can toggle on per-message */
  attachments?: AIAttachment[];
  /** AI provider name (e.g. 'minimax', 'anthropic', 'openai', 'groq') */
  provider?: string;
  /** Model ID override (e.g. 'MiniMax-M2.7', 'claude-sonnet-4-20250514') */
  model?: string;
}

export type HudsonAIChat = ReturnType<typeof useHudsonAI>;

export function useHudsonAI({ toolset, context, onToolCall, mode, attachments, provider, model }: UseHudsonAIOptions) {
  const onToolCallRef = useRef(onToolCall);
  onToolCallRef.current = onToolCall;

  // CLI session ID — one per chat lifetime, regenerated on clear
  const sessionIdRef = useRef(crypto.randomUUID());

  // Track which attachments are toggled on
  const [activeAttachments, setActiveAttachments] = useState<Set<string>>(new Set());

  const toggleAttachment = useCallback((label: string) => {
    setActiveAttachments(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);

  // Read platform-level AI mode preference; per-call `mode` overrides it
  const [settings] = usePersistentState<{ aiMode?: AIMode }>('hudson.settings', {});
  const resolvedMode = mode ?? settings.aiMode ?? 'api';

  // Refs for values that change frequently but should NOT cause transport recreation.
  // The body function reads from refs at send time — always fresh, no re-init.
  const activeAttachmentsRef = useRef(activeAttachments);
  activeAttachmentsRef.current = activeAttachments;
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;
  const contextRef = useRef(context);
  contextRef.current = context;
  const providerRef = useRef(provider);
  providerRef.current = provider;
  const modelRef = useRef(model);
  modelRef.current = model;

  const transport = useMemo(
    () => new DefaultChatTransport({
      api: '/api/ai/chat',
      body: () => {
        // Resolve active attachments at send time
        const resolved: Record<string, unknown> = {};
        for (const att of attachmentsRef.current ?? []) {
          if (activeAttachmentsRef.current.has(att.label)) {
            const value = att.content();
            if (value !== null) resolved[att.label.toLowerCase()] = value;
          }
        }
        return {
          toolset,
          context: { ...contextRef.current, ...resolved },
          mode: resolvedMode,
          sessionId: sessionIdRef.current,
          provider: providerRef.current,
          model: modelRef.current,
        };
      },
    }),
    // Only recreate transport when toolset or mode changes — NOT on context/provider/model
    // Those are read from refs at send time.
    [toolset, resolvedMode],
  );

  const chat = useChat({ transport });

  const clearChat = useCallback(() => {
    sessionIdRef.current = crypto.randomUUID();
    chat.setMessages([]);
  }, [chat]);

  // Watch for tool parts in messages and fire the callback
  const { messages } = chat;
  const processedRef = useRef(new Set<string>());

  useEffect(() => {
    if (!onToolCallRef.current) return;

    for (const msg of messages) {
      if (msg.role !== 'assistant') continue;
      for (const part of msg.parts) {
        if (isToolUIPart(part)) {
          // Wait until input is fully available — during 'input-streaming'
          // the input may be undefined or partial
          if (part.state === 'input-streaming') continue;
          const key = part.toolCallId;
          if (!processedRef.current.has(key)) {
            processedRef.current.add(key);
            const name = getToolName(part);
            onToolCallRef.current(
              name,
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
    clearChat,
    error: chat.error,
    mode: resolvedMode,
    /** Available attachments defined by the app */
    attachments: attachments ?? [],
    /** Which attachment labels are currently active */
    activeAttachments,
    /** Toggle an attachment on/off by label */
    toggleAttachment,
  };
}
