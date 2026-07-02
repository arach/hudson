# HUD-009 — Drawing Documents and Animatable Targets

**Status**: Draft
**Owner**: TBD
**Targets**: Logo, Preframe, hudsonkit web
**Related**: HUD-007 (app controls), HUD-008 (app backends), HUD-010 (cache policies)

## Summary

Hudson should promote the new Logo drawing work into a reusable composition layer before it deepens into more Logo-only editor code. The right order is:

1. **Drawing layer first** — reusable document model, surface, SVG renderer, toolbar, inspector, persistence, and edit operations for shape components.
2. **Animatable layer second** — reusable timeline and keyframe model that targets drawing components, SVG nodes, and app-owned visual objects through a stable adapter.

The important design choice is composition, not inheritance. Logo should not become a base class for drawing apps, and Preframe should not know Logo internals. Apps should compose a drawing document layer where they need spatial editing, then optionally expose those drawing objects as animation targets.

## Why Now

Logo just gained a structured component layer:

- top-centered drawing tools
- rectangle, oval, line, and text components
- per-template persisted drawing state
- SVG output integration
- canvas selection and dragging
- inspector rows with visible, locked, delete, transform, style, and type-specific controls

That is the right user-facing direction, but the implementation currently sits inside `apps/web/app/apps/logo/*`. If the next pass adds resize handles, grouping, undo/redo, snapping, alignment, copy/paste, and animation hooks directly in Logo, Hudson will have another high-value editor system trapped inside one app.

Drawing is not Logo-specific. Theme Designer, Shaper, docs diagrams, workflow diagrams, whiteboards, and future icon/composition tools all want pieces of the same stack. Animation has the same pressure: Preframe wants timeline and playback primitives, while Logo wants to send real targets to Preframe without using fragile cross-app assumptions.

## Current State

Logo now has the first working vertical slice:

- `apps/web/app/apps/logo/types.ts` defines `LogoDrawingShape`, `LogoEditorTool`, and per-template shape maps.
- `apps/web/app/apps/logo/LogoProvider.tsx` owns tool state, selection, CRUD, persistence, and reset operations.
- `apps/web/app/apps/logo/TemplateSvg.tsx` appends structured components into the final SVG output.
- `apps/web/app/apps/logo/LogoInteractiveSurface.tsx` handles pointer drawing, hit testing, selection, dragging, keyboard moves, and delete.
- `apps/web/app/apps/logo/LogoContent.tsx` renders the centered drawing toolbar.
- `apps/web/app/apps/logo/LogoInspector.tsx` renders component rows and type-specific controls.

This is enough behavior to extract from, but not enough proof to promote directly to public hudsonkit API. The first extraction should stay inside the app repo, then graduate after a second app consumes it.

## Design Principles

1. **Composition over inheritance.** Apps opt into drawing and animation primitives by rendering providers/components and passing adapters.
2. **Document model first.** Spatial editing should be driven by a serializable document, not by DOM mutation.
3. **Renderer is swappable.** SVG is the first renderer. Canvas, HTML, and native renderers should remain possible.
4. **Targets are stable.** Animation addresses targets by stable IDs and capabilities, not app-specific component types.
5. **App state remains app-owned.** The shared layer owns drawing or animation documents; Logo still owns templates, lighting, wordmark, AI, exports, and brand concepts.
6. **Promote only after reuse.** Start in `apps/web/app/lib/drawing` or `apps/web/app/apps/logo/lib/drawing`; move to `hudsonkit` after a second app uses the same primitives.

## Drawing Layer

### Model

Create a reusable drawing document shape:

```ts
export type DrawingTool =
  | 'select'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'text'
  | 'path';

export interface DrawingNodeBase {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  x: number;
  y: number;
  rotate?: number;
  opacity?: number;
}

export type DrawingNode =
  | DrawingRectNode
  | DrawingEllipseNode
  | DrawingLineNode
  | DrawingTextNode
  | DrawingPathNode;

export interface DrawingDocument {
  id: string;
  version: 1;
  nodes: DrawingNode[];
  selection: string[];
  viewport?: DrawingViewportState;
  metadata?: Record<string, unknown>;
}
```

The model should include common fields now and leave room for paths/freehand later. Do not include Logo-specific fields like template ID, lighting, wordmark, or variant family. Logo can map `params.variant` to a `DrawingDocument.id` or store a `Record<templateId, DrawingDocument>`.

### Operations

Prefer a reducer-style command surface:

```ts
type DrawingAction =
  | { type: 'node/add'; node: DrawingNode }
  | { type: 'node/update'; id: string; patch: Partial<DrawingNode> }
  | { type: 'node/delete'; ids: string[] }
  | { type: 'node/reorder'; ids: string[]; toIndex: number }
  | { type: 'selection/set'; ids: string[] }
  | { type: 'document/reset' };
```

The reducer gives Hudson one place to add undo/redo, clipboard, grouping, and batch mutations without each app inventing local state logic.

### Surface

Create a reusable React surface that accepts a document plus callbacks:

```tsx
<DrawingSurface
  document={document}
  tool={tool}
  viewBox={{ x: 0, y: 0, width: 512, height: 512 }}
  size={512}
  onAction={dispatchDrawingAction}
  renderUnderlay={<LogoTemplateSvg />}
/>
```

The surface owns pointer interpretation, draw previews, hit testing, selection bounds, drag movement, keyboard nudges, delete, and eventually resize/rotate handles. It should not own app persistence.

### Toolbar

Create a reusable toolbar with configurable tool availability:

```tsx
<DrawingToolbar
  tool={tool}
  tools={['select', 'rect', 'ellipse', 'line', 'text']}
  selectedCount={document.selection.length}
  onToolChange={setTool}
  onDelete={() => dispatch({ type: 'node/delete', ids: document.selection })}
/>
```

Logo can place this in its current top-centered toolbar next to Light, Lighting, Wordmark, Sizes, Matrix, Animate, and AI controls. Other apps can render the same toolbar in their own chrome.

### Inspector

Create a reusable inspector section:

```tsx
<DrawingInspector
  document={document}
  onAction={dispatchDrawingAction}
/>
```

The inspector should provide:

- layer rows
- visibility toggle
- lock toggle
- delete
- name
- x/y
- rotation
- opacity
- width/height/radius for boxes
- fill/stroke/stroke width for shape nodes
- font family, weight, size, letter spacing, text, fill for text nodes

Hudson controls should be used where possible. Keep the inspector composable so Logo can render drawing controls above or below template params.

### Renderer

Keep SVG rendering as a reusable utility:

```ts
renderDrawingSvg(document, {
  dataAttribute: 'data-drawing-node-id',
});
```

Logo’s `TemplateSvg` should become:

```ts
const templateSvg = applyElementOffsets(svg, elementOffsets);
const drawingLayer = renderDrawingSvg(drawingDocument);
const finalSvg = appendLayer(templateSvg, drawingLayer);
```

SVG output must be deterministic and export-safe. Do not rely on runtime React nodes for final export.

## Animatable Layer

The animation layer should come after the drawing extraction, but the drawing model should be shaped so animation can target it cleanly.

### Targets

Define a minimal target adapter:

```ts
export interface AnimatableTarget {
  id: string;
  name: string;
  kind: 'drawing-node' | 'svg-node' | 'group' | 'app-object';
  capabilities: AnimatableCapability[];
  initial: AnimatableState;
}

export interface AnimatableState {
  x?: number;
  y?: number;
  scale?: number;
  rotate?: number;
  opacity?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
}
```

Drawing nodes can implement this directly. Logo template internals marked with `data-element-id` can be exposed as `svg-node` targets when measured. App-specific objects can implement an adapter without becoming drawing nodes.

### Animation Document

Preframe should own timeline documents:

```ts
export interface AnimationDocument {
  id: string;
  version: 1;
  durationMs: number;
  fps: number;
  targets: AnimatableTarget[];
  tracks: AnimationTrack[];
  metadata?: Record<string, unknown>;
}

export interface AnimationTrack {
  id: string;
  targetId: string;
  property: keyof AnimatableState;
  keyframes: AnimationKeyframe[];
}

export interface AnimationKeyframe {
  timeMs: number;
  value: number | string;
  easing?: string;
}
```

This is temporal state. It should not be mixed into `DrawingDocument`. A drawing document can be animated by an animation document, but it remains valid and editable without animation.

### Runtime

Reusable animation runtime:

- current time
- play, pause, seek
- loop mode
- interpolation
- easing
- target state resolution
- reduced-motion mode
- preview sampling

Preframe composes this runtime with its own catalog, render queue, export options, and AI generation. Logo should only package target data and open/send an animation document.

### UI

Reusable animation UI can follow after runtime:

- transport controls
- timeline ruler
- track list
- keyframe editor
- easing picker
- property inspector
- preset browser

This should start inside Preframe or `apps/web/app/lib/animation`, then move to `hudsonkit` after Logo or another app consumes the same primitives.

## Logo Migration Plan

### Phase 1 — Extract Drawing Internals

Move generic pieces out of Logo:

- `LogoDrawingShape` → `DrawingNode`
- `LogoEditorTool` → `DrawingTool`
- drawing CRUD callbacks → reducer/actions
- SVG drawing renderer → `renderDrawingSvg`
- component rows → `DrawingInspector`
- draw/select/move pointer logic → `DrawingSurface`

Logo keeps:

- template params
- template element offsets
- lighting
- light mode
- wordmark
- export
- AI editing
- matrix/picks
- brand/template lineage

### Phase 2 — Recompose Logo

Logo should supply adapters:

```tsx
<DrawingProvider
  documentId={params.variant}
  storageKey="logo.drawingDocuments"
>
  <DrawingToolbar />
  <DrawingSurface renderUnderlay={<TemplateSvg />} />
  <DrawingInspector />
</DrawingProvider>
```

The exact API can differ, but the dependency direction should not: drawing depends on generic shape state, Logo depends on drawing, and drawing does not import Logo.

### Phase 3 — Add Editor Fundamentals

Add the next drawing-tool features against the generic layer:

- undo/redo
- duplicate
- copy/paste
- multi-select
- reorder forward/backward
- grouping
- resize handles
- rotate handles
- grid snap
- centerline snap
- align/distribute
- color swatches
- shape presets
- path/freehand tool

Do not add these first as Logo-only features unless the behavior is genuinely Logo-specific.

### Phase 4 — Prove Reuse

Use the drawing layer in a second app before promoting to `hudsonkit`.

Good candidates:

- Shaper overlay annotations
- Theme Designer preview annotations
- a lightweight whiteboard/diagram app
- Preframe scene layout editor

Once two apps use it, promote stable APIs to:

```
packages/web/hudsonkit/src/drawing/
packages/web/hudsonkit/src/components/drawing/
```

## Preframe / Animation Migration Plan

### Phase 1 — Define Targets

Expose Logo drawing nodes and marked SVG nodes as `AnimatableTarget[]`.

Logo’s Animate action should send structured targets, not just a generic cross-app job:

```ts
dataBus.pushDirect('logo', 'animation-targets', 'preframe', {
  sourceAppId: 'logo',
  documentId: params.variant,
  targets,
});
```

This keeps the current data-bus route viable while removing the need for Preframe to infer Logo structure.

### Phase 2 — Preframe Consumes Animation Documents

Preframe should normalize incoming targets into an `AnimationDocument`, then let the timeline own motion state.

Logo can generate a starting document:

- fade in all nodes
- reveal line strokes
- scale/settle shapes
- slide wordmark
- stagger groups

Preframe owns further edits and rendering.

### Phase 3 — Backend Escalation

In-browser preview should require no backend. Server routes are only for escalation:

- mp4 compile
- GIF export
- render farm
- AI-authored animation programs
- long-running batch renders

When backend work is needed, follow HUD-008 under `/api/logo/animate/...` or `/api/preframe/...`, depending on which app owns the result.

## Public API Sketch

Initial local modules:

```
apps/web/app/lib/drawing/
  model.ts
  reducer.ts
  svg.ts
  DrawingProvider.tsx
  DrawingSurface.tsx
  DrawingToolbar.tsx
  DrawingInspector.tsx

apps/web/app/lib/animation/
  model.ts
  interpolate.ts
  runtime.ts
```

Future hudsonkit modules:

```
hudsonkit/drawing
hudsonkit/animation
hudsonkit/components/drawing
hudsonkit/components/animation
```

Do not create these public subpaths until reuse proves the API.

## Acceptance Criteria

HUD-009 is ready to implement when:

1. Logo’s current drawing behavior can be expressed through a generic drawing document.
2. Logo no longer imports drawing-specific business logic from `LogoInteractiveSurface`.
3. SVG exports include drawing nodes through a generic renderer.
4. The drawing toolbar and inspector are reusable components with app-level placement.
5. At least one second app can render and edit a drawing document without Logo imports.
6. Preframe can accept `AnimatableTarget[]` from Logo without knowing Logo template internals.
7. Animation documents are separate from drawing documents.

## Non-goals

- Replacing Shaper’s bezier editor in v1.
- Building a full Figma clone.
- Inventing a native cross-platform drawing engine before web reuse is proven.
- Moving drawing directly into hudsonkit before a second consumer exists.
- Making Preframe depend on Logo.
- Treating animation as fields embedded directly on drawing nodes.
- Adding durable render queues; those remain a backend/export concern.

## Open Questions

1. Should the first extraction live in `apps/web/app/lib/drawing` or `apps/web/app/apps/logo/lib/drawing`? Recommendation: `apps/web/app/lib/drawing`, because the intent is immediate reuse, but keep it private to the app repo.
2. Should drawing documents persist through `usePersistentState` only, or also through HUD-008 app storage? Recommendation: local state first; use app storage once documents become named assets.
3. Should template internals marked with `data-element-id` become drawing nodes? Recommendation: no. Keep template internals as `svg-node` targets/edit offsets; drawing nodes are user-created document components.
4. Should animation start in Logo or Preframe? Recommendation: Preframe owns timeline editing; Logo owns target packaging and preset generation.
5. Should `path/freehand` land before or after extraction? Recommendation: after extraction, so the new geometry type hardens the generic model instead of Logo-only logic.

## First Implementation Slice

1. Create `apps/web/app/lib/drawing/model.ts` and move the drawing node types.
2. Create `apps/web/app/lib/drawing/reducer.ts` and move CRUD/reset/selection logic into actions.
3. Create `apps/web/app/lib/drawing/svg.ts` and move `renderDrawingShape`/layer rendering from `TemplateSvg`.
4. Refactor Logo Provider to store `DrawingDocument` per template id.
5. Refactor `LogoInteractiveSurface` into a generic `DrawingSurface` plus Logo underlay.
6. Refactor the Logo toolbar to use `DrawingToolbar`.
7. Refactor the Logo inspector to use `DrawingInspector`.
8. Preserve current behavior: draw rect/oval/line/text, select, drag, hide, lock, delete, edit fields, export SVG.

The slice is successful if the UI behaves the same as the current Logo drawing tools, but the drawing code no longer imports Logo-specific types.
