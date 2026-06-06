'use client';

import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { createHudsonId, logHudsonAgentAction, useHudsonAI, usePlatform } from 'hudsonkit';
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

export interface SendLogoAIMessageFile {
  /** IANA media type, e.g. "image/jpeg". */
  mediaType: string;
  /** Data URL or hosted URL of the file. */
  url: string;
  /** Optional filename for display in the conversation. */
  filename?: string;
}

export interface SendLogoAIMessageOptions {
  action?: string;
  label?: string;
  surface?: string;
  /** Optional file attachments (e.g. a workspace screenshot). Pass-through to chat.sendMessage. */
  files?: SendLogoAIMessageFile[];
}

interface ActiveLogoAIAction {
  traceId: string;
  action: string;
  label: string;
  prompt: string;
  variant: string;
  surface: string;
}

function compactPrompt(message: string) {
  return message.replace(/\s+/g, ' ').trim().slice(0, 420);
}

function inferLogoAIAction(message: string) {
  const firstLine = message.trim().split('\n')[0]?.toLowerCase() ?? '';
  if (firstLine.startsWith('polish this logo')) return 'logo.polish';
  if (firstLine.startsWith('create 3 distinct variations')) return 'logo.explore';
  if (firstLine.startsWith('simplify this logo')) return 'logo.simplify';
  if (firstLine.startsWith('elevate this logo')) return 'logo.elevate';
  if (firstLine.startsWith('remix this logo')) return 'logo.remix';
  if (firstLine.startsWith('# iterate on')) return 'logo.iterate-picks';
  return 'logo.ai.edit';
}

function labelLogoAIAction(action: string) {
  switch (action) {
    case 'logo.polish':
      return 'Polish logo';
    case 'logo.explore':
      return 'Explore logo variants';
    case 'logo.simplify':
      return 'Simplify logo';
    case 'logo.elevate':
      return 'Elevate logo';
    case 'logo.remix':
      return 'Remix logo';
    case 'logo.iterate-picks':
      return 'Iterate logo picks';
    default:
      return 'Edit logo';
  }
}

export function useLogoAI(opts: UseLogoAIOptions) {
  const {
    params, setParam, setVariant, resetDefaults, presets,
    templates, addTemplate, deleteTemplate,
    customParamValues, setCustomParam, refreshTemplates, appSettings,
  } = opts;
  const { apiBaseUrl } = usePlatform();
  const compileEndpoint = `${apiBaseUrl}/api/logo/compile`;

  const normalizedTemplates = useMemo(() => normalizeLogoTemplateLineage(templates), [templates]);
  const templateById = useMemo(() => new Map(normalizedTemplates.map(template => [template.id, template])), [normalizedTemplates]);
  const templateByIdRef = useRef(templateById);
  const activeVariantRef = useRef(params.variant);
  const activePromptTraceIdRef = useRef<string | null>(null);
  const activeActionRef = useRef<ActiveLogoAIAction | null>(null);

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

  const startLogoAIAction = useCallback((message: string, options: SendLogoAIMessageOptions = {}) => {
    const action = options.action ?? inferLogoAIAction(message);
    const label = options.label ?? labelLogoAIAction(action);
    const traceId = createHudsonId('tr');
    const variant = activeVariantRef.current;
    const surface = options.surface ?? 'logo-ai';
    activePromptTraceIdRef.current = traceId;
    activeActionRef.current = { traceId, action, label, prompt: message, variant, surface };
    logHudsonAgentAction({
      source: 'logo-ai',
      status: 'started',
      action,
      appId: 'logo',
      appName: 'Logo',
      traceId,
      args: {
        prompt: compactPrompt(message),
        variant,
      },
      metadata: {
        label,
        surface,
        promptLength: message.length,
      },
    });
  }, []);

  const finishLogoAIAction = useCallback((status: 'completed' | 'failed', error?: unknown) => {
    const active = activeActionRef.current;
    if (!active) return;
    activeActionRef.current = null;
    activePromptTraceIdRef.current = null;
    logHudsonAgentAction({
      source: 'logo-ai',
      status,
      action: active.action,
      appId: 'logo',
      appName: 'Logo',
      traceId: active.traceId,
      args: {
        prompt: compactPrompt(active.prompt),
        variant: active.variant,
      },
      metadata: {
        label: active.label,
        surface: active.surface,
        promptLength: active.prompt.length,
      },
      error,
    });
  }, []);

  const chat = useHudsonAI({
    toolset: 'logo',
    chatId: 'logo-app-chat',
    context,
    attachments,
    provider: String(appSettings.aiProvider || 'minimax'),
    model: String(appSettings.aiModel || 'MiniMax-M2.7'),
    agentTrace: {
      source: 'logo-ai',
      appId: 'logo',
      appName: 'Logo',
      parentTraceId: () => activePromptTraceIdRef.current ?? undefined,
    },
    onFinish: () => {
      finishLogoAIAction('completed');
    },
    onError: (error) => {
      finishLogoAIAction('failed', error);
    },
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
          // AI ops never mutate the source template. If a model still calls
          // update_template (cached schema, older system prompt), reject loudly
          // so it falls back to create_template with parentId.
          throw new Error('update_template is not available — iterations always create a new template via create_template with parentId of the source.');
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

  const sendAiMessage = useCallback((message: string, options: SendLogoAIMessageOptions = {}) => {
    const files = options.files;
    logActivity('send', files?.length ? `Sending to AI (${files.length} file${files.length === 1 ? '' : 's'})` : 'Sending to AI');
    startLogoAIAction(message, options);
    try {
      if (files && files.length > 0) {
        chat.sendMessage({
          text: message,
          files: files.map(f => ({ type: 'file' as const, mediaType: f.mediaType, url: f.url, filename: f.filename })),
        });
      } else {
        chat.sendMessage({ text: message });
      }
    } catch (err) {
      finishLogoAIAction('failed', err);
      logActivity('error', err instanceof Error ? err.message : String(err));
    }
  }, [chat, finishLogoAIAction, logActivity, startLogoAIAction]);

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
