'use client';
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { usePersistentState, useAppSettings, usePlatform } from '@hudson/sdk';
import type { AppSettingsValues } from '@hudson/sdk';
import type { LogoTemplate } from './types';
import { logoSettings } from './settings';
import { isBuiltinVariant } from './types';
import { builtinRenderBodies } from './builtinRenderBodies';

export interface LogoParams {
  variant: string;
  bgColor: string;
  paneColor: string;
  dimPaneColor: string;
  channelColor: string;
  borderRadius: number;
  paneRadius: number;
  gapWidth: number;
  splitX: number; // 0-1, where the vertical L arm sits
  splitY: number; // 0-1, where the horizontal L arm sits
  padding: number;
}

export const defaults: LogoParams = {
  variant: 'negative-space',
  bgColor: '#111113',
  paneColor: '#ffffff',
  dimPaneColor: 'rgba(255,255,255,0.55)',
  channelColor: 'rgba(51,199,115,0.3)',
  borderRadius: 80,
  paneRadius: 14,
  gapWidth: 14,
  splitX: 0.37,
  splitY: 0.60,
  padding: 72,
};

// ---------------------------------------------------------------------------
// Seed built-in templates from builtinRenderBodies
// ---------------------------------------------------------------------------
function createBuiltinTemplates(): LogoTemplate[] {
  return Object.entries(builtinRenderBodies).map(([id, def]) => ({
    id,
    name: def.name,
    description: def.description,
    renderBody: def.renderBody,
    params: [],
    createdAt: 0,
    updatedAt: 0,
  }));
}

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
  customParamValues: Record<string, Record<string, number | string>>;
  setCustomParam: (templateId: string, key: string, value: number | string) => void;
  // App settings (relay URL, compile endpoint, etc.)
  appSettings: AppSettingsValues;
  /** Resolved API base URL from platform adapter */
  apiBaseUrl: string;
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
    params: { variant: 'negative-space', paneColor: '#ffffff', dimPaneColor: 'rgba(255,255,255,0.55)', bgColor: '#111113' },
  },
  {
    label: 'Dark panes, green L',
    params: { variant: 'green-channel', paneColor: '#1c1c1e', dimPaneColor: '#1c1c1e', channelColor: 'rgba(51,199,115,0.3)', bgColor: '#111113' },
  },
  {
    label: '2x2 grid color',
    params: { variant: 'grid-color', paneColor: '#ffffff', dimPaneColor: 'rgba(255,255,255,0.07)', bgColor: '#111113' },
  },
  {
    label: 'Interlocking L-pieces',
    params: { variant: 'interlocking', paneColor: '#ffffff', dimPaneColor: 'rgba(255,255,255,0.65)', bgColor: '#111113' },
  },
  // ── Lattice Grid color presets ──
  {
    label: 'Monochrome',
    params: { variant: 'lattice-grid', paneColor: '#ffffff', dimPaneColor: 'rgba(255,255,255,0.18)', bgColor: '#111113' },
  },
  {
    label: 'Emerald',
    params: { variant: 'lattice-grid', paneColor: '#34d399', dimPaneColor: 'rgba(52,211,153,0.20)', bgColor: '#0a0f0d' },
  },
  {
    label: 'Emerald on white',
    params: { variant: 'lattice-grid', paneColor: '#059669', dimPaneColor: 'rgba(5,150,105,0.18)', bgColor: '#f8faf9', borderRadius: 80, paneRadius: 14 },
  },
  {
    label: 'Ocean',
    params: { variant: 'lattice-grid', paneColor: '#38bdf8', dimPaneColor: 'rgba(56,189,248,0.18)', bgColor: '#0a0d14' },
  },
  {
    label: 'Violet',
    params: { variant: 'lattice-grid', paneColor: '#a78bfa', dimPaneColor: 'rgba(167,139,250,0.18)', bgColor: '#0d0a14' },
  },
  {
    label: 'Sunset',
    params: { variant: 'lattice-grid', paneColor: '#fb923c', dimPaneColor: 'rgba(251,146,60,0.18)', bgColor: '#140e0a' },
  },
  {
    label: 'Rose',
    params: { variant: 'lattice-grid', paneColor: '#fb7185', dimPaneColor: 'rgba(251,113,133,0.18)', bgColor: '#140a0c' },
  },
  {
    label: 'Gold',
    params: { variant: 'lattice-grid', paneColor: '#fbbf24', dimPaneColor: 'rgba(251,191,36,0.18)', bgColor: '#14120a' },
  },
  {
    label: 'Soft white',
    params: { variant: 'lattice-grid', paneColor: 'rgba(255,255,255,0.85)', dimPaneColor: 'rgba(255,255,255,0.12)', bgColor: '#18181b', borderRadius: 96, paneRadius: 18, gapWidth: 16 },
  },
  {
    label: 'Neon mint',
    params: { variant: 'lattice-grid', paneColor: '#6ee7b7', dimPaneColor: 'rgba(110,231,183,0.12)', bgColor: '#000000' },
  },
  // ── Dot Matrix presets ──
  {
    label: 'Dot matrix',
    params: { variant: 'dot-matrix', paneColor: 'rgba(255,255,255,0.85)', dimPaneColor: 'rgba(255,255,255,0.18)', bgColor: '#111113' },
  },
  {
    label: 'Dot matrix — emerald',
    params: { variant: 'dot-matrix', paneColor: '#34d399', dimPaneColor: 'rgba(52,211,153,0.20)', bgColor: '#0a0f0d' },
  },
  {
    label: 'Dot matrix — ocean',
    params: { variant: 'dot-matrix', paneColor: '#38bdf8', dimPaneColor: 'rgba(56,189,248,0.18)', bgColor: '#0a0d14' },
  },
  // ── Other variant presets ──
  {
    label: 'App windows',
    params: { variant: 'app-windows', paneColor: '#1c1c1e', dimPaneColor: '#16162a', bgColor: '#111113' },
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

export function LogoProvider({ children }: { children: ReactNode }) {
  const [appSettings] = useAppSettings('logo-designer', logoSettings);
  const { apiBaseUrl } = usePlatform();
  const [params, setParams] = useState<LogoParams>(defaults);

  // All templates (built-in + custom), persisted
  const [templates, setTemplates] = usePersistentState<LogoTemplate[]>('logo.templates', []);
  const [customParamValues, setCustomParamValues] = usePersistentState<Record<string, Record<string, number | string>>>('logo.customParamValues', {});

  // Ensure built-in templates are always present (merge with any existing custom templates)
  useEffect(() => {
    setTemplates(prev => {
      const existingIds = new Set(prev.map(t => t.id));
      const builtins = createBuiltinTemplates();
      const missing = builtins.filter(b => !existingIds.has(b.id));
      if (missing.length === 0) return prev; // all built-ins already present
      return [...missing, ...prev];
    });
  }, [setTemplates]);

  const setParam = useCallback(<K extends keyof LogoParams>(key: K, value: LogoParams[K]) => {
    setParams(prev => ({ ...prev, [key]: value }));
  }, []);

  const setVariant = useCallback((v: string) => {
    // Initialize custom param defaults when switching to a template with custom params
    const tmpl = templates.find(t => t.id === v);
    if (tmpl && tmpl.params.length > 0) {
      setCustomParamValues(cpv => {
        const existing = cpv[v] ?? {};
        const filled = { ...existing };
        for (const p of tmpl.params) {
          if (!(p.key in filled)) filled[p.key] = p.default;
        }
        return { ...cpv, [v]: filled };
      });
    }

    // Apply preset params for built-in variants
    if (isBuiltinVariant(v)) {
      const preset = presets.find(p => p.params.variant === v);
      setParams(prev => ({ ...prev, ...preset?.params, variant: v }));
    } else {
      setParams(prev => ({ ...prev, variant: v }));
    }
  }, [templates, setCustomParamValues]);

  const resetDefaults = useCallback(() => setParams(defaults), []);

  // Template CRUD
  const addTemplate = useCallback((template: LogoTemplate) => {
    setTemplates(prev => [...prev, template]);
  }, [setTemplates]);

  const updateTemplate = useCallback((id: string, updates: Partial<Omit<LogoTemplate, 'id'>>) => {
    setTemplates(prev => prev.map(t =>
      t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t
    ));
  }, [setTemplates]);

  const deleteTemplate = useCallback((id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
    setCustomParamValues(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, [setTemplates, setCustomParamValues]);

  const setCustomParam = useCallback((templateId: string, key: string, value: number | string) => {
    setCustomParamValues(prev => ({
      ...prev,
      [templateId]: { ...(prev[templateId] ?? {}), [key]: value },
    }));
  }, [setCustomParamValues]);

  return (
    <Ctx.Provider value={{
      params, setParam, setVariant, resetDefaults, presets,
      templates, addTemplate, updateTemplate, deleteTemplate,
      customParamValues, setCustomParam,
      appSettings, apiBaseUrl,
    }}>
      {children}
    </Ctx.Provider>
  );
}
