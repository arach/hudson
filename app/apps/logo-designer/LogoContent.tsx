'use client';

import { useRef, useCallback, useState } from 'react';
import { RotateCcw, Sun, Moon, Type, Grid3X3, Sparkles, Shuffle, Pencil, Wand2, X } from 'lucide-react';
import { useLogo } from './LogoProvider';
import type { LogoParams } from './LogoProvider';
import type { WordmarkConfig } from './types';
import { LogoSvg } from './LogoSvg';
import { WordmarkSvg } from './WordmarkSvg';

// ---------------------------------------------------------------------------
// Mini pan/zoom canvas
// ---------------------------------------------------------------------------
function useCanvasControls(initial = { x: 0, y: 0, zoom: 1 }) {
  const [pan, setPan] = useState(initial);
  const isPanning = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setPan(p => ({ ...p, zoom: Math.min(8, Math.max(0.1, p.zoom * delta)) }));
    } else {
      setPan(p => ({ ...p, x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && (e.currentTarget as HTMLElement).dataset.panning === 'true')) {
      e.preventDefault();
      isPanning.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setPan(p => ({ ...p, x: p.x + dx, y: p.y + dy }));
  }, []);

  const handleMouseUp = useCallback(() => { isPanning.current = false; }, []);
  const reset = useCallback(() => setPan(initial), [initial]);

  return { pan, handleWheel, handleMouseDown, handleMouseMove, handleMouseUp, reset };
}

// ---------------------------------------------------------------------------
// Draggable wordmark wrapper — mouse drag updates offsetX/offsetY
// ---------------------------------------------------------------------------
function DraggableWordmark({ params, size, mode, zoom, onOffsetChange }: {
  params: LogoParams;
  size: number;
  mode: 'dark' | 'light';
  zoom: number;
  onOffsetChange: (dx: number, dy: number) => void;
}) {
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  // Convert pixel delta to SVG viewBox units
  // The WordmarkSvg renders at `size` px height = 512 viewBox units
  const pxToSvg = 512 / (size * zoom);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // Only left click, not during pan
    if (e.button !== 0) return;
    e.stopPropagation();
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).style.cursor = 'grabbing';
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = (e.clientX - lastPos.current.x) * pxToSvg;
    const dy = (e.clientY - lastPos.current.y) * pxToSvg;
    lastPos.current = { x: e.clientX, y: e.clientY };
    onOffsetChange(dx, dy);
  }, [pxToSvg, onOffsetChange]);

  const onMouseUp = useCallback((e: React.MouseEvent) => {
    dragging.current = false;
    (e.currentTarget as HTMLElement).style.cursor = '';
  }, []);

  return (
    <div
      className="cursor-grab active:cursor-grabbing relative group"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <WordmarkSvg params={params} size={size} mode={mode} />
      {/* Drag hint */}
      <div className="absolute -top-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-mono text-white/30 whitespace-nowrap pointer-events-none">
        drag to reposition text
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Geometry overlay — shows param hints on icon hover
// ---------------------------------------------------------------------------
function GeometryOverlay({ params, size }: { params: LogoParams; size: number }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const scale = size / 512;
  const p = params;

  // Compute positions in pixels (scaled from 512 viewBox)
  const s = (v: number) => v * scale;
  const content = 512 - p.padding * 2;
  const vGap = p.padding + content * p.splitX;
  const hGap = p.padding + content * p.splitY;

  const zones: { id: string; label: string; value: string; rect: [number, number, number, number]; color: string }[] = [
    // Padding — top edge
    { id: 'padding', label: 'padding', value: `${p.padding}px`, rect: [0, 0, 512, p.padding], color: 'rgba(56,189,248,0.12)' },
    // Padding — left edge
    { id: 'padding-l', label: 'padding', value: `${p.padding}px`, rect: [0, 0, p.padding, 512], color: 'rgba(56,189,248,0.12)' },
    // Gap vertical
    { id: 'gapWidth-v', label: 'gapWidth', value: `${p.gapWidth}px`, rect: [vGap, p.padding, p.gapWidth, content], color: 'rgba(251,191,36,0.15)' },
    // Gap horizontal
    { id: 'gapWidth-h', label: 'gapWidth', value: `${p.gapWidth}px`, rect: [p.padding, hGap, content, p.gapWidth], color: 'rgba(251,191,36,0.15)' },
    // Split X marker (vertical line)
    { id: 'splitX', label: 'splitX', value: `${(p.splitX * 100).toFixed(0)}%`, rect: [vGap - 2, p.padding, 4, content], color: 'rgba(52,211,153,0.30)' },
    // Split Y marker (horizontal line)
    { id: 'splitY', label: 'splitY', value: `${(p.splitY * 100).toFixed(0)}%`, rect: [p.padding, hGap - 2, content, 4], color: 'rgba(52,211,153,0.30)' },
  ];

  return (
    <div
      className="absolute inset-0 pointer-events-auto"
      onMouseLeave={() => setHovered(null)}
    >
      {zones.map(z => (
        <div
          key={z.id}
          className="absolute transition-opacity duration-150"
          style={{
            left: s(z.rect[0]),
            top: s(z.rect[1]),
            width: s(z.rect[2]),
            height: s(z.rect[3]),
            background: hovered === z.id ? z.color : 'transparent',
            opacity: hovered ? (hovered === z.id ? 1 : 0.3) : 0,
          }}
          onMouseEnter={() => setHovered(z.id)}
        />
      ))}
      {/* Tooltip */}
      {hovered && (() => {
        const zone = zones.find(z => z.id === hovered);
        if (!zone) return null;
        return (
          <div
            className="absolute z-20 pointer-events-none px-2 py-1 rounded bg-black/80 backdrop-blur-sm border border-white/10 text-[10px] font-mono text-white/80 whitespace-nowrap"
            style={{
              left: s(zone.rect[0] + zone.rect[2] / 2),
              top: s(zone.rect[1]) - 24,
              transform: 'translateX(-50%)',
            }}
          >
            <span className="text-emerald-400">{zone.label}</span>
            <span className="text-white/40 ml-1.5">{zone.value}</span>
          </div>
        );
      })()}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main content
// ---------------------------------------------------------------------------
export function LogoContent() {
  const { params, setParam, lightParams, showPreviews, togglePreviews, sendAiMessage, aiStatus, templates } = useLogo();
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const canvas = useCanvasControls();
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.code === 'Space' && !e.repeat && !(e.target as HTMLElement).closest('input, textarea, select')) {
      e.preventDefault();
      setSpaceHeld(true);
    }
  }, []);

  const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
    if (e.code === 'Space') setSpaceHeld(false);
  }, []);

  const hasWordmark = params.wordmark.layout !== 'icon-only' && params.wordmark.text.length > 0;

  // --- AI action system ---
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [editInput, setEditInput] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const buildContext = useCallback(() => {
    const svgEl = containerRef.current?.querySelector('svg[viewBox]');
    const svgMarkup = svgEl ? svgEl.outerHTML : '(SVG not available)';
    const tmpl = templates.find(t => t.id === params.variant);
    const paramSummary = JSON.stringify({
      bgColor: params.bgColor, paneColor: params.paneColor, dimPaneColor: params.dimPaneColor,
      channelColor: params.channelColor, strokeColor: params.strokeColor,
      borderRadius: params.borderRadius, paneRadius: params.paneRadius,
      gapWidth: params.gapWidth, splitX: params.splitX, splitY: params.splitY, padding: params.padding,
    });
    return { svgMarkup, tmplName: tmpl?.name ?? params.variant, paramSummary };
  }, [params, templates]);

  const handleAiAction = useCallback((action: 'vary' | 'refine' | 'edit', editText?: string) => {
    const { svgMarkup, tmplName, paramSummary } = buildContext();
    const ctx = `Template: "${tmplName}"\nParams: ${paramSummary}\nCurrent SVG:\n\`\`\`svg\n${svgMarkup}\n\`\`\``;

    let prompt: string;
    switch (action) {
      case 'vary':
        prompt = `Create 3 distinct variations of this logo by modifying the template's renderBody. Keep the same variant but explore different visual approaches — try different shapes, layouts, or effects. Save each as a variation (e.g. "${tmplName}-v1", "${tmplName}-v2", "${tmplName}-v3"). Keep the same color scheme.\n\n${ctx}`;
        break;
      case 'refine':
        prompt = `Refine this logo to be more polished and professional. Make subtle improvements to colors, proportions, spacing, and visual balance. Don't change the variant or overall concept — just polish it. Apply changes directly.\n\n${ctx}`;
        break;
      case 'edit':
        prompt = `${editText}\n\n${ctx}`;
        break;
    }

    sendAiMessage(prompt);
    setAiMenuOpen(false);
    setEditInput('');
  }, [buildContext, sendAiMessage]);

  const handleWordmarkOffset = useCallback((dx: number, dy: number) => {
    setParam('wordmark', {
      ...params.wordmark,
      offsetX: Math.round(params.wordmark.offsetX + dx),
      offsetY: Math.round(params.wordmark.offsetY + dy),
    });
  }, [params.wordmark, setParam]);

  return (
    <div className="flex h-full overflow-hidden">
      <div
        ref={containerRef}
        className={`flex-1 relative overflow-hidden min-w-0 ${spaceHeld ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={{ background: 'radial-gradient(circle at 50% 50%, rgba(20,20,20,1) 0%, rgba(10,10,10,1) 100%)' }}
        tabIndex={0}
        data-panning={spaceHeld ? 'true' : 'false'}
        onWheel={canvas.handleWheel}
        onMouseDown={canvas.handleMouseDown}
        onMouseMove={canvas.handleMouseMove}
        onMouseUp={canvas.handleMouseUp}
        onMouseLeave={canvas.handleMouseUp}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onBlur={() => setSpaceHeld(false)}
      >
        {/* Dot grid background */}
        <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.4 }}>
          <svg width="100%" height="100%">
            <defs>
              <pattern id="logo-grid" width={20 * canvas.pan.zoom} height={20 * canvas.pan.zoom} patternUnits="userSpaceOnUse"
                patternTransform={`translate(${canvas.pan.x % (20 * canvas.pan.zoom)} ${canvas.pan.y % (20 * canvas.pan.zoom)})`}>
                <circle cx={10 * canvas.pan.zoom} cy={10 * canvas.pan.zoom} r={0.8} fill="rgba(255,255,255,0.15)" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#logo-grid)" />
          </svg>
        </div>

        {/* Floating toolbar */}
        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-px rounded-lg border border-white/10 bg-black/60 backdrop-blur-xl p-0.5">
          <button
            onClick={() => setParam('lightEnabled', !params.lightEnabled)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-mono transition-colors ${
              params.lightEnabled ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'
            }`}
            title={params.lightEnabled ? 'Disable light mode' : 'Enable light mode'}
          >
            {params.lightEnabled ? <Sun size={11} /> : <Moon size={11} />}
            Light
          </button>

          <div className="w-px h-4 bg-white/10" />

          <button
            onClick={() => {
              const cycle: WordmarkConfig['layout'][] = ['icon-only', 'horizontal', 'stacked'];
              const idx = cycle.indexOf(params.wordmark.layout);
              setParam('wordmark', { ...params.wordmark, layout: cycle[(idx + 1) % cycle.length] });
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-mono transition-colors ${
              params.wordmark.layout !== 'icon-only' ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'
            }`}
            title={`Wordmark: ${params.wordmark.layout}`}
          >
            <Type size={11} />
            {params.wordmark.layout === 'icon-only' ? 'Wordmark' : params.wordmark.layout === 'horizontal' ? 'Horiz' : 'Stack'}
          </button>

          <div className="w-px h-4 bg-white/10" />

          <button
            onClick={togglePreviews}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-mono transition-colors ${
              showPreviews ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'
            }`}
            title={showPreviews ? 'Hide asset catalog' : 'Show asset catalog'}
          >
            <Grid3X3 size={11} />
            Sizes
          </button>

          <div className="w-px h-4 bg-white/10" />

          {/* AI actions */}
          <div className="relative">
            <button
              onClick={() => setAiMenuOpen(o => !o)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-mono transition-colors ${
                aiStatus === 'streaming' ? 'bg-emerald-500/20 text-emerald-400 animate-pulse'
                : aiMenuOpen ? 'bg-emerald-500/15 text-emerald-400'
                : 'text-neutral-500 hover:text-emerald-400 hover:bg-emerald-500/10'
              }`}
              title="AI actions"
            >
              <Sparkles size={11} className={aiStatus === 'streaming' ? 'animate-spin' : ''} />
              {aiStatus === 'streaming' ? 'Working...' : 'AI'}
            </button>
            {aiMenuOpen && (
              <div className="absolute top-full mt-1.5 right-0 w-[260px] rounded-lg border border-white/10 bg-neutral-900/95 backdrop-blur-xl shadow-xl overflow-hidden z-50">
                {/* Vary */}
                <button
                  onClick={() => handleAiAction('vary')}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
                >
                  <Shuffle size={13} className="text-cyan-400 shrink-0" />
                  <div>
                    <div className="text-[11px] text-white/80 font-medium">Vary</div>
                    <div className="text-[9px] text-white/30">Create 3 variations of this design</div>
                  </div>
                </button>
                {/* Refine */}
                <button
                  onClick={() => handleAiAction('refine')}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/5 transition-colors border-t border-white/[0.04]"
                >
                  <Wand2 size={13} className="text-emerald-400 shrink-0" />
                  <div>
                    <div className="text-[11px] text-white/80 font-medium">Refine</div>
                    <div className="text-[9px] text-white/30">Polish colors, proportions, and balance</div>
                  </div>
                </button>
                {/* Edit */}
                <div className="border-t border-white/[0.04] px-3 py-2.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Pencil size={13} className="text-amber-400 shrink-0" />
                    <div className="text-[11px] text-white/80 font-medium">Edit</div>
                  </div>
                  <form onSubmit={e => { e.preventDefault(); if (editInput.trim()) handleAiAction('edit', editInput.trim()); }}>
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editInput}
                      onChange={e => setEditInput(e.target.value)}
                      placeholder="Make the gaps wider and warmer..."
                      className="w-full px-2.5 py-1.5 rounded bg-white/5 border border-white/10 text-[11px] text-white/80 placeholder:text-white/20 outline-none focus:border-emerald-500/40 transition-colors"
                      autoFocus
                    />
                  </form>
                </div>
                {/* Close */}
                <button
                  onClick={() => setAiMenuOpen(false)}
                  className="w-full flex items-center justify-center py-1.5 text-white/20 hover:text-white/40 transition-colors border-t border-white/[0.04]"
                >
                  <X size={10} />
                </button>
              </div>
            )}
          </div>

          <div className="w-px h-4 bg-white/10" />

          <button
            onClick={canvas.reset}
            className="px-2 py-1.5 rounded-md text-neutral-500 hover:text-neutral-300 hover:bg-white/5 transition-colors"
            title="Reset view"
          >
            <RotateCcw size={11} />
          </button>
        </div>

        {/* Zoom indicator */}
        <div className="absolute bottom-2 right-2 z-10 text-[10px] font-mono text-white/20">
          {Math.round(canvas.pan.zoom * 100)}%
        </div>

        {/* Canvas world */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `translate(${canvas.pan.x}px, ${canvas.pan.y}px) scale(${canvas.pan.zoom})`,
            transformOrigin: 'center center',
          }}
        >
          <div className="flex flex-col items-center gap-12">

            {/* ── Main preview ── */}
            {hasWordmark ? (
              <div className="flex flex-col items-center gap-8">
                <div className="flex flex-col items-center gap-2">
                  <DraggableWordmark
                    params={params}
                    size={400}
                    mode="dark"
                    zoom={canvas.pan.zoom}
                    onOffsetChange={handleWordmarkOffset}
                  />
                  <span className="text-[11px] text-white/20">
                    {params.lightEnabled ? 'Dark' : params.wordmark.layout}
                  </span>
                </div>
                {params.lightEnabled && (
                  <div className="flex flex-col items-center gap-2 rounded-xl bg-white/90 p-6">
                    <DraggableWordmark
                      params={params}
                      size={400}
                      mode="light"
                      zoom={canvas.pan.zoom}
                      onOffsetChange={handleWordmarkOffset}
                    />
                    <span className="text-[10px] text-black/25">Light</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex gap-8 items-start">
                {/* Dark icon with geometry overlay */}
                <div className="flex flex-col items-center gap-2">
                  <div
                    className="relative"
                    onMouseEnter={() => setShowOverlay(true)}
                    onMouseLeave={() => setShowOverlay(false)}
                  >
                    <LogoSvg params={params} size={512} />
                    {showOverlay && <GeometryOverlay params={params} size={512} />}
                  </div>
                  <span className="text-[11px] text-white/20">
                    {params.lightEnabled ? 'Dark' : '512px'}
                  </span>
                </div>
                {params.lightEnabled && (
                  <div className="flex flex-col items-center gap-2">
                    <LogoSvg params={lightParams} size={512} />
                    <span className="text-[11px] text-white/20">Light</span>
                  </div>
                )}
              </div>
            )}

            {/* ── Asset catalog (Xcode-style rows) ── */}
            {showPreviews && (
              <div className="rounded-lg border border-white/10 overflow-hidden" style={{ background: 'rgba(20,20,22,0.90)' }}>
                <div className="flex items-center px-4 py-2 border-b border-white/8 text-[10px] font-mono uppercase tracking-wider text-white/25">
                  <span className="w-[80px] shrink-0">Size</span>
                  <span className="flex-1">Dark</span>
                  {params.lightEnabled && <span className="flex-1">Light</span>}
                </div>
                {[512, 256, 128, 64, 32, 16].map((sz, i) => (
                  <div
                    key={sz}
                    className={`flex items-center px-4 py-3 ${i > 0 ? 'border-t border-white/[0.04]' : ''}`}
                    style={{ minHeight: Math.max(sz + 16, 48) }}
                  >
                    <div className="w-[80px] shrink-0 flex flex-col">
                      <span className="text-[11px] font-mono text-white/40">{sz}px</span>
                      <span className="text-[9px] font-mono text-white/15">{sz}&times;{sz}</span>
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                      <div
                        className="rounded border border-white/8 flex items-center justify-center"
                        style={{
                          width: sz + 8, height: sz + 8,
                          backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.03) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.03) 75%), linear-gradient(45deg, rgba(255,255,255,0.03) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.03) 75%)',
                          backgroundSize: '8px 8px', backgroundPosition: '0 0, 4px 4px',
                        }}
                      >
                        <LogoSvg params={params} size={sz} />
                      </div>
                    </div>
                    {params.lightEnabled && (
                      <div className="flex-1 flex items-center justify-center">
                        <div
                          className="rounded border border-black/10 flex items-center justify-center"
                          style={{
                            width: sz + 8, height: sz + 8,
                            backgroundImage: 'linear-gradient(45deg, rgba(0,0,0,0.04) 25%, #f0f0f0 25%, #f0f0f0 75%, rgba(0,0,0,0.04) 75%), linear-gradient(45deg, rgba(0,0,0,0.04) 25%, #f0f0f0 25%, #f0f0f0 75%, rgba(0,0,0,0.04) 75%)',
                            backgroundSize: '8px 8px', backgroundPosition: '0 0, 4px 4px',
                            backgroundColor: '#f5f5f5',
                          }}
                        >
                          <LogoSvg params={lightParams} size={sz} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
