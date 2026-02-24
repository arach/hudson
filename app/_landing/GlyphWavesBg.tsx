'use client';

import { GlyphWaves } from './GlyphWaves';

/** Same GlyphWaves animation as the hero, just dimmer — with boosted mouse response to compensate for lower opacity */
export function GlyphWavesBg() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <GlyphWaves
        charset=":::..;.-"
        cellSize={10}
        colorDark="#0A0A0A"
        colorLight="#10B981"
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
        opacity={0.25}
        maxDpr={1.5}
      />
    </div>
  );
}
