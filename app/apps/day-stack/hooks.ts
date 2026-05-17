'use client';

import { createElement, useMemo } from 'react';
import { Check, Plus, SkipForward } from 'lucide-react';
import type { CommandOption, StatusColor } from 'hudsonkit';
import { formatDuration, useDayStack } from './DayStackProvider';

export function useDayStackCommands(): CommandOption[] {
  const { addHourBlock, completeAndAdvance, focusNext, resetToday } = useDayStack();

  return useMemo<CommandOption[]>(() => [
    { id: 'day-stack:add-block', label: 'Add Focus Block', action: addHourBlock, icon: createElement(Plus, { size: 14 }), section: 'Stacks' },
    { id: 'day-stack:done-next', label: 'Complete Current Block and Focus Next', action: completeAndAdvance, icon: createElement(Check, { size: 14 }), section: 'Stacks' },
    { id: 'day-stack:next', label: 'Focus Next Block', action: focusNext, icon: createElement(SkipForward, { size: 14 }), section: 'Stacks' },
    { id: 'day-stack:reset', label: 'Reset Stacks', action: resetToday, section: 'Stacks' },
  ], [addHourBlock, completeAndAdvance, focusNext, resetToday]);
}

export function useDayStackStatus(): { label: string; color: StatusColor } {
  const { remainingCount } = useDayStack();
  if (remainingCount === 0) return { label: 'complete', color: 'emerald' };
  return { label: `${remainingCount} open`, color: 'amber' };
}

export function useDayStackNavCenter() {
  const { activeBlock } = useDayStack();
  return createElement('span', {
    className: 'max-w-[340px] truncate text-[11px] font-mono text-neutral-400',
  }, activeBlock ? `${activeBlock.start}-${activeBlock.end} ${activeBlock.project}` : 'No focus block');
}

export function useDayStackNavActions() {
  const { activeBlock, completeAndAdvance, focusNext, totalMinutes } = useDayStack();

  return createElement('div', { className: 'flex items-center gap-2' },
    createElement('span', {
      className: 'font-mono text-[10px] uppercase text-neutral-500',
    }, formatDuration(totalMinutes)),
    createElement('button', {
      onClick: focusNext,
      disabled: !activeBlock,
      className: 'rounded p-1 text-neutral-500 transition-colors hover:bg-white/[0.06] hover:text-cyan-300 disabled:opacity-30',
      title: 'Focus next block',
    }, createElement(SkipForward, { size: 13 })),
    createElement('button', {
      onClick: completeAndAdvance,
      disabled: !activeBlock,
      className: 'rounded p-1 text-neutral-500 transition-colors hover:bg-white/[0.06] hover:text-emerald-300 disabled:opacity-30',
      title: 'Complete current block',
    }, createElement(Check, { size: 13 })),
  );
}

export function useDayStackLayoutMode(): 'canvas' | 'panel' {
  return 'panel';
}
