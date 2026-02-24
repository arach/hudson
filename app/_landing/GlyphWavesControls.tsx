'use client';

import { useState, useCallback, useEffect } from 'react';
import { GlyphWaves, type GlyphWavesProps } from './GlyphWaves';

interface SliderDef {
  key: keyof GlyphWavesProps;
  label: string;
  min: number;
  max: number;
  step: number;
}

const SLIDERS: SliderDef[] = [
  { key: 'noiseScale', label: 'Noise Scale', min: 1, max: 30, step: 0.5 },
  { key: 'noiseSkew', label: 'Noise Skew (°)', min: 0, max: 90, step: 1 },
  { key: 'noiseDrift', label: 'Drift Speed', min: 0, max: 500, step: 5 },
  { key: 'gamma', label: 'Gamma', min: 0.1, max: 3, step: 0.05 },
  { key: 'overlayMix', label: 'Contrast Mix', min: 0, max: 1, step: 0.01 },
  { key: 'cellSize', label: 'Cell Size', min: 4, max: 32, step: 1 },
  { key: 'mouseRadius', label: 'Mouse Radius', min: 0, max: 0.5, step: 0.01 },
  { key: 'mouseStrength', label: 'Mouse Strength', min: 0, max: 2, step: 0.05 },
  { key: 'mouseDissipation', label: 'Mouse Dissipation', min: 0.8, max: 0.999, step: 0.005 },
  { key: 'grainAmount', label: 'Grain Amount', min: 0, max: 0.5, step: 0.01 },
  { key: 'grainSpeed', label: 'Grain Speed', min: 0, max: 5000, step: 50 },
  { key: 'opacity', label: 'Opacity', min: 0, max: 1, step: 0.05 },
  { key: 'maxDpr', label: 'Max DPR', min: 0.5, max: 3, step: 0.5 },
];

const DEFAULTS: GlyphWavesProps = {
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

export function GlyphWavesControls() {
  const [params, setParams] = useState<GlyphWavesProps>({ ...DEFAULTS });
  const [open, setOpen] = useState(true);

  // Toggle with Ctrl+Shift+G
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key === 'G') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const update = useCallback((key: keyof GlyphWavesProps, value: number | string) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  }, []);

  const copyConfig = useCallback(() => {
    const lines = Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `  ${k}={${typeof v === 'string' ? `"${v}"` : v}}`)
      .join('\n');
    const code = `<GlyphWaves\n${lines}\n/>`;
    navigator.clipboard.writeText(code);
  }, [params]);

  const reset = useCallback(() => setParams({ ...DEFAULTS }), []);

  return (
    <>
      <div className="absolute inset-0 pointer-events-none">
        <GlyphWaves {...params} />
      </div>

      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed top-3 right-3 z-[9999] px-2 py-1 rounded text-[10px] font-mono tracking-wider uppercase bg-neutral-900 border border-neutral-700 text-neutral-400 hover:text-neutral-200 transition-colors pointer-events-auto cursor-pointer"
      >
        {open ? 'Hide Controls' : 'Show Controls'}
      </button>

      {/* Control panel */}
      {open && (
        <div className="fixed top-10 right-3 z-[9999] w-[280px] max-h-[calc(100vh-60px)] overflow-y-auto pointer-events-auto bg-neutral-950/95 backdrop-blur-sm border border-neutral-800 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono font-bold tracking-widest text-neutral-400 uppercase">
              Glyph Waves
            </span>
            <div className="flex gap-1.5">
              <button
                onClick={reset}
                className="text-[9px] font-mono tracking-wider uppercase px-1.5 py-0.5 rounded border border-neutral-700 text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
              >
                Reset
              </button>
              <button
                onClick={copyConfig}
                className="text-[9px] font-mono tracking-wider uppercase px-1.5 py-0.5 rounded border border-emerald-800 text-emerald-500 hover:text-emerald-300 transition-colors cursor-pointer"
              >
                Copy JSX
              </button>
            </div>
          </div>

          {/* Colors */}
          <div className="flex gap-2">
            <label className="flex-1">
              <span className="text-[9px] font-mono text-neutral-500 block mb-0.5">Dark</span>
              <input
                type="color"
                value={params.colorDark ?? '#0A0A0A'}
                onChange={(e) => update('colorDark', e.target.value)}
                className="w-full h-6 rounded border border-neutral-700 bg-transparent cursor-pointer"
              />
            </label>
            <label className="flex-1">
              <span className="text-[9px] font-mono text-neutral-500 block mb-0.5">Light</span>
              <input
                type="color"
                value={params.colorLight ?? '#10B981'}
                onChange={(e) => update('colorLight', e.target.value)}
                className="w-full h-6 rounded border border-neutral-700 bg-transparent cursor-pointer"
              />
            </label>
          </div>

          {/* Charset */}
          <label>
            <span className="text-[9px] font-mono text-neutral-500 block mb-0.5">Charset</span>
            <input
              type="text"
              value={params.charset ?? ':::..;.-'}
              onChange={(e) => update('charset', e.target.value)}
              className="w-full h-6 rounded border border-neutral-700 bg-neutral-900 text-neutral-200 text-xs font-mono px-2"
            />
          </label>

          {/* Sliders */}
          {SLIDERS.map(({ key, label, min, max, step }) => (
            <label key={key} className="block">
              <div className="flex justify-between mb-0.5">
                <span className="text-[9px] font-mono text-neutral-500">{label}</span>
                <span className="text-[9px] font-mono text-neutral-600 tabular-nums">
                  {typeof params[key] === 'number' ? (params[key] as number).toFixed(step < 1 ? 2 : 0) : params[key]}
                </span>
              </div>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={(params[key] as number) ?? 0}
                onChange={(e) => update(key, parseFloat(e.target.value))}
                className="w-full h-1 appearance-none bg-neutral-800 rounded-full accent-emerald-500 cursor-pointer"
              />
            </label>
          ))}
        </div>
      )}
    </>
  );
}
