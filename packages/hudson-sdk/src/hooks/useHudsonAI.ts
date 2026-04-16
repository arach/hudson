'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isToolUIPart, getToolName } from 'ai';
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
  sessionIdRef: MutableRefObject<string>;
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
    sessionId: args.sessionIdRef.current,
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
        sessionIdRef,
        providerRef,
        modelRef,
      }),
    }),
    [],
  );
  /* eslint-enable react-hooks/refs */

  const chat = useChat({
    transport,
    onFinish: event => invokeHudsonAIFinish(onFinishRef, event),
    onError: error => invokeHudsonAIError(onErrorRef, error),
  });

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
            onToolCallRef.current?.(name, (part.input ?? {}) as Record<string, unknown>);
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
