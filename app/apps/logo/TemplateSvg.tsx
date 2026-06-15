'use client';

import { useMemo } from 'react';
import type { LogoTemplate, LightingConfig, LogoElementOffsets, LogoDrawingShape } from './types';
import type { LogoParams } from './LogoProvider';
import { appendDrawingSvgLayer } from '../../lib/drawing';

// ---------------------------------------------------------------------------
// Bitmap mask rasterizer — renders any shape to a pixel grid for O(1) sampling
// ---------------------------------------------------------------------------

const MASK_SIZE = 128;

interface RasterizeOpts {
  /** If true, compute the actual path bounding box and fit it to the mask — rather than
   *  using the SVG's declared viewBox verbatim. Upstream apps (e.g. Shaper) often export
   *  with fixed padding inside a 512×512 viewBox, which otherwise makes the shape appear
   *  small and off-center in the logo. Defaults to true. */
  fit?: boolean;
  /** Extra margin around the fitted shape as a fraction of its longest side (0 = fill). */
  margin?: number;
}

export interface RasterizeResult {
  mask: Uint8Array;
  /** Effective viewBox used to draw the mask, in the SOURCE SVG's coordinate space.
   *  When fit is applied this is the path bbox (expanded by margin); otherwise it
   *  matches the SVG's declared viewBox. Templates that also render the piped paths
   *  directly can use this to keep their rendering aligned with the mask. */
  viewBox: [number, number, number, number];
}

interface PathBounds { x: number; y: number; w: number; h: number }

/** Measure the true geometric bounds of all drawable elements in an SVG string
 *  using DOM getBBox(). Returns bounds in the SVG's user coordinate system.
 *  Crucially, this is NOT clipped by the SVG's declared viewBox — geometry
 *  extending past the viewBox edge is still reported. */
function measurePathBounds(svgString: string): PathBounds | null {
  if (typeof document === 'undefined' || typeof document.body === 'undefined') return null;
  const container = document.createElement('div');
  // Render offscreen with no clipping so getBBox sees full geometry.
  container.style.cssText = 'position:absolute;visibility:hidden;left:-99999px;top:0;width:1px;height:1px;overflow:visible;pointer-events:none;';
  container.innerHTML = svgString;
  const svgEl = container.querySelector('svg');
  if (!svgEl) return null;
  document.body.appendChild(container);
  try {
    const selector = 'path,circle,rect,ellipse,line,polyline,polygon';
    const nodes = svgEl.querySelectorAll(selector);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach((n) => {
      try {
        const b = (n as SVGGraphicsElement).getBBox();
        if (!isFinite(b.width) || !isFinite(b.height)) return;
        if (b.width === 0 && b.height === 0) return;
        if (b.x < minX) minX = b.x;
        if (b.y < minY) minY = b.y;
        if (b.x + b.width > maxX) maxX = b.x + b.width;
        if (b.y + b.height > maxY) maxY = b.y + b.height;
      } catch {
        /* skip unmeasurable nodes */
      }
    });
    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return null;
    const w = maxX - minX;
    const h = maxY - minY;
    if (w <= 0 || h <= 0) return null;
    return { x: minX, y: minY, w, h };
  } catch {
    return null;
  } finally {
    try { document.body.removeChild(container); } catch { /* already removed */ }
  }
}

/** Fallback bbox measurement via pixel scanning. Uses an ENLARGED virtual
 *  viewBox (3× the declared one) so overflow geometry is included even though
 *  we can't use getBBox. Less accurate than getBBox but always available. */
function measureByScratchCanvas(
  paths: Element[],
  vx: number, vy: number, vw: number, vh: number,
  yFlip: boolean,
): PathBounds | null {
  if (typeof document === 'undefined') return null;
  const SCRATCH = 384;
  // Enlarge the sampled region 3× around the declared viewBox so paths that
  // extend outside it still get captured.
  const expand = 1.0;
  const evx = vx - vw * expand;
  const evy = vy - vh * expand;
  const evw = vw * (1 + 2 * expand);
  const evh = vh * (1 + 2 * expand);
  const scratch = document.createElement('canvas');
  scratch.width = SCRATCH;
  scratch.height = SCRATCH;
  const sctx = scratch.getContext('2d');
  if (!sctx) return null;
  sctx.setTransform(SCRATCH / evw, 0, 0, SCRATCH / evh, -evx * SCRATCH / evw, -evy * SCRATCH / evh);
  if (yFlip) sctx.scale(1, -1);
  sctx.fillStyle = '#000';
  for (const pathEl of paths) {
    const d = pathEl.getAttribute('d');
    if (d) sctx.fill(new Path2D(d));
  }
  const sd = sctx.getImageData(0, 0, SCRATCH, SCRATCH).data;
  let minX = SCRATCH, minY = SCRATCH, maxX = -1, maxY = -1;
  for (let y = 0; y < SCRATCH; y++) {
    for (let x = 0; x < SCRATCH; x++) {
      if (sd[(y * SCRATCH + x) * 4 + 3] > 32) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0 || maxY < 0) return null;
  const sx = evw / SCRATCH;
  const sy = evh / SCRATCH;
  return {
    x: evx + minX * sx,
    y: evy + minY * sy,
    w: (maxX - minX + 1) * sx,
    h: (maxY - minY + 1) * sy,
  };
}

/** Rasterize an SVG string to a binary mask via offscreen canvas. */
function rasterizeSvgToMask(
  svgString: string,
  opts: RasterizeOpts = {},
): RasterizeResult | null {
  if (typeof document === 'undefined') return null;
  try {
    const fit = opts.fit ?? true;
    const margin = Math.max(0, opts.margin ?? 0);

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');
    if (!svgEl) return null;

    const vb = svgEl.getAttribute('viewBox')?.split(/[\s,]+/).map(Number);
    let [vx, vy, vw, vh] = vb && vb.length === 4 ? vb : [0, 0, 512, 512];

    const paths = Array.from(doc.querySelectorAll('path'));
    const gEl = doc.querySelector('g[transform]');
    const yFlip = gEl?.getAttribute('transform')?.includes('scale(1,-1)') ?? false;

    // ── Optional fit pass: compute TRUE path bounds and use them as the effective
    // source viewBox, so padding/empty regions around the shape don't shrink it
    // inside the mask. Critically, path geometry can extend OUTSIDE the declared
    // viewBox (e.g. a shape drawn past Shaper's 512×512 canvas edge) — we need to
    // include that overflow, which viewBox-clipped canvas rasterization misses.
    if (fit && paths.length > 0) {
      const bounds = measurePathBounds(svgString) ?? measureByScratchCanvas(paths, vx, vy, vw, vh, yFlip);
      if (bounds) {
        const { x: bx, y: by, w: bw, h: bh } = bounds;
        // Preserve aspect ratio: center a square around the content bbox so
        // non-square shapes aren't horizontally/vertically stretched.
        const cx = bx + bw / 2;
        const cy = by + bh / 2;
        const side = Math.max(bw, bh);
        const padded = side * (1 + margin * 2);
        vx = cx - padded / 2;
        vy = cy - padded / 2;
        vw = padded;
        vh = padded;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = MASK_SIZE;
    canvas.height = MASK_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.setTransform(MASK_SIZE / vw, 0, 0, MASK_SIZE / vh, -vx * MASK_SIZE / vw, -vy * MASK_SIZE / vh);
    if (yFlip) ctx.scale(1, -1);

    ctx.fillStyle = '#000';
    for (const pathEl of paths) {
      const d = pathEl.getAttribute('d');
      if (d) ctx.fill(new Path2D(d));
    }

    const imageData = ctx.getImageData(0, 0, MASK_SIZE, MASK_SIZE);
    const mask = new Uint8Array(MASK_SIZE * MASK_SIZE);
    for (let i = 0; i < mask.length; i++) {
      mask[i] = imageData.data[i * 4 + 3] > 128 ? 1 : 0;
    }
    return { mask, viewBox: [vx, vy, vw, vh] };
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
  customParamValues: Record<string, number | string | boolean | Record<string, unknown>[]>;
  backgroundSvg?: string | null;
  size: number;
  /** Per-shape drag offsets to apply on top of the template's natural positions.
   *  Keys are stable shape IDs marked as `data-element-id` in the render body. */
  elementOffsets?: LogoElementOffsets;
  /** Structured component layer drawn above the active template. */
  drawingShapes?: LogoDrawingShape[];
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
// Shape intake layer — standard API every template can use
//
// After rasterization, any template receives these helpers on `p`:
//   p.hasShape               — bool: is a mask present?
//   p.inShape(xN, yN)        — 0|1 at normalized canvas coord
//   p.shapeEdge(xN, yN, r)   — bool: within r mask cells of silhouette edge
//   p.shapeSDF(xN, yN)       — signed distance (normalized units, <0 inside)
// ---------------------------------------------------------------------------

/** Exact-ish Euclidean signed distance transform via two-pass Chamfer 3-4. */
function computeSignedDistanceField(mask: Uint8Array, size: number): Float32Array {
  const INF = 1e9;
  const distTo = (target: 0 | 1): Float32Array => {
    const d = new Float32Array(size * size);
    for (let i = 0; i < size * size; i++) d[i] = mask[i] === target ? 0 : INF;
    const DIAG = Math.SQRT2;
    // Forward pass (top-left to bottom-right)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        if (d[i] === 0) continue;
        if (x > 0) d[i] = Math.min(d[i], d[i - 1] + 1);
        if (y > 0) d[i] = Math.min(d[i], d[i - size] + 1);
        if (x > 0 && y > 0) d[i] = Math.min(d[i], d[i - size - 1] + DIAG);
        if (x < size - 1 && y > 0) d[i] = Math.min(d[i], d[i - size + 1] + DIAG);
      }
    }
    // Backward pass (bottom-right to top-left)
    for (let y = size - 1; y >= 0; y--) {
      for (let x = size - 1; x >= 0; x--) {
        const i = y * size + x;
        if (d[i] === 0) continue;
        if (x < size - 1) d[i] = Math.min(d[i], d[i + 1] + 1);
        if (y < size - 1) d[i] = Math.min(d[i], d[i + size] + 1);
        if (x < size - 1 && y < size - 1) d[i] = Math.min(d[i], d[i + size + 1] + DIAG);
        if (x > 0 && y < size - 1) d[i] = Math.min(d[i], d[i + size - 1] + DIAG);
      }
    }
    return d;
  };
  const outside = distTo(1); // for off-pixels: distance to nearest on-pixel
  const inside  = distTo(0); // for on-pixels:  distance to nearest off-pixel
  const out = new Float32Array(size * size);
  const scale = 1 / size; // normalize so 1.0 == canvas width
  for (let i = 0; i < size * size; i++) {
    out[i] = (mask[i] ? -inside[i] : outside[i]) * scale;
  }
  return out;
}

/** Build a clipPath `d` attribute from a bitmap mask using row RLE. */
function buildMaskClipPathD(mask: Uint8Array, size: number, vb: number): string {
  const cell = vb / size;
  let d = '';
  for (let y = 0; y < size; y++) {
    let x = 0;
    while (x < size) {
      if (mask[y * size + x]) {
        const x0 = x;
        while (x < size && mask[y * size + x]) x++;
        const px = (x0 * cell).toFixed(1);
        const py = (y * cell).toFixed(1);
        const pw = ((x - x0) * cell).toFixed(2);
        const ch = cell.toFixed(2);
        d += `M${px} ${py}h${pw}v${ch}h-${pw}z`;
      } else {
        x++;
      }
    }
  }
  return d;
}

/** Attach standard shape helpers to `p`. Safe to call whether or not a mask is present. */
function attachShapeHelpers(p: Record<string, unknown>) {
  const mask = p.__shapeMask as Uint8Array | undefined;
  const size = (p.__shapeMaskSize as number | undefined) ?? MASK_SIZE;
  const hasShape = !!mask;

  p.hasShape = hasShape;

  const sample = (xN: number, yN: number): 0 | 1 => {
    if (!mask) return 0;
    const ix = Math.max(0, Math.min(size - 1, Math.floor(xN * size)));
    const iy = Math.max(0, Math.min(size - 1, Math.floor(yN * size)));
    return mask[iy * size + ix] > 0 ? 1 : 0;
  };

  p.inShape = sample;

  p.shapeEdge = (xN: number, yN: number, radius = 1): boolean => {
    if (!mask) return false;
    const step = 1 / size;
    const center = sample(xN, yN);
    const r = Math.max(1, radius | 0);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (sample(xN + dx * step, yN + dy * step) !== center) return true;
      }
    }
    return false;
  };

  // Lazy SDF — computed on first call, reused thereafter on this `p`.
  let sdf: Float32Array | null = null;
  p.shapeSDF = (xN: number, yN: number): number => {
    if (!mask) return 1;
    if (!sdf) sdf = computeSignedDistanceField(mask, size);
    const ix = Math.max(0, Math.min(size - 1, Math.floor(xN * size)));
    const iy = Math.max(0, Math.min(size - 1, Math.floor(yN * size)));
    return sdf[iy * size + ix];
  };
}

// ---------------------------------------------------------------------------
// Per-element offset overlay — wraps any node marked `data-element-id="<id>"`
// in a `<g transform>` built from the matching `ShapeOffset`. The data layer
// is render-agnostic; this is the SVG-specific applier.
//
// Transform pivot: the interactive editor stores `originX/Y` when the user
// rotates or scales an element. Template authors can also provide
// `data-rotate-origin="cx,cy"` as a default pivot.
// ---------------------------------------------------------------------------
function readTransformOrigin(node: Element, offset: LogoElementOffsets[string]): { x: number; y: number } | null {
  const offsetOriginX = offset.originX;
  const offsetOriginY = offset.originY;
  if (
    typeof offsetOriginX === 'number' &&
    typeof offsetOriginY === 'number' &&
    Number.isFinite(offsetOriginX) &&
    Number.isFinite(offsetOriginY)
  ) {
    return { x: offsetOriginX, y: offsetOriginY };
  }

  const origin = node.getAttribute('data-rotate-origin');
  if (!origin) return null;
  const [cxRaw, cyRaw] = origin.split(',');
  const cx = Number((cxRaw ?? '').trim());
  const cy = Number((cyRaw ?? '').trim());
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  return { x: cx, y: cy };
}

export function applyElementOffsets(svg: string, offsets: LogoElementOffsets | undefined): string {
  if (!offsets || Object.keys(offsets).length === 0) return svg;
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return svg;
  try {
    const wrapped = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB} ${VB}">${svg}</svg>`;
    const doc = new DOMParser().parseFromString(wrapped, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');
    if (!svgEl) return svg;
    if (doc.querySelector('parsererror')) return svg;

    let changed = false;
    const marked = svgEl.querySelectorAll('[data-element-id]');
    marked.forEach((node) => {
      const id = node.getAttribute('data-element-id');
      if (!id) return;
      const offset = offsets[id];
      if (!offset) return;
      const dx = offset.dx ?? 0;
      const dy = offset.dy ?? 0;
      const rot = offset.rotate ?? 0;
      const scale = offset.scale ?? 1;
      if (dx === 0 && dy === 0 && rot === 0 && scale === 1) return;
      const origin = readTransformOrigin(node, offset);

      const parts: string[] = [];
      if (dx !== 0 || dy !== 0) parts.push(`translate(${dx} ${dy})`);
      if (rot !== 0) {
        if (origin) parts.push(`rotate(${rot} ${origin.x} ${origin.y})`);
        else parts.push(`rotate(${rot})`);
      }
      if (scale !== 1) {
        if (origin) {
          parts.push(`translate(${origin.x} ${origin.y})`);
          parts.push(`scale(${scale})`);
          parts.push(`translate(${-origin.x} ${-origin.y})`);
        } else {
          parts.push(`scale(${scale})`);
        }
      }
      if (parts.length === 0) return;

      const g = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', parts.join(' '));
      g.setAttribute('data-element-offset-wrapper', id);
      node.parentNode?.insertBefore(g, node);
      g.appendChild(node);
      changed = true;
    });

    if (!changed) return svg;
    const serializer = new XMLSerializer();
    return Array.from(svgEl.childNodes)
      .map((n) => serializer.serializeToString(n))
      .join('');
  } catch {
    return svg;
  }
}

let __clipIdCounter = 0;
function wrapWithShapeClip(svg: string, p: Record<string, unknown>): string {
  if (!p.clipToShape) return svg;
  const mask = p.__shapeMask as Uint8Array | undefined;
  const size = (p.__shapeMaskSize as number | undefined) ?? MASK_SIZE;
  if (!mask) return svg;
  const id = `__shapeClip_${++__clipIdCounter}`;
  const d = buildMaskClipPathD(mask, size, VB);
  return `<defs><clipPath id="${id}"><path d="${d}"/></clipPath></defs><g clip-path="url(#${id})">${svg}</g>`;
}

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
  customParamValues: Record<string, number | string | boolean | Record<string, unknown>[]>,
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
      p.__pipedYFlip = /scale\(\s*1\s*,\s*-1\s*\)/.test(backgroundSvg);
      const fit = typeof p.fitShapeToCanvas === 'boolean' ? p.fitShapeToCanvas : true;
      const margin = typeof p.shapeMargin === 'number' ? p.shapeMargin : 0;
      const result = rasterizeSvgToMask(backgroundSvg, { fit, margin });
      if (result) {
        p.__shapeMask = result.mask;
        p.__shapeMaskSize = MASK_SIZE;
        // Expose the EFFECTIVE viewBox (post-fit) so templates that render the
        // piped paths directly stay aligned with the mask.
        p.__pipedViewBox = result.viewBox;
      } else {
        // Mask rasterization failed — still expose the declared viewBox so
        // downstream consumers don't see undefined.
        const vbMatch = backgroundSvg.match(/viewBox="([^"]+)"/);
        if (vbMatch) {
          const parts = vbMatch[1].trim().split(/[\s,]+/).map(Number);
          if (parts.length === 4) p.__pipedViewBox = parts;
        }
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

    // Attach standard shape intake helpers — hasShape, inShape, shapeEdge, shapeSDF.
    // These are safe to call whether or not a mask is present, so templates can
    // write `if (p.hasShape) …` without any guards around the helpers themselves.
    attachShapeHelpers(p);

    return p;
  }, [params, template.params, customParamValues, backgroundSvg]);

  return useMemo(() => {
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('p', 'vb', template.renderBody);
      const result = fn(merged, VB);
      if (typeof result !== 'string') return { svg: errorSvg('renderBody must return a string'), error: 'renderBody must return a string' };
      // Universal post-process: clip output to the piped silhouette if the param is on.
      // Zero-code path for templates that haven't (yet) adopted the shape helpers.
      return { svg: wrapWithShapeClip(result, merged), error: null };
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

export function TemplateSvg({ template, params, customParamValues, backgroundSvg, size, elementOffsets, drawingShapes }: Props) {
  const { svg } = useTemplateRender(template, params, customParamValues, backgroundSvg);

  // Apply per-element drag offsets before lighting, so the lighting filter sees
  // the post-transform geometry. Memoized separately so render doesn't re-run
  // when only offsets change.
  const offsetSvg = useMemo(
    () => applyElementOffsets(svg, elementOffsets),
    [svg, elementOffsets],
  );

  const componentSvg = useMemo(
    () => appendDrawingSvgLayer(offsetSvg, drawingShapes),
    [offsetSvg, drawingShapes],
  );

  const finalSvg = useMemo(() => {
    if (!params.lightingEnabled) return componentSvg;
    const filterDef = buildLightingFilter(params.lighting);
    return `${filterDef}<g filter="url(#__lighting)">${componentSvg}</g>`;
  }, [componentSvg, params.lightingEnabled, params.lighting]);

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
