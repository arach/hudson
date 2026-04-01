# Performance Patterns: Drag, Resize & Continuous Interactions in React

Lessons learned from optimizing Hudson's drag, resize, pan, and scrub interactions.

## The Core Problem

React re-renders components when state changes. During drag/resize operations, if you call `setState` on every `mousemove` event (~60-120 times/second), React reconciles and re-renders the entire subtree on every frame. With a 16ms frame budget (60fps), even a few milliseconds of reconciliation overhead creates visible jank.

## The Pattern: Refs During Interaction, State on Commit

```
mousemove (hot path)     ->  Write to refs / DOM directly
mouseup   (commit)       ->  Flush final value to React state
```

This is the single most impactful optimization for interaction performance in React. React never needs to know about intermediate values.

---

## Pattern 1: Direct DOM Manipulation for Position/Size

**When to use:** Moving, resizing, or repositioning an element during drag.

### Before (bad)

```tsx
const [bounds, setBounds] = useState({ x: 0, y: 0, w: 400, h: 300 });

const onMouseMove = (ev: MouseEvent) => {
  setBounds({ ...startBounds, x: startBounds.x + dx, y: startBounds.y + dy });
  // React re-renders the entire window + children every frame
};
```

### After (good)

```tsx
const windowRef = useRef<HTMLDivElement>(null);
const [bounds, setBounds] = useState({ x: 0, y: 0, w: 400, h: 300 });

const applyBoundsToDOM = (b: Bounds) => {
  const el = windowRef.current;
  if (!el) return;
  el.style.left = `${b.x}px`;
  el.style.top = `${b.y}px`;
  el.style.width = `${b.w}px`;
  el.style.height = `${b.h}px`;
};

const onMouseMove = (ev: MouseEvent) => {
  // Direct DOM — zero React overhead
  applyBoundsToDOM({ ...startBounds, x: startBounds.x + dx, y: startBounds.y + dy });
};

const onMouseUp = (ev: MouseEvent) => {
  // Flush to React state once
  setBounds({ ...startBounds, x: startBounds.x + dx, y: startBounds.y + dy });
};
```

**Applied to:** AppWindow drag, AppWindow resize, sidebar panel resize.

---

## Pattern 2: Closure-Based Drag Handlers

**When to use:** Any drag interaction where you need start values.

Instead of storing `startX`, `startWidth` etc. in state and reading them back on every move, capture them in a closure at mousedown time.

### Before (bad)

```tsx
const [isDragging, setIsDragging] = useState(false);
const [startX, setStartX] = useState(0);

const onMouseDown = (e) => {
  setIsDragging(true);
  setStartX(e.clientX);
};

// This useEffect re-runs every time isDragging changes
useEffect(() => {
  if (isDragging) {
    const onMouseMove = (ev) => { /* uses startX from state */ };
    const onMouseUp = () => { setIsDragging(false); };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => { /* cleanup */ };
  }
}, [isDragging, startX]);
```

### After (good)

```tsx
const onMouseDown = (e: React.MouseEvent) => {
  const startX = e.clientX;           // Captured in closure
  const startWidth = currentWidth;     // Captured in closure

  const onMouseMove = (ev: MouseEvent) => {
    const delta = ev.clientX - startX;
    const newWidth = Math.max(MIN, Math.min(MAX, startWidth + delta));
    element.style.width = `${newWidth}px`;  // DOM direct
  };

  const onMouseUp = (ev: MouseEvent) => {
    const delta = ev.clientX - startX;
    setWidth(Math.max(MIN, Math.min(MAX, startWidth + delta)));  // State flush
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
};
```

Benefits:
- No state for drag tracking (`isDragging`, `startX` etc.)
- No useEffect for listener management
- Closure captures exactly what you need
- Cleanup is local to the handler

**Applied to:** Sidebar resize, anchor list resize, animation scrubber.

---

## Pattern 3: Ref Mirrors for Hot-Path Reads

**When to use:** When state needs to be readable in a hot path without triggering re-renders.

```tsx
const [isPanning, setIsPanning] = useState(false);
const isPanningRef = useRef(false);

// Set both when changing
const startPan = () => {
  setIsPanning(true);
  isPanningRef.current = true;
};

// Read ref in hot path (no re-render dependency)
const onMouseMove = (ev: MouseEvent) => {
  if (isPanningRef.current) {
    // fast path — no React involvement
  }
};

// State still drives UI (cursor changes, conditional rendering)
<div className={isPanning ? 'cursor-grabbing' : 'cursor-grab'}>
```

**Applied to:** Shaper pan (`isPanningRef`, `panStartRef`), point drag (`dragStartRef`).

---

## Pattern 4: rAF Batching for Decorative Updates

**When to use:** Visual feedback that doesn't need to be pixel-perfect every frame (crosshairs, coordinate readouts, progress indicators).

```tsx
const rafRef = useRef<number | null>(null);

const onMouseMove = (ev: MouseEvent) => {
  // Cancel previous pending update
  if (rafRef.current) cancelAnimationFrame(rafRef.current);

  rafRef.current = requestAnimationFrame(() => {
    setMousePos({ x: ev.clientX, y: ev.clientY });
    rafRef.current = null;
  });
};
```

This coalesces multiple mousemove events into a single state update per frame. If the browser fires 3 mousemove events before the next paint, only the last one triggers a React render.

**Applied to:** Shaper crosshair guide coordinates, animation scrubber progress.

---

## Pattern 5: Targeted Cloning Instead of Deep Copy

**When to use:** Updating nested immutable state during drag.

### Before (bad)

```tsx
setBezierData((prev) => {
  const newData = JSON.parse(JSON.stringify(prev));  // Deep clone EVERYTHING
  newData.strokes[i][j].p0[0] += dx;                // Modify one point
  return newData;
});
```

`JSON.parse(JSON.stringify())` is O(n) on the entire data structure. For bezier data with hundreds of segments, this is significant per-frame overhead.

### After (good)

```tsx
setBezierData((prev) => {
  const newStrokes = prev.strokes.map((stroke, si) => {
    if (si !== targetStroke) return stroke;  // Reuse unchanged strokes
    return stroke.map((seg, sei) => {
      if (sei !== targetSegment) return seg;  // Reuse unchanged segments
      // Only clone the one segment we're modifying
      return { p0: [...seg.p0], c1: [...seg.c1], c2: [...seg.c2], p3: [...seg.p3] };
    });
  });
  const seg = newStrokes[targetStroke][targetSegment];
  seg.p0[0] += dx;
  return { strokes: newStrokes };
});
```

Benefits:
- O(1) cloning instead of O(n)
- Unchanged array references let React.memo / useMemo skip re-renders downstream
- No JSON serialization overhead

**Applied to:** Shaper point drag (bezier data mutation).

---

## Pattern 6: DOM Query for Element Targeting

**When to use:** When you need to manipulate an element you don't have a ref to (e.g., it's in a child component).

```tsx
// Add a data attribute to the target element
<div data-frame-panel="manifest" style={{ width: `${leftWidth}px` }}>

// In the drag handler, query for it
const panelEl = document.querySelector('[data-frame-panel="manifest"]') as HTMLElement;
if (panelEl) panelEl.style.width = `${newWidth}px`;
```

This bridges the gap when the drag handler is in a parent but the visual element is in a child. It's simpler than threading refs through props for a one-off interaction.

**Applied to:** Sidebar resize (parent handler, child panel element).

---

## Decision Checklist

Ask yourself these questions when implementing any continuous interaction:

1. **Is setState called inside onMouseMove/onPointerMove?** If yes, it's a hot path — apply Pattern 1 or 3.
2. **Am I deep-cloning data every frame?** Use targeted cloning (Pattern 5) or accumulate deltas in refs and apply once.
3. **Is the visual update purely decorative?** (crosshairs, guides, tooltips) — use rAF batching (Pattern 4) or direct DOM (Pattern 1).
4. **Am I using useEffect to manage drag listeners?** Switch to closure-based handlers (Pattern 2) for simpler, faster code.
5. **Does my parent re-render children during drag?** The parent's setState re-renders everything below it — push the DOM manipulation as close to the leaf element as possible.

## Existing Good Patterns in Hudson

These were already well-optimized before this pass:

- **TerminalDrawer** — direct DOM height during drag, state on mouseup
- **Frame space-pan** — ref-based callback, no state in hot path
- **Canvas.tsx pan tracking** — uses `lastPanRef`, `isPanningRef` for pan delta accumulation

## Files Changed

| File | What Changed |
|------|-------------|
| `app/shell/WorkspaceShell.tsx` | Sidebar resize: DOM during drag, state on mouseup |
| `packages/hudson-sdk/.../AppWindow.tsx` | Window drag + resize: DOM during drag, state on mouseup |
| `app/apps/shaper/ShaperProvider.tsx` | Pan: ref + DOM transform; Point drag: targeted clone + ref dragStart; Anchor resize: closure + DOM |
| `app/apps/shaper/tools/AnchorsTool.tsx` | Added `data-anchor-list` attribute for DOM targeting |
| `packages/hudson-sdk/.../Canvas.tsx` | Guide lines: direct DOM via refs instead of state |
| `packages/hudson-sdk/.../AnimationTimeline.tsx` | Scrubber: rAF batching + DOM for playhead/progress |
