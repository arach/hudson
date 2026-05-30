import type { DrawingNode } from './model';

export const DRAWING_NODE_DATA_ATTRIBUTE = 'data-drawing-node-id';
export const DRAWING_LAYER_ATTRIBUTE = 'data-drawing-layer';

export interface RenderDrawingSvgOptions {
  nodeDataAttribute?: string;
  layerDataAttribute?: string;
  layerDataValue?: string;
}

function svgAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function transformForBox(x: number, y: number, w: number, h: number, rotate = 0): string {
  if (!rotate) return '';
  const cx = x + w / 2;
  const cy = y + h / 2;
  return ` transform="rotate(${rotate} ${cx} ${cy})"`;
}

function drawingNodeDataAttr(node: DrawingNode, options: RenderDrawingSvgOptions): string {
  const attribute = options.nodeDataAttribute ?? DRAWING_NODE_DATA_ATTRIBUTE;
  return `${attribute}="${svgAttr(node.id)}"`;
}

export function renderDrawingNode(node: DrawingNode, options: RenderDrawingSvgOptions = {}): string {
  if (!node.visible) return '';
  const opacity = node.opacity ?? 1;
  const common = `${drawingNodeDataAttr(node, options)} opacity="${opacity}"`;

  switch (node.type) {
    case 'rect':
      return `<rect ${common} x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" rx="${node.radius}" fill="${svgAttr(node.fill)}" stroke="${svgAttr(node.stroke)}" stroke-width="${node.strokeWidth}"${transformForBox(node.x, node.y, node.w, node.h, node.rotate)}/>`;
    case 'ellipse':
      return `<ellipse ${common} cx="${node.x + node.w / 2}" cy="${node.y + node.h / 2}" rx="${node.w / 2}" ry="${node.h / 2}" fill="${svgAttr(node.fill)}" stroke="${svgAttr(node.stroke)}" stroke-width="${node.strokeWidth}"${transformForBox(node.x, node.y, node.w, node.h, node.rotate)}/>`;
    case 'line':
      return `<line ${common} x1="${node.x}" y1="${node.y}" x2="${node.x2}" y2="${node.y2}" stroke="${svgAttr(node.stroke)}" stroke-width="${node.strokeWidth}" stroke-linecap="round"/>`;
    case 'text':
      return `<text ${common} x="${node.x}" y="${node.y}" fill="${svgAttr(node.fill)}" font-family="${svgAttr(node.fontFamily)}" font-weight="${node.fontWeight}" font-size="${node.fontSize}" letter-spacing="${node.letterSpacing}em"${node.rotate ? ` transform="rotate(${node.rotate} ${node.x} ${node.y})"` : ''}>${svgAttr(node.text)}</text>`;
  }
}

export function renderDrawingSvg(
  nodes: DrawingNode[] | undefined,
  options: RenderDrawingSvgOptions = {},
): string {
  if (!nodes || nodes.length === 0) return '';
  return nodes.map(node => renderDrawingNode(node, options)).join('');
}

export function appendDrawingSvgLayer(
  svg: string,
  nodes: DrawingNode[] | undefined,
  options: RenderDrawingSvgOptions = {},
): string {
  const rendered = renderDrawingSvg(nodes, options);
  if (!rendered) return svg;
  const layerAttribute = options.layerDataAttribute ?? DRAWING_LAYER_ATTRIBUTE;
  const layerValue = options.layerDataValue ?? 'true';
  return `${svg}<g ${layerAttribute}="${svgAttr(layerValue)}">${rendered}</g>`;
}
