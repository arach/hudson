import { tool } from 'ai';
import { z } from 'zod';
import { INTENTS_SYSTEM_PROMPT, type ToolsetDefinition } from '@hudsonkit/ai/toolsets';

// ---------------------------------------------------------------------------
// Generic intents toolset.
// Built on top of an app's intent catalog: the model dispatches by commandId
// and the client looks up the matching action from useCommands().
// ---------------------------------------------------------------------------

interface IntentDescriptor {
  commandId: string;
  title: string;
  description: string;
  category?: string;
  keywords?: string[];
  shortcut?: string;
  dangerous?: boolean;
  params?: { name: string; description: string; type: string; optional?: boolean; enum?: string[] }[];
}

interface IntentCatalogContext {
  appId?: string;
  appName?: string;
  appDescription?: string;
  intents?: IntentDescriptor[];
  /** Free-form app-supplied state snapshot rendered after the catalog. */
  state?: Record<string, unknown>;
}

function context(ctx: Record<string, unknown>): string {
  const c = ctx as IntentCatalogContext;
  const sections: string[] = [];

  if (c.appName) {
    sections.push(`## App\n**${c.appName}**${c.appId ? ` (${c.appId})` : ''}${c.appDescription ? ` — ${c.appDescription}` : ''}`);
  }

  const intents = c.intents ?? [];
  if (intents.length === 0) {
    sections.push('## Intents\n_(none declared — you can only converse, not dispatch)_');
  } else {
    const lines = intents.map(i => {
      const parts = [`- \`${i.commandId}\` — **${i.title}**: ${i.description}`];
      if (i.shortcut) parts.push(`  shortcut: \`${i.shortcut}\``);
      if (i.keywords?.length) parts.push(`  keywords: ${i.keywords.join(', ')}`);
      if (i.params?.length) {
        const ps = i.params.map(p => `${p.name}${p.optional ? '?' : ''}: ${p.type}${p.enum ? ` (${p.enum.join('|')})` : ''}`).join(', ');
        parts.push(`  params: ${ps}`);
      }
      if (i.dangerous) parts.push(`  **dangerous** — confirm before dispatching`);
      return parts.join('\n');
    });
    sections.push(`## Intents\n${lines.join('\n')}`);
  }

  if (c.state && Object.keys(c.state).length > 0) {
    sections.push(`## App state\n\`\`\`json\n${JSON.stringify(c.state, null, 2)}\n\`\`\``);
  }

  return sections.join('\n\n');
}

function tools(_ctx: Record<string, unknown>) {
  return {
    dispatch: tool({
      description: 'Run an app intent by its commandId. The client side looks up the command in useCommands() and invokes its action.',
      inputSchema: z.object({
        commandId: z.string().describe('The exact commandId from the intent catalog'),
        params: z.record(z.string(), z.unknown()).optional().describe('Optional parameters for parameterized intents'),
      }),
      execute: async (args) => ({ applied: true, ...args }),
    }),
  };
}

export const intentsToolset: ToolsetDefinition = { system: INTENTS_SYSTEM_PROMPT, context, tools };
