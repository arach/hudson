'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { GlyphWaves, type GlyphWavesProps } from './GlyphWaves';
import { AnimatePresence, motion } from 'motion/react';
import { useGlyphWavesParams, DEFAULTS } from './GlyphWavesParams';

/* ── Slider definitions ─────────────────────────────────────── */

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

/* ── Component ──────────────────────────────────────────────── */

export function ComponentShowcase() {
  const { params, update, reset } = useGlyphWavesParams();
  const [controlsOpen, setControlsOpen] = useState(false);
  const [copiedTsx, setCopiedTsx] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const copyTsx = useCallback(() => {
    const lines = Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `  ${k}={${typeof v === 'string' ? `"${v}"` : v}}`)
      .join('\n');
    const code = `<GlyphWaves\n${lines}\n/>`;
    navigator.clipboard.writeText(code);
    setCopiedTsx(true);
    setTimeout(() => setCopiedTsx(false), 2000);
  }, [params]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key === 'G') {
        e.preventDefault();
        setExpanded(true);
        setControlsOpen((o) => !o);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'c') {
        const sel = window.getSelection();
        if (sel && sel.toString().length > 0) return;
        e.preventDefault();
        copyTsx();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [copyTsx]);

  // Collapse when clicking outside
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!expanded) return;
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setExpanded(false);
        setControlsOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [expanded]);

  const [mod, setMod] = useState('Ctrl');
  useEffect(() => {
    if (/Mac/.test(navigator.userAgent)) setMod('\u2318');
  }, []);

  /* ── Preview props ────────────────────────────────────────── */
  const previewProps: GlyphWavesProps = {
    ...params,
    cellSize: Math.max(6, Math.min((params.cellSize ?? 10) - 2, 14)),
    mouseRadius: 0.15,
    mouseStrength: 0.5,
    grainAmount: 0.08,
    opacity: Math.min((params.opacity ?? 0.5) + 0.1, 1),
    maxDpr: 1,
  };

  const glassStyle = {
    background:
      'linear-gradient(165deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 40%, rgba(0,0,0,0.15) 100%)',
    border: '1px solid rgba(255,255,255,0.12)',
    boxShadow:
      '0 8px 32px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.08) inset',
    backdropFilter: 'blur(16px)',
  };

  return (
    <div ref={rootRef} className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
      {/* ── Controls panel (slides up above card) ─────────── */}
      <AnimatePresence>
        {controlsOpen && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="w-[280px] rounded-xl overflow-hidden max-h-[50vh] overflow-y-auto"
            style={glassStyle}
          >
            <div className="p-3 space-y-2">
              {/* Header + Quick Copy */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold tracking-widest text-neutral-400 uppercase">
                  Controls
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={copyTsx}
                    className="text-[9px] font-mono tracking-wider uppercase px-1.5 py-0.5 rounded border border-emerald-800/60 text-emerald-500/80 hover:text-emerald-400 hover:border-emerald-700 transition-colors cursor-pointer"
                  >
                    {copiedTsx ? 'Copied!' : `Copy TSX`}
                  </button>
                  <button
                    onClick={reset}
                    className="text-[9px] font-mono tracking-wider uppercase px-1.5 py-0.5 rounded border border-neutral-700 text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Colors */}
              <div className="flex gap-2">
                <label className="flex-1">
                  <span className="text-[9px] font-mono text-neutral-500 block mb-0.5">
                    Dark
                  </span>
                  <input
                    type="color"
                    value={params.colorDark ?? '#0A0A0A'}
                    onChange={(e) => update('colorDark', e.target.value)}
                    className="w-full h-6 rounded border border-neutral-700 bg-transparent cursor-pointer"
                  />
                </label>
                <label className="flex-1">
                  <span className="text-[9px] font-mono text-neutral-500 block mb-0.5">
                    Light
                  </span>
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
                <span className="text-[9px] font-mono text-neutral-500 block mb-0.5">
                  Charset
                </span>
                <input
                  type="text"
                  value={params.charset ?? ':::..;.-'}
                  onChange={(e) => update('charset', e.target.value)}
                  className="w-full h-6 rounded border border-neutral-700 bg-neutral-900/50 text-neutral-200 text-xs font-mono px-2"
                />
              </label>

              {/* Sliders */}
              {SLIDERS.map(({ key, label, min, max, step }) => (
                <label key={key} className="block">
                  <div className="flex justify-between mb-0.5">
                    <span className="text-[9px] font-mono text-neutral-500">
                      {label}
                    </span>
                    <span className="text-[9px] font-mono text-neutral-600 tabular-nums">
                      {typeof params[key] === 'number'
                        ? (params[key] as number).toFixed(step < 1 ? 2 : 0)
                        : params[key]}
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Expanded card ────────────────────────────────────── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="w-[280px] rounded-xl overflow-hidden"
            style={glassStyle}
          >
            {/* GlyphWaves preview */}
            <div className="relative h-[100px] overflow-hidden">
              <GlyphWaves {...previewProps} />
              <div
                className="absolute bottom-0 left-0 right-0 h-8"
                style={{
                  background:
                    'linear-gradient(to top, rgba(10,10,10,0.95), transparent)',
                }}
              />
            </div>

            {/* Card body */}
            <div className="px-4 pb-4 pt-1.5 space-y-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-medium tracking-wide text-neutral-200">
                    GlyphWaves
                  </span>
                  <span className="text-[9px] font-mono tracking-wider text-neutral-500 uppercase">
                    React + WebGL
                  </span>
                </div>
                <p className="text-[11px] font-mono text-neutral-400 mt-1 leading-relaxed">
                  Perlin noise glyph dithering with mouse interaction. Free to use.
                </p>
              </div>

              {/* Controls CTA */}
              <button
                onClick={() => setControlsOpen((o) => !o)}
                className="showcase-btn w-full group/btn"
              >
                <span className="showcase-btn-label">
                  {controlsOpen ? 'Hide Controls' : 'View Controls'}
                </span>
                <span
                  className="text-[9px] transition-transform duration-200"
                  style={{
                    display: 'inline-block',
                    transform: controlsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                >
                  ▲
                </span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Collapsed pill — always visible ───────────────── */}
      <button
        onClick={() => setExpanded((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono cursor-pointer transition-all duration-200 hover:scale-[1.02]"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        }}
      >
        <span className="text-[10px] tracking-widest text-neutral-500 uppercase">
          Powered by Hudson
        </span>
      </button>
    </div>
  );
}
