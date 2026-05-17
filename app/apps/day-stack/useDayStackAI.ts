'use client';

import { useCallback, useMemo, useState, useEffect } from 'react';
import { useHudsonAI } from 'hudsonkit';
import type { AppSettingsValues, HudsonAIChat } from 'hudsonkit';
import type { ScheduleBlock, ScheduleBlockUpdate } from './DayStackProvider';

interface AppendScheduleBlockInput {
  start?: string;
  end?: string;
  project?: string;
  note?: string;
  done?: boolean;
  durationMinutes?: number;
}

interface UseDayStackAIOptions {
  source: string;
  blocks: ScheduleBlock[];
  activeBlock: ScheduleBlock | null;
  setSource: (source: string) => void;
  appendBlock: (block: AppendScheduleBlockInput) => void;
  updateBlock: (id: string, patch: ScheduleBlockUpdate) => void;
  completeAndAdvance: () => void;
  focusNext: () => void;
  resetToday: () => void;
  appSettings: AppSettingsValues;
}

let activitySeq = 0;

export interface DayStackAIActivityEntry {
  id: number;
  tool: string;
  summary: string;
  timestamp: number;
}

export interface DayStackAIState {
  aiChat: HudsonAIChat;
  aiActivity: DayStackAIActivityEntry[];
  aiError: string | null;
}

function stringArg(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function booleanArg(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function numberArg(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

export function useDayStackAI({
  source,
  blocks,
  activeBlock,
  setSource,
  appendBlock,
  updateBlock,
  completeAndAdvance,
  focusNext,
  resetToday,
  appSettings,
}: UseDayStackAIOptions): DayStackAIState {
  const [activity, setActivity] = useState<DayStackAIActivityEntry[]>([]);
  const logActivity = useCallback((tool: string, summary: string) => {
    setActivity(prev => [...prev.slice(-9), { id: ++activitySeq, tool, summary, timestamp: Date.now() }]);
  }, []);

  const context = useMemo(() => ({
    source,
    blocks,
    activeBlock,
  }), [activeBlock, blocks, source]);

  const aiChat = useHudsonAI({
    toolset: 'day-stack',
    chatId: 'day-stack-chat',
    context,
    provider: String(appSettings.aiProvider || 'copilot'),
    model: String(appSettings.aiModel || 'gemini-3-flash-preview'),
    onToolCall: async (name, args) => {
      switch (name) {
        case 'append_block': {
          const project = stringArg(args.project);
          const note = stringArg(args.note);
          appendBlock({
            start: stringArg(args.start),
            end: stringArg(args.end),
            durationMinutes: numberArg(args.durationMinutes),
            project,
            note,
            done: booleanArg(args.done),
          });
          logActivity('append_block', project ? `${project}: ${note ?? 'new block'}` : 'New focus block');
          break;
        }

        case 'update_block': {
          const id = stringArg(args.id);
          if (!id) break;
          updateBlock(id, {
            start: stringArg(args.start),
            end: stringArg(args.end),
            project: stringArg(args.project),
            note: stringArg(args.note),
            done: booleanArg(args.done),
          });
          logActivity('update_block', id);
          break;
        }

        case 'set_plan': {
          const nextSource = stringArg(args.source);
          if (!nextSource) break;
          setSource(nextSource);
          logActivity('set_plan', 'Replaced plan source');
          break;
        }

        case 'complete_current':
          completeAndAdvance();
          logActivity('complete_current', activeBlock?.project ?? 'Current block');
          break;

        case 'focus_next':
          focusNext();
          logActivity('focus_next', 'Focused next open block');
          break;

        case 'reset_today':
          if (args.confirm === true) {
            resetToday();
            logActivity('reset_today', 'Reset starter plan');
          }
          break;
      }
    },
  });

  const chatError = aiChat.error;
  useEffect(() => {
    if (chatError) logActivity('error', String(chatError).slice(0, 80));
  }, [chatError, logActivity]);

  return {
    aiChat,
    aiActivity: activity,
    aiError: chatError ? String(chatError) : null,
  };
}
