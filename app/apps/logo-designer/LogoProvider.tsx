'use client';
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type Variant = 'negative-space' | 'green-channel' | 'grid-color' | 'interlocking' | 'lattice-grid' | 'app-windows';

export interface LogoParams {
  variant: Variant;
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

const defaults: LogoParams = {
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

interface LogoState {
  params: LogoParams;
  setParam: <K extends keyof LogoParams>(key: K, value: LogoParams[K]) => void;
  setVariant: (v: Variant) => void;
  resetDefaults: () => void;
  presets: { label: string; params: Partial<LogoParams> }[];
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
  const [params, setParams] = useState<LogoParams>(defaults);

  const setParam = useCallback(<K extends keyof LogoParams>(key: K, value: LogoParams[K]) => {
    setParams(prev => ({ ...prev, [key]: value }));
  }, []);

  const setVariant = useCallback((v: Variant) => {
    const preset = presets.find(p => p.params.variant === v);
    setParams(prev => ({ ...prev, ...preset?.params, variant: v }));
  }, []);

  const resetDefaults = useCallback(() => setParams(defaults), []);

  return (
    <Ctx.Provider value={{ params, setParam, setVariant, resetDefaults, presets }}>
      {children}
    </Ctx.Provider>
  );
}
