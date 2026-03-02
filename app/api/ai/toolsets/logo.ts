import { tool } from 'ai';
import { z } from 'zod';

const paramKeys = [
  'bgColor', 'paneColor', 'dimPaneColor', 'channelColor',
  'borderRadius', 'paneRadius', 'gapWidth', 'splitX', 'splitY', 'padding',
] as const;

export function logoTools(_context: Record<string, unknown>) {
  return {
    set_param: tool({
      description: 'Set a single logo design parameter. Use this to adjust colors, spacing, border radius, and layout proportions.',
      inputSchema: z.object({
        key: z.enum(paramKeys).describe('The parameter to change'),
        value: z.union([z.string(), z.number()]).describe('The new value'),
      }),
      execute: async ({ key, value }) => ({ applied: true, key, value }),
    }),

    set_variant: tool({
      description: 'Switch to a different logo variant style.',
      inputSchema: z.object({
        variant: z.enum([
          'negative-space', 'green-channel', 'grid-color',
          'interlocking', 'lattice-grid', 'app-windows',
        ]).describe('The variant to switch to'),
      }),
      execute: async ({ variant }) => ({ applied: true, variant }),
    }),

    apply_preset: tool({
      description: 'Apply a named preset configuration. The preset label must match one of the available presets.',
      inputSchema: z.object({
        preset_label: z.string().describe('The label of the preset to apply (case-insensitive match)'),
      }),
      execute: async ({ preset_label }) => ({ applied: true, preset: preset_label }),
    }),

    reset_defaults: tool({
      description: 'Reset all logo parameters back to the default values.',
      inputSchema: z.object({}),
      execute: async () => ({ applied: true }),
    }),
  };
}

export function logoSystemPrompt(context: Record<string, unknown>): string {
  const params = context.params ?? {};
  const presetNames = (context.presetNames as string[]) ?? [];

  return `You are a logo design assistant for the Hudson platform's lattice logo.

Current parameters:
${JSON.stringify(params, null, 2)}

Available presets: ${presetNames.join(', ')}

Available variants: negative-space, green-channel, grid-color, interlocking, lattice-grid, app-windows

You can adjust the logo by calling tools. When the user describes what they want, translate that into parameter changes. For example:
- "make it emerald" → set paneColor to an emerald shade, adjust dimPaneColor to match
- "switch to dark mode" → adjust bgColor to a dark color
- "try the lattice style" → set_variant to lattice-grid
- "use the ocean preset" → apply_preset with "Ocean"

Be concise in your responses. Describe what you changed and why. Make multiple tool calls when needed to achieve the desired look.`;
}
