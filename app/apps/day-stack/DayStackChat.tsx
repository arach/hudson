'use client';

import { AI } from 'hudsonkit';
import { useDayStack } from './DayStackProvider';

export function DayStackChat() {
  const { aiChat, aiActivity, aiError } = useDayStack();
  const latest = aiActivity.at(-1);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <div className="border-b border-border/60 px-3 py-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-700/70 dark:text-cyan-200/65">
          Stacks AI
        </div>
        <div className="mt-1 truncate text-[11px] text-muted-foreground">
          {aiError ? aiError : latest ? `${latest.tool}: ${latest.summary}` : 'Plan the day in concrete focus blocks.'}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <AI chat={aiChat} placeholder="Add blocks, rewrite the day, or move focus..." />
      </div>
    </div>
  );
}
