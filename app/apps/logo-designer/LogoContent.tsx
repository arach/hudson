'use client';

import { useRef, useCallback, useState } from 'react';
import { RotateCcw, Sun, Moon, Type, Grid3X3, Sparkles, Shuffle, Pencil, Wand2, X, Minimize2, Maximize2, Zap, Send, Lightbulb } from 'lucide-react';
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
      {/* Drag hint — preview stage is always dark per template bg, so this text needs to read on dark */}
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
  const { params, setParam, lightParams, showPreviews, togglePreviews, sendAiMessage, aiStatus, aiActivity, aiError, aiMessages, templates, inspectMode } = useLogo();
  const [spaceHeld, setSpaceHeld] = useState(false);
  const gridOpacity = 0.4; // Fixed — workspace-level grid opacity is in shell settings
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
  const [editOpen, setEditOpen] = useState(false);
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

  type AiAction = 'polish' | 'explore' | 'simplify' | 'elevate' | 'remix' | 'edit';
  const AI_ACTIONS: { id: AiAction; icon: typeof Wand2; label: string; desc: string; color: string; prompt: (ctx: string, name: string) => string }[] = [
    {
      id: 'polish', icon: Wand2, label: 'Polish', desc: 'Subtle refinements', color: 'text-emerald-400',
      prompt: (ctx, name) => `Polish this logo with subtle improvements. Adjust colors for better harmony, refine proportions, improve spacing and balance. Keep the same concept — just make it cleaner and more intentional. Apply changes directly.\n\n${ctx}`,
    },
    {
      id: 'explore', icon: Shuffle, label: 'Explore', desc: 'Create 3 variations', color: 'text-cyan-400',
      prompt: (ctx, name) => `Create 3 distinct variations of this logo by modifying the template's renderBody. Explore different visual approaches — different geometries, compositions, or effects. Save each as "${name}-v1", "${name}-v2", "${name}-v3". Keep the color palette.\n\n${ctx}`,
    },
    {
      id: 'simplify', icon: Minimize2, label: 'Simplify', desc: 'Remove complexity', color: 'text-amber-400',
      prompt: (ctx) => `Simplify this logo. Remove decorative elements, reduce the number of shapes, increase negative space. The mark should read clearly at 16px. Less is more — find the essential geometry and remove everything else. Apply changes directly.\n\n${ctx}`,
    },
    {
      id: 'elevate', icon: Maximize2, label: 'Elevate', desc: 'Add sophistication', color: 'text-violet-400',
      prompt: (ctx) => `Elevate this logo to feel more premium and sophisticated. Add subtle depth through layered opacity, refine the geometry for better mathematical harmony, improve the color palette for more richness. Think Pentagram or Wolff Olins level. Apply changes directly.\n\n${ctx}`,
    },
    {
      id: 'remix', icon: Zap, label: 'Remix', desc: 'Fresh take, same spirit', color: 'text-rose-400',
      prompt: (ctx, name) => `Remix this logo — keep the core concept and color palette but reimagine the visual execution. Try a completely different geometric approach. Create a fresh take that feels related but distinctly new. Save as "${name}-remix". \n\n${ctx}`,
    },
  ];

  const handleAiAction = useCallback((action: AiAction, editText?: string) => {
    const { svgMarkup, tmplName, paramSummary } = buildContext();
    const ctx = `Template: "${tmplName}"\nParams: ${paramSummary}\nCurrent SVG:\n\`\`\`svg\n${svgMarkup}\n\`\`\``;

    let prompt: string;
    if (action === 'edit') {
      prompt = `${editText}\n\n${ctx}`;
    } else {
      const actionDef = AI_ACTIONS.find(a => a.id === action)!;
      prompt = actionDef.prompt(ctx, tmplName);
    }

    sendAiMessage(prompt);
    setAiMenuOpen(false);
    setEditOpen(false);
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
        {gridOpacity > 0 && (
        <div className="absolute inset-0 pointer-events-none" style={{ opacity: gridOpacity }}>
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
        )}

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
            onClick={() => setParam('lightingEnabled', !params.lightingEnabled)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-mono transition-colors ${
              params.lightingEnabled ? 'bg-amber-500/15 text-amber-400' : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'
            }`}
            title={params.lightingEnabled ? 'Disable lighting' : 'Enable lighting'}
          >
            <Lightbulb size={11} />
            Lighting
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
                aiError ? 'bg-red-500/15 text-red-400'
                : aiStatus === 'streaming' ? 'bg-emerald-500/20 text-emerald-400 animate-pulse'
                : aiMenuOpen ? 'bg-emerald-500/15 text-emerald-400'
                : 'text-neutral-500 hover:text-emerald-400 hover:bg-emerald-500/10'
              }`}
              title="AI actions"
            >
              <Sparkles size={11} className={aiStatus === 'streaming' ? 'animate-spin' : ''} />
              {aiStatus === 'streaming' ? 'Working...' : aiError ? 'Error' : 'AI'}
            </button>
            {aiMenuOpen && (
              <div className="absolute top-full mt-2 right-0 w-[220px] rounded-xl border border-white/10 bg-neutral-950/95 backdrop-blur-2xl shadow-2xl shadow-black/50 overflow-hidden z-50">
                <div className="px-3 pt-2.5 pb-1.5">
                  <div className="text-[9px] font-mono uppercase tracking-widest text-white/20">Actions</div>
                </div>
                {AI_ACTIONS.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      onClick={() => handleAiAction(action.id)}
                      disabled={aiStatus === 'streaming'}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-white/[0.04] active:bg-white/[0.07] transition-colors disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <Icon size={14} className={`${action.color} shrink-0`} />
                      <div className="min-w-0">
                        <div className="text-[11px] text-white/80">{action.label}</div>
                        <div className="text-[9px] text-white/25">{action.desc}</div>
                      </div>
                    </button>
                  );
                })}
                <div className="border-t border-white/[0.05] mt-1" />
                <button
                  onClick={() => { setAiMenuOpen(false); setEditOpen(true); }}
                  disabled={aiStatus === 'streaming'}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/[0.04] transition-colors disabled:opacity-30"
                >
                  <Pencil size={14} className="text-white/40 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[11px] text-white/80">Edit</div>
                    <div className="text-[9px] text-white/25">Describe what to change</div>
                  </div>
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

        {/* Edit modal */}
        {editOpen && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setEditOpen(false); }}>
            <div className="w-[440px] rounded-xl border border-white/10 bg-neutral-950/95 backdrop-blur-2xl shadow-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Pencil size={14} className="text-white/40" />
                  <span className="text-[13px] text-white/80 font-medium">Edit with AI</span>
                </div>
                <button onClick={() => setEditOpen(false)} className="p-1 text-white/20 hover:text-white/50 transition-colors">
                  <X size={14} />
                </button>
              </div>
              <form onSubmit={e => { e.preventDefault(); if (editInput.trim()) handleAiAction('edit', editInput.trim()); }}>
                <input
                  ref={editInputRef}
                  type="text"
                  value={editInput}
                  onChange={e => setEditInput(e.target.value)}
                  placeholder="Make the gaps wider, soften the corners, try a warmer palette..."
                  autoFocus
                  className="w-full px-4 py-3 rounded-lg bg-white/[0.04] border border-white/10 text-[13px] text-white/90 placeholder:text-white/20 outline-none focus:border-emerald-500/30 transition-colors"
                />
                <div className="flex items-center justify-between mt-3">
                  <span className="text-[9px] text-white/15 font-mono">Enter to send</span>
                  <button
                    type="submit"
                    disabled={!editInput.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-[11px] font-medium hover:bg-emerald-500/25 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  >
                    <Send size={11} />
                    Send
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Zoom indicator */}
        <div className="absolute bottom-2 right-2 z-10 text-[10px] font-mono text-white/20">
          {Math.round(canvas.pan.zoom * 100)}%
        </div>

        {/* AI HUD — streaming text + activity */}
        {(aiStatus === 'streaming' || aiActivity.length > 0) && (() => {
          // Extract latest assistant text (strip <think> blocks)
          const lastAssistant = [...(aiMessages ?? [])].reverse().find(m => m.role === 'assistant');
          const rawText = lastAssistant?.parts
            ?.filter((p: { type: string }) => p.type === 'text')
            .map((p: { text?: string }) => p.text ?? '')
            .join('') ?? '';
          const streamText = rawText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

          return (
            <div className="absolute bottom-2 left-2 z-10 flex flex-col gap-1 max-w-[380px]">
              {/* Streaming thought */}
              {aiStatus === 'streaming' && streamText && (
                <div className="text-[10px] font-mono leading-relaxed px-3 py-2 rounded-lg bg-black/60 backdrop-blur-xl border border-white/8 text-white/40 max-h-[120px] overflow-y-auto frame-scrollbar">
                  {streamText.slice(-300)}
                  <span className="inline-block w-1.5 h-3 bg-emerald-400/60 ml-0.5 animate-pulse" />
                </div>
              )}
              {/* Tool calls */}
              {aiActivity.slice(-3).map((entry, i) => {
                const age = Date.now() - entry.timestamp;
                const fading = age > 8000;
                return (
                  <div
                    key={entry.id}
                    className={`text-[9px] font-mono px-2 py-0.5 rounded bg-black/40 backdrop-blur-sm transition-opacity duration-1000 ${
                      fading && i < 2 ? 'opacity-20' : 'opacity-70'
                    }`}
                  >
                    <span className={entry.tool === 'error' ? 'text-red-400/70' : 'text-emerald-400/70'}>{entry.tool}</span>
                    <span className={`ml-1.5 ${entry.tool === 'error' ? 'text-red-300/40' : 'text-white/30'}`}>{entry.summary}</span>
                  </div>
                );
              })}
            </div>
          );
        })()}

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
                  <div className="relative">
                    <LogoSvg params={params} size={512} />
                    {inspectMode && <GeometryOverlay params={params} size={512} />}
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
