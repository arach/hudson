'use client';

import { useHudsonAI, AI, useTerminalRelay, TerminalRelay, usePlatform } from '@hudson/sdk';
import type { AIAttachment } from '@hudson/sdk';
import { useLogo, defaults } from './LogoProvider';
import { isBuiltinVariant } from './types';
import type { LogoTemplate, TemplateParam } from './types';
import { useMemo, useState, useCallback } from 'react';
import { buildSystemPrompt, buildClaudeMd } from './prompts';
import type { ModelTier } from './prompts';

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
  const modelTier = (appSettings.modelTier as ModelTier) || 'comprehensive';
  const relayBackend = (appSettings.relayBackend as 'pty' | 'tmux') || 'pty';
  const relayAgent = (appSettings.agent as 'claude' | 'pi') || 'pi';
  const relayProvider = String(appSettings.provider || 'minimax');
  const relayModel = String(appSettings.model || 'MiniMax-M2.7');

  const [mode, setMode] = useState<TerminalMode>('relay');

  // ---- Relay mode ----
  // Build a rich system prompt with full dynamic context
  const promptCtx = useMemo(() => ({
    params,
    presets: presets as { label: string; params: Partial<typeof params> }[],
    templates,
    customParamValues,
    homeFolder,
  }), [params, presets, templates, customParamValues, homeFolder]);

  const relaySystemPrompt = useMemo(() => buildSystemPrompt(promptCtx, modelTier), [promptCtx, modelTier]);

  // CLAUDE.md bootstrapped into the workspace — dynamic, reflects current session
  const workspaceFiles = useMemo(() => ({
    'CLAUDE.md': buildClaudeMd(promptCtx),
  }), [promptCtx]);

  const relay = useTerminalRelay({
    url: relayUrl,
    systemPrompt: relaySystemPrompt,
    cwd: homeFolder,
    workspaceFiles,
    sessionKey: 'logo-designer',
    backend: relayBackend,
    tmuxSession: relayBackend === 'tmux' ? 'hudson-logos' : undefined,
    agent: relayAgent,
    provider: relayAgent === 'pi' ? relayProvider : undefined,
    model: relayAgent === 'pi' ? relayModel : undefined,
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
          <>
            <button
              type="button"
              onClick={() => relay.restart()}
              className="text-[10px] px-2 py-0.5 rounded-full border text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10 transition-colors"
              title="Kill session and start fresh (picks up new agent/model settings)"
            >
              Restart
            </button>
            <button
              type="button"
              onClick={() => relay.disconnect()}
              className="text-[10px] px-2 py-0.5 rounded-full border text-red-400 border-red-500/30 hover:bg-red-500/10 transition-colors"
            >
              Disconnect
            </button>
          </>
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
