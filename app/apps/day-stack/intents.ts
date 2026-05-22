import type { AppIntent } from 'hudsonkit';
import { DAY_STACK_PLAN_FORMAT } from './agent-context';

export const dayStackIntents: AppIntent[] = [
  {
    commandId: 'day-stack:add-block',
    title: 'Add Focus Block',
    description: `Append a new one-hour Stacks block to the plan. Use the markdown format ${DAY_STACK_PLAN_FORMAT.replace(/\n/g, ' ')}`,
    category: 'edit',
    keywords: ['add block', 'new block', 'schedule hour', 'add project', 'plan another focus block', 'voice add'],
  },
  {
    commandId: 'day-stack:done-next',
    title: 'Complete Current Block and Focus Next',
    description: 'Mark the current focus block complete, then advance to the next open block. Voice phrases include "done and next", "finish this", and "complete this block".',
    category: 'navigation',
    keywords: ['done next', 'complete current', 'mark done', 'advance', 'finish block', 'next focus'],
  },
  {
    commandId: 'day-stack:next',
    title: 'Focus Next Block',
    description: 'Move focus to the next open scheduled block without marking the current one complete.',
    category: 'navigation',
    keywords: ['next block', 'next focus', 'skip forward', 'move on', 'focus next'],
  },
  {
    commandId: 'day-stack:reset',
    title: 'Reset Stacks',
    description: 'Restore the default four-block starter plan. This replaces the current Stacks source.',
    category: 'edit',
    keywords: ['reset day', 'start over', 'clear plan', 'default plan', 'new day'],
    dangerous: true,
  },
];
