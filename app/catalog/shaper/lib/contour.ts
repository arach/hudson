/**
 * Contour extraction from binary images.
 * Ported from talkie/scripts/extract_logo_primitives.py
 */

/** Otsu's method — find optimal threshold for grayscale histogram */
export function otsuThreshold(gray: number[]): number {
  const hist = new Array(256).fill(0);
  for (const v of gray) hist[v]++;

  const total = gray.length;
  let sumTotal = 0;
  for (let i = 0; i < 256; i++) sumTotal += i * hist[i];

  let sumB = 0;
  let wB = 0;
  let maxVar = -1;
  let threshold = 128;

  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += i * hist[i];
    const mB = sumB / wB;
    const mF = (sumTotal - sumB) / wF;
    const varBetween = wB * wF * (mB - mF) ** 2;
    if (varBetween > maxVar) {
      maxVar = varBetween;
      threshold = i;
    }
  }
  return threshold;
}

/** Analyze image characteristics to determine the best extraction strategy */
export type ImageKind = "alpha" | "logo" | "illustration" | "photo";

export interface ImageAnalysis {
  kind: ImageKind;
  hasAlpha: boolean;
  uniqueColors: number;       // estimated distinct hue buckets
  colorEntropy: number;       // 0..1 — low = few tones, high = many
  edgeDensity: number;        // fraction of edge pixels
  contrastRatio: number;      // stddev / mean of luminance
  recommendedSigma: number;   // Canny blur sigma
  recommendedLow: number;     // Canny low threshold ratio
  recommendedHigh: number;    // Canny high threshold ratio
}

export function analyzeImage(imageData: ImageData): ImageAnalysis {
  const { data, width, height } = imageData;
  const n = width * height;

  // Alpha analysis
  let transparentCount = 0;
  for (let i = 0; i < n; i++) {
    if (data[i * 4 + 3] < 10) transparentCount++;
  }
  const hasAlpha = transparentCount > n * 0.1;

  // Luminance stats
  const gray = new Float32Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const v = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    gray[i] = v;
    sum += v;
  }
  const mean = sum / n;
  let variance = 0;
  for (let i = 0; i < n; i++) variance += (gray[i] - mean) ** 2;
  variance /= n;
  const stddev = Math.sqrt(variance);
  const contrastRatio = mean > 0 ? stddev / mean : 0;

  // Luminance histogram entropy — measures tonal complexity
  const hist = new Float64Array(64); // 64 bins
  for (let i = 0; i < n; i++) hist[Math.min(63, Math.floor(gray[i] / 4))]++;
  let entropy = 0;
  for (let i = 0; i < 64; i++) {
    const p = hist[i] / n;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  const maxEntropy = Math.log2(64);
  const colorEntropy = entropy / maxEntropy; // normalize to 0..1

  // Unique color estimation — count occupied buckets in a coarse color cube (4x4x4 = 64 buckets)
  const colorBuckets = new Set<number>();
  for (let i = 0; i < n; i++) {
    const r = data[i * 4] >> 6;     // 0..3
    const g = data[i * 4 + 1] >> 6;
    const b = data[i * 4 + 2] >> 6;
    colorBuckets.add((r << 4) | (g << 2) | b);
  }
  const uniqueColors = colorBuckets.size;

  // Quick edge density estimate (simple gradient magnitude on subsample)
  let edgePixels = 0;
  const step = 2; // sample every 2nd pixel
  for (let y = 1; y < height - 1; y += step) {
    for (let x = 1; x < width - 1; x += step) {
      const dx = gray[y * width + x + 1] - gray[y * width + x - 1];
      const dy = gray[(y + 1) * width + x] - gray[(y - 1) * width + x];
      if (Math.hypot(dx, dy) > 20) edgePixels++;
    }
  }
  const sampledPixels = Math.ceil((height - 2) / step) * Math.ceil((width - 2) / step);
  const edgeDensity = edgePixels / sampledPixels;

  // Classify
  let kind: ImageKind;
  if (hasAlpha) {
    kind = "alpha";
  } else if (uniqueColors <= 12 && colorEntropy < 0.55) {
    kind = "logo";       // few colors, low entropy — flat graphic
  } else if (colorEntropy < 0.7 || (uniqueColors <= 24 && edgeDensity < 0.15)) {
    kind = "illustration"; // moderate complexity — illustration, cartoon, or vector art
  } else {
    kind = "photo";       // rich tones, high entropy — photograph
  }

  // Adaptive Canny parameters based on image characteristics
  let sigma: number, low: number, high: number;
  switch (kind) {
    case "alpha":
    case "logo":
      // Sharp edges, minimal blur needed
      sigma = 0.8;
      low = 0.03;
      high = 0.10;
      break;
    case "illustration":
      sigma = 1.2;
      low = 0.04;
      high = 0.12;
      break;
    case "photo":
      // More blur to suppress noise, higher thresholds for cleaner edges
      sigma = 1.8 + (edgeDensity > 0.25 ? 0.5 : 0); // noisier → more blur
      low = 0.06;
      high = 0.18;
      break;
  }

  console.log(
    `[analyze] kind=${kind} uniqueColors=${uniqueColors} entropy=${colorEntropy.toFixed(2)} ` +
    `edgeDensity=${edgeDensity.toFixed(3)} contrast=${contrastRatio.toFixed(2)} ` +
    `sigma=${sigma} low=${low} high=${high}`
  );

  return {
    kind, hasAlpha, uniqueColors, colorEntropy, edgeDensity, contrastRatio,
    recommendedSigma: sigma, recommendedLow: low, recommendedHigh: high,
  };
}

/** Convert RGBA ImageData to a boolean mask using alpha channel (if present) or Otsu threshold */
export function imageToMask(imageData: ImageData): boolean[] {
  const { data, width, height } = imageData;
  const n = width * height;

  // Check if image uses alpha channel for shape definition
  let transparentCount = 0;
  let opaqueCount = 0;
  for (let i = 0; i < n; i++) {
    const a = data[i * 4 + 3];
    if (a < 10) transparentCount++;
    else if (a > 245) opaqueCount++;
  }

  if (transparentCount > n * 0.1) {
    console.log("[mask] using alpha channel,", opaqueCount, "opaque pixels");
    return Array.from({ length: n }, (_, i) => data[i * 4 + 3] > 128);
  }

  // Fallback: use luminance + Otsu
  const gray: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  const threshold = otsuThreshold(gray);
  console.log("[mask] using Otsu threshold:", threshold);
  return gray.map((v) => v < threshold);
}

// --- Edge detection (Canny-style) ---

/** Convert RGBA ImageData to grayscale float array [0..255] */
export function imageToGray(imageData: ImageData): Float32Array {
  const { data, width, height } = imageData;
  const n = width * height;
  const gray = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return gray;
}

/** Gaussian blur (separable, sigma-based kernel) */
export function gaussianBlur(src: Float32Array, w: number, h: number, sigma: number): Float32Array {
  const radius = Math.ceil(sigma * 3);
  const size = radius * 2 + 1;
  // Build 1D kernel
  const kernel = new Float32Array(size);
  let sum = 0;
  for (let i = 0; i < size; i++) {
    const x = i - radius;
    kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
    sum += kernel[i];
  }
  for (let i = 0; i < size; i++) kernel[i] /= sum;

  // Horizontal pass
  const tmp = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let k = 0; k < size; k++) {
        const sx = Math.min(w - 1, Math.max(0, x + k - radius));
        v += src[y * w + sx] * kernel[k];
      }
      tmp[y * w + x] = v;
    }
  }

  // Vertical pass
  const dst = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let k = 0; k < size; k++) {
        const sy = Math.min(h - 1, Math.max(0, y + k - radius));
        v += tmp[sy * w + x] * kernel[k];
      }
      dst[y * w + x] = v;
    }
  }
  return dst;
}

/** Sobel gradient magnitude and direction */
function sobelGradients(gray: Float32Array, w: number, h: number): { mag: Float32Array; dir: Float32Array } {
  const mag = new Float32Array(w * h);
  const dir = new Float32Array(w * h);

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const gx =
        -gray[(y - 1) * w + (x - 1)] + gray[(y - 1) * w + (x + 1)]
        - 2 * gray[y * w + (x - 1)] + 2 * gray[y * w + (x + 1)]
        - gray[(y + 1) * w + (x - 1)] + gray[(y + 1) * w + (x + 1)];
      const gy =
        -gray[(y - 1) * w + (x - 1)] - 2 * gray[(y - 1) * w + x] - gray[(y - 1) * w + (x + 1)]
        + gray[(y + 1) * w + (x - 1)] + 2 * gray[(y + 1) * w + x] + gray[(y + 1) * w + (x + 1)];
      mag[idx] = Math.hypot(gx, gy);
      dir[idx] = Math.atan2(gy, gx);
    }
  }
  return { mag, dir };
}

/** Non-maximum suppression — thin edges to 1px ridges */
function nonMaxSuppression(mag: Float32Array, dir: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const m = mag[idx];
      if (m === 0) continue;

      // Quantize angle to 4 directions (0, 45, 90, 135)
      let angle = (dir[idx] * 180) / Math.PI;
      if (angle < 0) angle += 180;

      let n1 = 0, n2 = 0;
      if ((angle >= 0 && angle < 22.5) || (angle >= 157.5 && angle <= 180)) {
        n1 = mag[y * w + (x + 1)];
        n2 = mag[y * w + (x - 1)];
      } else if (angle >= 22.5 && angle < 67.5) {
        n1 = mag[(y - 1) * w + (x + 1)];
        n2 = mag[(y + 1) * w + (x - 1)];
      } else if (angle >= 67.5 && angle < 112.5) {
        n1 = mag[(y - 1) * w + x];
        n2 = mag[(y + 1) * w + x];
      } else {
        n1 = mag[(y - 1) * w + (x - 1)];
        n2 = mag[(y + 1) * w + (x + 1)];
      }

      out[idx] = (m >= n1 && m >= n2) ? m : 0;
    }
  }
  return out;
}

/** Double threshold + hysteresis — classify edges as strong/weak, connect weak to strong */
function hysteresis(nms: Float32Array, w: number, h: number, lowRatio: number, highRatio: number): boolean[] {
  // Find max magnitude
  let maxMag = 0;
  for (let i = 0; i < nms.length; i++) {
    if (nms[i] > maxMag) maxMag = nms[i];
  }
  const highThresh = maxMag * highRatio;
  const lowThresh = maxMag * lowRatio;

  const strong = new Uint8Array(w * h); // 2 = strong, 1 = weak
  const queue: number[] = [];

  for (let i = 0; i < nms.length; i++) {
    if (nms[i] >= highThresh) {
      strong[i] = 2;
      queue.push(i);
    } else if (nms[i] >= lowThresh) {
      strong[i] = 1;
    }
  }

  // BFS: promote weak edges connected to strong edges
  while (queue.length > 0) {
    const idx = queue.pop()!;
    const x = idx % w;
    const y = (idx - x) / w;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        const ni = ny * w + nx;
        if (strong[ni] === 1) {
          strong[ni] = 2;
          queue.push(ni);
        }
      }
    }
  }

  return Array.from(strong, (v) => v === 2);
}

/** Full Canny edge detection pipeline — returns boolean edge mask */
export function cannyEdgeDetection(
  imageData: ImageData,
  sigma: number = 1.4,
  lowRatio: number = 0.05,
  highRatio: number = 0.15,
): boolean[] {
  const { width: w, height: h } = imageData;
  console.log("[canny] start:", w, "x", h, "sigma:", sigma);

  // 1. Grayscale
  const gray = imageToGray(imageData);

  // 2. Gaussian blur
  const blurred = gaussianBlur(gray, w, h, sigma);

  // 3. Sobel gradients
  const { mag, dir } = sobelGradients(blurred, w, h);

  // 4. Non-maximum suppression
  const nms = nonMaxSuppression(mag, dir, w, h);

  // 5. Hysteresis thresholding
  const edges = hysteresis(nms, w, h, lowRatio, highRatio);

  const edgeCount = edges.filter(Boolean).length;
  console.log("[canny] edges:", edgeCount, "of", edges.length, "pixels");

  return edges;
}

type Pt = [number, number];

function ptKey(x: number, y: number): string {
  return `${Math.round(x * 1000)},${Math.round(y * 1000)}`;
}

/** Marching squares contour extraction.
 *  maxContours = 1 returns just the longest path (legacy).
 *  maxContours > 1 returns up to N contours sorted by length (longest first).
 *  minLength filters out tiny noise contours.
 */
export function marchingSquares(
  mask: boolean[],
  width: number,
  height: number,
  maxContours: number = 1,
  minLength: number = 8,
): Pt[] {
  function isOn(x: number, y: number): boolean {
    return mask[y * width + x];
  }

  const segments: [string, string, Pt, Pt][] = [];

  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const tl = isOn(x, y) ? 1 : 0;
      const tr = isOn(x + 1, y) ? 1 : 0;
      const br = isOn(x + 1, y + 1) ? 1 : 0;
      const bl = isOn(x, y + 1) ? 1 : 0;
      const c = (tl << 3) | (tr << 2) | (br << 1) | bl;
      if (c === 0 || c === 15) continue;

      const top: Pt = [x + 0.5, y];
      const right: Pt = [x + 1, y + 0.5];
      const bottom: Pt = [x + 0.5, y + 1];
      const left: Pt = [x, y + 0.5];

      const crossings: [string, Pt][] = [];
      if (tl !== tr) crossings.push(["top", top]);
      if (tr !== br) crossings.push(["right", right]);
      if (br !== bl) crossings.push(["bottom", bottom]);
      if (bl !== tl) crossings.push(["left", left]);

      if (crossings.length === 2) {
        const k1 = ptKey(crossings[0][1][0], crossings[0][1][1]);
        const k2 = ptKey(crossings[1][1][0], crossings[1][1][1]);
        segments.push([k1, k2, crossings[0][1], crossings[1][1]]);
      } else if (crossings.length === 4) {
        if (c === 5) {
          segments.push([ptKey(top[0], top[1]), ptKey(right[0], right[1]), top, right]);
          segments.push([ptKey(bottom[0], bottom[1]), ptKey(left[0], left[1]), bottom, left]);
        } else if (c === 10) {
          segments.push([ptKey(top[0], top[1]), ptKey(left[0], left[1]), top, left]);
          segments.push([ptKey(bottom[0], bottom[1]), ptKey(right[0], right[1]), bottom, right]);
        }
      }
    }
  }

  // Build adjacency
  const adj = new Map<string, string[]>();
  const ptLookup = new Map<string, Pt>();

  for (const [k1, k2, p1, p2] of segments) {
    ptLookup.set(k1, p1);
    ptLookup.set(k2, p2);
    if (!adj.has(k1)) adj.set(k1, []);
    if (!adj.has(k2)) adj.set(k2, []);
    adj.get(k1)!.push(k2);
    adj.get(k2)!.push(k1);
  }

  // Walk paths
  function edgeId(a: string, b: string): string {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  const visitedEdges = new Set<string>();
  const paths: Pt[][] = [];

  for (const [k1, k2] of segments) {
    const eid = edgeId(k1, k2);
    if (visitedEdges.has(eid)) continue;

    const path: string[] = [k1, k2];
    visitedEdges.add(eid);
    let prev = k1;
    let curr = k2;

    while (true) {
      const neighbors = adj.get(curr);
      if (!neighbors || neighbors.length === 0) break;

      let next: string;
      if (neighbors.length === 1) {
        next = neighbors[0];
      } else {
        next = neighbors[0] !== prev ? neighbors[0] : neighbors[1];
      }

      if (next === path[0]) {
        path.push(next);
        break;
      }

      const eidNext = edgeId(curr, next);
      if (visitedEdges.has(eidNext)) break;

      visitedEdges.add(eidNext);
      path.push(next);
      prev = curr;
      curr = next;
    }

    paths.push(path.map((k) => ptLookup.get(k)!));
  }

  if (paths.length === 0) return [];

  // Sort by length (longest first), filter out tiny paths
  paths.sort((a, b) => b.length - a.length);
  const filtered = paths.filter((p) => p.length >= minLength);
  if (filtered.length === 0) return [];

  // For backwards compat: maxContours=1 returns a flat array
  if (maxContours <= 1) return filtered[0];

  // Return concatenated top-N contours (separated in the caller)
  return filtered[0];
}

/** Multi-contour extraction — returns up to N contours sorted by length */
export function marchingSquaresMulti(
  mask: boolean[],
  width: number,
  height: number,
  maxContours: number = 10,
  minLength: number = 20,
): Pt[][] {
  function isOn(x: number, y: number): boolean {
    return mask[y * width + x];
  }

  const segments: [string, string, Pt, Pt][] = [];

  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const tl = isOn(x, y) ? 1 : 0;
      const tr = isOn(x + 1, y) ? 1 : 0;
      const br = isOn(x + 1, y + 1) ? 1 : 0;
      const bl = isOn(x, y + 1) ? 1 : 0;
      const c = (tl << 3) | (tr << 2) | (br << 1) | bl;
      if (c === 0 || c === 15) continue;

      const top: Pt = [x + 0.5, y];
      const right: Pt = [x + 1, y + 0.5];
      const bottom: Pt = [x + 0.5, y + 1];
      const left: Pt = [x, y + 0.5];

      const crossings: [string, Pt][] = [];
      if (tl !== tr) crossings.push(["top", top]);
      if (tr !== br) crossings.push(["right", right]);
      if (br !== bl) crossings.push(["bottom", bottom]);
      if (bl !== tl) crossings.push(["left", left]);

      if (crossings.length === 2) {
        const k1 = ptKey(crossings[0][1][0], crossings[0][1][1]);
        const k2 = ptKey(crossings[1][1][0], crossings[1][1][1]);
        segments.push([k1, k2, crossings[0][1], crossings[1][1]]);
      } else if (crossings.length === 4) {
        if (c === 5) {
          segments.push([ptKey(top[0], top[1]), ptKey(right[0], right[1]), top, right]);
          segments.push([ptKey(bottom[0], bottom[1]), ptKey(left[0], left[1]), bottom, left]);
        } else if (c === 10) {
          segments.push([ptKey(top[0], top[1]), ptKey(left[0], left[1]), top, left]);
          segments.push([ptKey(bottom[0], bottom[1]), ptKey(right[0], right[1]), bottom, right]);
        }
      }
    }
  }

  // Build adjacency
  const adj = new Map<string, string[]>();
  const ptLookup = new Map<string, Pt>();

  for (const [k1, k2, p1, p2] of segments) {
    ptLookup.set(k1, p1);
    ptLookup.set(k2, p2);
    if (!adj.has(k1)) adj.set(k1, []);
    if (!adj.has(k2)) adj.set(k2, []);
    adj.get(k1)!.push(k2);
    adj.get(k2)!.push(k1);
  }

  function edgeId(a: string, b: string): string {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  const visitedEdges = new Set<string>();
  const paths: Pt[][] = [];

  for (const [k1, k2] of segments) {
    const eid = edgeId(k1, k2);
    if (visitedEdges.has(eid)) continue;

    const path: string[] = [k1, k2];
    visitedEdges.add(eid);
    let prev = k1;
    let curr = k2;

    while (true) {
      const neighbors = adj.get(curr);
      if (!neighbors || neighbors.length === 0) break;

      let next: string;
      if (neighbors.length === 1) {
        next = neighbors[0];
      } else {
        next = neighbors[0] !== prev ? neighbors[0] : neighbors[1];
      }

      if (next === path[0]) {
        path.push(next);
        break;
      }

      const eidNext = edgeId(curr, next);
      if (visitedEdges.has(eidNext)) break;

      visitedEdges.add(eidNext);
      path.push(next);
      prev = curr;
      curr = next;
    }

    paths.push(path.map((k) => ptLookup.get(k)!));
  }

  // Sort by length, filter, return top N
  paths.sort((a, b) => b.length - a.length);
  return paths.filter((p) => p.length >= minLength).slice(0, maxContours);
}

/** Ramer-Douglas-Peucker polyline simplification */
export function rdp(points: Pt[], epsilon: number): Pt[] {
  if (points.length < 3) return points;

  function distPointLine(pt: Pt, start: Pt, end: Pt): number {
    const [sx, sy] = start;
    const [ex, ey] = end;
    const [px, py] = pt;
    const dx = ex - sx;
    const dy = ey - sy;
    if (dx === 0 && dy === 0) return Math.hypot(px - sx, py - sy);
    let t = ((px - sx) * dx + (py - sy) * dy) / (dx * dx + dy * dy);
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (sx + t * dx), py - (sy + t * dy));
  }

  let maxDist = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = distPointLine(points[i], points[0], points[points.length - 1]);
    if (d > maxDist) {
      index = i;
      maxDist = d;
    }
  }

  if (maxDist > epsilon) {
    const left = rdp(points.slice(0, index + 1), epsilon);
    const right = rdp(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  }

  return [points[0], points[points.length - 1]];
}

/** Load an image into an offscreen canvas and return pixel data at given resolution */
export function loadImageData(src: string, size: number): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, size, size);
      resolve(ctx.getImageData(0, 0, size, size));
    };
    img.onerror = reject;
    img.src = src;
  });
}
