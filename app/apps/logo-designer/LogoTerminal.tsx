'use client';

import { useHudsonAI, AI, useTerminalRelay, TerminalRelay, usePlatform } from '@hudson/sdk';
import type { AIAttachment } from '@hudson/sdk';
import { useLogo, defaults } from './LogoProvider';
import { isBuiltinVariant } from './types';
import type { LogoTemplate, TemplateParam } from './types';
import { useMemo, useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Server-side compile helper
// ---------------------------------------------------------------------------
async function compileTemplate(source: string, endpoint: string): Promise<{ js: string } | { error: string }> {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      return { error: data.error ?? `HTTP ${res.status}` };
    }
    return { js: data.js };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// System prompt for the relay session — rich domain knowledge + dynamic state
// ---------------------------------------------------------------------------

const RELAY_SYSTEM_BASE = `You are the design assistant for the Hudson Logo Designer.
You are running inside the Logo Designer app's relay terminal. The user is designing a procedurally generated SVG logo that renders live from parameters. When the user asks you to change the logo, edit files and parameters directly — don't ask for confirmation.

## Project Structure
You are working in the Hudson Logo Designer app:
- app/apps/logo-designer/ — the app source code
- app/apps/logo-designer/LogoProvider.tsx — state management, params, presets, templates
- app/apps/logo-designer/builtinRenderBodies.ts — built-in template render functions
- app/apps/logo-designer/types.ts — TypeScript types for templates and params
- app/api/logo/compile/route.ts — server-side TS→JS compilation endpoint
- packages/hudson-sdk/ — shared SDK with UI components and hooks

## How the Logo Works
The logo is procedurally generated SVG rendered from a set of parameters. All designs — built-in variants and custom templates — are editable templates with a TypeScript render function.

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
All variants are templates. Built-in variants (negative-space, green-channel, grid-color, interlocking, lattice-grid, app-windows, dot-matrix) are pre-seeded and editable.

### How renderBody works
- Receives \`p\` (object with ALL standard params + custom params) and \`vb\` (viewBox size, always 512)
- Must return a string of SVG elements (inner content — no outer <svg> tag)
- Written in TypeScript, compiled via esbuild on the server
- Always start with a background rect: \`<rect width="\${vb}" height="\${vb}" rx="\${borderRadius}" fill="\${bgColor}"/>\`
- Use the 512x512 coordinate space. Center = (256, 256).

### Rules
- Keep dimPaneColor consistent with paneColor (same hue, lower opacity)
- When modifying an existing template, update the existing file — don't create a new one
- Be concise. Say what you changed and why in 1-2 sentences.`;

/**
 * Build the dynamic context section from current app state.
 * This snapshots the state at the time the relay connects.
 */
function buildRelayContext(
  params: Record<string, unknown>,
  presets: { label: string; params: Record<string, unknown> }[],
  templates: { id: string; name: string; description: string; renderBody: string; sourceCode?: string; params: unknown[] }[],
  customParamValues: Record<string, Record<string, unknown>>,
): string {
  const sections: string[] = [];

  sections.push(`## Current Parameters\n\`\`\`json\n${JSON.stringify(params, null, 2)}\n\`\`\``);

  if (presets.length > 0) {
    const lines = presets.map(p => `- **${p.label}**: ${JSON.stringify(p.params)}`);
    sections.push(`## Available Presets\n${lines.join('\n')}`);
  }

  if (templates.length > 0) {
    const activeVariant = params.variant as string;
    const lines = templates.map(t => {
      const active = t.id === activeVariant ? ' **(active)**' : '';
      return `- **${t.name}** (id: \`${t.id}\`)${active}: ${t.description} — ${t.params.length} custom params`;
    });
    sections.push(`## Templates\n${lines.join('\n')}`);

    const active = templates.find(t => t.id === activeVariant);
    if (active) {
      const code = active.sourceCode || active.renderBody;
      sections.push(
        `## Active Template Source: ${active.name}\n` +
        `\`\`\`typescript\n${code}\n\`\`\`\n` +
        `Custom params: \`${JSON.stringify(active.params)}\``
      );
      if (customParamValues[active.id]) {
        sections.push(`Custom param values: \`${JSON.stringify(customParamValues[active.id])}\``);
      }
    }
  }

  return sections.join('\n\n');
}

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------
type TerminalMode = 'chat' | 'relay';

export function LogoTerminal() {
  const {
    params, setParam, setVariant, resetDefaults, presets,
    templates, addTemplate, updateTemplate, deleteTemplate,
    customParamValues, setCustomParam,
    appSettings, apiBaseUrl,
  } = useLogo();

  const relayUrl = String(appSettings.relayUrl || 'ws://localhost:3600');
  const compileEndpoint = `${apiBaseUrl}${String(appSettings.compileEndpoint || '/api/logo/compile')}`;
  const homeFolder = String(appSettings.homeFolder || '~/hudson/logos');

  const [mode, setMode] = useState<TerminalMode>('relay');

  // ---- Relay mode ----
  // Build a rich system prompt with current state snapshot
  const relaySystemPrompt = useMemo(() => {
    const dynamicCtx = buildRelayContext(
      params as unknown as Record<string, unknown>,
      presets as { label: string; params: Record<string, unknown> }[],
      templates as { id: string; name: string; description: string; renderBody: string; sourceCode?: string; params: unknown[] }[],
      customParamValues as Record<string, Record<string, unknown>>,
    );
    return `${RELAY_SYSTEM_BASE}\n\n---\n\n${dynamicCtx}`;
  }, [params, presets, templates, customParamValues]);

  // CLAUDE.md bootstrapped into the workspace so Claude Code auto-reads it
  const workspaceClaude = useMemo(() => `# Hudson Logo Designer Workspace

This is the working directory for the Hudson Logo Designer. You are a design assistant helping the user create and refine procedurally generated SVG logos.

## What You Can Do
- Create and edit files in this directory (templates, exports, experiments)
- The logo renders live from parameters in the Hudson app — your system prompt has the full parameter reference
- Write SVG, TypeScript render functions, or plain design notes here

## Quick Reference
- Canvas: 512x512 SVG coordinate space
- Background rect: \`<rect width="\${vb}" height="\${vb}" rx="\${borderRadius}" fill="\${bgColor}"/>\`
- Render functions receive \`(p, vb)\` and return SVG inner string
- Keep dimPaneColor consistent with paneColor (same hue, lower opacity)

## Files
Save any logo explorations, exported SVGs, or template drafts here.
`, []);

  const workspaceFiles = useMemo(() => ({
    'CLAUDE.md': workspaceClaude,
  }), [workspaceClaude]);

  const relay = useTerminalRelay({
    url: relayUrl,
    systemPrompt: relaySystemPrompt,
    cwd: homeFolder,
    workspaceFiles,
  });

  // ---- Chat mode (fallback) ----
  const attachments: AIAttachment[] = useMemo(() => [
    {
      label: 'SVG',
      content: () => {
        const svg = document.querySelector('svg[viewBox]');
        return svg ? svg.outerHTML : null;
      },
    },
  ], []);

  const chat = useHudsonAI({
    toolset: 'logo',
    context: { params, presets, templates, customParamValues },
    attachments,
    onToolCall: async (name, args) => {
      switch (name) {
        case 'set_param':
          setParam(args.key as keyof typeof params, args.value as never);
          break;

        case 'set_variant':
          setVariant(args.variant as string);
          break;

        case 'apply_preset': {
          const p = presets.find(
            pr => pr.label.toLowerCase() === (args.preset_label as string).toLowerCase(),
          );
          if (p) Object.entries(p.params).forEach(([k, v]) => setParam(k as keyof typeof params, v as never));
          break;
        }

        case 'reset_defaults':
          resetDefaults();
          break;

        case 'create_template': {
          const source = args.renderBody as string;
          const customParams = (args.params as TemplateParam[]) ?? [];

          // Compile via server
          const result = await compileTemplate(source, compileEndpoint);
          if ('error' in result) {
            console.warn('[logo] Template compilation failed:', result.error);
            // Still create with raw source so AI can see error and fix
          }

          const id = crypto.randomUUID().slice(0, 8);
          const template: LogoTemplate = {
            id,
            name: args.name as string,
            description: (args.description as string) ?? '',
            renderBody: 'js' in result ? result.js : source,
            sourceCode: source,
            params: customParams,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          addTemplate(template);
          setVariant(id);
          break;
        }

        case 'update_template': {
          const templateId = args.templateId as string;
          const updates: Partial<Omit<LogoTemplate, 'id'>> = {};
          if (args.name) updates.name = args.name as string;
          if (args.description) updates.description = args.description as string;
          if (args.renderBody) {
            const source = args.renderBody as string;
            updates.sourceCode = source;

            // Compile via server
            const result = await compileTemplate(source, compileEndpoint);
            if ('error' in result) {
              console.warn('[logo] Template update compilation failed:', result.error);
              updates.renderBody = source; // fallback to raw source
            } else {
              updates.renderBody = result.js;
            }
          }
          if (args.params) updates.params = args.params as TemplateParam[];
          updateTemplate(templateId, updates);
          break;
        }

        case 'delete_template': {
          const id = args.templateId as string;
          // Don't allow deleting built-in templates
          if (isBuiltinVariant(id)) break;
          if (params.variant === id) {
            setVariant('negative-space');
          }
          deleteTemplate(id);
          break;
        }

        case 'set_custom_param': {
          const activeId = params.variant;
          setCustomParam(activeId, args.key as string, args.value as number | string);
          break;
        }
      }
    },
  });

  // Config summary for the relay disconnected CTA
  const relayConfigItems = useMemo(() => [
    { label: 'Relay', value: relayUrl },
    { label: 'CWD', value: homeFolder },
  ], [relayUrl, homeFolder]);

  // Start relay service via the service API
  const { serviceApiUrl } = usePlatform();
  const handleStartRelay = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`${serviceApiUrl}/api/services/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId: 'relay', action: 'start', triggeredBy: 'user' }),
      });
      const data = await res.json();
      return data.success === true;
    } catch {
      return false;
    }
  }, [serviceApiUrl]);

  // Open workspace manager via keyboard shortcut dispatch
  const openSettings = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: ',',
      metaKey: true,
      shiftKey: true,
      bubbles: true,
    }));
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Mode toggle */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-neutral-700/50 bg-neutral-900/50">
        <button
          type="button"
          onClick={() => {
            setMode('relay');
            if (relay.status === 'disconnected' || relay.status === 'error') {
              relay.connect();
            }
          }}
          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
            mode === 'relay'
              ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
              : 'text-neutral-500 border-neutral-700 hover:text-neutral-300 hover:border-neutral-600'
          }`}
        >
          Relay
        </button>
        <button
          type="button"
          onClick={() => setMode('chat')}
          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
            mode === 'chat'
              ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
              : 'text-neutral-500 border-neutral-700 hover:text-neutral-300 hover:border-neutral-600'
          }`}
        >
          Chat
        </button>
        {mode === 'relay' && relay.status === 'connected' && relay.sessionId && (
          <span className="text-[10px] text-neutral-600 ml-auto font-mono">{relay.sessionId}</span>
        )}
        {mode === 'relay' && relay.status !== 'connected' && (
          <button
            type="button"
            onClick={() => relay.connect()}
            className="text-[10px] px-2 py-0.5 rounded-full border text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 transition-colors ml-auto"
          >
            Connect
          </button>
        )}
        {mode === 'relay' && relay.status === 'connected' && (
          <button
            type="button"
            onClick={() => relay.disconnect()}
            className="text-[10px] px-2 py-0.5 rounded-full border text-red-400 border-red-500/30 hover:bg-red-500/10 transition-colors"
          >
            Disconnect
          </button>
        )}
      </div>
      {/* Content */}
      <div className="flex-1 min-h-0">
        {mode === 'relay' ? (
          <TerminalRelay relay={relay} configItems={relayConfigItems} onOpenSettings={openSettings} onStartService={handleStartRelay} />
        ) : (
          <AI chat={chat} placeholder="Describe a logo design or ask me to create one..." />
        )}
      </div>
    </div>
  );
}
