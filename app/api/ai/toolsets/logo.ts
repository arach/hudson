import { tool } from 'ai';
import { z } from 'zod';
import type { ToolsetDefinition } from '@hudsonkit/ai/toolsets';

// ---------------------------------------------------------------------------
// Parameter keys (shared between tools and prompt)
// ---------------------------------------------------------------------------
const paramKeys = [
  'bgColor', 'paneColor', 'dimPaneColor', 'channelColor',
  'borderRadius', 'paneRadius', 'gapWidth', 'splitX', 'splitY', 'padding',
] as const;

const templateParamSchema = z.object({
  key: z.string().describe('Param key (camelCase, no spaces)'),
  label: z.string().describe('Human-readable label'),
  type: z.enum(['number', 'color', 'toggle', 'enum', 'text']).describe('Control type: number=slider, color=picker, toggle=on/off, enum=dropdown, text=freeform input'),
  default: z.union([z.number(), z.string(), z.boolean()]).describe('Default value'),
  min: z.number().optional().describe('Min value (for number type)'),
  max: z.number().optional().describe('Max value (for number type)'),
  step: z.number().optional().describe('Step increment (for number type)'),
  options: z.array(z.string()).optional().describe('Allowed values (for enum type)'),
  group: z.string().optional().describe('Inspector section name — params with the same group render in a collapsible section'),
});

// ---------------------------------------------------------------------------
// App-level system prompt
// ---------------------------------------------------------------------------
const system = `You are an elite logo designer and creative director working in the Hudson Logo Designer. You design at the level of Pentagram, Wolff Olins, and Collins. Every decision is intentional.

## Design Taste
- One focal point per mark. Everything else supports it.
- Two colors max in the mark. Background + one accent. Opacity layers (0.9 → 0.5 → 0.15 → 0.05) create depth without adding colors.
- Geometric construction: circles, golden rectangles, perfect tangencies.
- Optical corrections over mathematical perfection.
- Subtle gradients/glows at 0.03–0.08 opacity add polish without being obvious.
- "What can I remove?" before "what can I add?" — less is more.
- Never use purple. Prefer cyan, teal, emerald accents.
- Must read clearly at 32px. If details vanish at small sizes, they're noise.

## How this works
The logo is procedurally generated SVG rendered live from parameters. All designs — both the built-in variants and AI-created templates — are editable templates. When you call tools, the logo re-renders instantly.

You have two modes of operation:

1. **Parameter tweaking** — Change colors, dimensions, and layout using set_param, set_variant, apply_preset.
2. **Template authoring** — Create entirely new logo designs or modify any existing template (including built-ins) by writing TypeScript render functions using create_template and update_template.

## Built-in Parameters
| Parameter     | Type   | Range/Format | Description                               |
|---------------|--------|--------------|-------------------------------------------|
| bgColor       | color  | hex/rgba     | Canvas background color                   |
| paneColor     | color  | hex/rgba     | Primary pane fill color                   |
| dimPaneColor  | color  | hex/rgba     | Secondary pane fill (often translucent)   |
| channelColor  | color  | hex/rgba     | L-channel color (green-channel variant)   |
| borderRadius  | number | 0-200 px     | Outer container corner radius             |
| paneRadius    | number | 0-50 px      | Individual pane corner radius             |
| gapWidth      | number | 2-40 px      | Gap between panes                         |
| splitX        | number | 0.1-0.9      | Horizontal split position of the L arm    |
| splitY        | number | 0.1-0.9      | Vertical split position of the L arm      |
| padding       | number | 20-120 px    | Inner padding from container edge         |

## Templates
All variants are templates. The 6 built-in variants (negative-space, green-channel, grid-color, interlocking, lattice-grid, app-windows) are pre-seeded templates that can be edited like any other.

To switch between templates, use set_variant with the template ID.

## Creating & Editing Templates

Write **TypeScript** for your render functions. The backend compiles TS → JS via esbuild. If there's a type error or syntax error, you'll get a clear error message — fix it and retry.

### How renderBody works
- Receives \`p\` (object with ALL standard params + your custom params) and \`vb\` (viewBox size, always 512)
- \`p\` and \`vb\` are already function parameters. Never redeclare them — do not write \`const vb = 512\`, \`let vb = ...\`, or \`const p = ...\`.
- Must **return a string** of SVG elements (the inner content — no outer \`<svg>\` tag)
- Must be only the render function body. Do not include a \`const meta = {...}\` header and do not wrap it in an outer function.
- Use template literals for SVG markup
- Full TypeScript: loops, conditionals, Math functions, type annotations, variables

### Example renderBody (TypeScript)
\`\`\`typescript
const { bgColor, borderRadius, padding, paneColor } = p;
const cx: number = vb / 2;
const cy: number = vb / 2;
const r: number = (vb - padding * 2) / 2;
let svg: string = \`<rect width="\${vb}" height="\${vb}" rx="\${borderRadius}" fill="\${bgColor}"/>\`;
for (let i = 0; i < 5; i++) {
  const ri = r * (1 - i * 0.18);
  const opacity = 1 - i * 0.15;
  svg += \`<circle cx="\${cx}" cy="\${cy}" r="\${ri}" fill="none" stroke="\${paneColor}" stroke-width="3" opacity="\${opacity}"/>\`;
}
return svg;
\`\`\`

### Custom parameters
Declare template-specific params that appear as sliders/pickers in the inspector panel. Use standard params (bgColor, padding, etc.) for shared properties — only add custom params for template-specific values.

**Grouping:** Set \`group: "Section Name"\` on params to organize them into collapsible sections in the inspector. Params with the same group render together under that heading (e.g. group all geometry params under "Geometry", colors under "Colors"). Ungrouped params render flat.

### Rules for writing renderBody
- Always start with a background rect: \`<rect width="\${vb}" height="\${vb}" rx="\${borderRadius}" fill="\${bgColor}"/>\`
- Use the 512×512 coordinate space. Center = (256, 256).
- Reference \`p.bgColor\`, \`p.paneColor\`, etc. for consistency with standard controls
- Do not redeclare \`p\` or \`vb\`; the app injects them when rendering.
- After creating a template, it auto-activates. Use set_param/set_custom_param to refine.
- If a template errors, you'll see the error in context — fix it with update_template.

## Reading template source

Template renderBody/params are **not** pre-loaded into your context. Call \`get_template_source(id)\` to fetch a template's source on demand — for the active template, the read-only built-ins, or any custom template. This keeps your context lean and lets you pull only what you need for the task at hand.

## Editing Templates In Place

**IMPORTANT: When modifying an existing template, ALWAYS use update_template — do NOT create a new template.**

Workflow for iterating on a design:
1. Call \`get_template_source(activeVariantId)\` to read the current source
2. Modify the renderBody and/or params, then call \`update_template\` with the existing templateId and the changes
3. The 8 read-only built-ins (see below) cannot be modified — clone them with \`create_template\` instead

Keep metadata honest while editing. If you simplify a design, update the description so it matches the new design. If you remove controls or features from renderBody, pass a replacement \`params\` array with only the controls still used; pass \`[]\` when no custom controls remain. Do not rename a template to its raw id, and do not remove its family placement. Omitted metadata is preserved by the app, but changed metadata should stay human-readable.

## Built-in Variants

The 8 built-in variants (negative-space, green-channel, grid-color, interlocking, lattice-grid, app-windows, dot-matrix, mosaic) are **read-only**. You CANNOT modify or delete them. To create a variation, use create_template to make a new template inspired by a built-in.

## Light / Dark Mode
Set \`lightEnabled: true\` via set_param to enable a light variant. Then use set_param to adjust \`lightColors\` (an object with bgColor, paneColor, dimPaneColor, channelColor for the light variant). The app renders both variants side-by-side. Templates are unaware of modes — they receive swapped colors automatically.

## Wordmark
Set \`wordmark\` via set_param with an object: \`{ text, fontFamily, fontWeight, fontSize, letterSpacing, color, lightColor, layout, gap }\`.
- \`layout\`: "icon-only" (default), "horizontal", or "stacked"
- Available fonts: Inter, Geist Mono, JetBrains Mono, Noto Serif Display
- \`fontSize\`: ratio relative to icon height (0.40 = 40%)
- \`color\` / \`lightColor\`: text color for dark / light mode

## General Rules
- When the user asks you to change the logo, DO IT immediately by calling tools.
- Use multiple tool calls in one response for compound edits.
- Keep dimPaneColor consistent with paneColor (same hue, lower opacity).
- Be concise. Say what you changed and why in 1-2 sentences.

`;

// ---------------------------------------------------------------------------
// Instance context — dynamic state rendered per-request
// ---------------------------------------------------------------------------
function context(ctx: Record<string, unknown>): string {
  const params = ctx.params ?? {};
  const presets = ctx.presets ?? ctx.presetNames ?? [];
  const svg = ctx.svg;
  const templates = ctx.templates as { id: string; name: string; description: string; renderBody: string; sourceCode?: string; params: unknown[] }[] | undefined;
  const customParamValues = ctx.customParamValues as Record<string, Record<string, unknown>> | undefined;

  const sections: string[] = [];

  sections.push(`## Current parameters\n\`\`\`json\n${JSON.stringify(params, null, 2)}\n\`\`\``);

  if (Array.isArray(presets) && presets.length > 0) {
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

  sections.push(`## Template editing guardrails
- Tool output means the call was accepted; the rendered preview is the truth. If a preview reports a render error, fix the template source with \`update_template\`.
- \`renderBody\` is only the function body that returns SVG inner content. Do not include \`const meta = {...}\`, an outer function, an outer \`<svg>\`, or redeclarations of \`p\` / \`vb\`.
- Keep readable names, descriptions, params, and family placement aligned with the actual design. Do not turn names into raw ids like \`16857149\`.`);

  // Templates — only the registry (name, id, description, param count). Source
  // is NOT injected by default: the AI fetches what it needs via
  // `get_template_source(id)`. This keeps each request lean for the common case
  // (tweaking params, applying presets, set_variant) where the source is dead
  // weight in the context window.
  if (templates && templates.length > 0) {
    const activeVariant = (params as Record<string, unknown>).variant as string;

    const lines = templates.map(t => {
      const active = t.id === activeVariant ? ' **(active)**' : '';
      return `- **${t.name}** (id: \`${t.id}\`)${active}: ${t.description} — ${t.params.length} custom params`;
    });
    sections.push(
      `## Templates\n${lines.join('\n')}\n\n` +
      `_Call \`get_template_source(id)\` to read any template's renderBody + params before editing or cloning._`,
    );

    const active = templates.find(t => t.id === activeVariant);
    if (active && customParamValues && customParamValues[active.id]) {
      sections.push(`## Active template custom param values\n\`${JSON.stringify(customParamValues[active.id])}\``);
    }
  }

  return sections.join('\n\n');
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------
function tools(ctx: Record<string, unknown>) {
  return {
    get_template_source: tool({
      description: 'Read a template\'s source (renderBody, params, name, description) by id. Call this before update_template, or before create_template if cloning an existing template. Lets you pull the source on demand instead of having every template inlined in context.',
      inputSchema: z.object({
        id: z.string().describe('Template id — e.g. "negative-space", "t-decoration", or a custom hex id'),
      }),
      execute: async ({ id }) => {
        const templates = (ctx.templates ?? []) as Array<{
          id: string;
          name?: string;
          description?: string;
          renderBody?: string;
          sourceCode?: string;
          params?: unknown[];
        }>;
        const t = templates.find(tt => tt.id === id);
        if (!t) return { found: false, id, error: `No template with id "${id}". Use the Templates list to find a valid id.` };
        return {
          found: true,
          id: t.id,
          name: t.name ?? id,
          description: t.description ?? '',
          renderBody: t.sourceCode || t.renderBody || '',
          params: t.params ?? [],
        };
      },
    }),

    set_param: tool({
      description: 'Set a single logo design parameter.',
      inputSchema: z.object({
        key: z.enum(paramKeys).describe('The parameter to change'),
        value: z.union([z.string(), z.number()]).describe('The new value'),
      }),
      execute: async ({ key, value }) => ({ applied: true, key, value }),
    }),

    set_variant: tool({
      description: 'Switch to a template by its ID (e.g. "negative-space", "lattice-grid", or a custom template ID).',
      inputSchema: z.object({
        variant: z.string().describe('Template ID'),
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

    create_template: tool({
      description: 'Create a new logo template. Write renderBody as a TypeScript function body only — no meta header, no outer function, no p/vb redeclarations. The template auto-activates after creation. When iterating on picks from a variation matrix, pass `parentId` so the new template nests under the source in the variant tree.',
      inputSchema: z.object({
        name: z.string().describe('Human-readable template name'),
        description: z.string().describe('Short description of the design'),
        renderBody: z.string().describe('TypeScript function body: receives (p, vb), must return SVG inner string. Do not redeclare p/vb, include const meta, wrap in a function, or include an outer <svg>.'),
        params: z.array(templateParamSchema).describe('Custom parameter declarations for this template. Include only controls used by renderBody.'),
        parentId: z.string().optional().describe('Id of the template this was spawned from (for AI-iterated variants). Renders nested under the parent in the variant nav.'),
      }),
      execute: async (args) => ({ applied: true, action: 'create_template', ...args }),
    }),

    update_template: tool({
      description: 'Modify a custom template (NOT built-ins — they are read-only). Only include fields you want to change. Write renderBody as a TypeScript function body only. Omitted metadata is preserved; update description/params when the visual behavior changes.',
      inputSchema: z.object({
        templateId: z.string().describe('The template ID to update'),
        name: z.string().optional().describe('New name'),
        description: z.string().optional().describe('New description'),
        renderBody: z.string().optional().describe('New render function body (TypeScript). Do not redeclare p/vb, include const meta, wrap in a function, or include an outer <svg>.'),
        params: z.array(templateParamSchema).optional().describe('New param declarations, replacing all existing controls. Include [] when removing every custom control.'),
      }),
      execute: async (args) => ({ applied: true, action: 'update_template', ...args }),
    }),

    delete_template: tool({
      description: 'Delete a custom template (cannot delete built-in templates).',
      inputSchema: z.object({
        templateId: z.string().describe('The template ID to delete'),
      }),
      execute: async (args) => ({ applied: true, action: 'delete_template', ...args }),
    }),

    set_custom_param: tool({
      description: 'Set the value of a custom parameter on the currently active template.',
      inputSchema: z.object({
        key: z.string().describe('The custom param key'),
        value: z.union([z.string(), z.number()]).describe('The new value'),
      }),
      execute: async (args) => ({ applied: true, action: 'set_custom_param', ...args }),
    }),

  };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
export const logoToolset: ToolsetDefinition = { system, context, tools };
