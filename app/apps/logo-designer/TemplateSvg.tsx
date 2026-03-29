'use client';

import { useMemo } from 'react';
import type { LogoTemplate } from './types';
import type { LogoParams } from './LogoProvider';

// ---------------------------------------------------------------------------
// Bitmap mask rasterizer — renders any shape to a pixel grid for O(1) sampling
// ---------------------------------------------------------------------------

const MASK_SIZE = 128;

/** Rasterize an SVG string to a binary mask via offscreen canvas. */
function rasterizeSvgToMask(svgString: string): Uint8Array | null {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = MASK_SIZE;
    canvas.height = MASK_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');
    if (!svgEl) return null;

    const vb = svgEl.getAttribute('viewBox')?.split(/[\s,]+/).map(Number);
    const [vx, vy, vw, vh] = vb && vb.length === 4 ? vb : [0, 0, 512, 512];

    ctx.setTransform(MASK_SIZE / vw, 0, 0, MASK_SIZE / vh, -vx * MASK_SIZE / vw, -vy * MASK_SIZE / vh);

    const gEl = doc.querySelector('g[transform]');
    if (gEl?.getAttribute('transform')?.includes('scale(1,-1)')) {
      ctx.scale(1, -1);
    }

    ctx.fillStyle = '#000';
    for (const pathEl of doc.querySelectorAll('path')) {
      const d = pathEl.getAttribute('d');
      if (d) ctx.fill(new Path2D(d));
    }

    const imageData = ctx.getImageData(0, 0, MASK_SIZE, MASK_SIZE);
    const mask = new Uint8Array(MASK_SIZE * MASK_SIZE);
    for (let i = 0; i < mask.length; i++) {
      mask[i] = imageData.data[i * 4 + 3] > 128 ? 1 : 0;
    }
    return mask;
  } catch {
    return null;
  }
}

/** Rasterize a built-in letter shape to a binary mask via canvas Path2D. */
function rasterizeLetterToMask(letter: string): Uint8Array | null {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = MASK_SIZE;
    canvas.height = MASK_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Render the letter as a filled glyph using a bold system font
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${MASK_SIZE * 0.75}px "Inter", "Helvetica Neue", Arial, sans-serif`;
    ctx.fillText(letter, MASK_SIZE / 2, MASK_SIZE / 2 + MASK_SIZE * 0.03);

    const imageData = ctx.getImageData(0, 0, MASK_SIZE, MASK_SIZE);
    const mask = new Uint8Array(MASK_SIZE * MASK_SIZE);
    for (let i = 0; i < mask.length; i++) {
      mask[i] = imageData.data[i * 4 + 3] > 64 ? 1 : 0;
    }
    return mask;
  } catch {
    return null;
  }
}

// Cache letter masks — same letter always produces the same mask
const letterMaskCache = new Map<string, Uint8Array>();
function getLetterMask(letter: string): Uint8Array | null {
  if (letterMaskCache.has(letter)) return letterMaskCache.get(letter)!;
  const mask = rasterizeLetterToMask(letter);
  if (mask) letterMaskCache.set(letter, mask);
  return mask;
}

// ---------------------------------------------------------------------------
// SVG helpers
// ---------------------------------------------------------------------------

interface Props {
  template: LogoTemplate;
  params: LogoParams;
  customParamValues: Record<string, number | string | Record<string, unknown>[]>;
  backgroundSvg?: string | null;
  size: number;
}

function extractPaths(svg: string): string[] {
  const paths: string[] = [];
  const re = /\bd="([^"]+)"/g;
  let m;
  while ((m = re.exec(svg)) !== null) {
    const d = m[1].trim();
    if (d.length > 10) paths.push(d);
  }
  return paths;
}

const VB = 512;

const NUMERIC_KEYS = new Set([
  'borderRadius', 'paneRadius', 'gapWidth', 'splitX', 'splitY', 'padding',
]);

// ---------------------------------------------------------------------------
// Render hook
// ---------------------------------------------------------------------------

export interface RenderResult {
  svg: string;
  error: string | null;
}

export function useTemplateRender(
  template: LogoTemplate,
  params: LogoParams,
  customParamValues: Record<string, number | string | Record<string, unknown>[]>,
  backgroundSvg?: string | null,
): RenderResult {
  const merged = useMemo(() => {
    const p: Record<string, unknown> = { ...params };
    for (const key of NUMERIC_KEYS) {
      if (key in p && typeof p[key] !== 'number') p[key] = Number(p[key]);
    }
    for (const decl of template.params) {
      let val = customParamValues[decl.key] ?? decl.default;
      if (decl.type === 'number' && typeof val !== 'number') val = Number(val);
      p[decl.key] = val;
    }

    // ── Shape mask: always provide __shapeMask regardless of source ──
    // Priority: piped SVG > built-in letter from shape param
    if (backgroundSvg) {
      p.__pipedSvg = backgroundSvg;
      p.__pipedPaths = extractPaths(backgroundSvg);
      const vbMatch = backgroundSvg.match(/viewBox="([^"]+)"/);
      if (vbMatch) {
        const parts = vbMatch[1].trim().split(/[\s,]+/).map(Number);
        if (parts.length === 4) p.__pipedViewBox = parts;
      }
      p.__pipedYFlip = /scale\(\s*1\s*,\s*-1\s*\)/.test(backgroundSvg);
      const mask = rasterizeSvgToMask(backgroundSvg);
      if (mask) {
        p.__shapeMask = mask;
        p.__shapeMaskSize = MASK_SIZE;
      }
    }

    // For built-in letter shapes: rasterize the letter to a mask too
    const shapeParam = p.shape as string | undefined;
    if (!p.__shapeMask && shapeParam && shapeParam !== 'Piped' && shapeParam.length <= 2) {
      const letter = shapeParam.length === 1 ? shapeParam : shapeParam; // single char
      const mask = getLetterMask(letter);
      if (mask) {
        p.__shapeMask = mask;
        p.__shapeMaskSize = MASK_SIZE;
      }
    }

    return p;
  }, [params, template.params, customParamValues, backgroundSvg]);

  return useMemo(() => {
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('p', 'vb', template.renderBody);
      const result = fn(merged, VB);
      if (typeof result !== 'string') return { svg: errorSvg('renderBody must return a string'), error: 'renderBody must return a string' };
      return { svg: result, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { svg: errorSvg(message), error: message };
    }
  }, [template.renderBody, merged]);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplateSvg({ template, params, customParamValues, backgroundSvg, size }: Props) {
  const { svg } = useTemplateRender(template, params, customParamValues, backgroundSvg);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${VB} ${VB}`}
      width={size}
      height={size}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function errorSvg(message: string): string {
  const escaped = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  return `<rect width="512" height="512" rx="40" fill="#1a1a1a"/>` +
    `<text x="256" y="240" text-anchor="middle" fill="#ef4444" font-size="18" font-family="monospace">Render Error</text>` +
    `<text x="256" y="280" text-anchor="middle" fill="#666" font-size="12" font-family="monospace">${escaped}</text>`;
}
