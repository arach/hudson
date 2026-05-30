'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { useEffect } from 'react';
import { Download, Check, Apple, Smartphone, Loader2, Search, Crosshair, Globe, Monitor, Package, ExternalLink, Trash2, Send, ClipboardCopy, Plus, RotateCcw, RotateCw, Maximize2, Minimize2, Undo2, Eye, EyeOff, Lock, Unlock, Square, Circle, Minus, Type } from 'lucide-react';
import { useLogo } from './LogoProvider';
import { LogoSvg } from './LogoSvg';
import { builtinRenderBodies, type BuiltinDef } from './builtinRenderBodies';
import {
  ParamSection, ParamSlider, ParamToggle, ParamColor, ParamEnum, ParamText, ParamGrid,
} from 'hudsonkit/controls';
import type { ParamDefinition } from 'hudsonkit/controls';
import { GOOGLE_FONTS, loadGoogleFont } from './types';
import type { LogoDrawingShape, ShapeOffset, WordmarkConfig } from './types';

const EXPORT_SIZES = [512, 256, 128, 64, 32, 16] as const;
const LOGO_VIEWBOX_SIZE = 512;

function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

function normalizeDegrees(value: number): number {
  let next = value % 360;
  if (next > 180) next -= 360;
  if (next < -180) next += 360;
  return roundTo(next, 1);
}

function componentTypeLabel(type: LogoDrawingShape['type']): string {
  switch (type) {
    case 'rect':
      return 'Rectangle';
    case 'ellipse':
      return 'Ellipse';
    case 'line':
      return 'Line';
    case 'text':
      return 'Text';
  }
}

function componentIcon(type: LogoDrawingShape['type']) {
  switch (type) {
    case 'rect':
      return Square;
    case 'ellipse':
      return Circle;
    case 'line':
      return Minus;
    case 'text':
      return Type;
  }
}

// ---------------------------------------------------------------------------
// Inspector header actions — target/inspect button
// ---------------------------------------------------------------------------
export function LogoInspectorHeaderActions() {
  const { inspectMode, toggleInspectMode } = useLogo();
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={toggleInspectMode}
        className={`p-1 rounded transition-colors ${
          inspectMode
            ? 'text-info bg-info/15'
            : 'text-muted-foreground/80 hover:text-foreground/80 hover:bg-muted/40'
        }`}
        title={inspectMode ? 'Exit inspect mode' : 'Inspect element parameters'}
      >
        <Crosshair size={12} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Font search picker
// ---------------------------------------------------------------------------

function FontPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!query) return [...GOOGLE_FONTS];
    const q = query.toLowerCase();
    return GOOGLE_FONTS.filter(f => f.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground">Font</span>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-2 py-1 rounded bg-muted/40 border border-border text-[11px] text-foreground/80 hover:border-accent/40 transition-colors"
      >
        <span style={{ fontFamily: value }}>{value}</span>
        <Search size={10} className="text-muted-foreground" />
      </button>
      {open && (
        <div className="flex flex-col border border-border rounded bg-popover/95 backdrop-blur-xl overflow-hidden">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search fonts"
            autoFocus
            className="px-2 py-1.5 text-[11px] bg-transparent border-b border-border text-foreground/90 placeholder:text-muted-foreground/80 outline-none"
          />
          <div className="max-h-[200px] overflow-y-auto frame-scrollbar">
            {filtered.map(font => (
              <button
                key={font}
                onClick={() => {
                  loadGoogleFont(font);
                  onChange(font);
                  setOpen(false);
                  setQuery('');
                }}
                className={`w-full text-left px-2 py-1.5 text-[11px] transition-colors ${
                  font === value
                    ? 'bg-accent/15 text-accent'
                    : 'text-foreground/70 hover:bg-muted/40 hover:text-foreground/90'
                }`}
                style={{ fontFamily: font }}
              >
                {font}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-2 py-3 text-[10px] text-muted-foreground/80 text-center">No fonts match</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SVG helpers — grab the live SVG from the DOM, clone & resize for export
// ---------------------------------------------------------------------------

function cloneSvgAtSize(sourceRef: React.RefObject<HTMLDivElement | null>, size: number): string {
  const svg = sourceRef.current?.querySelector('svg');
  if (!svg) return '';
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('width', String(size));
  clone.setAttribute('height', String(size));
  // Ensure xmlns is present (XMLSerializer sometimes omits it on inner SVGs)
  if (!clone.getAttribute('xmlns')) {
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }
  const markup = new XMLSerializer().serializeToString(clone);
  // Strip any default namespace prefix that XMLSerializer may inject (ns0:, etc.)
  return markup.replace(/<(\/?)ns\d+:/g, '<$1').replace(/\s+xmlns:ns\d+="[^"]*"/g, '');
}

function svgToPngBlob(svgMarkup: string, size: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('Failed to create PNG blob'));
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG image'));
    };
    img.src = url;
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  // Delay cleanup — revoking immediately races the browser's download initiation
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 200);
}

// ---------------------------------------------------------------------------
// Feedback button
// ---------------------------------------------------------------------------

function ExportButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  const [done, setDone] = useState(false);

  const handle = useCallback(async () => {
    try {
      await onClick();
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      // silent — clipboard/download may fail in some contexts
    }
  }, [onClick]);

  return (
    <button
      onClick={handle}
      className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/40 hover:bg-muted/60 active:bg-muted transition-colors text-[11px] font-mono text-foreground/80"
    >
      {done ? <Check size={12} className="text-accent" /> : icon}
      {done ? 'Done' : label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Prompt helpers — render an SVG and format a param schema for the AI prompt
// ---------------------------------------------------------------------------

type ParamValue = string | number | boolean;

function resolveDefaults(def: BuiltinDef): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {};
  const p = def.params as Record<string, { default: ParamValue }> | undefined;
  if (!p) return out;
  for (const [k, decl] of Object.entries(p)) out[k] = decl.default;
  return out;
}

function renderInlineSvg(renderBody: string, params: Record<string, unknown>, vb = 256): string {
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('p', 'vb', renderBody);
    const inner = fn(params, vb);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb} ${vb}" width="${vb}" height="${vb}">${typeof inner === 'string' ? inner : ''}</svg>`;
  } catch {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb} ${vb}"><!-- render error --></svg>`;
  }
}

function formatParamSchema(paramsObj: Record<string, unknown> | undefined): string {
  if (!paramsObj) return '(no schema declared)';
  const lines: string[] = [];
  for (const [key, raw] of Object.entries(paramsObj)) {
    const decl = raw as { type?: string; default?: unknown; min?: number; max?: number; step?: number; options?: unknown[]; values?: unknown[] };
    const parts: string[] = [`${key}:`];
    if (decl.type) parts.push(decl.type);
    parts.push(`default=${JSON.stringify(decl.default)}`);
    if (decl.min !== undefined || decl.max !== undefined) parts.push(`range=${decl.min ?? '?'}..${decl.max ?? '?'}`);
    const enumVals = decl.options ?? decl.values;
    if (Array.isArray(enumVals)) parts.push(`enum=[${enumVals.map(v => JSON.stringify(v)).join(', ')}]`);
    lines.push(parts.join(' '));
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Inspector — params + preview + export
// ---------------------------------------------------------------------------

export function LogoInspector() {
  const {
    params,
    setParam,
    templates,
    customParamValues,
    setCustomParam,
    elementOffsets,
    setElementOffset,
    resetElementOffsets,
    drawingShapes,
    selectedDrawingId,
    setSelectedDrawingId,
    updateDrawingShape,
    deleteDrawingShape,
    resetDrawingShapes,
    apiBaseUrl,
    showPreviews,
    togglePreviews,
    view,
    picks,
    clearPicks,
    updatePickInstruction,
    sendAiMessage,
    aiStatus,
    beginAiSession,
    activeSession,
  } = useLogo();
  const previewRef = useRef<HTMLDivElement>(null);

  const buildPicksPrompt = useCallback(() => {
    if (picks.length === 0) return '';
    const variantId = params.variant;
    const n = picks.length;
    const plural = n === 1 ? '' : 's';

    const pickBlocks = picks.map((pick, idx) => {
      const overrides = JSON.stringify(pick.overrides);
      const note = pick.instruction?.trim()
        ? `instruction: "${pick.instruction.trim()}"`
        : 'instruction: (none — explore within the template\'s param vocabulary)';
      return `- pick ${idx + 1}/${n} [${pick.coordLabel}] ${pick.family} — overrides: ${overrides} · ${note}`;
    }).join('\n');

    return [
      `# Iterate on \`${variantId}\` — ${n} pick${plural}`,
      '',
      `Call \`get_template_source("${variantId}")\` first to fetch the active template's renderBody and params schema. Use that as the source of truth — do not regenerate or refactor it.`,
      '',
      `## Picks (${n})`,
      pickBlocks,
      '',
      '## Directive',
      `Call \`create_template\` **exactly ${n} time${plural}**, once per pick in order. For each pick:`,
      `- **renderBody**: copy the active template's renderBody verbatim (do not refactor, rename, or restructure)`,
      `- **params**: the active template's param schema, with the pick's overrides baked into the matching \`default\` values. Honor the instruction by adjusting 1-2 additional defaults within the existing vocabulary (enum values must stay in-set; no new params).`,
      `- **name**: \`${variantId}-<short-kebab-handle>\` describing the direction`,
      `- **description**: 1 sentence on what this pick explores`,
      `- **parentId**: \`"${variantId}"\` — this nests the new variant under \`${variantId}\` in the variant tree`,
      '',
      `Do not stop after the first call — continue until all ${n} call${plural} ${n === 1 ? 'is' : 'are'} made. End with a 1-2 sentence summary of how the new variants relate.`,
    ].join('\n');
  }, [picks, params.variant]);

  const [sentInfo, setSentInfo] = useState<{ count: number; startedAt: number } | null>(null);
  const handleSendToAi = useCallback((mode: 'new' | 'append' = 'new') => {
    const prompt = buildPicksPrompt();
    if (!prompt) return;
    const count = picks.length;
    // 'new': stamp a v(N+1) session so AI-created templates land there.
    // 'append': route AI-created templates into the currently active session.
    beginAiSession(picks, params.variant, mode);
    sendAiMessage(prompt, {
      action: 'logo.iterate-picks',
      label: `Iterate ${count} logo pick${count === 1 ? '' : 's'}`,
      surface: 'logo-inspector',
    });
    setSentInfo({ count, startedAt: Date.now() });
    clearPicks();
  }, [buildPicksPrompt, picks, params.variant, sendAiMessage, clearPicks, beginAiSession]);

  // Keep the "sent" banner alive while AI is working, plus a 2s tail after it
  // returns to ready. Different visual states: sending → working → done.
  const aiWorking = aiStatus !== 'ready' && aiStatus !== 'error';
  const sentPhase: 'idle' | 'working' | 'done' = !sentInfo
    ? 'idle'
    : aiWorking
      ? 'working'
      : 'done';
  useEffect(() => {
    if (!sentInfo || sentPhase !== 'done') return;
    const elapsedSinceSent = Date.now() - sentInfo.startedAt;
    const tail = Math.max(0, 2500 - elapsedSinceSent);
    const timer = setTimeout(() => setSentInfo(null), tail);
    return () => clearTimeout(timer);
  }, [sentInfo, sentPhase]);

  const [picksPromptCopied, setPicksPromptCopied] = useState(false);
  const handleCopyPicksPrompt = useCallback(async () => {
    const prompt = buildPicksPrompt();
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setPicksPromptCopied(true);
      setTimeout(() => setPicksPromptCopied(false), 1500);
    } catch {
      /* ignore — clipboard can fail in some browser contexts */
    }
  }, [buildPicksPrompt]);

  const activeTemplate = templates.find(t => t.id === params.variant);
  const activeElementOffsets = activeTemplate ? (elementOffsets[activeTemplate.id] ?? {}) : {};
  const activeElementEntries = Object.entries(activeElementOffsets);
  const activeDrawingShapes = activeTemplate ? (drawingShapes[activeTemplate.id] ?? []) : [];
  const selectedDrawing = activeDrawingShapes.find(shape => shape.id === selectedDrawingId) ?? null;

  const updateActiveDrawing = useCallback((shapeId: string, patch: Partial<LogoDrawingShape>) => {
    if (!activeTemplate) return;
    updateDrawingShape(activeTemplate.id, shapeId, patch);
  }, [activeTemplate, updateDrawingShape]);

  const deleteActiveDrawing = useCallback((shapeId: string) => {
    if (!activeTemplate) return;
    deleteDrawingShape(activeTemplate.id, shapeId);
  }, [activeTemplate, deleteDrawingShape]);

  const resetActiveDrawingShapes = useCallback(() => {
    if (!activeTemplate) return;
    resetDrawingShapes(activeTemplate.id);
  }, [activeTemplate, resetDrawingShapes]);

  const readElementOrigin = useCallback((shapeId: string): Pick<ShapeOffset, 'originX' | 'originY'> | null => {
    const root = previewRef.current;
    if (!root) return null;
    const escapedId = shapeId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const node = root.querySelector(`[data-element-id="${escapedId}"]`) as SVGGraphicsElement | null;
    const svg = root.querySelector('svg') as SVGSVGElement | null;
    if (!node || !svg) return null;

    const nodeRect = node.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
    if (nodeRect.width <= 0 || nodeRect.height <= 0 || svgRect.width <= 0 || svgRect.height <= 0) return null;

    return {
      originX: roundTo(((nodeRect.left + nodeRect.width / 2) - svgRect.left) / svgRect.width * LOGO_VIEWBOX_SIZE, 1),
      originY: roundTo(((nodeRect.top + nodeRect.height / 2) - svgRect.top) / svgRect.height * LOGO_VIEWBOX_SIZE, 1),
    };
  }, []);

  const updateElementOffset = useCallback((shapeId: string, patch: ShapeOffset, needsOrigin = false) => {
    if (!activeTemplate) return;
    const origin = needsOrigin ? readElementOrigin(shapeId) : null;
    setElementOffset(activeTemplate.id, shapeId, origin ? { ...patch, ...origin } : patch);
  }, [activeTemplate, readElementOrigin, setElementOffset]);

  const resetElementOffset = useCallback((shapeId: string) => {
    if (!activeTemplate) return;
    setElementOffset(activeTemplate.id, shapeId, null);
  }, [activeTemplate, setElementOffset]);

  const resetActiveElementOffsets = useCallback(() => {
    if (!activeTemplate) return;
    resetElementOffsets(activeTemplate.id);
  }, [activeTemplate, resetElementOffsets]);

  const handleDownloadSvg = useCallback(() => {
    const markup = cloneSvgAtSize(previewRef, 512);
    if (!markup) return;
    downloadBlob(
      new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }),
      `logo-${params.variant}.svg`,
    );
  }, [params.variant]);

  const handleCopySvg = useCallback(async () => {
    const markup = cloneSvgAtSize(previewRef, 512);
    if (!markup) return;
    await navigator.clipboard.writeText(markup);
  }, []);

  const handleDownloadPng = useCallback(async (size: number) => {
    const markup = cloneSvgAtSize(previewRef, size);
    if (!markup) return;
    const blob = await svgToPngBlob(markup, size);
    downloadBlob(blob, `logo-${params.variant}-${size}x${size}.png`);
  }, [params.variant]);

  const handleCopyPng = useCallback(async () => {
    const markup = cloneSvgAtSize(previewRef, 512);
    if (!markup) return;
    const blob = await svgToPngBlob(markup, 512);
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob }),
    ]);
  }, []);

  type ExportPlatform = 'macos' | 'ios' | 'web' | 'windows' | 'all' | 'icon-composer';
  const [platformExporting, setPlatformExporting] = useState<ExportPlatform | null>(null);
  const [iconComposerAvailable, setIconComposerAvailable] = useState(false);
  const [iconComposerPath, setIconComposerPath] = useState<string | null>(null);

  // Check Icon Composer availability on mount
  useEffect(() => {
    fetch(`${apiBaseUrl}/api/logo/export/icon-composer`)
      .then(r => r.json())
      .then(d => setIconComposerAvailable(d.available === true))
      .catch(() => {});
  }, [apiBaseUrl]);

  const getMergedParams = useCallback(() => {
    const tmpl = templates.find(t => t.id === params.variant);
    if (!tmpl) return null;
    const merged: Record<string, unknown> = { ...params };
    const cpv = customParamValues[tmpl.id] ?? {};
    for (const decl of tmpl.params) {
      merged[decl.key] = cpv[decl.key] ?? decl.default;
    }
    return { renderBody: tmpl.renderBody, params: merged };
  }, [params, templates, customParamValues]);

  const handlePlatformExport = useCallback(async (platform: ExportPlatform) => {
    const data = getMergedParams();
    if (!data) return;

    setPlatformExporting(platform);
    try {
      if (platform === 'icon-composer') {
        const res = await fetch(`${apiBaseUrl}/api/logo/export/icon-composer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const result = await res.json();
        if (result.filePath) setIconComposerPath(result.filePath);
        return;
      }

      const res = await fetch(`${apiBaseUrl}/api/logo/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, platform }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Export failed' }));
        throw new Error(err.error || 'Export failed');
      }

      const filenames: Record<string, string> = {
        macos: 'AppIcon-macOS.zip',
        ios: 'AppIcon-iOS.zip',
        web: 'favicon-bundle.zip',
        windows: 'AppIcon-Windows.zip',
        all: 'AppIcon-All-Platforms.zip',
      };
      const blob = await res.blob();
      downloadBlob(blob, filenames[platform] ?? 'export.zip');
    } finally {
      setPlatformExporting(null);
    }
  }, [getMergedParams, apiBaseUrl]);

  // Convert custom template params to ParamDefinition[] for ParamGrid
  const customParams: ParamDefinition[] | null = activeTemplate && activeTemplate.params.length > 0
    ? activeTemplate.params.map(p => ({
        key: p.key,
        label: p.label,
        type: p.type,
        default: p.default,
        min: p.min,
        max: p.max,
        step: p.step,
        options: p.options,
        placeholder: p.placeholder,
        group: p.group,
        itemTemplate: p.itemTemplate,
        itemFields: p.itemFields?.map(f => ({
          key: f.key,
          label: f.label,
          type: f.type as 'number' | 'color' | 'toggle' | 'enum' | 'text',
          default: f.default as number | string | boolean,
          min: f.min,
          max: f.max,
          step: f.step,
          options: f.options,
          placeholder: f.placeholder,
        })),
      }))
    : null;

  const customValues = activeTemplate ? (customParamValues[activeTemplate.id] ?? {}) : {};

  return (
    <div className="p-3 space-y-1 overflow-y-auto h-full frame-scrollbar">
      {/* ── Active template name ── */}
      {activeTemplate && (
        <div className="flex items-center gap-2 px-1 pb-2">
          <span className="text-[12px] font-medium text-foreground/80 truncate">{activeTemplate.name}</span>
          <span className="text-[9px] text-muted-foreground/80 font-mono shrink-0">{activeTemplate.id}</span>
        </div>
      )}

      {/* ── Matrix picks panel ── */}
      {view === 'matrix' && (
        <div className="mb-2 rounded border border-border/60 bg-muted/20 p-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80 font-mono">
              Picks · {picks.length}
            </span>
            {picks.length > 0 && (
              <button
                onClick={clearPicks}
                className="text-muted-foreground/70 hover:text-foreground/80 transition-colors"
                title="Clear picks"
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
          {sentInfo && (
            <div className={`relative mb-2 overflow-hidden flex items-center gap-2 rounded border px-2.5 py-2 text-[11px] ${
              sentPhase === 'working'
                ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300 shadow-[0_0_0_1px_rgba(34,211,238,0.08),0_0_18px_rgba(34,211,238,0.12)] animate-[logo-iter-pulse_2s_ease-in-out_infinite]'
                : 'border-accent/35 bg-accent/10 text-accent'
            }`}>
              {sentPhase === 'working' ? (
                <Loader2 size={12} className="animate-spin shrink-0" />
              ) : (
                <Check size={12} className="shrink-0" />
              )}
              <span className="min-w-0 truncate">
                {sentPhase === 'working'
                  ? `AI iterating on ${sentInfo.count} pick${sentInfo.count === 1 ? '' : 's'}…`
                  : `Sent ${sentInfo.count} pick${sentInfo.count === 1 ? '' : 's'} · open AI tab to follow up`}
              </span>
              <span className="ml-auto shrink-0 text-[9.5px] font-mono uppercase tracking-[0.12em] opacity-70">
                {sentPhase === 'working' ? 'streaming' : 'open ai →'}
              </span>
              {sentPhase === 'working' && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent animate-[logo-iter-sweep_1.6s_linear_infinite]"
                />
              )}
            </div>
          )}
          {picks.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/70 leading-snug">
              Click cells in the matrix to multi-select winners. Selected cells stack here; add a per-pick instruction (optional), then send the whole batch to the AI.
            </p>
          ) : (
            <>
              <ul className="space-y-2 mb-2 max-h-[320px] overflow-y-auto frame-scrollbar pr-1">
                {picks.map(pick => (
                  <li
                    key={pick.key}
                    className="rounded border border-border/50 bg-background/40 px-2 py-1.5"
                  >
                    <div className="flex items-baseline gap-1.5 text-[10.5px] font-mono leading-tight">
                      <span className="rounded bg-accent/15 text-accent px-1.5 py-0.5 text-[9.5px] tracking-wide tabular-nums">
                        {pick.coordLabel}
                      </span>
                      <span className="text-muted-foreground/75 truncate">{pick.family}</span>
                    </div>
                    <div className="mt-1 text-[10px] font-mono text-foreground/70 truncate" title={`${pick.paramKey}=${String(pick.value)}`}>
                      <span>{pick.paramKey}</span>
                      <span className="text-muted-foreground/40">=</span>
                      <span className="text-accent">{String(pick.value)}</span>
                    </div>
                    <textarea
                      value={pick.instruction}
                      onChange={e => updatePickInstruction(pick.key, e.target.value)}
                      placeholder={`How should ${pick.coordLabel} evolve? (optional)`}
                      rows={2}
                      className="mt-1.5 w-full resize-none rounded border border-border/40 bg-muted/30 px-1.5 py-1 text-[10.5px] font-mono text-foreground/85 placeholder:text-muted-foreground/40 focus:border-accent/50 focus:outline-none"
                    />
                  </li>
                ))}
              </ul>
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleSendToAi('new')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-accent/15 hover:bg-accent/25 text-accent text-[11px] font-medium transition-colors"
                  title={`Send picks as new v${activeSession + 1} grid`}
                >
                  <Send size={11} />
                  Send to AI
                </button>
                {activeSession >= 2 && (
                  <button
                    onClick={() => handleSendToAi('append')}
                    className="flex items-center justify-center gap-1 py-1.5 px-2.5 rounded border border-border/60 bg-muted/30 hover:bg-muted/55 text-foreground/75 text-[11px] font-medium transition-colors"
                    title={`Add new variants to the current v${activeSession} grid instead of starting v${activeSession + 1}`}
                  >
                    <Plus size={11} />
                    Append
                  </button>
                )}
                <button
                  onClick={handleCopyPicksPrompt}
                  className="flex items-center justify-center py-1.5 px-2 rounded bg-muted/40 hover:bg-muted/60 text-foreground/80 transition-colors"
                  title="Copy the structured prompt — paste into Claude.ai, Claude Code, or any AI tool"
                >
                  {picksPromptCopied ? <Check size={11} /> : <ClipboardCopy size={11} />}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Template-specific params (top) ── */}
      {customParams && (
        <ParamSection label={`${activeTemplate!.name} Params`} defaultExpanded={true}>
          <ParamGrid
            params={customParams}
            values={customValues}
            onChange={(key, value) => setCustomParam(activeTemplate!.id, key, value as number | string | Record<string, unknown>[])}
            defaultExpanded={true}
          />
        </ParamSection>
      )}

      {/* ── Structured components ── */}
      {activeTemplate && activeDrawingShapes.length > 0 && (
        <ParamSection label={`Components · ${activeDrawingShapes.length}`} defaultExpanded={true}>
          <div className="flex flex-col gap-2">
            <div className="space-y-1.5">
              {activeDrawingShapes.map((shape) => {
                const Icon = componentIcon(shape.type);
                const active = shape.id === selectedDrawingId;
                return (
                  <div
                    key={shape.id}
                    className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 transition-colors ${
                      active ? 'border-cyan-500/45 bg-cyan-500/10' : 'border-border/55 bg-muted/15'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedDrawingId(shape.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      title={shape.name}
                    >
                      <Icon size={13} className={active ? 'text-cyan-500' : 'text-muted-foreground'} />
                      <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground/85">
                        {shape.name}
                      </span>
                      <span className="shrink-0 text-[9px] font-mono uppercase tracking-[0.12em] text-muted-foreground/65">
                        {componentTypeLabel(shape.type)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateActiveDrawing(shape.id, { visible: !shape.visible })}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                      title={shape.visible ? 'Hide component' : 'Show component'}
                    >
                      {shape.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateActiveDrawing(shape.id, { locked: !shape.locked })}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                      title={shape.locked ? 'Unlock component' : 'Lock component'}
                    >
                      {shape.locked ? <Lock size={12} /> : <Unlock size={12} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteActiveDrawing(shape.id)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
                      title="Delete component"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>

            {selectedDrawing && (
              <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-medium text-foreground/85">
                      {selectedDrawing.name}
                    </div>
                    <div className="font-mono text-[9px] text-muted-foreground/70">
                      {componentTypeLabel(selectedDrawing.type)} · x {roundTo(selectedDrawing.x, 1)} · y {roundTo(selectedDrawing.y, 1)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteActiveDrawing(selectedDrawing.id)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
                    title="Delete selected component"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <div className="space-y-2">
                  <ParamText
                    label="Name"
                    value={selectedDrawing.name}
                    onChange={v => updateActiveDrawing(selectedDrawing.id, { name: v })}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <ParamToggle
                      label="Visible"
                      value={selectedDrawing.visible}
                      onChange={v => updateActiveDrawing(selectedDrawing.id, { visible: v })}
                    />
                    <ParamToggle
                      label="Locked"
                      value={selectedDrawing.locked}
                      onChange={v => updateActiveDrawing(selectedDrawing.id, { locked: v })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <ParamSlider
                      label="X"
                      value={selectedDrawing.x}
                      min={-128}
                      max={640}
                      step={1}
                      onChange={v => updateActiveDrawing(selectedDrawing.id, { x: v })}
                    />
                    <ParamSlider
                      label="Y"
                      value={selectedDrawing.y}
                      min={-128}
                      max={640}
                      step={1}
                      onChange={v => updateActiveDrawing(selectedDrawing.id, { y: v })}
                    />
                  </div>
                  {selectedDrawing.type !== 'line' && (
                    <ParamSlider
                      label="Rotate"
                      value={selectedDrawing.rotate ?? 0}
                      min={-180}
                      max={180}
                      step={1}
                      format={v => `${v}°`}
                      onChange={v => updateActiveDrawing(selectedDrawing.id, { rotate: normalizeDegrees(v) })}
                    />
                  )}
                  {selectedDrawing.type === 'rect' && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <ParamSlider
                          label="Width"
                          value={selectedDrawing.w}
                          min={4}
                          max={640}
                          step={1}
                          onChange={v => updateActiveDrawing(selectedDrawing.id, { w: v })}
                        />
                        <ParamSlider
                          label="Height"
                          value={selectedDrawing.h}
                          min={4}
                          max={640}
                          step={1}
                          onChange={v => updateActiveDrawing(selectedDrawing.id, { h: v })}
                        />
                      </div>
                      <ParamSlider
                        label="Radius"
                        value={selectedDrawing.radius}
                        min={0}
                        max={160}
                        step={1}
                        onChange={v => updateActiveDrawing(selectedDrawing.id, { radius: v })}
                      />
                      <ParamColor label="Fill" value={selectedDrawing.fill} onChange={v => updateActiveDrawing(selectedDrawing.id, { fill: v })} />
                      <ParamColor label="Stroke" value={selectedDrawing.stroke} onChange={v => updateActiveDrawing(selectedDrawing.id, { stroke: v })} />
                      <ParamSlider label="Stroke width" value={selectedDrawing.strokeWidth} min={0} max={40} step={1} onChange={v => updateActiveDrawing(selectedDrawing.id, { strokeWidth: v })} />
                    </>
                  )}
                  {selectedDrawing.type === 'ellipse' && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <ParamSlider
                          label="Width"
                          value={selectedDrawing.w}
                          min={4}
                          max={640}
                          step={1}
                          onChange={v => updateActiveDrawing(selectedDrawing.id, { w: v })}
                        />
                        <ParamSlider
                          label="Height"
                          value={selectedDrawing.h}
                          min={4}
                          max={640}
                          step={1}
                          onChange={v => updateActiveDrawing(selectedDrawing.id, { h: v })}
                        />
                      </div>
                      <ParamColor label="Fill" value={selectedDrawing.fill} onChange={v => updateActiveDrawing(selectedDrawing.id, { fill: v })} />
                      <ParamColor label="Stroke" value={selectedDrawing.stroke} onChange={v => updateActiveDrawing(selectedDrawing.id, { stroke: v })} />
                      <ParamSlider label="Stroke width" value={selectedDrawing.strokeWidth} min={0} max={40} step={1} onChange={v => updateActiveDrawing(selectedDrawing.id, { strokeWidth: v })} />
                    </>
                  )}
                  {selectedDrawing.type === 'line' && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <ParamSlider
                          label="X2"
                          value={selectedDrawing.x2}
                          min={-128}
                          max={640}
                          step={1}
                          onChange={v => updateActiveDrawing(selectedDrawing.id, { x2: v })}
                        />
                        <ParamSlider
                          label="Y2"
                          value={selectedDrawing.y2}
                          min={-128}
                          max={640}
                          step={1}
                          onChange={v => updateActiveDrawing(selectedDrawing.id, { y2: v })}
                        />
                      </div>
                      <ParamColor label="Stroke" value={selectedDrawing.stroke} onChange={v => updateActiveDrawing(selectedDrawing.id, { stroke: v })} />
                      <ParamSlider label="Stroke width" value={selectedDrawing.strokeWidth} min={1} max={48} step={1} onChange={v => updateActiveDrawing(selectedDrawing.id, { strokeWidth: v })} />
                    </>
                  )}
                  {selectedDrawing.type === 'text' && (
                    <>
                      <ParamText
                        label="Text"
                        value={selectedDrawing.text}
                        placeholder="Brand"
                        onChange={v => updateActiveDrawing(selectedDrawing.id, { text: v })}
                      />
                      <FontPicker
                        value={selectedDrawing.fontFamily}
                        onChange={v => updateActiveDrawing(selectedDrawing.id, { fontFamily: v })}
                      />
                      <ParamEnum
                        label="Weight"
                        value={String(selectedDrawing.fontWeight)}
                        options={['400', '500', '600', '700', '800', '900']}
                        onChange={v => updateActiveDrawing(selectedDrawing.id, { fontWeight: Number(v) })}
                      />
                      <ParamSlider
                        label="Font size"
                        value={selectedDrawing.fontSize}
                        min={8}
                        max={180}
                        step={1}
                        onChange={v => updateActiveDrawing(selectedDrawing.id, { fontSize: v })}
                      />
                      <ParamSlider
                        label="Letter spacing"
                        value={selectedDrawing.letterSpacing}
                        min={-0.08}
                        max={0.4}
                        step={0.01}
                        format={v => `${v.toFixed(2)}em`}
                        onChange={v => updateActiveDrawing(selectedDrawing.id, { letterSpacing: v })}
                      />
                      <ParamColor label="Fill" value={selectedDrawing.fill} onChange={v => updateActiveDrawing(selectedDrawing.id, { fill: v })} />
                    </>
                  )}
                  <ParamSlider
                    label="Opacity"
                    value={selectedDrawing.opacity ?? 1}
                    min={0}
                    max={1}
                    step={0.05}
                    format={v => `${Math.round(v * 100)}%`}
                    onChange={v => updateActiveDrawing(selectedDrawing.id, { opacity: v })}
                  />
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={resetActiveDrawingShapes}
              className="flex items-center justify-center gap-1.5 rounded-md border border-border/60 bg-muted/20 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <Undo2 size={12} />
              Reset components
            </button>
          </div>
        </ParamSection>
      )}

      {/* ── Direct element edits ── */}
      {activeTemplate && activeElementEntries.length > 0 && (
        <ParamSection label={`Element Edits · ${activeElementEntries.length}`} defaultExpanded={true}>
          <div className="flex flex-col gap-2">
            {activeElementEntries.map(([shapeId, offset]) => {
              const dx = offset.dx ?? 0;
              const dy = offset.dy ?? 0;
              const rotate = offset.rotate ?? 0;
              const scale = offset.scale ?? 1;
              return (
                <div key={shapeId} className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[11px] font-medium text-foreground/85" title={shapeId}>{shapeId}</div>
                      <div className="font-mono text-[9px] text-muted-foreground/70">
                        x {roundTo(dx, 1)} · y {roundTo(dy, 1)} · r {roundTo(rotate, 1)}° · {Math.round(scale * 100)}%
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => resetElementOffset(shapeId)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                      title="Reset this element"
                    >
                      <Undo2 size={13} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <ParamSlider
                      label="X"
                      value={dx}
                      min={-220}
                      max={220}
                      step={1}
                      onChange={v => updateElementOffset(shapeId, { dx: v })}
                    />
                    <ParamSlider
                      label="Y"
                      value={dy}
                      min={-220}
                      max={220}
                      step={1}
                      onChange={v => updateElementOffset(shapeId, { dy: v })}
                    />
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateElementOffset(shapeId, { rotate: normalizeDegrees(rotate - 5) }, true)}
                      className="flex h-7 w-7 items-center justify-center rounded border border-border/60 bg-muted/30 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                      title="Rotate left"
                    >
                      <RotateCcw size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateElementOffset(shapeId, { rotate: normalizeDegrees(rotate + 5) }, true)}
                      className="flex h-7 w-7 items-center justify-center rounded border border-border/60 bg-muted/30 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                      title="Rotate right"
                    >
                      <RotateCw size={13} />
                    </button>
                    <ParamSlider
                      label="Rotate"
                      value={rotate}
                      min={-180}
                      max={180}
                      step={1}
                      format={v => `${v}°`}
                      onChange={v => updateElementOffset(shapeId, { rotate: normalizeDegrees(v) }, true)}
                    />
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateElementOffset(shapeId, { scale: roundTo(Math.max(0.25, scale - 0.05), 2) }, true)}
                      className="flex h-7 w-7 items-center justify-center rounded border border-border/60 bg-muted/30 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                      title="Scale down"
                    >
                      <Minimize2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateElementOffset(shapeId, { scale: roundTo(Math.min(3, scale + 0.05), 2) }, true)}
                      className="flex h-7 w-7 items-center justify-center rounded border border-border/60 bg-muted/30 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                      title="Scale up"
                    >
                      <Maximize2 size={13} />
                    </button>
                    <ParamSlider
                      label="Scale"
                      value={scale}
                      min={0.25}
                      max={3}
                      step={0.05}
                      format={v => `${Math.round(v * 100)}%`}
                      onChange={v => updateElementOffset(shapeId, { scale: roundTo(v, 2) }, true)}
                    />
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              onClick={resetActiveElementOffsets}
              className="flex items-center justify-center gap-1.5 rounded-md border border-border/60 bg-muted/20 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <Undo2 size={12} />
              Reset all element edits
            </button>
          </div>
        </ParamSection>
      )}

      {/* ── Tool config: Lighting ── */}
      {params.lightingEnabled && (
        <ParamSection label="Lighting" defaultExpanded={true}>
          <ParamSlider label="Direction" value={params.lighting.azimuth}
            min={0} max={360} step={5}
            format={v => `${v}°`}
            onChange={v => setParam('lighting', { ...params.lighting, azimuth: v })} />
          <ParamSlider label="Elevation" value={params.lighting.elevation}
            min={10} max={90} step={1}
            format={v => `${v}°`}
            onChange={v => setParam('lighting', { ...params.lighting, elevation: v })} />
          <ParamSlider label="Intensity" value={params.lighting.intensity}
            min={0} max={2} step={0.05}
            format={v => v.toFixed(2)}
            onChange={v => setParam('lighting', { ...params.lighting, intensity: v })} />
          <ParamSlider label="Ambient" value={params.lighting.ambient}
            min={0.1} max={1} step={0.05}
            format={v => v.toFixed(2)}
            onChange={v => setParam('lighting', { ...params.lighting, ambient: v })} />
          <ParamSlider label="Specular" value={params.lighting.specular}
            min={0} max={1} step={0.05}
            format={v => v.toFixed(2)}
            onChange={v => setParam('lighting', { ...params.lighting, specular: v })} />
          <ParamSlider label="Sharpness" value={params.lighting.specularExp}
            min={4} max={128} step={2}
            onChange={v => setParam('lighting', { ...params.lighting, specularExp: v })} />
          <ParamSlider label="Depth" value={params.lighting.surfaceScale}
            min={1} max={15} step={0.5}
            format={v => v.toFixed(1)}
            onChange={v => setParam('lighting', { ...params.lighting, surfaceScale: v })} />
        </ParamSection>
      )}

      {/* ── Tool config: Light Mode ── */}
      {params.lightEnabled && (
        <ParamSection label="Light Colors" defaultExpanded={true}>
          <ParamColor label="Background" value={params.lightColors.bgColor}
            onChange={v => setParam('lightColors', { ...params.lightColors, bgColor: v })} />
          <ParamColor label="Pane fill" value={params.lightColors.paneColor}
            onChange={v => setParam('lightColors', { ...params.lightColors, paneColor: v })} />
          <ParamColor label="Dim pane" value={params.lightColors.dimPaneColor}
            onChange={v => setParam('lightColors', { ...params.lightColors, dimPaneColor: v })} />
          <ParamColor label="Channel" value={params.lightColors.channelColor}
            onChange={v => setParam('lightColors', { ...params.lightColors, channelColor: v })} />
          <ParamColor label="Stroke" value={params.lightColors.strokeColor}
            onChange={v => setParam('lightColors', { ...params.lightColors, strokeColor: v })} />
        </ParamSection>
      )}

      {/* ── Tool config: Wordmark ── */}
      {params.wordmark.layout !== 'icon-only' && (
        <ParamSection label="Wordmark" defaultExpanded={true}>
          <ParamText label="Text" value={params.wordmark.text} placeholder="Brand name"
            onChange={v => setParam('wordmark', { ...params.wordmark, text: v })} />
          <FontPicker value={params.wordmark.fontFamily}
            onChange={v => setParam('wordmark', { ...params.wordmark, fontFamily: v })} />
          <ParamEnum label="Weight" value={String(params.wordmark.fontWeight)}
            options={['400', '700']}
            onChange={v => setParam('wordmark', { ...params.wordmark, fontWeight: Number(v) })} />
          <ParamSlider label="Font size" value={params.wordmark.fontSize}
            min={0.15} max={0.80} step={0.01}
            format={v => `${Math.round(v * 100)}%`}
            onChange={v => setParam('wordmark', { ...params.wordmark, fontSize: v })} />
          <ParamSlider label="Letter spacing" value={params.wordmark.letterSpacing}
            min={0} max={0.30} step={0.01}
            format={v => `${v.toFixed(2)}em`}
            onChange={v => setParam('wordmark', { ...params.wordmark, letterSpacing: v })} />
          <ParamSlider label="Gap" value={params.wordmark.gap}
            min={10} max={120} step={2}
            onChange={v => setParam('wordmark', { ...params.wordmark, gap: v })} />
          <ParamSlider label="Offset X" value={params.wordmark.offsetX}
            min={-100} max={100} step={1}
            onChange={v => setParam('wordmark', { ...params.wordmark, offsetX: v })} />
          <ParamSlider label="Offset Y" value={params.wordmark.offsetY}
            min={-100} max={100} step={1}
            onChange={v => setParam('wordmark', { ...params.wordmark, offsetY: v })} />
          <ParamColor label="Text color (dark)" value={params.wordmark.color}
            onChange={v => setParam('wordmark', { ...params.wordmark, color: v })} />
          {params.lightEnabled && (
            <ParamColor label="Text color (light)" value={params.wordmark.lightColor}
              onChange={v => setParam('wordmark', { ...params.wordmark, lightColor: v })} />
          )}
        </ParamSection>
      )}

      {/* ── Generic: Proportions ── */}
      <ParamSection label="Layout" defaultExpanded={false}>
        <ParamSlider label="Gap between panes" value={params.gapWidth} min={4} max={32} step={1}
          onChange={v => setParam('gapWidth', v)} />
        <ParamSlider label="Horizontal split" value={params.splitX} min={0.2} max={0.5} step={0.01}
          format={v => `${Math.round(v * 100)}%`}
          onChange={v => setParam('splitX', v)} />
        <ParamSlider label="Vertical split" value={params.splitY} min={0.4} max={0.8} step={0.01}
          format={v => `${Math.round(v * 100)}%`}
          onChange={v => setParam('splitY', v)} />
        <ParamSlider label="Inner padding" value={params.padding} min={40} max={120} step={2}
          onChange={v => setParam('padding', v)} />
        <ParamSlider label="Corner radius" value={params.borderRadius} min={0} max={128} step={2}
          onChange={v => setParam('borderRadius', v)} />
        <ParamSlider label="Inner corner radius" value={params.paneRadius} min={0} max={32} step={1}
          onChange={v => setParam('paneRadius', v)} />
      </ParamSection>

      {/* ── Generic: Shape intake ── */}
      <ParamSection label="Shape" defaultExpanded={false}>
        <ParamToggle
          label="Clip to piped shape"
          value={params.clipToShape}
          onChange={v => setParam('clipToShape', v)}
        />
        <ParamToggle
          label="Fit shape to canvas"
          value={params.fitShapeToCanvas}
          onChange={v => setParam('fitShapeToCanvas', v)}
        />
        {params.fitShapeToCanvas && (
          <ParamSlider
            label="Shape margin"
            value={params.shapeMargin}
            min={0}
            max={0.25}
            step={0.01}
            format={v => `${Math.round(v * 100)}%`}
            onChange={v => setParam('shapeMargin', v)}
          />
        )}
      </ParamSection>

      {/* ── Generic: Colors (dark mode) ── */}
      <ParamSection label="Colors" defaultExpanded={false}>
        <ParamColor label="Background" value={params.bgColor} onChange={v => setParam('bgColor', v)} />
        <ParamColor label="Primary fill" value={params.paneColor} onChange={v => setParam('paneColor', v)} />
        <ParamColor label="Secondary fill" value={params.dimPaneColor} onChange={v => setParam('dimPaneColor', v)} />
        <ParamColor label="Accent" value={params.channelColor} onChange={v => setParam('channelColor', v)} />
        <ParamColor label="Stroke" value={params.strokeColor} onChange={v => setParam('strokeColor', v)} />
      </ParamSection>

      {/* Preview */}
      <ParamSection label="Preview" defaultExpanded={true}>
        <div
          ref={previewRef}
          className="flex items-center justify-center rounded-lg bg-muted/40 p-4"
        >
          <LogoSvg params={params} size={160} />
        </div>
      </ParamSection>

      {/* ── Export ── */}
      <ParamSection label="Export" defaultExpanded={false}>
        {/* Quick actions — SVG/PNG */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <ExportButton icon={<Download size={11} />} label="SVG" onClick={handleDownloadSvg} />
          <ExportButton icon={<Download size={11} />} label="PNG 512" onClick={() => handleDownloadPng(512)} />
          <ExportButton icon={<Download size={11} />} label="Copy PNG" onClick={handleCopyPng} />
        </div>

        {/* PNG size grid */}
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {EXPORT_SIZES.map((size) => (
            <button
              key={size}
              onClick={() => handleDownloadPng(size)}
              className="flex items-center justify-center gap-1 px-2 py-1 rounded bg-muted/20 hover:bg-muted/40 active:bg-muted/60 transition-colors text-[10px] font-mono text-muted-foreground hover:text-foreground/80"
            >
              {size}
            </button>
          ))}
        </div>

        {/* Platform exports */}
        <div className="space-y-1">
          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/80 mb-1.5">Platforms</div>
          {([
            { id: 'macos' as ExportPlatform, icon: Apple, label: 'macOS', desc: '.icns + iconset bundle' },
            { id: 'ios' as ExportPlatform, icon: Smartphone, label: 'iOS', desc: '.appiconset for Xcode' },
            { id: 'web' as ExportPlatform, icon: Globe, label: 'Web', desc: 'favicon.ico + touch icon + manifest' },
            { id: 'windows' as ExportPlatform, icon: Monitor, label: 'Windows', desc: '.ico with all sizes' },
            { id: 'all' as ExportPlatform, icon: Package, label: 'All Platforms', desc: 'Everything in one zip' },
          ]).map(({ id, icon: Icon, label, desc }) => (
            <button
              key={id}
              onClick={() => handlePlatformExport(id)}
              disabled={platformExporting !== null}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-muted/20 hover:bg-muted/40 active:bg-muted/60 disabled:opacity-30 disabled:pointer-events-none transition-colors text-left"
            >
              <div className="w-7 h-7 rounded-md bg-muted/40 flex items-center justify-center shrink-0">
                {platformExporting === id ? (
                  <Loader2 size={13} className="animate-spin text-muted-foreground" />
                ) : (
                  <Icon size={13} className="text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-foreground/80 font-medium">{label}</div>
                <div className="text-[9px] text-muted-foreground truncate">{desc}</div>
              </div>
              <Download size={11} className="ml-auto text-muted-foreground/60 shrink-0" />
            </button>
          ))}

          {/* Icon Composer */}
          <button
            onClick={() => handlePlatformExport('icon-composer')}
            disabled={platformExporting !== null || !iconComposerAvailable}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-muted/20 hover:bg-muted/40 active:bg-muted/60 disabled:opacity-30 disabled:pointer-events-none transition-colors text-left mt-2 border-t border-border/60 pt-3"
          >
            <div className="w-7 h-7 rounded-md bg-muted/40 flex items-center justify-center shrink-0">
              {platformExporting === 'icon-composer' ? (
                <Loader2 size={13} className="animate-spin text-muted-foreground" />
              ) : (
                <Apple size={13} className="text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] text-foreground/80 font-medium">Icon Composer</div>
              <div className="text-[9px] text-muted-foreground truncate">
                {iconComposerAvailable ? 'Open 1024px in Icon Composer' : 'Not installed'}
              </div>
            </div>
            <ExternalLink size={11} className="ml-auto text-muted-foreground/60 shrink-0" />
          </button>
          {iconComposerPath && (
            <div className="text-[9px] font-mono text-muted-foreground/80 px-2 mt-1 truncate">{iconComposerPath}</div>
          )}
        </div>
      </ParamSection>
    </div>
  );
}
