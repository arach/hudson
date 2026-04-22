import type { BezierData } from '../types';

// ---------------------------------------------------------------------------
// Output format builders. All pure — no React, no DOM (except rasterize,
// which is explicitly browser-only).
// ---------------------------------------------------------------------------

export interface ExportOptions {
  /** The composed bezier path string (all visible strokes). */
  pathD: string;
  pathColor: string;
  fillEnabled: boolean;
  fillPattern: 'solid' | 'dither' | 'halftone' | 'noise';
  /** Overall bbox used to compute the SVG viewBox. Defaults to 0 0 1024 1024. */
  viewBox?: { x: number; y: number; width: number; height: number };
  /** Padding (in canvas units) added to the computed viewBox. */
  viewBoxPadding?: number;
}

export interface Bbox { x: number; y: number; width: number; height: number }

/** Compute the combined bounding box across all strokes in bezierData. */
export function computeBezierBbox(bezierData: BezierData | null): Bbox {
  if (!bezierData || bezierData.strokes.length === 0) {
    return { x: 0, y: 0, width: 1024, height: 1024 };
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const stroke of bezierData.strokes) {
    for (const seg of stroke) {
      for (const pt of [seg.p0, seg.c1, seg.c2, seg.p3] as const) {
        if (pt[0] < minX) minX = pt[0];
        if (pt[0] > maxX) maxX = pt[0];
        if (pt[1] < minY) minY = pt[1];
        if (pt[1] > maxY) maxY = pt[1];
      }
    }
  }
  if (!isFinite(minX)) return { x: 0, y: 0, width: 1024, height: 1024 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Build a complete SVG document string ready for export. */
export function buildSvgString(opts: ExportOptions): string {
  const bbox = opts.viewBox ?? { x: 0, y: 0, width: 1024, height: 1024 };
  const pad = opts.viewBoxPadding ?? 0;
  const viewBox = `${bbox.x - pad} ${bbox.y - pad} ${bbox.width + 2 * pad} ${bbox.height + 2 * pad}`;

  const fill = opts.fillEnabled ? opts.pathColor : 'none';
  const stroke = opts.fillEnabled && opts.fillPattern === 'solid' ? 'none' : opts.pathColor;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
  <path d="${opts.pathD}" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}

/**
 * Rasterize an SVG string to a PNG Blob at `size`×`size`. Browser-only.
 * Uses an Image + Canvas pipeline — works for any browser that supports
 * HTMLCanvasElement.toBlob (all modern browsers).
 */
export async function rasterizeSvgToPng(svgString: string, size = 1024): Promise<Blob> {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load SVG for rasterization'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.drawImage(img, 0, 0, size, size);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob returned null'))), 'image/png');
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Trigger a browser download for a Blob. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Copy text to the clipboard (uses the modern Clipboard API). */
export async function copyText(text: string): Promise<void> {
  if (!navigator.clipboard) throw new Error('Clipboard API unavailable');
  await navigator.clipboard.writeText(text);
}

/** Copy a PNG Blob to the clipboard. Requires a secure context. */
export async function copyPng(blob: Blob): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('Clipboard image-write not supported in this browser');
  }
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

/** Convert a Blob to a data URL (used for posting to the Assets API). */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Sanitize a user-facing name into something safe for filenames. */
export function sanitizeFilename(name: string, fallback = 'shaper'): string {
  const stripped = name.replace(/\.[^.]+$/, '').trim();
  const safe = stripped.replace(/[^a-zA-Z0-9_\-. ]/g, '_').slice(0, 80);
  return safe || fallback;
}
