'use client';

import { GlyphWaves } from './GlyphWaves';

// Animated dithered-glyph background for the landing page.
// Tuned for Hudson's cyan accent, kept dim so it reads as ambient.
export function GlyphWavesBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none -z-10">
      <GlyphWaves
        charset=":::..;.-"
        cellSize={10}
        colorDark="#0A0A0A"
        colorLight="#22D3EE"
        noiseScale={1}
        noiseSkew={69}
        noiseDrift={45}
        gamma={0.4}
        overlayMix={0.55}
        mouseRadius={0.2}
        mouseStrength={0.8}
        mouseDissipation={0.96}
        grainAmount={0.11}
        grainSpeed={1000}
        opacity={0.22}
        maxDpr={1.5}
      />
    </div>
  );
}
