'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { useEffect } from 'react';
import { Download, Copy, Check, Image, Apple, Smartphone, Loader2, Search, Crosshair, Globe, Monitor, Package, ExternalLink } from 'lucide-react';
import { useLogo } from './LogoProvider';
import { LogoSvg } from './LogoSvg';
import {
  ParamSection, ParamSlider, ParamToggle, ParamColor, ParamEnum, ParamText, ParamGrid,
} from '@hudson/sdk/controls';
import type { ParamDefinition } from '@hudson/sdk/controls';
import { GOOGLE_FONTS, loadGoogleFont } from './types';
import type { WordmarkConfig } from './types';

const EXPORT_SIZES = [512, 256, 128, 64, 32, 16] as const;

// ---------------------------------------------------------------------------
// Inspector header actions — target/inspect button
// ---------------------------------------------------------------------------
export function LogoInspectorHeaderActions() {
  const { inspectMode, toggleInspectMode } = useLogo();
  return (
    <button
      onClick={toggleInspectMode}
      className={`p-1 rounded transition-colors ${
        inspectMode
          ? 'text-cyan-400 bg-cyan-500/15'
          : 'text-white/25 hover:text-white/50 hover:bg-white/5'
      }`}
      title={inspectMode ? 'Exit inspect mode' : 'Inspect element parameters'}
    >
      <Crosshair size={12} />
    </button>
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
      <span className="text-[11px] text-white/50">Font</span>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-2 py-1 rounded bg-white/5 border border-white/10 text-[11px] text-white/70 hover:border-emerald-500/40 transition-colors"
      >
        <span style={{ fontFamily: value }}>{value}</span>
        <Search size={10} className="text-white/30" />
      </button>
      {open && (
        <div className="flex flex-col border border-white/10 rounded bg-neutral-900/95 backdrop-blur-xl overflow-hidden">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search fonts..."
            autoFocus
            className="px-2 py-1.5 text-[11px] bg-transparent border-b border-white/10 text-white/80 placeholder:text-white/20 outline-none"
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
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'text-white/60 hover:bg-white/5 hover:text-white/80'
                }`}
                style={{ fontFamily: font }}
              >
                {font}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-2 py-3 text-[10px] text-white/20 text-center">No fonts match</div>
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
  return new XMLSerializer().serializeToString(clone);
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
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
      className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/[0.06] hover:bg-white/[0.10] active:bg-white/[0.14] transition-colors text-[11px] font-mono text-neutral-300"
    >
      {done ? <Check size={12} className="text-emerald-400" /> : icon}
      {done ? 'Done' : label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Inspector — params + preview + export
// ---------------------------------------------------------------------------

export function LogoInspector() {
  const { params, setParam, templates, customParamValues, setCustomParam, apiBaseUrl, showPreviews, togglePreviews } = useLogo();
  const previewRef = useRef<HTMLDivElement>(null);

  const activeTemplate = templates.find(t => t.id === params.variant);

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
          <span className="text-[12px] font-medium text-white/70 truncate">{activeTemplate.name}</span>
          <span className="text-[9px] text-white/20 font-mono shrink-0">{activeTemplate.id}</span>
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
          className="flex items-center justify-center rounded-lg bg-neutral-900/60 p-4"
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
              className="flex items-center justify-center gap-1 px-2 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] transition-colors text-[10px] font-mono text-white/40 hover:text-white/60"
            >
              {size}
            </button>
          ))}
        </div>

        {/* Platform exports */}
        <div className="space-y-1">
          <div className="text-[9px] font-mono uppercase tracking-widest text-white/20 mb-1.5">Platforms</div>
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
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] active:bg-white/[0.09] disabled:opacity-30 disabled:pointer-events-none transition-colors text-left"
            >
              <div className="w-7 h-7 rounded-md bg-white/[0.04] flex items-center justify-center shrink-0">
                {platformExporting === id ? (
                  <Loader2 size={13} className="animate-spin text-white/40" />
                ) : (
                  <Icon size={13} className="text-white/40" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-white/70 font-medium">{label}</div>
                <div className="text-[9px] text-white/25 truncate">{desc}</div>
              </div>
              <Download size={11} className="ml-auto text-white/15 shrink-0" />
            </button>
          ))}

          {/* Icon Composer */}
          <button
            onClick={() => handlePlatformExport('icon-composer')}
            disabled={platformExporting !== null || !iconComposerAvailable}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] active:bg-white/[0.09] disabled:opacity-30 disabled:pointer-events-none transition-colors text-left mt-2 border-t border-white/[0.04] pt-3"
          >
            <div className="w-7 h-7 rounded-md bg-white/[0.04] flex items-center justify-center shrink-0">
              {platformExporting === 'icon-composer' ? (
                <Loader2 size={13} className="animate-spin text-white/40" />
              ) : (
                <Apple size={13} className="text-white/40" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] text-white/70 font-medium">Icon Composer</div>
              <div className="text-[9px] text-white/25 truncate">
                {iconComposerAvailable ? 'Open 1024px in Icon Composer' : 'Not installed'}
              </div>
            </div>
            <ExternalLink size={11} className="ml-auto text-white/15 shrink-0" />
          </button>
          {iconComposerPath && (
            <div className="text-[9px] font-mono text-white/20 px-2 mt-1 truncate">{iconComposerPath}</div>
          )}
        </div>
      </ParamSection>
    </div>
  );
}
