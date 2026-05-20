'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { usePersistentState } from './usePersistentState';
import type { ChatOnErrorCallback, ChatOnFinishCallback, UIMessage } from 'ai';
import type { MutableRefObject } from 'react';

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
  /** Stable chat identifier used to preserve the same chat across remounts. */
  chatId?: string;
  /** Restored chat messages for this chat instance. */
  initialMessages?: UIMessage[];
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
  /** Called when the assistant response finishes streaming. */
  onFinish?: ChatOnFinishCallback<UIMessage>;
  /** Called when the chat stream errors. */
  onError?: ChatOnErrorCallback;
}

export type HudsonAIChat = ReturnType<typeof useHudsonAI>;

function buildHudsonAIRequestBody(args: {
  activeAttachmentsRef: MutableRefObject<Set<string>>;
  attachmentsRef: MutableRefObject<AIAttachment[] | undefined>;
  contextRef: MutableRefObject<Record<string, unknown> | undefined>;
  toolsetRef: MutableRefObject<string>;
  modeRef: MutableRefObject<AIMode>;
  providerRef: MutableRefObject<string | undefined>;
  modelRef: MutableRefObject<string | undefined>;
}) {
  const resolved: Record<string, unknown> = {};

  for (const att of args.attachmentsRef.current ?? []) {
    if (args.activeAttachmentsRef.current.has(att.label)) {
      const value = att.content();
      if (value !== null) resolved[att.label.toLowerCase()] = value;
    }
  }

  return {
    toolset: args.toolsetRef.current,
    context: { ...args.contextRef.current, ...resolved },
    mode: args.modeRef.current,
    provider: args.providerRef.current,
    model: args.modelRef.current,
  };
}

function invokeHudsonAIFinish(
  ref: MutableRefObject<ChatOnFinishCallback<UIMessage> | undefined>,
  event: Parameters<ChatOnFinishCallback<UIMessage>>[0],
) {
  ref.current?.(event);
}

function invokeHudsonAIError(
  ref: MutableRefObject<ChatOnErrorCallback | undefined>,
  error: Parameters<ChatOnErrorCallback>[0],
) {
  ref.current?.(error);
}

export function useHudsonAI({
  toolset,
  chatId,
  initialMessages,
  context,
  onToolCall,
  mode,
  attachments,
  provider,
  model,
  onFinish,
  onError,
}: UseHudsonAIOptions) {
  const onToolCallRef = useRef(onToolCall);
  const onFinishRef = useRef(onFinish);
  const onErrorRef = useRef(onError);

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
  const activeAttachmentsRef = useRef(activeAttachments);
  const attachmentsRef = useRef(attachments);
  const contextRef = useRef(context);
  const toolsetRef = useRef(toolset);
  const modeRef = useRef(resolvedMode);
  const providerRef = useRef(provider);
  const modelRef = useRef(model);

  useEffect(() => {
    onToolCallRef.current = onToolCall;
  }, [onToolCall]);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    activeAttachmentsRef.current = activeAttachments;
  }, [activeAttachments]);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  useEffect(() => {
    toolsetRef.current = toolset;
  }, [toolset]);

  useEffect(() => {
    modeRef.current = resolvedMode;
  }, [resolvedMode]);

  useEffect(() => {
    providerRef.current = provider;
  }, [provider]);

  useEffect(() => {
    modelRef.current = model;
  }, [model]);

  // The chat transport must stay stable for the chat lifetime.
  // It reads fresh request data from refs at send time instead of being recreated.
  /* eslint-disable react-hooks/refs */
  const transport = useMemo(
    () => new DefaultChatTransport({
      api: '/api/ai/chat',
      body: () => buildHudsonAIRequestBody({
        activeAttachmentsRef,
        attachmentsRef,
        contextRef,
        toolsetRef,
        modeRef,
        providerRef,
        modelRef,
      }),
    }),
    [],
  );
  /* eslint-enable react-hooks/refs */

  const handleToolCall = useCallback(async ({ toolCall }: { toolCall: { toolName: string; input: unknown } }) => {
    if (!onToolCallRef.current) return;
    const args = toolCall.input && typeof toolCall.input === 'object' && !Array.isArray(toolCall.input)
      ? toolCall.input as Record<string, unknown>
      : {};

    try {
      await onToolCallRef.current(toolCall.toolName, args);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      invokeHudsonAIError(onErrorRef, error);
      throw error;
    }
  }, []);

  const chat = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
    onToolCall: handleToolCall,
    onFinish: event => invokeHudsonAIFinish(onFinishRef, event),
    onError: error => invokeHudsonAIError(onErrorRef, error),
  });

  const clearChat = useCallback(() => {
    chat.setMessages([]);
  }, [chat]);

  const { messages } = chat;

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
