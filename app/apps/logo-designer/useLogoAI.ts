'use client';

import { useCallback, useMemo, useState, useEffect } from 'react';
import { createHudsonId, useHudsonAI, usePlatform } from 'hudsonkit';
import type { AppSettingsValues } from 'hudsonkit';
import type { LogoParams } from './LogoProvider';
import type { LogoTemplate, TemplateParam } from './types';
import { isBuiltinVariant } from './types';

interface UseLogoAIOptions {
  params: LogoParams;
  setParam: <K extends keyof LogoParams>(key: K, value: LogoParams[K]) => void;
  setVariant: (v: string) => void;
  resetDefaults: () => void;
  presets: { label: string; params: Partial<LogoParams> }[];
  templates: LogoTemplate[];
  addTemplate: (template: LogoTemplate) => void;
  updateTemplate: (id: string, updates: Partial<Omit<LogoTemplate, 'id'>>) => void;
  deleteTemplate: (id: string) => void;
  customParamValues: Record<string, Record<string, number | string | Record<string, unknown>[]>>;
  setCustomParam: (templateId: string, key: string, value: number | string | Record<string, unknown>[]) => void;
  refreshTemplates: () => void;
  appSettings: AppSettingsValues;
}

async function compileTemplate(source: string, endpoint: string): Promise<{ js: string } | { error: string }> {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source }),
    });
    const data = await res.json();
    if (!res.ok || data.error) return { error: data.error ?? `HTTP ${res.status}` };
    return { js: data.js };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

let _activityId = 0;

export interface AiActivityEntry {
  id: number;
  tool: string;
  summary: string;
  timestamp: number;
}

export function useLogoAI(opts: UseLogoAIOptions) {
  const {
    params, setParam, setVariant, resetDefaults, presets,
    templates, addTemplate, updateTemplate, deleteTemplate,
    customParamValues, setCustomParam, refreshTemplates, appSettings,
  } = opts;
  const { apiBaseUrl } = usePlatform();
  const compileEndpoint = `${apiBaseUrl}/api/logo/compile`;

  // Activity log — tracks what the AI is doing
  const [activity, setActivity] = useState<AiActivityEntry[]>([]);
  const logActivity = useCallback((tool: string, summary: string) => {
    setActivity(prev => [...prev.slice(-9), { id: ++_activityId, tool, summary, timestamp: Date.now() }]);
  }, []);

  const context = useMemo(() => ({
    params, presets, templates, customParamValues,
  }), [params, presets, templates, customParamValues]);

  // Coerce string-encoded numbers from AI (MiniMax sends "20" not 20)
  const NUMERIC_PARAMS = new Set(['borderRadius', 'paneRadius', 'gapWidth', 'splitX', 'splitY', 'padding']);
  const coerceParamValue = (key: string, value: unknown): unknown => {
    if (NUMERIC_PARAMS.has(key) && typeof value === 'string') return Number(value);
    return value;
  };

  const chat = useHudsonAI({
    toolset: 'logo',
    context,
    provider: String(appSettings.aiProvider || 'minimax'),
    model: String(appSettings.aiModel || 'MiniMax-M2.7'),
    onToolCall: async (name, args) => {
      try {
      console.log('[useLogoAI] tool call:', name, JSON.stringify(args).slice(0, 200));
      switch (name) {
        case 'set_param': {
          const key = args.key as string;
          const value = coerceParamValue(key, args.value);
          setParam(key as keyof LogoParams, value as never);
          logActivity('set_param', `${key} → ${JSON.stringify(value ?? null).slice(0, 30)}`);
          break;
        }
        case 'set_variant':
          setVariant(args.variant as string);
          logActivity('set_variant', String(args.variant));
          break;
        case 'apply_preset': {
          const p = presets.find(
            pr => pr.label.toLowerCase() === (args.preset_label as string).toLowerCase(),
          );
          if (p) Object.entries(p.params).forEach(([k, v]) => setParam(k as keyof LogoParams, v as never));
          logActivity('apply_preset', String(args.preset_label));
          break;
        }
        case 'reset_defaults':
          resetDefaults();
          logActivity('reset', 'Reset to defaults');
          break;
        case 'create_template': {
          const source = args.renderBody as string;
          const customParams = (args.params as TemplateParam[]) ?? [];
          const result = await compileTemplate(source, compileEndpoint);
          const id = createHudsonId('', 8);
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
          logActivity('create_template', `Created "${args.name}"`);
          setTimeout(refreshTemplates, 500);
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
            const result = await compileTemplate(source, compileEndpoint);
            updates.renderBody = 'js' in result ? result.js : source;
          }
          if (args.params) updates.params = args.params as TemplateParam[];
          updateTemplate(templateId, updates);
          logActivity('update_template', `Updated "${args.name ?? templateId}"`);
          setTimeout(refreshTemplates, 500);
          break;
        }
        case 'delete_template': {
          const id = args.templateId as string;
          if (isBuiltinVariant(id)) break;
          if (params.variant === id) setVariant('negative-space');
          deleteTemplate(id);
          logActivity('delete_template', `Deleted "${id}"`);
          break;
        }
        case 'set_custom_param': {
          const key = args.key as string;
          let val = args.value as number | string;
          // Coerce string numbers (AI often sends "3" instead of 3)
          if (typeof val === 'string' && val !== '' && !isNaN(Number(val))) val = Number(val);
          setCustomParam(params.variant, key, val);
          logActivity('set_custom_param', `${key} → ${JSON.stringify(val ?? null).slice(0, 30)}`);
          break;
        }
      }
      } catch (err) {
        console.error('[useLogoAI] tool call error:', name, err);
        logActivity('error', `${name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  });

  const sendAiMessage = useCallback((message: string) => {
    logActivity('send', 'Sending to AI...');
    try {
      chat.sendMessage({ text: message });
    } catch (err) {
      logActivity('error', err instanceof Error ? err.message : String(err));
    }
  }, [chat, logActivity]);

  // Surface errors in the activity log
  const chatError = chat?.error;
  useEffect(() => {
    if (chatError) logActivity('error', String(chatError).slice(0, 80));
  }, [chatError, logActivity]);

  return {
    sendAiMessage,
    aiStatus: chat?.status ?? 'ready',
    aiMessages: chat?.messages ?? [],
    aiActivity: activity,
    aiError: chatError ? String(chatError) : null,
  };
}
