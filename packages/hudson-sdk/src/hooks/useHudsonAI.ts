'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
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
  onToolCall?: (toolName: string, args: Record<string, unknown>) => void;
  /** Override inference mode per-call. If omitted, reads the platform default from settings. */
  mode?: AIMode;
  /** Attachable context the user can toggle on per-message */
  attachments?: AIAttachment[];
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

export function useHudsonAI({ toolset, context, onToolCall, mode, attachments }: UseHudsonAIOptions) {
  const onToolCallRef = useRef(onToolCall);
  onToolCallRef.current = onToolCall;

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
  const resolvedMode = mode ?? settings.aiMode ?? 'cli';

  // Build context with active attachments resolved at send time.
  // The transport body is rebuilt when context/attachments change.
  const activeAttachmentsRef = useRef(activeAttachments);
  activeAttachmentsRef.current = activeAttachments;
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;

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
          context: { ...context, ...resolved },
          mode: resolvedMode,
        };
      },
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
    mode: resolvedMode,
    /** Available attachments defined by the app */
    attachments: attachments ?? [],
    /** Which attachment labels are currently active */
    activeAttachments,
    /** Toggle an attachment on/off by label */
    toggleAttachment,
  };
}
