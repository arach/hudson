'use client';

import { useMemo } from 'react';
import type { LogoTemplate, LightingConfig } from './types';
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
// Lighting filter — logo-wide directional light via SVG filter primitives
// ---------------------------------------------------------------------------

function buildLightingFilter(l: LightingConfig): string {
  // Use luminance as height map: bright areas = raised, dark = recessed
  // Then apply diffuse + specular lighting from a distant light source.
  //
  // Composition: finalColor = original * (diffuse * strength + ambient) + specular
  //
  // feComposite arithmetic: result = k1*in1*in2 + k2*in1 + k3*in2 + k4
  const blur = Math.max(1, l.surfaceScale * 0.6);
  const k1 = l.intensity;  // how much diffuse modulates the original
  const k2 = l.ambient;    // how much original passes through unlit

  return [
    `<defs>`,
    `<filter id="__lighting" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">`,
    // Step 1: height map from luminance
    `<feColorMatrix in="SourceGraphic" type="luminanceToAlpha" result="luma"/>`,
    `<feGaussianBlur in="luma" stdDeviation="${blur}" result="heightMap"/>`,
    // Step 2: diffuse lighting (soft, lambertian)
    `<feDiffuseLighting in="heightMap" surfaceScale="${l.surfaceScale}" diffuseConstant="1" lighting-color="white" result="diffuse">`,
    `<feDistantLight azimuth="${l.azimuth}" elevation="${l.elevation}"/>`,
    `</feDiffuseLighting>`,
    // Step 3: multiply diffuse with original  →  original * (diffuse * k1 + ambient)
    `<feComposite in="SourceGraphic" in2="diffuse" operator="arithmetic" k1="${k1}" k2="${k2}" k3="0" k4="0" result="lit"/>`,
    // Step 4: specular highlights (glossy/metallic)
    ...(l.specular > 0 ? [
      `<feSpecularLighting in="heightMap" surfaceScale="${l.surfaceScale}" specularConstant="${l.specular}" specularExponent="${l.specularExp}" lighting-color="white" result="spec">`,
      `<feDistantLight azimuth="${l.azimuth}" elevation="${l.elevation}"/>`,
      `</feSpecularLighting>`,
      // Clip specular to source alpha
      `<feComposite in="spec" in2="SourceAlpha" operator="in" result="specMasked"/>`,
      // Add specular on top: lit + specMasked
      `<feComposite in="lit" in2="specMasked" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"/>`,
    ] : [
      // No specular — just output lit
      `<feComposite in="lit" in2="lit" operator="arithmetic" k1="0" k2="1" k3="0" k4="0"/>`,
    ]),
    `</filter>`,
    `</defs>`,
  ].join('');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplateSvg({ template, params, customParamValues, backgroundSvg, size }: Props) {
  const { svg } = useTemplateRender(template, params, customParamValues, backgroundSvg);

  const finalSvg = useMemo(() => {
    if (!params.lightingEnabled) return svg;
    const filterDef = buildLightingFilter(params.lighting);
    return `${filterDef}<g filter="url(#__lighting)">${svg}</g>`;
  }, [svg, params.lightingEnabled, params.lighting]);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${VB} ${VB}`}
      width={size}
      height={size}
      dangerouslySetInnerHTML={{ __html: finalSvg }}
    />
  );
}

function errorSvg(message: string): string {
  const escaped = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  return `<rect width="512" height="512" rx="40" fill="#1a1a1a"/>` +
    `<text x="256" y="240" text-anchor="middle" fill="#ef4444" font-size="18" font-family="monospace">Render Error</text>` +
    `<text x="256" y="280" text-anchor="middle" fill="#666" font-size="12" font-family="monospace">${escaped}</text>`;
}
