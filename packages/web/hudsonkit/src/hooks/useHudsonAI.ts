'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { usePersistentState } from './usePersistentState';
import { logHudsonAgentAction } from '../observability/agent-actions';
import type { ChatOnErrorCallback, ChatOnFinishCallback, UIMessage } from 'ai';
import type { MutableRefObject } from 'react';

type AIMode = 'cli' | 'api';

export interface AIAttachment {
  /** Short label shown on the toggle (e.g. "SVG", "State", "Screenshot") */
  label: string;
  /** Called at send time to produce the content. Can return string, object, or null to skip. */
  content: () => string | Record<string, unknown> | null;
}

export interface HudsonAIAgentTrace {
  appId?: string;
  appName?: string;
  workspaceId?: string;
  workspaceName?: string;
  source?: string;
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
  /** Metadata used by the global HUD logger for agent-initiated tool calls. */
  agentTrace?: HudsonAIAgentTrace;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function findCommandContext(
  context: Record<string, unknown> | undefined,
  commandId: string | undefined,
): Record<string, unknown> | undefined {
  if (!commandId || !isRecord(context) || !Array.isArray(context.commands)) return undefined;
  return context.commands.find(
    (entry): entry is Record<string, unknown> =>
      isRecord(entry) && entry.id === commandId,
  );
}

function getWorkspaceContext(context: Record<string, unknown> | undefined) {
  if (!isRecord(context)) return {};
  const scope = isRecord(context.scope) ? context.scope : undefined;
  const workspace = isRecord(context.workspace) ? context.workspace : undefined;
  return {
    workspaceId: stringValue(scope?.workspaceId) ?? stringValue(workspace?.id),
    workspaceName: stringValue(scope?.workspaceName) ?? stringValue(workspace?.name),
  };
}

function emitAgentActionEvent(input: {
  toolset: string;
  chatId?: string;
  toolName: string;
  args: Record<string, unknown>;
  context: Record<string, unknown> | undefined;
  trace: HudsonAIAgentTrace | undefined;
  status: 'started' | 'completed' | 'failed';
  error?: Error;
}) {
  const command = findCommandContext(input.context, stringValue(input.args.commandId));
  const workspace = getWorkspaceContext(input.context);
  const appId =
    input.trace?.appId ??
    stringValue(input.args.appId) ??
    stringValue(input.args.targetAppId) ??
    stringValue(command?.appId);
  const appName =
    input.trace?.appName ??
    stringValue(input.args.appName) ??
    stringValue(input.args.targetAppName) ??
    stringValue(command?.appName);
  const workspaceId =
    input.trace?.workspaceId ??
    stringValue(input.args.workspaceId) ??
    workspace.workspaceId;
  const workspaceName =
    input.trace?.workspaceName ??
    workspace.workspaceName;

  logHudsonAgentAction({
    source: input.trace?.source ?? 'useHudsonAI',
    status: input.status,
    toolset: input.toolset,
    chatId: input.chatId,
    action: input.toolName,
    commandId: stringValue(input.args.commandId),
    appId,
    appName,
    workspaceId,
    workspaceName,
    args: input.args,
    error: input.error,
  });
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
  agentTrace,
}: UseHudsonAIOptions) {
  const onToolCallRef = useRef(onToolCall);
  const onFinishRef = useRef(onFinish);
  const onErrorRef = useRef(onError);
  const agentTraceRef = useRef(agentTrace);

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
    agentTraceRef.current = agentTrace;
  }, [agentTrace]);

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
      emitAgentActionEvent({
        toolset: toolsetRef.current,
        chatId,
        toolName: toolCall.toolName,
        args,
        context: contextRef.current,
        trace: agentTraceRef.current,
        status: 'started',
      });
      await onToolCallRef.current(toolCall.toolName, args);
      emitAgentActionEvent({
        toolset: toolsetRef.current,
        chatId,
        toolName: toolCall.toolName,
        args,
        context: contextRef.current,
        trace: agentTraceRef.current,
        status: 'completed',
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      emitAgentActionEvent({
        toolset: toolsetRef.current,
        chatId,
        toolName: toolCall.toolName,
        args,
        context: contextRef.current,
        trace: agentTraceRef.current,
        status: 'failed',
        error,
      });
      invokeHudsonAIError(onErrorRef, error);
      throw error;
    }
  }, [chatId]);

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
