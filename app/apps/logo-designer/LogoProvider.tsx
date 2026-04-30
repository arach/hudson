'use client';
import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo, type ReactNode } from 'react';
import { usePersistentState, useAppSettings, usePlatform } from 'hudsonkit';
import type { AppSettingsValues } from 'hudsonkit';
import type { LogoTemplate, ColorSet, WordmarkConfig, LightingConfig } from './types';
import { logoSettings } from './settings';
import { isBuiltinVariant } from './types';
import { useLogoAI } from './useLogoAI';
import { useEventSourceInvalidation } from '../../hooks/useEventSourceInvalidation';

export type { ColorSet, WordmarkConfig, LightingConfig };

export interface LogoParams {
  variant: string;
  bgColor: string;
  paneColor: string;
  dimPaneColor: string;
  channelColor: string;
  strokeColor: string;
  borderRadius: number;
  paneRadius: number;
  gapWidth: number;
  splitX: number; // 0-1, where the vertical L arm sits
  splitY: number; // 0-1, where the horizontal L arm sits
  padding: number;
  // Light mode
  lightEnabled: boolean;
  lightColors: ColorSet;
  // Lighting
  lightingEnabled: boolean;
  lighting: LightingConfig;
  // Wordmark
  wordmark: WordmarkConfig;
}

export const defaultLightColors: ColorSet = {
  bgColor: '#fafafa',
  paneColor: '#1a1a1e',
  dimPaneColor: 'rgba(0,0,0,0.18)',
  channelColor: 'rgba(16,185,129,0.20)',
  strokeColor: 'rgba(0,0,0,0.12)',
};

export const defaultLighting: LightingConfig = {
  azimuth: 225,
  elevation: 45,
  intensity: 0.75,
  specular: 0.35,
  specularExp: 20,
  surfaceScale: 4,
  ambient: 0.55,
};

export const defaultWordmark: WordmarkConfig = {
  text: '',
  fontFamily: 'Inter',
  fontWeight: 700,
  fontSize: 0.40,
  letterSpacing: 0.08,
  color: '#ffffff',
  lightColor: '#111113',
  layout: 'icon-only',
  gap: 40,
  offsetX: 0,
  offsetY: 0,
};

export const defaults: LogoParams = {
  variant: 'negative-space',
  bgColor: '#111113',
  paneColor: '#ffffff',
  dimPaneColor: 'rgba(255,255,255,0.55)',
  channelColor: 'rgba(51,199,115,0.3)',
  strokeColor: 'rgba(255,255,255,0.08)',
  borderRadius: 80,
  paneRadius: 14,
  gapWidth: 14,
  splitX: 0.37,
  splitY: 0.60,
  padding: 72,
  lightEnabled: false,
  lightColors: defaultLightColors,
  lightingEnabled: false,
  lighting: defaultLighting,
  wordmark: defaultWordmark,
};

// File-watch SSE is the primary transport; these timers only run if the stream drops.
const TEMPLATE_FOCUSED_FALLBACK_POLL_MS = 120_000;
const TEMPLATE_VISIBLE_FALLBACK_POLL_MS = 300_000;

interface LogoState {
  params: LogoParams;
  setParam: <K extends keyof LogoParams>(key: K, value: LogoParams[K]) => void;
  setVariant: (v: string) => void;
  resetDefaults: () => void;
  presets: { label: string; params: Partial<LogoParams> }[];
  // Template management (all templates — built-in + custom)
  templates: LogoTemplate[];
  addTemplate: (template: LogoTemplate) => void;
  updateTemplate: (id: string, updates: Partial<Omit<LogoTemplate, 'id'>>) => void;
  deleteTemplate: (id: string) => void;
  /** Soft-delete: move to discarded (recoverable for 7 days) */
  discardTemplate: (id: string) => void;
  /** Restore a discarded template */
  restoreTemplate: (id: string) => void;
  /** Currently discarded template IDs */
  discardedIds: Set<string>;
  customParamValues: Record<string, Record<string, number | string | Record<string, unknown>[]>>;
  setCustomParam: (templateId: string, key: string, value: number | string | Record<string, unknown>[]) => void;
  // App settings (relay URL, compile endpoint, etc.)
  appSettings: AppSettingsValues;
  /** Resolved API base URL from platform adapter */
  apiBaseUrl: string;
  /** SVG string piped in from another app (e.g. Shaper) */
  backgroundSvg: string | null;
  setBackgroundSvg: (svg: string | null) => void;
  /** Whether size previews are visible on the canvas */
  showPreviews: boolean;
  togglePreviews: () => void;
  /** Params with light-mode colors swapped in (for rendering light variant) */
  lightParams: LogoParams;
  /** Queue a command for the terminal relay to pick up */
  sendTerminalCommand: (cmd: string) => void;
  /** Read and clear the pending command (consumed by LogoTerminal) */
  consumeTerminalCommand: () => string | null;
  /** Send a message to the background AI (no terminal needed) */
  sendAiMessage: (message: string) => void;
  /** Background AI status */
  aiStatus: string;
  /** Recent AI tool call activity log */
  aiActivity: { id: number; tool: string; summary: string; timestamp: number }[];
  /** Last AI error */
  aiError: string | null;
  /** Streaming AI messages */
  aiMessages: { role: string; parts: { type: string; text?: string }[] }[];
  /** Force refresh templates from server */
  refreshTemplates: () => void;
  /** Element inspect mode — shows geometry overlay on canvas */
  inspectMode: boolean;
  toggleInspectMode: () => void;
}

const Ctx = createContext<LogoState | null>(null);

export const useLogo = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLogo must be inside LogoProvider');
  return ctx;
};

const presets: { label: string; params: Partial<LogoParams> }[] = [
  {
    label: 'White panes, dark L',
    params: {
      variant: 'negative-space', paneColor: '#ffffff', dimPaneColor: 'rgba(255,255,255,0.55)', bgColor: '#111113',
      lightColors: { bgColor: '#fafafa', paneColor: '#1a1a1e', dimPaneColor: 'rgba(0,0,0,0.18)', channelColor: 'rgba(16,185,129,0.20)', strokeColor: 'rgba(0,0,0,0.10)' },
    },
  },
  {
    label: 'Dark panes, green L',
    params: {
      variant: 'green-channel', paneColor: '#1c1c1e', dimPaneColor: '#1c1c1e', channelColor: 'rgba(51,199,115,0.3)', bgColor: '#111113',
      lightColors: { bgColor: '#f0fdf4', paneColor: '#e2e8f0', dimPaneColor: '#e2e8f0', channelColor: 'rgba(16,185,129,0.35)', strokeColor: 'rgba(16,185,129,0.15)' },
    },
  },
  {
    label: '2x2 grid color',
    params: {
      variant: 'grid-color', paneColor: '#ffffff', dimPaneColor: 'rgba(255,255,255,0.07)', bgColor: '#111113',
      lightColors: { bgColor: '#f8fafc', paneColor: '#0f172a', dimPaneColor: 'rgba(15,23,42,0.08)', channelColor: 'rgba(16,185,129,0.20)', strokeColor: 'rgba(0,0,0,0.10)' },
    },
  },
  {
    label: 'Interlocking L-pieces',
    params: {
      variant: 'interlocking', paneColor: '#ffffff', dimPaneColor: 'rgba(255,255,255,0.65)', bgColor: '#111113',
      lightColors: { bgColor: '#fafafa', paneColor: '#18181b', dimPaneColor: 'rgba(24,24,27,0.50)', channelColor: 'rgba(16,185,129,0.20)', strokeColor: 'rgba(0,0,0,0.10)' },
    },
  },
  // ── Lattice Grid color presets ──
  {
    label: 'Monochrome',
    params: {
      variant: 'lattice-grid', paneColor: '#ffffff', dimPaneColor: 'rgba(255,255,255,0.18)', bgColor: '#111113',
      lightColors: { bgColor: '#fafafa', paneColor: '#18181b', dimPaneColor: 'rgba(24,24,27,0.14)', channelColor: 'rgba(0,0,0,0.06)', strokeColor: 'rgba(0,0,0,0.10)' },
    },
  },
  {
    label: 'Emerald',
    params: {
      variant: 'lattice-grid', paneColor: '#34d399', dimPaneColor: 'rgba(52,211,153,0.20)', bgColor: '#0a0f0d',
      lightColors: { bgColor: '#f0fdf4', paneColor: '#059669', dimPaneColor: 'rgba(5,150,105,0.18)', channelColor: 'rgba(5,150,105,0.10)', strokeColor: 'rgba(0,0,0,0.10)' },
    },
  },
  {
    label: 'Emerald on white',
    params: {
      variant: 'lattice-grid', paneColor: '#059669', dimPaneColor: 'rgba(5,150,105,0.18)', bgColor: '#f8faf9', borderRadius: 80, paneRadius: 14,
      lightColors: { bgColor: '#ffffff', paneColor: '#047857', dimPaneColor: 'rgba(4,120,87,0.15)', channelColor: 'rgba(4,120,87,0.08)', strokeColor: 'rgba(0,0,0,0.10)' },
    },
  },
  {
    label: 'Ocean',
    params: {
      variant: 'lattice-grid', paneColor: '#38bdf8', dimPaneColor: 'rgba(56,189,248,0.18)', bgColor: '#0a0d14',
      lightColors: { bgColor: '#f0f9ff', paneColor: '#0284c7', dimPaneColor: 'rgba(2,132,199,0.16)', channelColor: 'rgba(2,132,199,0.08)', strokeColor: 'rgba(0,0,0,0.10)' },
    },
  },
  {
    label: 'Violet',
    params: {
      variant: 'lattice-grid', paneColor: '#a78bfa', dimPaneColor: 'rgba(167,139,250,0.18)', bgColor: '#0d0a14',
      lightColors: { bgColor: '#f5f3ff', paneColor: '#7c3aed', dimPaneColor: 'rgba(124,58,237,0.15)', channelColor: 'rgba(124,58,237,0.08)', strokeColor: 'rgba(0,0,0,0.10)' },
    },
  },
  {
    label: 'Sunset',
    params: {
      variant: 'lattice-grid', paneColor: '#fb923c', dimPaneColor: 'rgba(251,146,60,0.18)', bgColor: '#140e0a',
      lightColors: { bgColor: '#fff7ed', paneColor: '#ea580c', dimPaneColor: 'rgba(234,88,12,0.15)', channelColor: 'rgba(234,88,12,0.08)', strokeColor: 'rgba(0,0,0,0.10)' },
    },
  },
  {
    label: 'Rose',
    params: {
      variant: 'lattice-grid', paneColor: '#fb7185', dimPaneColor: 'rgba(251,113,133,0.18)', bgColor: '#140a0c',
      lightColors: { bgColor: '#fff1f2', paneColor: '#e11d48', dimPaneColor: 'rgba(225,29,72,0.14)', channelColor: 'rgba(225,29,72,0.07)', strokeColor: 'rgba(0,0,0,0.10)' },
    },
  },
  {
    label: 'Gold',
    params: {
      variant: 'lattice-grid', paneColor: '#fbbf24', dimPaneColor: 'rgba(251,191,36,0.18)', bgColor: '#14120a',
      lightColors: { bgColor: '#fefce8', paneColor: '#ca8a04', dimPaneColor: 'rgba(202,138,4,0.16)', channelColor: 'rgba(202,138,4,0.08)', strokeColor: 'rgba(0,0,0,0.10)' },
    },
  },
  {
    label: 'Soft white',
    params: {
      variant: 'lattice-grid', paneColor: 'rgba(255,255,255,0.85)', dimPaneColor: 'rgba(255,255,255,0.12)', bgColor: '#18181b', borderRadius: 96, paneRadius: 18, gapWidth: 16,
      lightColors: { bgColor: '#fafafa', paneColor: 'rgba(0,0,0,0.75)', dimPaneColor: 'rgba(0,0,0,0.08)', channelColor: 'rgba(0,0,0,0.04)', strokeColor: 'rgba(0,0,0,0.10)' },
    },
  },
  {
    label: 'Neon mint',
    params: {
      variant: 'lattice-grid', paneColor: '#6ee7b7', dimPaneColor: 'rgba(110,231,183,0.12)', bgColor: '#000000',
      lightColors: { bgColor: '#ecfdf5', paneColor: '#10b981', dimPaneColor: 'rgba(16,185,129,0.14)', channelColor: 'rgba(16,185,129,0.07)', strokeColor: 'rgba(0,0,0,0.10)' },
    },
  },
  // ── Dot Matrix presets ──
  {
    label: 'Dot matrix',
    params: {
      variant: 'dot-matrix', paneColor: 'rgba(255,255,255,0.85)', dimPaneColor: 'rgba(255,255,255,0.18)', bgColor: '#111113',
      lightColors: { bgColor: '#fafafa', paneColor: 'rgba(0,0,0,0.80)', dimPaneColor: 'rgba(0,0,0,0.12)', channelColor: 'rgba(0,0,0,0.05)', strokeColor: 'rgba(0,0,0,0.10)' },
    },
  },
  {
    label: 'Dot matrix — emerald',
    params: {
      variant: 'dot-matrix', paneColor: '#34d399', dimPaneColor: 'rgba(52,211,153,0.20)', bgColor: '#0a0f0d',
      lightColors: { bgColor: '#f0fdf4', paneColor: '#059669', dimPaneColor: 'rgba(5,150,105,0.18)', channelColor: 'rgba(5,150,105,0.08)', strokeColor: 'rgba(0,0,0,0.10)' },
    },
  },
  {
    label: 'Dot matrix — ocean',
    params: {
      variant: 'dot-matrix', paneColor: '#38bdf8', dimPaneColor: 'rgba(56,189,248,0.18)', bgColor: '#0a0d14',
      lightColors: { bgColor: '#f0f9ff', paneColor: '#0284c7', dimPaneColor: 'rgba(2,132,199,0.16)', channelColor: 'rgba(2,132,199,0.08)', strokeColor: 'rgba(0,0,0,0.10)' },
    },
  },
  // ── Mosaic presets ──
  {
    label: 'Mosaic',
    params: {
      variant: 'mosaic', paneColor: '#ffffff', dimPaneColor: 'rgba(255,255,255,0.45)', bgColor: '#111113',
      lightColors: { bgColor: '#fafafa', paneColor: '#1e1e22', dimPaneColor: 'rgba(30,30,34,0.35)', channelColor: 'rgba(0,0,0,0.06)', strokeColor: 'rgba(0,0,0,0.10)' },
    },
  },
  {
    label: 'Mosaic — emerald',
    params: {
      variant: 'mosaic', paneColor: '#34d399', dimPaneColor: 'rgba(52,211,153,0.35)', bgColor: '#0a0f0d',
      lightColors: { bgColor: '#f0fdf4', paneColor: '#059669', dimPaneColor: 'rgba(5,150,105,0.30)', channelColor: 'rgba(5,150,105,0.10)', strokeColor: 'rgba(0,0,0,0.10)' },
    },
  },
  {
    label: 'Mosaic — violet',
    params: {
      variant: 'mosaic', paneColor: '#a78bfa', dimPaneColor: 'rgba(167,139,250,0.35)', bgColor: '#0d0a14',
      lightColors: { bgColor: '#f5f3ff', paneColor: '#7c3aed', dimPaneColor: 'rgba(124,58,237,0.28)', channelColor: 'rgba(124,58,237,0.08)', strokeColor: 'rgba(0,0,0,0.10)' },
    },
  },
  // ── Other variant presets ──
  {
    label: 'App windows',
    params: {
      variant: 'app-windows', paneColor: '#1c1c1e', dimPaneColor: '#16162a', bgColor: '#111113',
      lightColors: { bgColor: '#f4f4f5', paneColor: '#e4e4e7', dimPaneColor: '#d4d4d8', channelColor: 'rgba(0,0,0,0.06)', strokeColor: 'rgba(0,0,0,0.10)' },
    },
  },
  {
    label: 'Thin & airy',
    params: { variant: 'negative-space', gapWidth: 20, padding: 88, splitX: 0.30, splitY: 0.55, paneRadius: 18 },
  },
  {
    label: 'Tight & bold',
    params: { variant: 'negative-space', gapWidth: 10, padding: 56, splitX: 0.40, splitY: 0.65, paneRadius: 10 },
  },
];

export function LogoProvider({
  children,
  disabled = false,
  visible = true,
  focused = false,
}: {
  children: ReactNode;
  disabled?: boolean;
  visible?: boolean;
  focused?: boolean;
}) {
  const [appSettings] = useAppSettings('logo-designer', logoSettings);
  const { apiBaseUrl } = usePlatform();
  const templateStreamEndpoint = `${apiBaseUrl}/api/logo/template/stream`;
  // Merge persisted params with defaults so new fields are backfilled
  const [rawParams, setParams] = usePersistentState<LogoParams>('logo.params', defaults);
  const params = useMemo<LogoParams>(() => ({
    ...defaults,
    ...rawParams,
    lightColors: { ...defaults.lightColors, ...rawParams.lightColors },
    lighting: { ...defaults.lighting, ...rawParams.lighting },
    wordmark: { ...defaults.wordmark, ...rawParams.wordmark },
  }), [rawParams]);
  const [backgroundSvg, setBackgroundSvg] = usePersistentState<string | null>('logo.backgroundSvg', null);
  const [showPreviews, setShowPreviews] = useState(false);
  const togglePreviews = useCallback(() => setShowPreviews(v => !v), []);
  const [inspectMode, setInspectMode] = useState(false);
  const toggleInspectMode = useCallback(() => setInspectMode(v => !v), []);

  // Pending terminal command queue (toolbar → terminal relay)
  const pendingCmdRef = useRef<string | null>(null);
  const sendTerminalCommand = useCallback((cmd: string) => { pendingCmdRef.current = cmd; }, []);
  const consumeTerminalCommand = useCallback(() => {
    const cmd = pendingCmdRef.current;
    pendingCmdRef.current = null;
    return cmd;
  }, []);

  // Derived: params with light-mode colors swapped in
  const lightParams = useMemo<LogoParams>(() => ({
    ...params,
    bgColor: params.lightColors.bgColor,
    paneColor: params.lightColors.paneColor,
    dimPaneColor: params.lightColors.dimPaneColor,
    channelColor: params.lightColors.channelColor,
    strokeColor: params.lightColors.strokeColor,
  }), [params]);

  // Per-template tool config (light mode, wordmark) — saved/restored on variant switch
  interface TemplateToolConfig { lightEnabled: boolean; lightColors: ColorSet; lightingEnabled: boolean; lighting: LightingConfig; wordmark: WordmarkConfig }
  const templateToolsRef = useRef<Record<string, TemplateToolConfig>>({});

  // Templates fetched from server-side JSON files
  const [templates, setTemplates] = useState<LogoTemplate[]>([]);
  const [customParamValues, setCustomParamValues] = usePersistentState<Record<string, Record<string, number | string | Record<string, unknown>[]>>>('logo.customParamValues', {});

  // Reconcile template files created outside the UI (relay/terminal edits).
  const templateEndpoint = `${apiBaseUrl}/api/logo/template`;
  const lastFetchRef = useRef('');
  const activeRef = useRef(true);

  const refreshTemplates = useCallback(async () => {
    try {
      const res = await fetch(templateEndpoint);
      if (!res.ok) return;
      const data = await res.json();
      const json = JSON.stringify(data.templates);
      if (json !== lastFetchRef.current) {
        lastFetchRef.current = json;
        if (activeRef.current) {
          setTemplates(data.templates);
          setCustomParamValues(cpv => {
            let changed = false;
            const next = { ...cpv };
            for (const t of data.templates as { id: string; params: { key: string; default: number | string | Record<string, unknown>[] | boolean }[] }[]) {
              if (!t.params || t.params.length === 0) continue;
              const existing = next[t.id] ?? {};
              let filled = existing;
              for (const p of t.params) {
                if (!(p.key in filled)) {
                  if (filled === existing) filled = { ...existing };
                  filled[p.key] = typeof p.default === 'boolean' ? (p.default ? 1 : 0) : p.default;
                  changed = true;
                }
              }
              if (filled !== existing) next[t.id] = filled;
            }
            return changed ? next : cpv;
          });
        }
      }
    } catch (err) {
      console.warn('[logo] Template fetch failed:', err);
    }
  }, [templateEndpoint, setCustomParamValues]);

  useEffect(() => {
    activeRef.current = !disabled && visible;
    return () => {
      activeRef.current = false;
    };
  }, [disabled, visible]);

  useEventSourceInvalidation({
    url: templateStreamEndpoint,
    enabled: !disabled && visible,
    onInvalidate: refreshTemplates,
    fallbackIntervalMs: focused
      ? TEMPLATE_FOCUSED_FALLBACK_POLL_MS
      : TEMPLATE_VISIBLE_FALLBACK_POLL_MS,
  });

  const setParam = useCallback(<K extends keyof LogoParams>(key: K, value: LogoParams[K]) => {
    setParams(prev => ({ ...prev, [key]: value }));
  }, []);

  const setVariant = useCallback((v: string) => {
    // Save current template's tool config before switching
    setParams(prev => {
      templateToolsRef.current[prev.variant] = {
        lightEnabled: prev.lightEnabled,
        lightColors: prev.lightColors,
        lightingEnabled: prev.lightingEnabled,
        lighting: prev.lighting,
        wordmark: prev.wordmark,
      };
      return prev;
    });

    // Initialize custom param defaults when switching to a template with custom params
    const tmpl = templates.find(t => t.id === v);
    if (tmpl && tmpl.params.length > 0) {
      setCustomParamValues(cpv => {
        const existing = cpv[v] ?? {};
        const filled = { ...existing };
        for (const p of tmpl.params) {
          if (!(p.key in filled)) filled[p.key] = typeof p.default === 'boolean' ? (p.default ? 1 : 0) : p.default;
        }
        return { ...cpv, [v]: filled };
      });
    }

    // Restore tool config for the new variant (or use defaults)
    const savedTools = templateToolsRef.current[v];
    const toolConfig = savedTools ?? {
      lightEnabled: false,
      lightColors: defaultLightColors,
      lightingEnabled: false,
      lighting: defaultLighting,
      wordmark: defaultWordmark,
    };

    // Apply preset params for built-in variants
    if (isBuiltinVariant(v)) {
      const preset = presets.find(p => p.params.variant === v);
      // Preset lightColors override saved if present
      const presetLightColors = preset?.params.lightColors;
      setParams(prev => ({
        ...prev,
        ...preset?.params,
        variant: v,
        lightEnabled: toolConfig.lightEnabled,
        lightColors: presetLightColors ?? toolConfig.lightColors,
        lightingEnabled: toolConfig.lightingEnabled,
        lighting: toolConfig.lighting,
        wordmark: toolConfig.wordmark,
      }));
    } else {
      setParams(prev => ({
        ...prev,
        variant: v,
        lightEnabled: toolConfig.lightEnabled,
        lightColors: toolConfig.lightColors,
        lightingEnabled: toolConfig.lightingEnabled,
        lighting: toolConfig.lighting,
        wordmark: toolConfig.wordmark,
      }));
    }
  }, [templates, setCustomParamValues]);

  const resetDefaults = useCallback(() => setParams(defaults), []);

  // Template CRUD — writes go through the API, polling picks up changes
  const addTemplate = useCallback(async (template: LogoTemplate) => {
    // Optimistically add to local state
    setTemplates(prev => [...prev, template]);
    // Persist to server
    try {
      await fetch(templateEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: template.id,
          name: template.name,
          description: template.description,
          renderBody: template.sourceCode || template.renderBody,
          params: template.params,
        }),
      });
    } catch { /* next poll will reconcile */ }
  }, [templateEndpoint]);

  const updateTemplate = useCallback(async (id: string, updates: Partial<Omit<LogoTemplate, 'id'>>) => {
    // Optimistically update local state
    setTemplates(prev => prev.map(t =>
      t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t
    ));
    // Persist to server
    try {
      await fetch(templateEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: updates.name,
          description: updates.description,
          renderBody: updates.sourceCode || updates.renderBody,
          params: updates.params,
        }),
      });
    } catch { /* next poll will reconcile */ }
  }, [templateEndpoint]);

  // --- Soft delete: discard with 7-day recovery ---
  const DISCARD_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
  const [discardedMap, setDiscardedMap] = usePersistentState<Record<string, number>>('logo.discarded', {});

  // Auto-purge expired discards
  useEffect(() => {
    const now = Date.now();
    const expired = Object.entries(discardedMap).filter(([, ts]) => now - ts > DISCARD_TTL_MS);
    if (expired.length > 0) {
      // Hard delete expired templates
      for (const [id] of expired) {
        fetch(templateEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, action: 'delete' }),
        }).catch(() => {});
      }
      setDiscardedMap(prev => {
        const next = { ...prev };
        for (const [id] of expired) delete next[id];
        return next;
      });
    }
  }, [discardedMap, templateEndpoint]);

  const discardedIds = useMemo(() => new Set(Object.keys(discardedMap)), [discardedMap]);

  const discardTemplate = useCallback((id: string) => {
    if (params.variant === id) setVariant('negative-space');
    setDiscardedMap(prev => ({ ...prev, [id]: Date.now() }));
  }, [params.variant, setVariant, setDiscardedMap]);

  const restoreTemplate = useCallback((id: string) => {
    setDiscardedMap(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, [setDiscardedMap]);

  const deleteTemplate = useCallback(async (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
    setDiscardedMap(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setCustomParamValues(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      await fetch(templateEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'delete' }),
      });
    } catch { /* next poll will reconcile */ }
  }, [templateEndpoint, setCustomParamValues, setDiscardedMap]);

  const setCustomParam = useCallback((templateId: string, key: string, value: number | string | Record<string, unknown>[]) => {
    setCustomParamValues(prev => ({
      ...prev,
      [templateId]: { ...(prev[templateId] ?? {}), [key]: value },
    }));
  }, [setCustomParamValues]);

  // Background AI (works without terminal)
  const { sendAiMessage, aiStatus, aiActivity, aiError, aiMessages } = useLogoAI({
    params, setParam, setVariant, resetDefaults, presets,
    templates, addTemplate, updateTemplate, deleteTemplate,
    customParamValues, setCustomParam, refreshTemplates, appSettings,
  });

  const value = useMemo<LogoState>(() => ({
    params, setParam, setVariant, resetDefaults, presets,
    templates, addTemplate, updateTemplate, deleteTemplate,
    discardTemplate, restoreTemplate, discardedIds,
    customParamValues, setCustomParam,
    appSettings, apiBaseUrl,
    backgroundSvg, setBackgroundSvg,
    showPreviews, togglePreviews,
    lightParams,
    sendTerminalCommand, consumeTerminalCommand,
    sendAiMessage, aiStatus, aiActivity, aiError, aiMessages, refreshTemplates,
    inspectMode, toggleInspectMode,
  }), [
    params, setParam, setVariant, resetDefaults,
    templates, addTemplate, updateTemplate, deleteTemplate,
    discardTemplate, restoreTemplate, discardedIds,
    customParamValues, setCustomParam,
    appSettings, apiBaseUrl,
    backgroundSvg, setBackgroundSvg,
    showPreviews, togglePreviews,
    lightParams,
    sendTerminalCommand, consumeTerminalCommand,
    sendAiMessage, aiStatus, aiActivity, aiError, aiMessages, refreshTemplates,
    inspectMode, toggleInspectMode,
  ]);

  return (
    <Ctx.Provider value={value}>
      {children}
    </Ctx.Provider>
  );
}
