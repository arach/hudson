export const DRAWING_VIEWBOX_SIZE = 512;

export type DrawingTool = 'select' | 'rect' | 'ellipse' | 'line' | 'text';
export type DrawingShapeTool = Exclude<DrawingTool, 'select' | 'text'>;

export interface ElementTransformOffset {
  dx?: number;
  dy?: number;
  rotate?: number;
  scale?: number;
  originX?: number;
  originY?: number;
}

interface DrawingNodeBase {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  x: number;
  y: number;
  rotate?: number;
  opacity?: number;
}

export interface DrawingRectNode extends DrawingNodeBase {
  type: 'rect';
  w: number;
  h: number;
  radius: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export interface DrawingEllipseNode extends DrawingNodeBase {
  type: 'ellipse';
  w: number;
  h: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export interface DrawingLineNode extends DrawingNodeBase {
  type: 'line';
  x2: number;
  y2: number;
  stroke: string;
  strokeWidth: number;
}

export interface DrawingTextNode extends DrawingNodeBase {
  type: 'text';
  text: string;
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  letterSpacing: number;
  fill: string;
}

export type DrawingNode =
  | DrawingRectNode
  | DrawingEllipseNode
  | DrawingLineNode
  | DrawingTextNode;

export type DrawingNodeMap = Record<string, DrawingNode[]>;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

export function normalizeDrawingDegrees(value: number): number {
  let next = value % 360;
  if (next > 180) next -= 360;
  if (next < -180) next += 360;
  return roundTo(next, 1);
}

export function isShapeDrawingTool(tool: DrawingTool): tool is DrawingShapeTool {
  return tool === 'rect' || tool === 'ellipse' || tool === 'line';
}

export function drawingNodeCounterName(type: DrawingNode['type'], count: number): string {
  const label = type === 'rect' ? 'Rectangle'
    : type === 'ellipse' ? 'Ellipse'
      : type === 'line' ? 'Line'
        : 'Text';
  return `${label} ${count + 1}`;
}

export function makeDrawingNodeId(type: DrawingNode['type']): string {
  return `${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function createDrawingTextNode(
  id: string,
  name: string,
  x: number,
  y: number,
): DrawingTextNode {
  return {
    id,
    name,
    type: 'text',
    visible: true,
    locked: false,
    x: roundTo(x, 1),
    y: roundTo(y, 1),
    text: 'Text',
    fontFamily: 'Inter',
    fontWeight: 700,
    fontSize: 64,
    letterSpacing: 0,
    fill: '#ffffff',
    opacity: 1,
  };
}

export function buildDrawingNodeFromBounds(
  type: DrawingShapeTool,
  id: string,
  name: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): Exclude<DrawingNode, DrawingTextNode> {
  if (type === 'line') {
    return {
      id,
      name,
      type,
      visible: true,
      locked: false,
      x: roundTo(x1, 1),
      y: roundTo(y1, 1),
      x2: roundTo(x2, 1),
      y2: roundTo(y2, 1),
      stroke: '#67e8f9',
      strokeWidth: 6,
      opacity: 1,
    };
  }

  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);

  if (type === 'ellipse') {
    return {
      id,
      name,
      type,
      visible: true,
      locked: false,
      x: roundTo(x, 1),
      y: roundTo(y, 1),
      w: roundTo(w, 1),
      h: roundTo(h, 1),
      fill: 'rgba(16,185,129,0.18)',
      stroke: '#34d399',
      strokeWidth: 4,
      opacity: 1,
    };
  }

  return {
    id,
    name,
    type,
    visible: true,
    locked: false,
    x: roundTo(x, 1),
    y: roundTo(y, 1),
    w: roundTo(w, 1),
    h: roundTo(h, 1),
    radius: 18,
    fill: 'rgba(34,211,238,0.18)',
    stroke: '#22d3ee',
    strokeWidth: 4,
    opacity: 1,
  };
}

export function isDrawingNodeLargeEnough(node: DrawingNode): boolean {
  if (node.type === 'text') return true;
  if (node.type === 'line') return Math.hypot(node.x2 - node.x, node.y2 - node.y) >= 4;
  return node.w >= 4 && node.h >= 4;
}

export function moveDrawingNode(node: DrawingNode, dx: number, dy: number): DrawingNode {
  const roundedDx = roundTo(dx, 1);
  const roundedDy = roundTo(dy, 1);
  if (node.type === 'line') {
    return {
      ...node,
      x: roundTo(node.x + roundedDx, 1),
      y: roundTo(node.y + roundedDy, 1),
      x2: roundTo(node.x2 + roundedDx, 1),
      y2: roundTo(node.y2 + roundedDy, 1),
    };
  }
  return {
    ...node,
    x: roundTo(node.x + roundedDx, 1),
    y: roundTo(node.y + roundedDy, 1),
  };
}
