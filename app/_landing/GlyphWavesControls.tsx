'use client';

import { GlyphWaves } from './GlyphWaves';
import { useGlyphWavesParams } from './GlyphWavesParams';

/**
 * Background-only GlyphWaves renderer driven by shared params.
 * Interactive controls live in ComponentShowcase.
 */
export function GlyphWavesControls() {
  const { params } = useGlyphWavesParams();

  return (
    <div className="absolute inset-0 pointer-events-none">
      <GlyphWaves {...params} />
    </div>
  );
}
