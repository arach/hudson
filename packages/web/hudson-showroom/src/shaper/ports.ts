import { useCallback } from 'react';
import { useShaper } from './ShaperProvider';
import type { BezierSegment } from './types';

/**
 * Port output hook for Shaper.
 * Returns an SVG string of the current canvas when the 'svg' port is read.
 */
export function useShaperPortOutput() {
  const { strokesPath, pathColor, fillEnabled, fillPattern } = useShaper();

  return useCallback((portId: string): unknown | null => {
    if (portId !== 'svg') return null;
    if (!strokesPath) return null;

    const fill = fillEnabled ? pathColor : 'none';
    const stroke = fillEnabled && fillPattern === 'solid' ? 'none' : pathColor;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <path d="${strokesPath}" fill="${fill}" stroke="${stroke}" stroke-width="2" />
</svg>`;
  }, [strokesPath, pathColor, fillEnabled, fillPattern]);
}

// ---------------------------------------------------------------------------
// SVG path → BezierSegment[] parser (no tracing, mathematically exact)
// ---------------------------------------------------------------------------

function parseSvgPathToBeziers(svgString: string): BezierSegment[][] {
  // Extract all path d attributes from SVG
  const dAttrs: string[] = [];
  const pathRe = /\bd="([^"]+)"/g;
  let pm;
  while ((pm = pathRe.exec(svgString)) !== null) dAttrs.push(pm[1]);
  if (dAttrs.length === 0) return [];

  // Also extract viewBox for coordinate normalization
  const vbMatch = svgString.match(/viewBox="([^"]+)"/);
  let vx = 0, vy = 0, vw = 512, vh = 512;
  if (vbMatch) {
    const parts = vbMatch[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4) [vx, vy, vw, vh] = parts;
  }

  // Normalize coordinates to 512x512 canvas with padding
  const padding = 60;
  const canvasSize = 512 - padding * 2;
  const scale = Math.min(canvasSize / vw, canvasSize / vh);
  const offsetX = padding + (canvasSize - vw * scale) / 2 - vx * scale;
  const offsetY = padding + (canvasSize - vh * scale) / 2 - vy * scale;

  const tx = (x: number, y: number): [number, number] => [
    x * scale + offsetX,
    y * scale + offsetY,
  ];

  const strokes: BezierSegment[][] = [];

  for (const d of dAttrs) {
    const segments: BezierSegment[] = [];
    const re = /([MmLlHhVvCcSsQqTtAaZz])\s*([^MmLlHhVvCcSsQqTtAaZz]*)/g;
    let match;
    let cx = 0, cy = 0;
    let startX = 0, startY = 0;

    while ((match = re.exec(d)) !== null) {
      const cmd = match[1];
      const nums = match[2].trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));

      switch (cmd) {
        case 'M': cx = nums[0]; cy = nums[1]; startX = cx; startY = cy; break;
        case 'm': cx += nums[0]; cy += nums[1]; startX = cx; startY = cy; break;
        case 'L': {
          const p0 = tx(cx, cy);
          cx = nums[0]; cy = nums[1];
          const p3 = tx(cx, cy);
          // Line as degenerate cubic: control points on the line
          segments.push({ p0, c1: [p0[0] + (p3[0] - p0[0]) / 3, p0[1] + (p3[1] - p0[1]) / 3], c2: [p0[0] + 2 * (p3[0] - p0[0]) / 3, p0[1] + 2 * (p3[1] - p0[1]) / 3], p3 });
          break;
        }
        case 'l': {
          const p0 = tx(cx, cy);
          cx += nums[0]; cy += nums[1];
          const p3 = tx(cx, cy);
          segments.push({ p0, c1: [p0[0] + (p3[0] - p0[0]) / 3, p0[1] + (p3[1] - p0[1]) / 3], c2: [p0[0] + 2 * (p3[0] - p0[0]) / 3, p0[1] + 2 * (p3[1] - p0[1]) / 3], p3 });
          break;
        }
        case 'H': {
          const p0 = tx(cx, cy);
          cx = nums[0];
          const p3 = tx(cx, cy);
          segments.push({ p0, c1: [p0[0] + (p3[0] - p0[0]) / 3, p0[1]], c2: [p0[0] + 2 * (p3[0] - p0[0]) / 3, p0[1]], p3 });
          break;
        }
        case 'h': {
          const p0 = tx(cx, cy);
          cx += nums[0];
          const p3 = tx(cx, cy);
          segments.push({ p0, c1: [p0[0] + (p3[0] - p0[0]) / 3, p0[1]], c2: [p0[0] + 2 * (p3[0] - p0[0]) / 3, p0[1]], p3 });
          break;
        }
        case 'V': {
          const p0 = tx(cx, cy);
          cy = nums[0];
          const p3 = tx(cx, cy);
          segments.push({ p0, c1: [p0[0], p0[1] + (p3[1] - p0[1]) / 3], c2: [p0[0], p0[1] + 2 * (p3[1] - p0[1]) / 3], p3 });
          break;
        }
        case 'v': {
          const p0 = tx(cx, cy);
          cy += nums[0];
          const p3 = tx(cx, cy);
          segments.push({ p0, c1: [p0[0], p0[1] + (p3[1] - p0[1]) / 3], c2: [p0[0], p0[1] + 2 * (p3[1] - p0[1]) / 3], p3 });
          break;
        }
        case 'C': {
          const p0 = tx(cx, cy);
          const c1 = tx(nums[0], nums[1]);
          const c2 = tx(nums[2], nums[3]);
          cx = nums[4]; cy = nums[5];
          const p3 = tx(cx, cy);
          segments.push({ p0, c1, c2, p3 });
          break;
        }
        case 'c': {
          const p0 = tx(cx, cy);
          const c1 = tx(cx + nums[0], cy + nums[1]);
          const c2 = tx(cx + nums[2], cy + nums[3]);
          cx += nums[4]; cy += nums[5];
          const p3 = tx(cx, cy);
          segments.push({ p0, c1, c2, p3 });
          break;
        }
        case 'Q': {
          // Quadratic → cubic: CP1 = P0 + 2/3*(QCP - P0), CP2 = P3 + 2/3*(QCP - P3)
          const p0 = tx(cx, cy);
          const qx = nums[0], qy = nums[1];
          cx = nums[2]; cy = nums[3];
          const p3 = tx(cx, cy);
          const [qxt, qyt] = tx(qx, qy);
          segments.push({
            p0,
            c1: [p0[0] + 2 / 3 * (qxt - p0[0]), p0[1] + 2 / 3 * (qyt - p0[1])],
            c2: [p3[0] + 2 / 3 * (qxt - p3[0]), p3[1] + 2 / 3 * (qyt - p3[1])],
            p3,
          });
          break;
        }
        case 'q': {
          const p0 = tx(cx, cy);
          const qx = cx + nums[0], qy = cy + nums[1];
          cx += nums[2]; cy += nums[3];
          const p3 = tx(cx, cy);
          const [qxt, qyt] = tx(qx, qy);
          segments.push({
            p0,
            c1: [p0[0] + 2 / 3 * (qxt - p0[0]), p0[1] + 2 / 3 * (qyt - p0[1])],
            c2: [p3[0] + 2 / 3 * (qxt - p3[0]), p3[1] + 2 / 3 * (qyt - p3[1])],
            p3,
          });
          break;
        }
        case 'Z':
        case 'z': {
          if (cx !== startX || cy !== startY) {
            const p0 = tx(cx, cy);
            const p3 = tx(startX, startY);
            segments.push({ p0, c1: [p0[0] + (p3[0] - p0[0]) / 3, p0[1] + (p3[1] - p0[1]) / 3], c2: [p0[0] + 2 * (p3[0] - p0[0]) / 3, p0[1] + 2 * (p3[1] - p0[1]) / 3], p3 });
          }
          cx = startX; cy = startY;
          break;
        }
      }
    }

    if (segments.length > 0) strokes.push(segments);
  }

  return strokes;
}

/**
 * Port input hook for Shaper.
 * Accepts image data URLs (trace pipeline) or SVG strings (direct path import).
 */
export function useShaperPortInput() {
  const { startProjectFromImage, newProject, setBezierData } = useShaper();

  return useCallback((portId: string, data: unknown) => {
    if (portId === 'image' && typeof data === 'string') {
      newProject();
      const img = new Image();
      img.onload = () => {
        startProjectFromImage({
          url: data,
          name: 'piped-image',
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      };
      img.src = data;
    }

    if (portId === 'svg' && typeof data === 'string') {
      // Direct SVG path import — no tracing, exact bezier conversion
      const strokes = parseSvgPathToBeziers(data);
      if (strokes.length > 0) {
        newProject();
        setBezierData({ strokes });
      }
    }
  }, [startProjectFromImage, newProject, setBezierData]);
}
