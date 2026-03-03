'use client';

import { useState, useCallback, useRef } from 'react';
import { Download, Copy, Check, Image } from 'lucide-react';
import { useLogo } from './LogoProvider';
import { LogoSvg } from './LogoSvg';

const EXPORT_SIZES = [512, 256, 128, 64, 32, 16] as const;

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
// Inspector
// ---------------------------------------------------------------------------

export function LogoInspector() {
  const { params, templates } = useLogo();
  const previewRef = useRef<HTMLDivElement>(null);

  const activeTemplate = templates.find(t => t.id === params.variant);
  const variantLabel = activeTemplate?.name ?? params.variant;

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

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full frame-scrollbar">
      {/* Preview */}
      <div className="space-y-2">
        <div className="text-[10px] font-mono text-neutral-200 tracking-widest uppercase">
          Preview
        </div>
        <div
          ref={previewRef}
          className="flex items-center justify-center rounded-lg bg-neutral-900/60 p-4"
        >
          <LogoSvg params={params} size={160} />
        </div>
      </div>

      <div className="h-px bg-neutral-600/50" />

      {/* Current Config */}
      <div className="space-y-2">
        <div className="text-[10px] font-mono text-neutral-200 tracking-widest uppercase">
          Current
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[11px] font-mono">
          <div className="text-neutral-400">variant</div>
          <div className="text-white">{variantLabel}</div>

          <div className="text-neutral-400">bg</div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-sm border border-white/10 shrink-0"
              style={{ backgroundColor: params.bgColor }}
            />
            <span className="text-neutral-300 truncate">{params.bgColor}</span>
          </div>

          <div className="text-neutral-400">pane</div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-sm border border-white/10 shrink-0"
              style={{ backgroundColor: params.paneColor }}
            />
            <span className="text-neutral-300 truncate">{params.paneColor}</span>
          </div>

          <div className="text-neutral-400">radius</div>
          <div className="text-neutral-300">{params.borderRadius}px</div>

          <div className="text-neutral-400">gap</div>
          <div className="text-neutral-300">{params.gapWidth}px</div>

          <div className="text-neutral-400">padding</div>
          <div className="text-neutral-300">{params.padding}px</div>

          <div className="text-neutral-400">split</div>
          <div className="text-neutral-300">
            {(params.splitX * 100).toFixed(0)}% &times; {(params.splitY * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      <div className="h-px bg-neutral-600/50" />

      {/* Export SVG */}
      <div className="space-y-2">
        <div className="text-[10px] font-mono text-neutral-200 tracking-widest uppercase">
          Export SVG
        </div>
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
      </div>

      <div className="h-px bg-neutral-600/50" />

      {/* Export PNG */}
      <div className="space-y-2">
        <div className="text-[10px] font-mono text-neutral-200 tracking-widest uppercase">
          Export PNG
        </div>
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
      </div>
    </div>
  );
}
