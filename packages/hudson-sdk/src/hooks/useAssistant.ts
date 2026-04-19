'use client';

import { useCallback, useMemo } from 'react';
import type { ChatOnFinishCallback, UIMessage } from 'ai';
import { useHudsonAI, type HudsonAIChat } from './useHudsonAI';
import type { HudsonApp } from '../types/app';
import type { CommandOption } from '../components/overlays/CommandPalette';

// ---------------------------------------------------------------------------
// useAssistant — wires the generic `intents` toolset to an app's commands.
// The model dispatches by commandId; this hook looks up the matching command
// from useCommands() and invokes its action.
// ---------------------------------------------------------------------------

export interface UseAssistantOptions {
  app: HudsonApp;
  /** Live commands array from app.hooks.useCommands() — passed in so the lookup is always fresh. */
  commands: CommandOption[];
  /** Optional app-supplied state snapshot included in the model's context each turn. */
  state?: Record<string, unknown>;
  /** Provider override (e.g. 'anthropic', 'copilot'). Defaults to whatever the API route picks. */
  provider?: string;
  /** Model override (e.g. 'claude-sonnet-4-20250514'). */
  model?: string;
  /** Called when an assistant turn finishes — pass through for things like reply TTS. */
  onFinish?: ChatOnFinishCallback<UIMessage>;
}

export type AssistantChat = HudsonAIChat;

export function useAssistant({
  app,
  commands,
  state,
  provider,
  model,
  onFinish,
}: UseAssistantOptions): AssistantChat {
  const intents = useMemo(() => {
    return (app.intents ?? []).map(i => ({
      commandId: i.commandId,
      title: i.title,
      description: i.description,
      category: i.category,
      keywords: i.keywords,
      shortcut: i.shortcut,
      dangerous: i.dangerous,
      params: i.params?.map(p => ({
        name: p.name,
        description: p.description,
        type: p.type,
        optional: p.optional,
        enum: p.enum,
      })),
    }));
  }, [app.intents]);

  const context = useMemo(() => ({
    appId: app.id,
    appName: app.name,
    appDescription: app.description,
    intents,
    state,
  }), [app.id, app.name, app.description, intents, state]);

  const dispatch = useCallback((commandId: string) => {
    const cmd = commands.find(c => c.id === commandId);
    if (!cmd) {
      console.warn(`[useAssistant] no command for id "${commandId}"`);
      return;
    }
    cmd.action();
  }, [commands]);

  return useHudsonAI({
    toolset: 'intents',
    context,
    provider,
    model,
    onFinish,
    onToolCall: (name, args) => {
      if (name !== 'dispatch') return;
      const commandId = (args as { commandId?: string }).commandId;
      if (typeof commandId === 'string') dispatch(commandId);
    },
  });
}
