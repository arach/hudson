export interface BezierSegment {
  p0: [number, number];
  c1: [number, number];
  c2: [number, number];
  p3: [number, number];
}

export interface BezierData {
  strokes: BezierSegment[][];
}

export interface NamedAnchor {
  name: string;
  stroke: string;
  index: number;
  x: number;
  y: number;
}

export interface SharedPoint {
  a: string;
  b: string;
  x: number;
  y: number;
}

export interface AnchorsData {
  anchors: NamedAnchor[];
  shared?: SharedPoint[];
}

export type PointType = 'p0' | 'p3' | 'c1' | 'c2';

export interface SelectedPoint {
  strokeIndex: number;
  segmentIndex: number;
  pointType: PointType;
}

export type Tool = 'select' | 'pen' | 'hand';

export interface ProjectImage {
  url: string;
  name: string;
  width: number;
  height: number;
}

export interface ImageWarning {
  message: string;
  type: 'info' | 'warn';
}

export interface RecentImage {
  name: string;
  thumbnail: string;
  blobUrl: string;
  width: number;
  height: number;
  timestamp: number;
}

export const MAX_RECENT = 8;

export const strokeColors: Record<string, string> = {
  bottom: '#ff6b6b',
  top: '#4dabf7',
  bridge: '#69db7c',
  left: '#ffd43b',
  right: '#9775fa',
};

// ---------------------------------------------------------------------------
// Trace pipeline options
// ---------------------------------------------------------------------------
export type EdgeDetection = 'auto' | 'otsu' | 'canny' | 'alpha';
export type Simplification = 'rdp' | 'none';
export type CurveFit = 'schneider' | 'polyline';
export type TraceResolution = 'auto' | 256 | 512 | 640 | 1024;

export interface TraceOptions {
  errorTolerance: number;
  edgeDetection: EdgeDetection;
  simplification: Simplification;
  curveFit: CurveFit;
  maxContours: number;
  resolution: TraceResolution;
}

export const DEFAULT_TRACE_OPTIONS: TraceOptions = {
  errorTolerance: 5,
  edgeDetection: 'auto',
  simplification: 'rdp',
  curveFit: 'schneider',
  maxContours: 10,
  resolution: 'auto',
};

export interface TraceInfo {
  imageKind: string;
  contourCount: number;
  pointCount: number;
  lastTraceMs: number;
}

export interface TraceResult {
  strokes: BezierSegment[][];
  info: TraceInfo;
}

// ---------------------------------------------------------------------------
// Project metadata
// ---------------------------------------------------------------------------
export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: number;
  sourceImage?: string;
}

export const DEFAULT_ZOOM = 0.45;
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 2;
export const MAX_HISTORY = 100;
