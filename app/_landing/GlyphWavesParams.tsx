'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { GlyphWavesProps } from './GlyphWaves';

export const DEFAULTS: GlyphWavesProps = {
  charset: ':::..;.-',
  cellSize: 10,
  colorDark: '#0A0A0A',
  colorLight: '#10B981',
  noiseScale: 1,
  noiseSkew: 69,
  noiseDrift: 45,
  gamma: 0.4,
  overlayMix: 0.55,
  mouseRadius: 0.1,
  mouseStrength: 0.4,
  mouseDissipation: 0.96,
  grainAmount: 0.11,
  grainSpeed: 1000,
  opacity: 0.5,
  maxDpr: 2,
};

interface GlyphWavesParamsCtx {
  params: GlyphWavesProps;
  update: (key: keyof GlyphWavesProps, value: number | string) => void;
  reset: () => void;
}

const Ctx = createContext<GlyphWavesParamsCtx>({
  params: DEFAULTS,
  update: () => {},
  reset: () => {},
});

export function GlyphWavesParamsProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useState<GlyphWavesProps>({ ...DEFAULTS });

  const update = useCallback(
    (key: keyof GlyphWavesProps, value: number | string) => {
      setParams((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const reset = useCallback(() => setParams({ ...DEFAULTS }), []);

  return <Ctx value={{ params, update, reset }}>{children}</Ctx>;
}

export function useGlyphWavesParams() {
  return useContext(Ctx);
}
