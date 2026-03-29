import { tool } from 'ai';
import { z } from 'zod';
import type { ToolsetDefinition } from './index';

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------
const system = `You are Hudson — a workspace-level AI assistant for a multi-app creative platform. You can see and control every app in the workspace.

## Your capabilities
1. **Adjust parameters** on any app — colors, dimensions, layout, custom params
2. **Push data between apps** via pipes — trigger the data flow from one app to another
3. **Create and manage pipes** — set up new connections between app ports
4. **Fetch images** — download images from URLs for the pipeline
5. **Create logo templates** — write SVG render functions for the logo designer
6. **Read app state** — see what each app is currently showing

## Design taste
- Clean, intentional, professional
- Never use purple — prefer cyan, teal, emerald
- Less is more — remove before adding
- Optical corrections over mathematical perfection

## Guidelines
- When the user asks to change something, DO IT immediately by calling tools
- Use multiple tool calls in one response for compound edits
- Be concise — say what you changed and why in 1-2 sentences
- If you're unsure which app to target, ask
`;

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
function context(ctx: Record<string, unknown>): string {
  const sections: string[] = [];

  // Apps in workspace
  const apps = ctx.apps as { id: string; name: string; ports?: { inputs?: { id: string }[]; outputs?: { id: string }[] } }[] | undefined;
  if (apps) {
    sections.push('## Apps\n' + apps.map(a => {
      const ins = a.ports?.inputs?.map(p => p.id).join(', ') || 'none';
      const outs = a.ports?.outputs?.map(p => p.id).join(', ') || 'none';
      return `- **${a.name}** (${a.id}) — in: ${ins} | out: ${outs}`;
    }).join('\n'));
  }

  // Pipes
  const pipes = ctx.pipes as { name: string; source: { appId: string; portId: string }; sink: { appId: string; portId: string } }[] | undefined;
  if (pipes && pipes.length > 0) {
    sections.push('## Pipes\n' + pipes.map(p =>
      `- ${p.name}: ${p.source.appId}.${p.source.portId} → ${p.sink.appId}.${p.sink.portId}`
    ).join('\n'));
  }

  // Logo params
  if (ctx.logoParams) {
    sections.push(`## Logo State\n\`\`\`json\n${JSON.stringify(ctx.logoParams, null, 2)}\n\`\`\``);
  }

  // Active template
  if (ctx.activeTemplate) {
    const t = ctx.activeTemplate as { name: string; id: string; sourceCode?: string; renderBody?: string };
    const code = t.sourceCode || t.renderBody || '';
    sections.push(`## Active Template: ${t.name} (${t.id})\n\`\`\`\n${code.slice(0, 2000)}\n\`\`\``);
  }

  return sections.join('\n\n');
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------
function tools(_ctx: Record<string, unknown>) {
  return {
    set_logo_param: tool({
      description: 'Set a parameter on the logo designer (colors, dimensions, layout).',
      inputSchema: z.object({
        key: z.string().describe('Parameter key (bgColor, paneColor, dimPaneColor, borderRadius, paneRadius, gapWidth, splitX, splitY, padding, etc.)'),
        value: z.union([z.string(), z.number()]).describe('New value'),
      }),
      execute: async (args) => ({ applied: true, app: 'logo-designer', ...args }),
    }),

    set_logo_custom_param: tool({
      description: 'Set a custom parameter on the active logo template (e.g. scale, rotation, gridSize).',
      inputSchema: z.object({
        key: z.string().describe('Custom param key'),
        value: z.union([z.string(), z.number()]).describe('New value'),
      }),
      execute: async (args) => ({ applied: true, app: 'logo-designer', action: 'set_custom_param', ...args }),
    }),

    set_logo_variant: tool({
      description: 'Switch the logo to a different template/variant.',
      inputSchema: z.object({
        variant: z.string().describe('Template ID'),
      }),
      execute: async (args) => ({ applied: true, app: 'logo-designer', ...args }),
    }),

    push_pipe: tool({
      description: 'Push data through a named pipe (e.g. "Fetch → Shaper" or "Shaper → Logo").',
      inputSchema: z.object({
        pipeName: z.string().describe('The name of the pipe to push'),
      }),
      execute: async (args) => ({ applied: true, action: 'push_pipe', ...args }),
    }),

    fetch_image: tool({
      description: 'Fetch an image from a URL and make it available for piping to other apps.',
      inputSchema: z.object({
        url: z.string().describe('The image URL to fetch'),
      }),
      execute: async (args) => ({ applied: true, action: 'fetch_image', ...args }),
    }),

    create_template: tool({
      description: 'Create a new logo template. Write the renderBody in TypeScript — receives (p, vb), must return SVG inner string.',
      inputSchema: z.object({
        name: z.string().describe('Template name'),
        description: z.string().describe('Short description'),
        renderBody: z.string().describe('TypeScript function body'),
        params: z.array(z.object({
          key: z.string(),
          label: z.string(),
          type: z.enum(['number', 'color', 'toggle', 'enum', 'text']),
          default: z.union([z.number(), z.string(), z.boolean()]),
          min: z.number().optional(),
          max: z.number().optional(),
          step: z.number().optional(),
        })).describe('Custom parameter declarations'),
      }),
      execute: async (args) => ({ applied: true, action: 'create_template', ...args }),
    }),

    create_pipe: tool({
      description: 'Create a new pipe connecting two app ports.',
      inputSchema: z.object({
        name: z.string().describe('Pipe name (e.g. "Fetch → Shaper")'),
        sourceAppId: z.string().describe('Source app ID'),
        sourcePortId: z.string().describe('Source port ID'),
        sinkAppId: z.string().describe('Sink app ID'),
        sinkPortId: z.string().describe('Sink port ID'),
      }),
      execute: async (args) => ({ applied: true, action: 'create_pipe', ...args }),
    }),

    generate_image: tool({
      description: 'Generate an image from a text prompt using Gemini/Imagen. Use this when the user asks you to draw, create, generate, or design an image or illustration. Returns the image which will be displayed in the chat.',
      inputSchema: z.object({
        prompt: z.string().describe('Detailed description of the image to generate. Be specific about style, composition, colors, and subject.'),
        aspectRatio: z.enum(['1:1', '3:4', '4:3', '9:16', '16:9']).optional().describe('Aspect ratio (default: 1:1)'),
      }),
      execute: async (args) => ({ applied: true, action: 'generate_image', ...args }),
    }),
  };
}

export const workspaceToolset: ToolsetDefinition = { system, context, tools };
