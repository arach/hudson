import { tool } from 'ai';
import { z } from 'zod';
import type { ToolsetDefinition } from './index';

// ---------------------------------------------------------------------------
// Parameter keys and variant names (shared between tools and prompt)
// ---------------------------------------------------------------------------
const paramKeys = [
  'bgColor', 'paneColor', 'dimPaneColor', 'channelColor',
  'borderRadius', 'paneRadius', 'gapWidth', 'splitX', 'splitY', 'padding',
] as const;

const variants = [
  'negative-space', 'green-channel', 'grid-color',
  'interlocking', 'lattice-grid', 'app-windows',
] as const;

// ---------------------------------------------------------------------------
// App-level system prompt — static knowledge about the Logo Designer
// ---------------------------------------------------------------------------
const system = `You are an assistant for the Hudson Logo Designer app.

## App overview
The Logo Designer creates lattice-style logos built from an L-shaped arrangement of rectangular panes. The design is fully parametric — every visual aspect is controlled by named parameters.

## Parameters
| Parameter     | Type   | Description                                       |
|---------------|--------|---------------------------------------------------|
| bgColor       | color  | Canvas background color                           |
| paneColor     | color  | Primary pane fill color                           |
| dimPaneColor  | color  | Secondary/dim pane fill (often translucent)       |
| channelColor  | color  | Color of the L-shaped channel (green-channel variant) |
| borderRadius  | number | Outer container border radius (px)                |
| paneRadius    | number | Individual pane corner radius (px)                |
| gapWidth      | number | Gap between panes (px)                            |
| splitX        | 0-1    | Horizontal split position of the L arm            |
| splitY        | 0-1    | Vertical split position of the L arm              |
| padding       | number | Inner padding from container edge (px)            |

## Variants
- **negative-space**: White panes on dark background, L-shape formed by the gap between panes.
- **green-channel**: Dark panes with a translucent green channel forming the L-shape.
- **grid-color**: 2x2 colored grid with dimmed quadrants.
- **interlocking**: Two interlocking L-shaped pieces.
- **lattice-grid**: Multi-pane lattice grid with color accents — the most versatile variant.
- **app-windows**: Panes styled as app windows with simulated title bars.

## Behavior
- Use tools to make changes. Multiple tool calls in one response are encouraged for compound edits.
- When adjusting colors, keep dimPaneColor visually consistent with paneColor (similar hue, lower opacity).
- Be concise. Describe what you changed and why in 1-2 sentences.`;

// ---------------------------------------------------------------------------
// Instance context — dynamic state rendered per-request
// ---------------------------------------------------------------------------
function context(ctx: Record<string, unknown>): string {
  const params = ctx.params ?? {};
  const presets = ctx.presets ?? ctx.presetNames ?? [];
  const svg = ctx.svg;

  const sections: string[] = [];

  sections.push(`## Current parameters\n\`\`\`json\n${JSON.stringify(params, null, 2)}\n\`\`\``);

  if (Array.isArray(presets) && presets.length > 0) {
    // If presets are objects with label+params, render them richly
    if (typeof presets[0] === 'object' && presets[0] !== null && 'label' in presets[0]) {
      const lines = (presets as { label: string; params: Record<string, unknown> }[])
        .map(p => `- **${p.label}**: ${JSON.stringify(p.params)}`);
      sections.push(`## Available presets\n${lines.join('\n')}`);
    } else {
      sections.push(`## Available presets\n${(presets as string[]).join(', ')}`);
    }
  }

  if (typeof svg === 'string') {
    sections.push(`## Current SVG\n\`\`\`svg\n${svg}\n\`\`\``);
  }

  return sections.join('\n\n');
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------
function tools(_ctx: Record<string, unknown>) {
  return {
    set_param: tool({
      description: 'Set a single logo design parameter.',
      inputSchema: z.object({
        key: z.enum(paramKeys).describe('The parameter to change'),
        value: z.union([z.string(), z.number()]).describe('The new value'),
      }),
      execute: async ({ key, value }) => ({ applied: true, key, value }),
    }),

    set_variant: tool({
      description: 'Switch to a different logo variant style.',
      inputSchema: z.object({
        variant: z.enum(variants).describe('The variant to switch to'),
      }),
      execute: async ({ variant }) => ({ applied: true, variant }),
    }),

    apply_preset: tool({
      description: 'Apply a named preset configuration.',
      inputSchema: z.object({
        preset_label: z.string().describe('The label of the preset to apply (case-insensitive match)'),
      }),
      execute: async ({ preset_label }) => ({ applied: true, preset: preset_label }),
    }),

    reset_defaults: tool({
      description: 'Reset all logo parameters back to default values.',
      inputSchema: z.object({}),
      execute: async () => ({ applied: true }),
    }),
  };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
export const logoToolset: ToolsetDefinition = { system, context, tools };
