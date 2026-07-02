'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { flushSync } from 'react-dom';
import { HudsonContextMenu, type ContextMenuEntry } from 'hudsonkit/context-menu';
import {
  DRAWING_VIEWBOX_SIZE,
  buildDrawingNodeFromBounds,
  clamp,
  createDrawingTextNode,
  drawingNodeCounterName,
  isDrawingNodeLargeEnough,
  isShapeDrawingTool,
  makeDrawingNodeId,
  moveDrawingNode,
  normalizeDrawingDegrees,
  roundTo,
  type DrawingNode,
  type DrawingShapeTool,
  type DrawingTool,
  type ElementTransformOffset,
} from './model';
import { DRAWING_NODE_DATA_ATTRIBUTE } from './svg';

interface Bbox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface EditableMoveDragState {
  mode: 'editable-move';
  id: string;
  startX: number;
  startY: number;
  initialDx: number;
  initialDy: number;
  cssScale: number;
}

interface NodeMoveDragState {
  mode: 'node-move';
  nodeId: string;
  startX: number;
  startY: number;
  initial: DrawingNode;
  cssScale: number;
}

interface DrawDragState {
  mode: 'draw';
  nodeId: string;
  name: string;
  shapeType: DrawingShapeTool;
  startX: number;
  startY: number;
}

type DragState = EditableMoveDragState | NodeMoveDragState | DrawDragState;

export interface DrawingSurfaceProps {
  size: number;
  viewBoxSize?: number;
  tool: DrawingTool;
  nodes: DrawingNode[];
  selectedNodeId: string | null;
  editableElementOffsets?: Record<string, ElementTransformOffset>;
  editableElementSelector?: string;
  editableElementDataAttribute?: string;
  onSelectedNodeChange: (id: string | null) => void;
  onAddNode: (node: DrawingNode) => void;
  onUpdateNode: (id: string, patch: Partial<DrawingNode>) => void;
  onDeleteNode: (id: string) => void;
  getNodeContextMenuItems?: (node: DrawingNode) => ContextMenuEntry[];
  onEditableElementOffsetChange?: (id: string, offset: ElementTransformOffset | null) => void;
  children: ReactNode;
}

const HOVER_RING = 'rgba(56, 189, 248, 0.55)';
const SELECT_RING = 'rgb(56, 189, 248)';
const SELECT_GLOW = 'rgba(56, 189, 248, 0.20)';
const DEFAULT_EDITABLE_ELEMENT_SELECTOR = '[data-element-id]';
const DRAWING_NODE_SELECTOR = `[${DRAWING_NODE_DATA_ATTRIBUTE}]`;

function sameBboxes(a: Record<string, Bbox>, b: Record<string, Bbox>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of bKeys) {
    const av = a[k];
    const bv = b[k];
    if (!av || av.x !== bv.x || av.y !== bv.y || av.w !== bv.w || av.h !== bv.h) return false;
  }
  return true;
}

export function DrawingSurface({
  size,
  viewBoxSize = DRAWING_VIEWBOX_SIZE,
  tool,
  nodes,
  selectedNodeId,
  editableElementOffsets = {},
  editableElementSelector = DEFAULT_EDITABLE_ELEMENT_SELECTOR,
  editableElementDataAttribute = 'data-element-id',
  onSelectedNodeChange,
  onAddNode,
  onUpdateNode,
  onDeleteNode,
  getNodeContextMenuItems,
  onEditableElementOffsetChange,
  children,
}: DrawingSurfaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedEditableId, setSelectedEditableId] = useState<string | null>(null);
  const [hoverEditableId, setHoverEditableId] = useState<string | null>(null);
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);
  const [editableBboxes, setEditableBboxes] = useState<Record<string, Bbox>>({});
  const [nodeBboxes, setNodeBboxes] = useState<Record<string, Bbox>>({});
  const [draftNode, setDraftNode] = useState<DrawingNode | null>(null);
  const [contextNodeId, setContextNodeId] = useState<string | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [dragMode, setDragMode] = useState<DragState['mode'] | null>(null);
  const selectedNode = useMemo(
    () => nodes.find(node => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  const measureCssScale = useCallback((): number => {
    const container = containerRef.current;
    if (!container || size <= 0) return 1;
    const w = container.getBoundingClientRect().width;
    if (!Number.isFinite(w) || w <= 0) return 1;
    return w / size;
  }, [size]);

  const svgUnitsPerCssPx = viewBoxSize / size;

  const pointToSvg = useCallback((ev: Pick<ReactPointerEvent, 'clientX' | 'clientY'>) => {
    const container = containerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const cssScale = measureCssScale();
    if (cssScale <= 0) return null;
    return {
      x: clamp(roundTo(((ev.clientX - rect.x) / cssScale) * svgUnitsPerCssPx, 1), 0, viewBoxSize),
      y: clamp(roundTo(((ev.clientY - rect.y) / cssScale) * svgUnitsPerCssPx, 1), 0, viewBoxSize),
    };
  }, [measureCssScale, svgUnitsPerCssPx, viewBoxSize]);

  const boxOrigin = useCallback((box: Bbox): Pick<ElementTransformOffset, 'originX' | 'originY'> => ({
    originX: roundTo((box.x + box.w / 2) * svgUnitsPerCssPx, 1),
    originY: roundTo((box.y + box.h / 2) * svgUnitsPerCssPx, 1),
  }), [svgUnitsPerCssPx]);

  const updateSelectedEditableOffset = useCallback((
    updater: (existing: ElementTransformOffset) => ElementTransformOffset,
    withOrigin = false,
  ) => {
    if (!selectedEditableId || !onEditableElementOffsetChange) return;
    const existing = editableElementOffsets[selectedEditableId] ?? {};
    const next = updater(existing);
    const selectedBox = editableBboxes[selectedEditableId];
    onEditableElementOffsetChange(
      selectedEditableId,
      withOrigin && selectedBox ? { ...next, ...boxOrigin(selectedBox) } : next,
    );
  }, [
    boxOrigin,
    editableBboxes,
    editableElementOffsets,
    onEditableElementOffsetChange,
    selectedEditableId,
  ]);

  const nudgeSelectedEditable = useCallback((dx: number, dy: number) => {
    updateSelectedEditableOffset((existing) => ({
      dx: roundTo((existing.dx ?? 0) + dx, 1),
      dy: roundTo((existing.dy ?? 0) + dy, 1),
    }));
  }, [updateSelectedEditableOffset]);

  const rotateSelectedEditable = useCallback((delta: number) => {
    updateSelectedEditableOffset((existing) => ({
      rotate: normalizeDrawingDegrees((existing.rotate ?? 0) + delta),
    }), true);
  }, [updateSelectedEditableOffset]);

  const scaleSelectedEditable = useCallback((delta: number) => {
    updateSelectedEditableOffset((existing) => ({
      scale: roundTo(clamp((existing.scale ?? 1) + delta, 0.25, 3), 2),
    }), true);
  }, [updateSelectedEditableOffset]);

  const resetSelectedEditable = useCallback(() => {
    if (!selectedEditableId || !onEditableElementOffsetChange) return;
    onEditableElementOffsetChange(selectedEditableId, null);
  }, [onEditableElementOffsetChange, selectedEditableId]);

  const handleContextMenuCapture = useCallback((ev: ReactMouseEvent<HTMLDivElement>) => {
    if (!getNodeContextMenuItems) return;
    const target = ev.target as Element | null;
    const markedNode = target?.closest(DRAWING_NODE_SELECTOR) as SVGGraphicsElement | null;
    const nodeId = markedNode?.getAttribute(DRAWING_NODE_DATA_ATTRIBUTE) ?? null;
    const node = nodeId ? nodes.find(item => item.id === nodeId) : null;

    if (!node) {
      flushSync(() => setContextNodeId(null));
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }

    flushSync(() => {
      setContextNodeId(node.id);
      onSelectedNodeChange(node.id);
      setSelectedEditableId(null);
      setHoverEditableId(null);
      setHoverNodeId(null);
    });
  }, [getNodeContextMenuItems, nodes, onSelectedNodeChange]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const svg = container.querySelector('svg');
    if (!svg) return;

    const markedEditable = svg.querySelectorAll(editableElementSelector);
    const markedNodes = svg.querySelectorAll(DRAWING_NODE_SELECTOR);
    const containerRect = container.getBoundingClientRect();
    const cssScale = containerRect.width > 0 ? containerRect.width / size : 1;
    const nextEditable: Record<string, Bbox> = {};
    const nextNodes: Record<string, Bbox> = {};

    markedEditable.forEach((node) => {
      const id = node.getAttribute(editableElementDataAttribute);
      if (!id) return;
      try {
        const rect = (node as SVGGraphicsElement).getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
          if (nextEditable[id]) return;
        }
        nextEditable[id] = {
          x: (rect.x - containerRect.x) / cssScale,
          y: (rect.y - containerRect.y) / cssScale,
          w: rect.width / cssScale,
          h: rect.height / cssScale,
        };
      } catch {
        /* skip unmeasurable nodes */
      }
    });

    markedNodes.forEach((node) => {
      const id = node.getAttribute(DRAWING_NODE_DATA_ATTRIBUTE);
      if (!id) return;
      try {
        const rect = (node as SVGGraphicsElement).getBoundingClientRect();
        if (rect.width <= 0 && rect.height <= 0) return;
        nextNodes[id] = {
          x: (rect.x - containerRect.x) / cssScale,
          y: (rect.y - containerRect.y) / cssScale,
          w: rect.width / cssScale,
          h: rect.height / cssScale,
        };
      } catch {
        /* skip unmeasurable nodes */
      }
    });

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setEditableBboxes((prev) => {
        if (sameBboxes(prev, nextEditable)) return prev;
        return nextEditable;
      });
      setNodeBboxes((prev) => {
        if (sameBboxes(prev, nextNodes)) return prev;
        return nextNodes;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [children, editableElementDataAttribute, editableElementSelector, nodes, size]);

  const handlePointerDown = useCallback((ev: ReactPointerEvent<HTMLDivElement>) => {
    if (ev.button !== 0) return;

    if (tool === 'text') {
      const pt = pointToSvg(ev);
      if (!pt) return;
      const count = nodes.filter(node => node.type === 'text').length;
      const id = makeDrawingNodeId('text');
      onAddNode(createDrawingTextNode(id, drawingNodeCounterName('text', count), pt.x, pt.y));
      setSelectedEditableId(null);
      setHoverEditableId(null);
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }

    if (isShapeDrawingTool(tool)) {
      const pt = pointToSvg(ev);
      if (!pt) return;
      const id = makeDrawingNodeId(tool);
      const name = drawingNodeCounterName(tool, nodes.filter(node => node.type === tool).length);
      dragRef.current = {
        mode: 'draw',
        nodeId: id,
        name,
        shapeType: tool,
        startX: pt.x,
        startY: pt.y,
      };
      setSelectedEditableId(null);
      onSelectedNodeChange(null);
      setHoverEditableId(null);
      setHoverNodeId(null);
      setDraftNode(buildDrawingNodeFromBounds(tool, id, name, pt.x, pt.y, pt.x, pt.y));
      setDragMode('draw');
      containerRef.current?.setPointerCapture(ev.pointerId);
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }

    const target = ev.target as Element | null;
    const markedNode = target?.closest(DRAWING_NODE_SELECTOR) as SVGGraphicsElement | null;
    if (markedNode) {
      const id = markedNode.getAttribute(DRAWING_NODE_DATA_ATTRIBUTE);
      const node = nodes.find(item => item.id === id);
      if (!id || !node) return;
      onSelectedNodeChange(id);
      setSelectedEditableId(null);
      setHoverEditableId(null);
      if (!node.locked) {
        dragRef.current = {
          mode: 'node-move',
          nodeId: id,
          startX: ev.clientX,
          startY: ev.clientY,
          initial: node,
          cssScale: measureCssScale(),
        };
        setDragMode('node-move');
        containerRef.current?.setPointerCapture(ev.pointerId);
      }
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }

    const markedEditable = target?.closest(editableElementSelector) as SVGGraphicsElement | null;
    if (!markedEditable) {
      setSelectedEditableId(null);
      onSelectedNodeChange(null);
      return;
    }
    const id = markedEditable.getAttribute(editableElementDataAttribute);
    if (!id) return;
    setSelectedEditableId(id);
    onSelectedNodeChange(null);
    const existing = editableElementOffsets[id] ?? {};
    dragRef.current = {
      mode: 'editable-move',
      id,
      startX: ev.clientX,
      startY: ev.clientY,
      initialDx: existing.dx ?? 0,
      initialDy: existing.dy ?? 0,
      cssScale: measureCssScale(),
    };
    setDragMode('editable-move');
    containerRef.current?.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  }, [
    editableElementOffsets,
    editableElementDataAttribute,
    editableElementSelector,
    measureCssScale,
    nodes,
    onAddNode,
    onSelectedNodeChange,
    pointToSvg,
    tool,
  ]);

  const handlePointerMove = useCallback((ev: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) {
      const target = ev.target as Element | null;
      const markedNode = target?.closest(DRAWING_NODE_SELECTOR);
      const nodeId = markedNode?.getAttribute(DRAWING_NODE_DATA_ATTRIBUTE) ?? null;
      if (nodeId !== hoverNodeId) setHoverNodeId(nodeId);
      const markedEditable = target?.closest(editableElementSelector);
      const editableId = markedEditable?.getAttribute(editableElementDataAttribute) ?? null;
      if (editableId !== hoverEditableId) setHoverEditableId(editableId);
      return;
    }

    if (drag.mode === 'draw') {
      const pt = pointToSvg(ev);
      if (!pt) return;
      setDraftNode(buildDrawingNodeFromBounds(drag.shapeType, drag.nodeId, drag.name, drag.startX, drag.startY, pt.x, pt.y));
      return;
    }

    let dxPx = ev.clientX - drag.startX;
    let dyPx = ev.clientY - drag.startY;
    if (ev.shiftKey) {
      if (Math.abs(dxPx) >= Math.abs(dyPx)) dyPx = 0;
      else dxPx = 0;
    }
    const screenToSvg = (viewBoxSize / size) / (drag.cssScale || 1);
    let dx = dxPx * screenToSvg;
    let dy = dyPx * screenToSvg;
    if (ev.altKey) {
      dx = Math.round(dx / 4) * 4;
      dy = Math.round(dy / 4) * 4;
    }

    if (drag.mode === 'node-move') {
      onUpdateNode(drag.nodeId, moveDrawingNode(drag.initial, dx, dy));
      return;
    }

    dx += drag.initialDx;
    dy += drag.initialDy;
    if (!ev.altKey) {
      dx = roundTo(dx, 1);
      dy = roundTo(dy, 1);
    }
    onEditableElementOffsetChange?.(drag.id, { dx, dy });
  }, [
    editableElementSelector,
    editableElementDataAttribute,
    hoverEditableId,
    hoverNodeId,
    onEditableElementOffsetChange,
    onUpdateNode,
    pointToSvg,
    size,
    viewBoxSize,
  ]);

  const handlePointerUp = useCallback((ev: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.mode === 'draw' && draftNode && isDrawingNodeLargeEnough(draftNode)) {
      onAddNode(draftNode);
    }
    dragRef.current = null;
    setDraftNode(null);
    setDragMode(null);
    try {
      containerRef.current?.releasePointerCapture(ev.pointerId);
    } catch {
      /* already released */
    }
  }, [draftNode, onAddNode]);

  const handlePointerLeave = useCallback(() => {
    if (!dragRef.current) {
      setHoverEditableId(null);
      setHoverNodeId(null);
    }
  }, []);

  useEffect(() => {
    if (selectedEditableId === null && selectedNodeId === null) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.metaKey || e.ctrlKey) return;

      const nudgeStep = e.shiftKey ? 8 : (e.altKey ? 0.5 : 1);
      const rotateStep = e.shiftKey ? 15 : 5;

      const nudgeNodeOrEditable = (dx: number, dy: number) => {
        if (selectedNode) {
          if (!selectedNode.locked) onUpdateNode(selectedNode.id, moveDrawingNode(selectedNode, dx, dy));
          return;
        }
        nudgeSelectedEditable(dx, dy);
      };

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          setSelectedEditableId(null);
          onSelectedNodeChange(null);
          return;
        case 'ArrowUp':
          e.preventDefault();
          nudgeNodeOrEditable(0, -nudgeStep);
          return;
        case 'ArrowDown':
          e.preventDefault();
          nudgeNodeOrEditable(0, nudgeStep);
          return;
        case 'ArrowLeft':
          e.preventDefault();
          nudgeNodeOrEditable(-nudgeStep, 0);
          return;
        case 'ArrowRight':
          e.preventDefault();
          nudgeNodeOrEditable(nudgeStep, 0);
          return;
        case '[':
          e.preventDefault();
          if (selectedNode) {
            if (!selectedNode.locked) {
              onUpdateNode(selectedNode.id, { rotate: normalizeDrawingDegrees((selectedNode.rotate ?? 0) - rotateStep) });
            }
            return;
          }
          rotateSelectedEditable(-rotateStep);
          return;
        case ']':
          e.preventDefault();
          if (selectedNode) {
            if (!selectedNode.locked) {
              onUpdateNode(selectedNode.id, { rotate: normalizeDrawingDegrees((selectedNode.rotate ?? 0) + rotateStep) });
            }
            return;
          }
          rotateSelectedEditable(rotateStep);
          return;
        case '-':
          e.preventDefault();
          if (!selectedNode) scaleSelectedEditable(-0.05);
          return;
        case '=':
        case '+':
          e.preventDefault();
          if (!selectedNode) scaleSelectedEditable(0.05);
          return;
        case 'Backspace':
        case 'Delete':
          e.preventDefault();
          if (selectedNode) {
            onDeleteNode(selectedNode.id);
            onSelectedNodeChange(null);
            return;
          }
          resetSelectedEditable();
          return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    nudgeSelectedEditable,
    onDeleteNode,
    onSelectedNodeChange,
    onUpdateNode,
    resetSelectedEditable,
    rotateSelectedEditable,
    scaleSelectedEditable,
    selectedEditableId,
    selectedNode,
    selectedNodeId,
  ]);

  const selectedEditableBox = selectedEditableId ? editableBboxes[selectedEditableId] : null;
  const hoverEditableBox = hoverEditableId && hoverEditableId !== selectedEditableId ? editableBboxes[hoverEditableId] : null;
  const selectedNodeBox = selectedNodeId ? nodeBboxes[selectedNodeId] : null;
  const hoverNodeBox = hoverNodeId && hoverNodeId !== selectedNodeId ? nodeBboxes[hoverNodeId] : null;
  const cursor = dragMode === 'editable-move' || dragMode === 'node-move'
    ? 'grabbing'
    : tool === 'select'
      ? (hoverEditableId || hoverNodeId ? 'grab' : 'default')
      : 'crosshair';

  const contextNode = contextNodeId ? nodes.find(node => node.id === contextNodeId) ?? null : null;
  const contextMenuItems = getNodeContextMenuItems
    ? contextNode
      ? getNodeContextMenuItems(contextNode)
      : [{ id: 'drawing:no-component', label: 'No component', disabled: true, action: () => {} }]
    : [];

  const surface = (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: size, height: size, cursor, userSelect: 'none', touchAction: 'none' }}
      onContextMenuCapture={handleContextMenuCapture}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerLeave}
    >
      {children}
      {draftNode && (
        <svg
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
          width={size}
          height={size}
        >
          {draftNode.type === 'rect' && (
            <rect
              x={draftNode.x}
              y={draftNode.y}
              width={draftNode.w}
              height={draftNode.h}
              rx={draftNode.radius}
              fill={draftNode.fill}
              stroke={draftNode.stroke}
              strokeWidth={draftNode.strokeWidth}
              strokeDasharray="8 6"
              opacity={0.9}
            />
          )}
          {draftNode.type === 'ellipse' && (
            <ellipse
              cx={draftNode.x + draftNode.w / 2}
              cy={draftNode.y + draftNode.h / 2}
              rx={draftNode.w / 2}
              ry={draftNode.h / 2}
              fill={draftNode.fill}
              stroke={draftNode.stroke}
              strokeWidth={draftNode.strokeWidth}
              strokeDasharray="8 6"
              opacity={0.9}
            />
          )}
          {draftNode.type === 'line' && (
            <line
              x1={draftNode.x}
              y1={draftNode.y}
              x2={draftNode.x2}
              y2={draftNode.y2}
              stroke={draftNode.stroke}
              strokeWidth={draftNode.strokeWidth}
              strokeLinecap="round"
              strokeDasharray="8 6"
              opacity={0.9}
            />
          )}
        </svg>
      )}
      {hoverNodeBox && <SelectionRing box={hoverNodeBox} color={HOVER_RING} inset={2} />}
      {selectedNodeBox && <SelectionRing box={selectedNodeBox} color={SELECT_RING} glow={SELECT_GLOW} inset={3} width={1.5} />}
      {hoverEditableBox && <SelectionRing box={hoverEditableBox} color={HOVER_RING} inset={2} />}
      {selectedEditableBox && <SelectionRing box={selectedEditableBox} color={SELECT_RING} glow={SELECT_GLOW} inset={3} width={1.5} />}
    </div>
  );

  if (!getNodeContextMenuItems) return surface;
  return <HudsonContextMenu items={contextMenuItems}>{surface}</HudsonContextMenu>;
}

function SelectionRing({
  box,
  color,
  glow,
  inset,
  width = 1,
}: {
  box: Bbox;
  color: string;
  glow?: string;
  inset: number;
  width?: number;
}) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left: box.x - inset,
        top: box.y - inset,
        width: box.w + inset * 2,
        height: box.h + inset * 2,
        border: `${width}px solid ${color}`,
        borderRadius: 3,
        pointerEvents: 'none',
        boxShadow: glow ? `0 0 0 3px ${glow}` : undefined,
        transition: 'none',
      }}
    />
  );
}
