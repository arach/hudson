'use client';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { useLogo } from './LogoProvider';

interface Props {
  /** Active template id — offset writes are keyed by this. */
  templateId: string;
  /** Rendered preview size in CSS pixels. SVG viewBox is always 512x512, so
   *  the user→pixel scale is `512 / size`. */
  size: number;
  /** The `<TemplateSvg>` (or any rendered SVG containing `data-element-id`
   *  markers) that this surface wraps. */
  children: ReactNode;
}

const VB = 512;
const HOVER_RING = 'rgba(56, 189, 248, 0.55)';
const SELECT_RING = 'rgb(56, 189, 248)';
const SELECT_GLOW = 'rgba(56, 189, 248, 0.20)';

interface Bbox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface DragState {
  shapeId: string;
  startX: number;
  startY: number;
  initialDx: number;
  initialDy: number;
  /** Container CSS-scale captured at pointerdown — drag deltas convert
   *  screen-px → SVG user-units by `dxPx / cssScale`. Captured once so a
   *  mid-drag workspace zoom can't shear the result. */
  cssScale: number;
}

/** Interactive overlay: hover ring, selection ring, drag-to-offset.
 *
 *  Reads `data-element-id` markers from the rendered SVG and lets the user
 *  drag any marked shape, writing the delta into `elementOffsets` via the
 *  provider. Live writes during drag (single offset entry per shape). */
export function LogoInteractiveSurface({ templateId, size, children }: Props) {
  const { elementOffsets, setElementOffset } = useLogo();
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [bboxes, setBboxes] = useState<Record<string, Bbox>>({});

  /** Container CSS scale: workspace zoom (or any ancestor `transform: scale`)
   *  shrinks the container in screen pixels while CSS coords inside it stay
   *  at natural size. Use this to convert screen-px → container-local CSS
   *  px for bbox positioning and drag deltas. Falls back to 1 if the
   *  container hasn't sized yet. */
  const measureCssScale = useCallback((): number => {
    const container = containerRef.current;
    if (!container || size <= 0) return 1;
    const w = container.getBoundingClientRect().width;
    if (!Number.isFinite(w) || w <= 0) return 1;
    return w / size;
  }, [size]);

  // ── Bbox sync ─────────────────────────────────────────────────────────────
  // After every render, walk the SVG's marked shapes and store their bboxes
  // relative to the container. Bboxes are in container-local CSS pixels
  // (NOT screen pixels) so positioning the selection ring at `left: bbox.x`
  // composes correctly with any ancestor CSS transform. Early-out when
  // nothing changed to avoid loops.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const svg = container.querySelector('svg');
    if (!svg) return;
    const marked = svg.querySelectorAll('[data-element-id]');
    const containerRect = container.getBoundingClientRect();
    const cssScale = containerRect.width > 0 ? containerRect.width / size : 1;
    const next: Record<string, Bbox> = {};
    marked.forEach((node) => {
      const id = node.getAttribute('data-element-id');
      if (!id) return;
      try {
        const rect = (node as SVGGraphicsElement).getBoundingClientRect();
        // Skip degenerate rects (e.g., elements inside <defs> render as 0×0).
        // A "glyph" id can appear both on a defs clipPath child and a
        // visible <text>; we want the visible one for the selection ring.
        if (rect.width <= 0 || rect.height <= 0) {
          if (next[id]) return;
        }
        next[id] = {
          x: (rect.x - containerRect.x) / cssScale,
          y: (rect.y - containerRect.y) / cssScale,
          w: rect.width / cssScale,
          h: rect.height / cssScale,
        };
      } catch {
        /* skip unmeasurable nodes */
      }
    });
    setBboxes((prev) => {
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (prevKeys.length === nextKeys.length) {
        let same = true;
        for (const k of nextKeys) {
          const a = prev[k];
          const b = next[k];
          if (!a || a.x !== b.x || a.y !== b.y || a.w !== b.w || a.h !== b.h) {
            same = false;
            break;
          }
        }
        if (same) return prev;
      }
      return next;
    });
  });

  // ── Pointer events ────────────────────────────────────────────────────────
  const handlePointerDown = useCallback((ev: ReactPointerEvent<HTMLDivElement>) => {
    if (ev.button !== 0) return; // primary button only
    const target = ev.target as Element | null;
    const marked = target?.closest('[data-element-id]') as SVGGraphicsElement | null;
    if (!marked) {
      // Click outside any marked shape — deselect.
      setSelectedId(null);
      return;
    }
    const id = marked.getAttribute('data-element-id');
    if (!id) return;
    setSelectedId(id);
    const existing = elementOffsets[templateId]?.[id] ?? {};
    dragRef.current = {
      shapeId: id,
      startX: ev.clientX,
      startY: ev.clientY,
      initialDx: existing.dx ?? 0,
      initialDy: existing.dy ?? 0,
      cssScale: measureCssScale(),
    };
    containerRef.current?.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  }, [elementOffsets, measureCssScale, templateId]);

  const handlePointerMove = useCallback((ev: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) {
      // Hover detection only — find the nearest marked ancestor.
      const target = ev.target as Element | null;
      const marked = target?.closest('[data-element-id]');
      const id = marked?.getAttribute('data-element-id') ?? null;
      if (id !== hoverId) setHoverId(id);
      return;
    }

    let dxPx = ev.clientX - drag.startX;
    let dyPx = ev.clientY - drag.startY;
    if (ev.shiftKey) {
      // Axis-lock to the dominant direction.
      if (Math.abs(dxPx) >= Math.abs(dyPx)) dyPx = 0;
      else dxPx = 0;
    }
    // Convert screen px → SVG user units: divide by container CSS scale
    // (so 1 screen px of cursor movement = 1 visible px of element movement
    // regardless of any ancestor `transform: scale`), then multiply by the
    // viewBox-per-CSS-px ratio (1:1 in our case since viewBox = size = 512).
    const svgPerCssPx = VB / size;
    const screenToSvg = svgPerCssPx / (drag.cssScale || 1);
    let dx = drag.initialDx + dxPx * screenToSvg;
    let dy = drag.initialDy + dyPx * screenToSvg;
    if (ev.altKey) {
      // Snap to a 4-unit grid in SVG user space.
      dx = Math.round(dx / 4) * 4;
      dy = Math.round(dy / 4) * 4;
    } else {
      // 0.1-unit precision otherwise.
      dx = Math.round(dx * 10) / 10;
      dy = Math.round(dy * 10) / 10;
    }
    setElementOffset(templateId, drag.shapeId, { dx, dy });
  }, [hoverId, setElementOffset, size, templateId]);

  const handlePointerUp = useCallback((ev: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      dragRef.current = null;
      try {
        containerRef.current?.releasePointerCapture(ev.pointerId);
      } catch {
        /* already released */
      }
    }
  }, []);

  const handlePointerLeave = useCallback(() => {
    if (!dragRef.current) setHoverId(null);
  }, []);

  // ── Esc to deselect ───────────────────────────────────────────────────────
  useEffect(() => {
    if (selectedId === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

  const selectionBox = selectedId ? bboxes[selectedId] : null;
  const hoverBox = hoverId && hoverId !== selectedId ? bboxes[hoverId] : null;
  const cursor = dragRef.current ? 'grabbing' : (hoverId ? 'grab' : 'default');

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: size, height: size, cursor, userSelect: 'none', touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerLeave}
    >
      {children}
      {hoverBox && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: hoverBox.x - 2,
            top: hoverBox.y - 2,
            width: hoverBox.w + 4,
            height: hoverBox.h + 4,
            border: `1px solid ${HOVER_RING}`,
            borderRadius: 3,
            pointerEvents: 'none',
            transition: 'none',
          }}
        />
      )}
      {selectionBox && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: selectionBox.x - 3,
            top: selectionBox.y - 3,
            width: selectionBox.w + 6,
            height: selectionBox.h + 6,
            border: `1.5px solid ${SELECT_RING}`,
            borderRadius: 3,
            pointerEvents: 'none',
            boxShadow: `0 0 0 3px ${SELECT_GLOW}`,
          }}
        />
      )}
    </div>
  );
}
