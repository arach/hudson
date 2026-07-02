// ---------------------------------------------------------------------------
// Portable toolset registry
//
// Replaces the hardcoded static-import registry in apps/web/app/api/ai/toolsets/index.ts.
// Runtime-agnostic: Next.js, Vite, and plain Node apps register/resolve
// toolsets identically.
// ---------------------------------------------------------------------------

import type { ToolsetDefinition } from './types';
import type { AppIntent } from '../types';

export interface ToolsetRegistry {
  register(id: string, definition: ToolsetDefinition): void;
  resolve(id: string): ToolsetDefinition | null;
  list(): { id: string; definition: ToolsetDefinition }[];
}

export function createToolsetRegistry(): ToolsetRegistry {
  const store = new Map<string, ToolsetDefinition>();

  return {
    register(id, definition) {
      store.set(id, definition);
    },

    resolve(id) {
      return store.get(id) ?? null;
    },

    list() {
      return Array.from(store, ([id, definition]) => ({ id, definition }));
    },
  };
}

// ---------------------------------------------------------------------------
// Built-in 'intents' toolset factory
//
// Compiles AppIntent[] into the standard dispatch tool shape that the existing
// intents toolset (apps/web/app/api/ai/toolsets/intents.ts) uses. This version is
// portable — no AI SDK import required at registration time.
// ---------------------------------------------------------------------------

export const INTENTS_SYSTEM_PROMPT = `You are an in-app Assistant embedded inside a Hudson app. The host app exposes a catalog of intents — each intent maps to a command the user could otherwise trigger via the command palette. Your job is to translate the user's natural-language request into the right dispatch call.

## How to act
- Prefer doing over describing. If a request maps cleanly to an intent, dispatch immediately.
- One tool call per atomic action; chain multiple calls for compound requests.
- If a request needs information not in the intent catalog, say so plainly — do not invent commandIds.
- After dispatching, summarize what you did in one short line. No preamble, no apology.

## How to dispatch
Call the \`dispatch\` tool with the exact \`commandId\` from the catalog. If the intent declares parameters, pass them under \`params\`. If the intent is marked dangerous, briefly confirm intent before dispatching unless the user was unambiguous.`;

export function buildIntentsToolset(intents: AppIntent[]): ToolsetDefinition {
  return {
    system: INTENTS_SYSTEM_PROMPT,

    context(ctx: Record<string, unknown>): string {
      const appName = ctx.appName as string | undefined;
      const appId = ctx.appId as string | undefined;
      const sections: string[] = [];

      if (appName) {
        sections.push(`## App\n**${appName}**${appId ? ` (${appId})` : ''}`);
      }

      if (intents.length === 0) {
        sections.push('## Intents\n_(none declared — you can only converse, not dispatch)_');
      } else {
        const lines = intents.map((i) => {
          const parts = [`- \`${i.commandId}\` — **${i.title}**: ${i.description}`];
          if (i.shortcut) parts.push(`  shortcut: \`${i.shortcut}\``);
          if (i.keywords?.length) parts.push(`  keywords: ${i.keywords.join(', ')}`);
          if (i.params?.length) {
            const ps = i.params
              .map((p) => `${p.name}${p.optional ? '?' : ''}: ${p.type}${p.enum ? ` (${p.enum.join('|')})` : ''}`)
              .join(', ');
            parts.push(`  params: ${ps}`);
          }
          if (i.dangerous) parts.push(`  **dangerous** — confirm before dispatching`);
          return parts.join('\n');
        });
        sections.push(`## Intents\n${lines.join('\n')}`);
      }

      return sections.join('\n\n');
    },

    tools() {
      return {
        dispatch: {
          description:
            'Run an app intent by its commandId. The client side looks up the command and invokes its action.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              commandId: { type: 'string', description: 'The exact commandId from the intent catalog' },
              params: {
                type: 'object',
                additionalProperties: true,
                description: 'Optional parameters for parameterized intents',
              },
            },
            required: ['commandId'],
          },
          // Pass-through executor. The real work is client-side — the host's
          // Assistant reads the dispatched tool call (via the streamed
          // tool-input-available event) and invokes the matching command. But
          // the pi-ai server loop needs *an* executor to run the tool at all
          // (a tool with no `execute` is rejected as "Unknown tool"), and a
          // server-side ack lets the model close the loop. Kept as a plain
          // function so this module stays AI-SDK-free / portable.
          execute: async (args: Record<string, unknown>) => ({
            dispatched: true,
            ...(args && typeof args === 'object' && !Array.isArray(args) ? args : {}),
          }),
        },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Default global registry with built-in 'intents' toolset
// ---------------------------------------------------------------------------

export const defaultRegistry = createToolsetRegistry();
