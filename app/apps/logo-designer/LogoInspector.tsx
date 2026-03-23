'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { Download, Copy, Check, Image, Apple, Smartphone, Loader2, Search } from 'lucide-react';
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

  const [platformExporting, setPlatformExporting] = useState<'macos' | 'ios' | null>(null);

  const handlePlatformExport = useCallback(async (platform: 'macos' | 'ios') => {
    const activeTemplate = templates.find(t => t.id === params.variant);
    if (!activeTemplate) return;

    setPlatformExporting(platform);
    try {
      const merged: Record<string, unknown> = { ...params };
      const cpv = customParamValues[activeTemplate.id] ?? {};
      for (const decl of activeTemplate.params) {
        merged[decl.key] = cpv[decl.key] ?? decl.default;
      }

      const res = await fetch(`${apiBaseUrl}/api/logo/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          renderBody: activeTemplate.renderBody,
          params: merged,
          platform,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Export failed' }));
        throw new Error(err.error || 'Export failed');
      }

      const blob = await res.blob();
      downloadBlob(blob, platform === 'macos' ? 'AppIcon-macOS.zip' : 'AppIcon-iOS.zip');
    } finally {
      setPlatformExporting(null);
    }
  }, [params, templates, customParamValues, apiBaseUrl]);

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
      <ParamSection label="Proportions" defaultExpanded={false}>
        <ParamSlider label="Gap width" value={params.gapWidth} min={4} max={32} step={1}
          onChange={v => setParam('gapWidth', v)} />
        <ParamSlider label="Split X (vertical arm)" value={params.splitX} min={0.2} max={0.5} step={0.01}
          onChange={v => setParam('splitX', v)} />
        <ParamSlider label="Split Y (horizontal arm)" value={params.splitY} min={0.4} max={0.8} step={0.01}
          onChange={v => setParam('splitY', v)} />
        <ParamSlider label="Padding" value={params.padding} min={40} max={120} step={2}
          onChange={v => setParam('padding', v)} />
        <ParamSlider label="Border radius (outer)" value={params.borderRadius} min={0} max={128} step={2}
          onChange={v => setParam('borderRadius', v)} />
        <ParamSlider label="Pane radius" value={params.paneRadius} min={0} max={32} step={1}
          onChange={v => setParam('paneRadius', v)} />
      </ParamSection>

      {/* ── Generic: Colors (dark mode) ── */}
      <ParamSection label="Colors" defaultExpanded={false}>
        <ParamColor label="Background" value={params.bgColor} onChange={v => setParam('bgColor', v)} />
        <ParamColor label="Pane fill" value={params.paneColor} onChange={v => setParam('paneColor', v)} />
        <ParamColor label="Dim pane" value={params.dimPaneColor} onChange={v => setParam('dimPaneColor', v)} />
        <ParamColor label="Channel" value={params.channelColor} onChange={v => setParam('channelColor', v)} />
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

      {/* Export SVG */}
      <ParamSection label="Export SVG" defaultExpanded={false}>
        <div className="flex flex-wrap gap-2">
          <ExportButton
            icon={<Download size={12} />}
            label="Download"
            onClick={handleDownloadSvg}
          />
          <ExportButton
            icon={<Copy size={12} />}
            label="Copy markup"
            onClick={handleCopySvg}
          />
        </div>
      </ParamSection>

      {/* Export PNG */}
      <ParamSection label="Export PNG" defaultExpanded={false}>
        <div className="flex flex-wrap gap-2">
          <ExportButton
            icon={<Copy size={12} />}
            label="Copy 512px"
            onClick={handleCopyPng}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-1">
          {EXPORT_SIZES.map((size) => (
            <button
              key={size}
              onClick={() => handleDownloadPng(size)}
              className="flex items-center justify-between px-3 py-1.5 rounded-md bg-white/[0.06] hover:bg-white/[0.10] active:bg-white/[0.14] transition-colors text-[11px] font-mono text-neutral-300"
            >
              <span>{size}&times;{size}</span>
              <Image size={10} className="text-neutral-500" />
            </button>
          ))}
        </div>
      </ParamSection>

      {/* Platform Export */}
      <ParamSection label="Platform Export" defaultExpanded={false}>
        <div className="text-[10px] font-mono text-neutral-500 leading-relaxed">
          Generate all required icon sizes as a ready-to-use bundle.
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handlePlatformExport('macos')}
            disabled={platformExporting !== null}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-white/[0.06] hover:bg-white/[0.10] active:bg-white/[0.14] disabled:opacity-40 disabled:pointer-events-none transition-colors text-[11px] font-mono text-neutral-300"
          >
            {platformExporting === 'macos' ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Apple size={12} />
            )}
            macOS
          </button>
          <button
            onClick={() => handlePlatformExport('ios')}
            disabled={platformExporting !== null}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-white/[0.06] hover:bg-white/[0.10] active:bg-white/[0.14] disabled:opacity-40 disabled:pointer-events-none transition-colors text-[11px] font-mono text-neutral-300"
          >
            {platformExporting === 'ios' ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Smartphone size={12} />
            )}
            iOS
          </button>
        </div>
      </ParamSection>
    </div>
  );
}
