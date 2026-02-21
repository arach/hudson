/**
 * Cubic Bezier curve fitting — Schneider's algorithm.
 * Ported from talkie/scripts/fit_bowtie_bezier.py
 */

import {
  loadImageData, imageToMask, marchingSquares, marchingSquaresMulti, rdp,
  analyzeImage, cannyEdgeDetection,
  type ImageAnalysis,
} from "./contour";

type Pt = [number, number];
type BezierCtrl = [Pt, Pt, Pt, Pt]; // [p0, c1, c2, p3]

// --- Vector helpers ---

function add(a: Pt, b: Pt): Pt {
  return [a[0] + b[0], a[1] + b[1]];
}

function sub(a: Pt, b: Pt): Pt {
  return [a[0] - b[0], a[1] - b[1]];
}

function mul(a: Pt, s: number): Pt {
  return [a[0] * s, a[1] * s];
}

function dot(a: Pt, b: Pt): number {
  return a[0] * b[0] + a[1] * b[1];
}

function len(v: Pt): number {
  return Math.hypot(v[0], v[1]);
}

function normalize(v: Pt): Pt {
  const l = len(v);
  if (l === 0) return [0, 0];
  return [v[0] / l, v[1] / l];
}

// --- Bezier evaluation ---

function bezierQ(ctrl: BezierCtrl, t: number): Pt {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  const a = mt2 * mt;
  const b = 3 * mt2 * t;
  const c = 3 * mt * t2;
  const d = t2 * t;
  return [
    a * ctrl[0][0] + b * ctrl[1][0] + c * ctrl[2][0] + d * ctrl[3][0],
    a * ctrl[0][1] + b * ctrl[1][1] + c * ctrl[2][1] + d * ctrl[3][1],
  ];
}

function bezierQPrime(ctrl: BezierCtrl, t: number): Pt {
  const mt = 1 - t;
  const a = -3 * mt * mt;
  const b = 3 * mt * mt - 6 * mt * t;
  const c = 6 * mt * t - 3 * t * t;
  const d = 3 * t * t;
  return [
    a * ctrl[0][0] + b * ctrl[1][0] + c * ctrl[2][0] + d * ctrl[3][0],
    a * ctrl[0][1] + b * ctrl[1][1] + c * ctrl[2][1] + d * ctrl[3][1],
  ];
}

function bezierQPrime2(ctrl: BezierCtrl, t: number): Pt {
  const mt = 1 - t;
  const a = 6 * mt;
  const b = -12 * mt + 6 * t;
  const c = 6 * mt - 12 * t;
  const d = 6 * t;
  return [
    a * ctrl[0][0] + b * ctrl[1][0] + c * ctrl[2][0] + d * ctrl[3][0],
    a * ctrl[0][1] + b * ctrl[1][1] + c * ctrl[2][1] + d * ctrl[3][1],
  ];
}

// --- Parameterization ---

function chordLengthParameterize(points: Pt[]): number[] {
  const u = [0];
  for (let i = 1; i < points.length; i++) {
    u.push(u[i - 1] + len(sub(points[i], points[i - 1])));
  }
  const total = u[u.length - 1];
  if (total === 0) return u.map(() => 0);
  return u.map((x) => x / total);
}

function newtonRaphsonRootFind(bezier: BezierCtrl, point: Pt, u: number): number {
  const q = bezierQ(bezier, u);
  const q1 = bezierQPrime(bezier, u);
  const q2 = bezierQPrime2(bezier, u);
  const numerator = dot(sub(q, point), q1);
  const denominator = dot(q1, q1) + dot(sub(q, point), q2);
  if (denominator === 0) return u;
  return u - numerator / denominator;
}

function reparameterize(points: Pt[], u: number[], bezier: BezierCtrl): number[] {
  return points.map((p, i) => newtonRaphsonRootFind(bezier, p, u[i]));
}

// --- Fitting ---

function generateBezier(points: Pt[], u: number[], leftTan: Pt, rightTan: Pt): BezierCtrl {
  const p0 = points[0];
  const p3 = points[points.length - 1];

  const c = [[0, 0], [0, 0]];
  const x = [0, 0];

  for (let i = 0; i < u.length; i++) {
    const ui = u[i];
    const b0 = (1 - ui) ** 3;
    const b1 = 3 * ui * (1 - ui) ** 2;
    const b2 = 3 * ui * ui * (1 - ui);
    const b3 = ui ** 3;

    const a1 = mul(leftTan, b1);
    const a2 = mul(rightTan, b2);

    c[0][0] += dot(a1, a1);
    c[0][1] += dot(a1, a2);
    c[1][0] += dot(a1, a2);
    c[1][1] += dot(a2, a2);

    const tmp = sub(points[i], add(mul(p0, b0), mul(p3, b3)));
    x[0] += dot(a1, tmp);
    x[1] += dot(a2, tmp);
  }

  const detC0C1 = c[0][0] * c[1][1] - c[1][0] * c[0][1];
  let alphaL = 0;
  let alphaR = 0;
  if (Math.abs(detC0C1) > 1e-6) {
    alphaL = (x[0] * c[1][1] - x[1] * c[0][1]) / detC0C1;
    alphaR = (c[0][0] * x[1] - c[1][0] * x[0]) / detC0C1;
  }

  const segLength = len(sub(p3, p0));
  const epsilon = 1e-6;
  if (alphaL < epsilon || alphaR < epsilon) {
    alphaL = alphaR = segLength / 3;
  }

  const p1 = add(p0, mul(leftTan, alphaL));
  const p2 = add(p3, mul(rightTan, alphaR));
  return [p0, p1, p2, p3];
}

function computeMaxError(points: Pt[], bezier: BezierCtrl, u: number[]): [number, number] {
  let maxDist = 0;
  let split = Math.floor(points.length / 2);
  for (let i = 0; i < points.length; i++) {
    const q = bezierQ(bezier, u[i]);
    const d = len(sub(q, points[i]));
    if (d > maxDist) {
      maxDist = d;
      split = i;
    }
  }
  return [maxDist, split];
}

function fitCubic(points: Pt[], leftTan: Pt, rightTan: Pt, error: number, depth: number = 0): BezierCtrl[] {
  if (points.length === 2 || depth > 50) {
    const dist = len(sub(points[0], points[points.length - 1])) / 3;
    return [[
      points[0],
      add(points[0], mul(leftTan, dist)),
      add(points[points.length - 1], mul(rightTan, dist)),
      points[points.length - 1],
    ]];
  }

  let u = chordLengthParameterize(points);
  let bezier = generateBezier(points, u, leftTan, rightTan);
  let [maxError, split] = computeMaxError(points, bezier, u);

  if (maxError < error) return [bezier];

  if (maxError < error * error) {
    for (let iter = 0; iter < 5; iter++) {
      u = reparameterize(points, u, bezier);
      bezier = generateBezier(points, u, leftTan, rightTan);
      [maxError, split] = computeMaxError(points, bezier, u);
      if (maxError < error) return [bezier];
    }
  }

  // Ensure split is valid for recursion
  if (split <= 0) split = 1;
  if (split >= points.length - 1) split = points.length - 2;

  const centerTan = normalize(sub(points[split - 1], points[split + 1]));
  const left = fitCubic(points.slice(0, split + 1), leftTan, centerTan, error, depth + 1);
  const right = fitCubic(points.slice(split), mul(centerTan, -1), rightTan, error, depth + 1);
  return left.concat(right);
}

/** Fit cubic bezier curves to a polyline */
export function fitCurve(points: Pt[], error: number = 4): BezierCtrl[] {
  if (points.length < 2) return [];
  const leftTan = normalize(sub(points[1], points[0]));
  const rightTan = normalize(sub(points[points.length - 2], points[points.length - 1]));
  return fitCubic(points, leftTan, rightTan, error);
}

// --- BezierSegment format (matching page.tsx) ---

export interface BezierSegment {
  p0: [number, number];
  c1: [number, number];
  c2: [number, number];
  p3: [number, number];
}

/** Convert fitting output to BezierSegment[] */
function toSegments(ctrls: BezierCtrl[]): BezierSegment[] {
  return ctrls.map(([p0, c1, c2, p3]) => ({
    p0: [p0[0], p0[1]],
    c1: [c1[0], c1[1]],
    c2: [c2[0], c2[1]],
    p3: [p3[0], p3[1]],
  }));
}

/**
 * Main entry point: trace contour from image and fit bezier curves.
 * Automatically detects image type and adapts the extraction pipeline:
 *   - alpha/logo: threshold mask → single contour → bezier fit
 *   - illustration: threshold mask → multiple contours → bezier fit per contour
 *   - photo: Canny edge detection → multiple contours → bezier fit per contour
 *
 * @param src - URL/path of the image
 * @param errorTolerance - bezier fitting error (lower = more detail)
 * @param resolution - trace resolution (default auto-selected based on image type)
 */
export async function traceFromImage(
  src: string,
  errorTolerance: number,
  resolution?: number,
): Promise<BezierSegment[][]> {
  // 1. Analyze at a small size first
  const previewData = await loadImageData(src, 256);
  const analysis: ImageAnalysis = analyzeImage(previewData);

  // 2. Pick trace resolution based on image type
  const traceRes = resolution ?? (
    analysis.kind === "photo" ? 640 :
    analysis.kind === "illustration" ? 512 :
    512
  );

  // 3. Load at trace resolution
  const imageData = await loadImageData(src, traceRes);
  console.log("[trace] loaded image", traceRes, "x", traceRes, "kind:", analysis.kind);

  const scale = 1024 / traceRes;

  // 4. Choose extraction strategy
  if (analysis.kind === "alpha" || analysis.kind === "logo") {
    // Classic pipeline: threshold → single/few contours
    return traceMask(imageData, traceRes, scale, errorTolerance, analysis.kind === "logo" ? 3 : 1);
  }

  if (analysis.kind === "illustration") {
    // Threshold for main shapes + edges for details
    const maskStrokes = await traceMask(imageData, traceRes, scale, errorTolerance, 5);
    return maskStrokes;
  }

  // Photo: use Canny edge detection
  return traceEdges(imageData, traceRes, scale, errorTolerance, analysis);
}

/** Threshold-based extraction (logos, alpha, illustrations) */
function traceMask(
  imageData: ImageData,
  traceRes: number,
  scale: number,
  errorTolerance: number,
  maxContours: number,
): BezierSegment[][] {
  const mask = imageToMask(imageData);
  const onCount = mask.filter(Boolean).length;
  console.log("[trace:mask]", onCount, "foreground pixels of", mask.length);

  if (maxContours <= 1) {
    const contour = marchingSquares(mask, traceRes, traceRes);
    if (contour.length === 0) return [];
    return [fitContour(contour, scale, errorTolerance)].filter((s) => s.length > 0);
  }

  // Min length scales with resolution — filter out noise
  const minLen = Math.max(20, traceRes * 0.04);
  const contours = marchingSquaresMulti(mask, traceRes, traceRes, maxContours, minLen);
  console.log("[trace:mask]", contours.length, "contours extracted");

  const strokes: BezierSegment[][] = [];
  for (const contour of contours) {
    const stroke = fitContour(contour, scale, errorTolerance);
    if (stroke.length > 0) strokes.push(stroke);
  }
  return strokes;
}

/** Edge-detection extraction (photos) */
function traceEdges(
  imageData: ImageData,
  traceRes: number,
  scale: number,
  errorTolerance: number,
  analysis: ImageAnalysis,
): BezierSegment[][] {
  const { recommendedSigma, recommendedLow, recommendedHigh } = analysis;

  const edgeMask = cannyEdgeDetection(imageData, recommendedSigma, recommendedLow, recommendedHigh);
  const edgeCount = edgeMask.filter(Boolean).length;
  console.log("[trace:edges]", edgeCount, "edge pixels");

  if (edgeCount === 0) return [];

  // Dynamic contour count: more edges → allow more contours, but cap it
  const maxContours = Math.min(30, Math.max(5, Math.round(edgeCount / (traceRes * 2))));
  // Dynamic min length: larger images get a higher threshold
  const minLen = Math.max(15, traceRes * 0.03);

  const contours = marchingSquaresMulti(edgeMask, traceRes, traceRes, maxContours, minLen);
  console.log("[trace:edges]", contours.length, "contours from edges, maxContours:", maxContours);

  // For photos, use a slightly higher tolerance to keep curves smooth
  const photoTolerance = Math.max(errorTolerance, errorTolerance * 1.2);

  const strokes: BezierSegment[][] = [];
  for (const contour of contours) {
    const stroke = fitContour(contour, scale, photoTolerance);
    if (stroke.length > 0) strokes.push(stroke);
  }
  return strokes;
}

/** Fit bezier curves to a single contour polyline, scaled to canvas */
function fitContour(contour: Pt[], scale: number, errorTolerance: number): BezierSegment[] {
  const scaled: Pt[] = contour.map(([x, y]) => [x * scale, y * scale]);

  const simplified = rdp(scaled, errorTolerance * 0.5);
  if (simplified.length < 2) return [];

  const fitted = fitCurve(simplified, errorTolerance);
  if (fitted.length === 0) return [];

  return toSegments(fitted);
}
