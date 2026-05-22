'use client';

import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { createHudsonId, useHudsonAI, usePlatform } from 'hudsonkit';
import type { AppSettingsValues, AIAttachment } from 'hudsonkit';
import type { LogoParams } from './LogoProvider';
import type { LogoTemplate, TemplateParam } from './types';
import { isBuiltinVariant, normalizeLogoTemplateLineage, resolveLogoTemplatePlacement } from './types';

interface UseLogoAIOptions {
  params: LogoParams;
  setParam: <K extends keyof LogoParams>(key: K, value: LogoParams[K]) => void;
  setVariant: (v: string) => void;
  resetDefaults: () => void;
  presets: { label: string; params: Partial<LogoParams> }[];
  templates: LogoTemplate[];
  addTemplate: (template: LogoTemplate) => Promise<void> | void;
  updateTemplate: (id: string, updates: Partial<Omit<LogoTemplate, 'id'>>) => Promise<void> | void;
  deleteTemplate: (id: string) => Promise<void> | void;
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

  const normalizedTemplates = useMemo(() => normalizeLogoTemplateLineage(templates), [templates]);
  const templateById = useMemo(() => new Map(normalizedTemplates.map(template => [template.id, template])), [normalizedTemplates]);
  const templateByIdRef = useRef(templateById);
  const activeVariantRef = useRef(params.variant);

  useEffect(() => {
    templateByIdRef.current = templateById;
  }, [templateById]);

  useEffect(() => {
    activeVariantRef.current = params.variant;
  }, [params.variant]);

  // Activity log — tracks what the AI is doing
  const [activity, setActivity] = useState<AiActivityEntry[]>([]);
  const logActivity = useCallback((tool: string, summary: string) => {
    setActivity(prev => [...prev.slice(-9), { id: ++_activityId, tool, summary, timestamp: Date.now() }]);
  }, []);

  const context = useMemo(() => ({
    params, presets, templates: normalizedTemplates, customParamValues,
  }), [params, presets, normalizedTemplates, customParamValues]);

  // Coerce string-encoded numbers from AI (MiniMax sends "20" not 20)
  const NUMERIC_PARAMS = new Set(['borderRadius', 'paneRadius', 'gapWidth', 'splitX', 'splitY', 'padding']);
  const coerceParamValue = (key: string, value: unknown): unknown => {
    if (NUMERIC_PARAMS.has(key) && typeof value === 'string') return Number(value);
    return value;
  };

  // Attachable context the user can toggle on from the chat composer.
  const attachments: AIAttachment[] = useMemo(() => [
    {
      label: 'SVG',
      content: () => {
        if (typeof document === 'undefined') return null;
        const svg = document.querySelector('svg[viewBox]');
        return svg ? svg.outerHTML : null;
      },
    },
  ], []);

  const chat = useHudsonAI({
    toolset: 'logo',
    chatId: 'logo-app-chat',
    context,
    attachments,
    provider: String(appSettings.aiProvider || 'minimax'),
    model: String(appSettings.aiModel || 'MiniMax-M2.7'),
    onToolCall: async (name, args) => {
      try {
      switch (name) {
        case 'set_param': {
          const key = args.key as string;
          if (typeof key !== 'string' || !key) throw new Error('set_param requires key');
          const value = coerceParamValue(key, args.value);
          setParam(key as keyof LogoParams, value as never);
          logActivity('set_param', `${key} → ${JSON.stringify(value ?? null).slice(0, 30)}`);
          break;
        }
        case 'set_variant':
          if (typeof args.variant !== 'string' || !args.variant) throw new Error('set_variant requires variant');
          if (!isBuiltinVariant(args.variant) && !templateByIdRef.current.has(args.variant)) throw new Error(`Unknown template "${args.variant}"`);
          activeVariantRef.current = args.variant;
          setVariant(args.variant);
          logActivity('set_variant', args.variant);
          break;
        case 'apply_preset': {
          if (typeof args.preset_label !== 'string') throw new Error('apply_preset requires preset_label');
          const presetLabel = args.preset_label;
          const p = presets.find(
            pr => pr.label.toLowerCase() === presetLabel.toLowerCase(),
          );
          if (!p) throw new Error(`Unknown preset "${presetLabel}"`);
          if (p) Object.entries(p.params).forEach(([k, v]) => setParam(k as keyof LogoParams, v as never));
          logActivity('apply_preset', presetLabel);
          break;
        }
        case 'reset_defaults':
          resetDefaults();
          logActivity('reset', 'Reset to defaults');
          break;
        case 'create_template': {
          const source = args.renderBody as string;
          if (typeof source !== 'string' || !source.trim()) throw new Error('create_template requires renderBody');
          if (typeof args.name !== 'string' || !args.name.trim()) throw new Error('create_template requires name');
          const customParams = (args.params as TemplateParam[]) ?? [];
          const result = await compileTemplate(source, compileEndpoint);
          if ('error' in result) {
            // Don't save a template that won't compile — it just clutters the
            // variant nav with broken entries. Surface the error so the AI
            // sees it and (in a future iteration) can retry with a fix.
            logActivity('error', `create_template "${args.name}" failed to compile: ${result.error.slice(0, 80)}`);
            throw new Error(`create_template failed to compile: ${result.error}`);
          }
          const id = createHudsonId('', 8);
          const placement = resolveLogoTemplatePlacement(Array.from(templateByIdRef.current.values()), activeVariantRef.current, {
            parentId: args.parentId,
            kind: args.kind,
            name: args.name,
          });
          const template: LogoTemplate = {
            id,
            name: args.name as string,
            description: (args.description as string) ?? '',
            renderBody: result.js,
            sourceCode: source,
            params: customParams,
            kind: placement.kind,
            parentId: placement.parentId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          await addTemplate(template);
          templateByIdRef.current = new Map(templateByIdRef.current).set(id, template);
          activeVariantRef.current = id;
          setVariant(id);
          logActivity('create_template', `Created "${args.name}"`);
          setTimeout(refreshTemplates, 500);
          break;
        }
        case 'update_template': {
          const templateId = args.templateId as string;
          if (typeof templateId !== 'string' || !templateId) throw new Error('update_template requires templateId');
          if (isBuiltinVariant(templateId)) throw new Error(`Cannot modify built-in template "${templateId}". Use create_template to clone it.`);
          const currentTemplate = templateByIdRef.current.get(templateId);
          if (!currentTemplate) throw new Error(`Unknown template "${templateId}"`);
          const updates: Partial<Omit<LogoTemplate, 'id'>> = {};
          if (args.name) updates.name = args.name as string;
          if (args.description) updates.description = args.description as string;
          if (args.kind === 'brand' || args.kind === 'style') updates.kind = args.kind;
          if (typeof args.parentId === 'string') {
            updates.parentId = templateByIdRef.current.has(args.parentId) ? args.parentId : currentTemplate.parentId;
          }
          if (args.renderBody) {
            const source = args.renderBody as string;
            const result = await compileTemplate(source, compileEndpoint);
            if ('error' in result) {
              logActivity('error', `update_template "${args.name ?? templateId}" failed to compile: ${result.error.slice(0, 80)}`);
              throw new Error(`update_template failed to compile: ${result.error}`);
            }
            updates.sourceCode = source;
            updates.renderBody = result.js;
          }
          if (args.params) updates.params = args.params as TemplateParam[];
          if (Object.keys(updates).length === 0) throw new Error('update_template requires at least one field to update');
          await updateTemplate(templateId, updates);
          templateByIdRef.current = new Map(templateByIdRef.current).set(templateId, {
            ...currentTemplate,
            ...updates,
            updatedAt: Date.now(),
          });
          logActivity('update_template', `Updated "${args.name ?? templateId}"`);
          setTimeout(refreshTemplates, 500);
          break;
        }
        case 'delete_template': {
          const id = args.templateId as string;
          if (typeof id !== 'string' || !id) throw new Error('delete_template requires templateId');
          if (isBuiltinVariant(id)) break;
          if (!templateByIdRef.current.has(id)) throw new Error(`Unknown template "${id}"`);
          if (activeVariantRef.current === id) {
            activeVariantRef.current = 'negative-space';
            setVariant('negative-space');
          }
          await deleteTemplate(id);
          const nextTemplates = new Map(templateByIdRef.current);
          nextTemplates.delete(id);
          templateByIdRef.current = nextTemplates;
          logActivity('delete_template', `Deleted "${id}"`);
          break;
        }
        case 'set_custom_param': {
          const key = args.key as string;
          if (typeof key !== 'string' || !key) throw new Error('set_custom_param requires key');
          const activeVariant = activeVariantRef.current;
          const activeTemplate = templateByIdRef.current.get(activeVariant);
          if (activeTemplate && !activeTemplate.params.some(param => param.key === key)) {
            throw new Error(`Template "${activeTemplate.name}" has no custom param "${key}"`);
          }
          let val = args.value as number | string;
          // Coerce string numbers (AI often sends "3" instead of 3)
          if (typeof val === 'string' && val !== '' && !isNaN(Number(val))) val = Number(val);
          setCustomParam(activeVariant, key, val);
          logActivity('set_custom_param', `${key} → ${JSON.stringify(val ?? null).slice(0, 30)}`);
          break;
        }
      }
      } catch (err) {
        console.error('[useLogoAI] tool call error:', name, err);
        logActivity('error', `${name}: ${err instanceof Error ? err.message : String(err)}`);
        throw err;
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
    /** Full chat handle — for surfaces that want the SDK's <AI/> component. */
    aiChat: chat,
  };
}
