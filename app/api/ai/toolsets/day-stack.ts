import { tool } from 'ai';
import { z } from 'zod';
import type { ToolsetDefinition } from '@hudsonkit/ai/toolsets';
import { DAY_STACK_AGENT_GUIDE } from '../../../apps/day-stack/agent-context';

const system = `You are the AI planner embedded in Stacks, Hudson's daily focus planning app.

${DAY_STACK_AGENT_GUIDE}

## How to act
- When the user asks to change the schedule, use tools. Do not merely describe the change.
- Prefer \`append_block\` for adding one new focus block.
- Prefer \`set_plan\` only when replacing or importing the full day.
- Use \`update_block\` when editing a specific existing block.
- Use \`complete_current\`, \`focus_next\`, and \`reset_today\` for direct navigation/control requests.
- After tools run, reply with the exact schedule change in one concise sentence.
- If a request is too vague to create a useful block, ask one focused question.`;

interface DayStackBlockContext {
  id: string;
  start: string;
  end: string;
  project: string;
  note: string;
  done: boolean;
  minutes: number;
}

function context(ctx: Record<string, unknown>): string {
  const source = typeof ctx.source === 'string' ? ctx.source : '';
  const blocks = Array.isArray(ctx.blocks) ? ctx.blocks as DayStackBlockContext[] : [];
  const activeBlock = ctx.activeBlock as DayStackBlockContext | null | undefined;
  const sections: string[] = [];

  if (activeBlock) {
    sections.push([
      '## Current focus',
      `- id: ${activeBlock.id}`,
      `- time: ${activeBlock.start}-${activeBlock.end}`,
      `- project: ${activeBlock.project}`,
      `- intention: ${activeBlock.note || 'n/a'}`,
      `- done: ${activeBlock.done}`,
    ].join('\n'));
  }

  if (blocks.length > 0) {
    sections.push([
      '## Parsed blocks',
      ...blocks.map(block =>
        `- ${block.id}: ${block.done ? '[x]' : '[ ]'} ${block.start}-${block.end} | ${block.project} | ${block.note}`,
      ),
    ].join('\n'));
  }

  if (source) {
    sections.push(`## Plan source\n\`\`\`markdown\n${source}\n\`\`\``);
  }

  return sections.join('\n\n---\n\n');
}

function tools() {
  return {
    append_block: tool({
      description: 'Append a focus block to the Stacks schedule.',
      inputSchema: z.object({
        start: z.string().optional().describe('Optional 24-hour start time, HH:MM. Omit to append after the last block with a buffer.'),
        end: z.string().optional().describe('Optional 24-hour end time, HH:MM. Omit to use durationMinutes or one hour.'),
        durationMinutes: z.number().optional().describe('Duration in minutes when end is omitted. Defaults to 60.'),
        project: z.string().describe('Short, scannable 1-4 word project name.'),
        note: z.string().describe('Concrete intention/outcome for the focus block.'),
        done: z.boolean().optional().describe('Whether the block should start completed. Defaults to false.'),
      }),
      execute: async (args) => ({ applied: true, ...args }),
    }),

    update_block: tool({
      description: 'Update one existing focus block by ID.',
      inputSchema: z.object({
        id: z.string().describe('Block ID from Parsed blocks.'),
        start: z.string().optional().describe('New 24-hour start time, HH:MM.'),
        end: z.string().optional().describe('New 24-hour end time, HH:MM.'),
        project: z.string().optional().describe('New short project name.'),
        note: z.string().optional().describe('New concrete intention/outcome.'),
        done: z.boolean().optional().describe('Whether the block is completed.'),
      }),
      execute: async (args) => ({ applied: true, ...args }),
    }),

    set_plan: tool({
      description: 'Replace the full Stacks markdown source. Use for full-day rewrites/imports.',
      inputSchema: z.object({
        source: z.string().describe('Complete markdown source using Stacks format.'),
      }),
      execute: async (args) => ({ applied: true, ...args }),
    }),

    complete_current: tool({
      description: 'Mark the current focus block done and advance to the next open block.',
      inputSchema: z.object({
        reason: z.string().optional().describe('Short reason for completing the current block.'),
      }),
      execute: async (args) => ({ applied: true, ...args }),
    }),

    focus_next: tool({
      description: 'Focus the next open block without marking the current block complete.',
      inputSchema: z.object({
        reason: z.string().optional().describe('Short reason for moving focus.'),
      }),
      execute: async (args) => ({ applied: true, ...args }),
    }),

    reset_today: tool({
      description: 'Reset Stacks to its default starter plan.',
      inputSchema: z.object({
        confirm: z.boolean().describe('Must be true when the user explicitly asked to reset the plan.'),
      }),
      execute: async (args) => ({ applied: true, ...args }),
    }),
  };
}

export const dayStackToolset: ToolsetDefinition = { system, context, tools };
