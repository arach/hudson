'use client';

import type { ReactNode } from 'react';
import { GlyphWavesParamsProvider } from './GlyphWavesParams';

/**
 * Wraps landing page content so the GlyphWaves background
 * and the ComponentShowcase controls share the same params state.
 */
export function LandingGlyphWaves({ children }: { children: ReactNode }) {
  return <GlyphWavesParamsProvider>{children}</GlyphWavesParamsProvider>;
}
