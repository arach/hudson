# Hudson Terminal Grid System – Evolutionary Design Spec

## 1. Context & Use Case (from Scout macOS native terminals)

Scout's native terminal feature (enabled via HUDSONKIT_WITH_TERMINAL) hosts multiple independent PTY terminals (via Termini + HudsonTerminal) inside a single view using HudsonKit's `HudTiling`.

Goals for this use case:
- Support "many" terminals (8–20+) without forcing cramped fixed layouts like 2x2.
- Users control the grid "shape" explicitly via cols/rows pickers (0 = auto).
- Comfortable cell sizes are preserved (target ~360×240) → use virtual sizing + scrolling instead of shrinking everything.
- Horizontal scrolling for "N by K" layouts (e.g. 2 rows + 8 cols = wide strip you scroll left/right).
- Optional per-terminal headers (title bar with status, restart, close) vs full-bleed.
- Live resizable bespoke layouts: drag edges/corners to adjust column widths or row heights; per-tile overrides that persist.
- Drag-to-reorder with nice previews (clear background ghost + dim, not full mask).
- Quick operations: "split column" / "add row", keyboard or button driven.
- Stable, high-speed add of new shells (no double-adds, no loss of existing, no crashes).
- Pixel-perfect (no subpixel clipping on buttons, borders, grips).
- Integration points: PTY focus, hover states, loading states, error states.
- Long-term: multiple independent "contexts" or "workspaces" (each a self-contained tiled grid) rather than one ever-growing canvas.
- Performance & feel: smooth 60fps drags/resizes, good momentum on scroll, discoverable affordances.

Current Scout integration lives in:
- `apps/macos/Sources/Scout/ScoutTerminalEmbedView.swift` (ScoutNativeTerminalContent, terminalBody GeometryReader + ScrollView wrapper, model, tile view with optional header).
- It passes `TilingConstraints(maxColumns, maxRows, gap, min sizes, fillStrategy: .maximize, alignLastRow: .stretch, ...)`.
- Uses target cell sizing to compute `virtualW`/`virtualH`, `inner` sizes, then `.frame` + padding + `.fixedSize` + `.scrollIndicators(.visible)`.
- Edge chevrons for "more content" awareness.
- Separate "New shell" mode (plain shell vs tmux).

See also the design exploration prototype:
- `apps/macos/docs/terminal-grid-navigation.html` (interactive mock of virtual sizing, shape controls, scrolling, hints, early workspace tabs ideas).

The primitive that does the heavy lifting is in HudsonKit.

## 2. Current Hudson State (as of now)

Primary files:
- `packages/native/apple/HudsonKit/Sources/HudsonUI/Primitives/HudTiling.swift`
- `HudGridBackground.swift` (supporting)

Key types (abridged):

```swift
public struct TilingConstraints: Sendable, Equatable {
    public var maxColumns: Int?
    public var maxRows: Int?
    public var gap: CGFloat = HudSpacing.md
    public var maxItemWidth: CGFloat?
    public var maxItemHeight: CGFloat?
    public var minItemWidth: CGFloat = 120
    public var minItemHeight: CGFloat = 80
    public var maxFill: CGFloat = 1.0
    public var fillStrategy: FillStrategy = .maximize   // .maximize | .even | .compact
    public var alignLastRow: AlignLastRow = .start      // .start | .center | .stretch
    public var preferMoreColumns: Bool = true
}

public func computeTilingLayout(...) -> [TileLayout]
```

HudTiling (SwiftUI) → HudTilingRepresentable (macOS) → HudTilingView (NSView):
- Maintains `order`, `customSizes: [ID: CGSize]`
- Live edge resize with group shift (same-x or same-y items move together).
- Drag reorder with ghost preview (dim + clear background).
- Relayout uses either uniform base + customs, or derived col/row sizes.
- Pixel-aligned frames.
- Respects maxColumns / maxRows as hard caps.

Strengths: quite good low-level layout + interaction primitive.
Weaknesses exposed by terminals: 
- Logic for "number of cols/rows" is mostly constraint caps + auto heuristics.
- No first-class "split column here" or "add row" API/gesture.
- Custom sizes are per-item; deriving stable colWidths/rowHeights for UI controls is tricky on Scout side.
- Single grid instance scales to "one big virtual canvas" but not obviously to "multiple independent pages".
- ScrollView integration, virtual sizing, and "comfortable cell" preservation live entirely on the consumer (Scout).

## 3. Evolutionary Vision (phased, pragmatic)

We want a **robust system** that starts simple and grows with the use case without breaking existing consumers or turning into a 10k-line monolith.

**Phase 0 / Today (stabilize)**
- Solid maxColumns / maxRows as first-class, with clear semantics (hard cap on shape).
- Good scrolling story when virtual size > viewport (bidirectional).
- Reliable bespoke per-split resize (col widths + row heights) with persistence.
- Visual "more content" affordances live on consumer or provided as helper.

**Phase 1 (quick wins for terminals)**
- Explicit column/row management:
  - API to set / query number of logical columns and rows.
  - "Split" operations: insert column at index, insert row.
  - Perhaps `addColumn()`, `addRow()`, `removeColumn(at:)`.
- Better resize model:
  - First-class `colWidths: [CGFloat]`, `rowHeights: [CGFloat]` (or proportional).
  - Or a `ColumnSpec` / `RowSpec` type (fixed, proportional, min/max).
  - Live group resize + proportional redistribution.
- Improved layout computation that can return both item rects **and** the derived column/row geometry for UI (sliders, splitters, labels).

**Phase 2 (multiple contexts / workspaces)**
- Easy composition of several independent grids ("pages", "workspaces", "sessions of terminals").
- A higher-level type perhaps: `HudGridWorkspace` or `HudTilingWorkspace` that manages a collection of named/ordered sub-grids, each with its own items + constraints.
- Navigation between workspaces (tabs, strip, command palette) can live in consumer (Scout) or have light helpers.
- Each workspace remains a "rigid grid that maximizes space" rather than one ever-growing canvas.
- Drag between workspaces? (future).

**Phase 3 (guided canvas / advanced)**
- Optional "smart" remapping, minimap, zoom levels, snap-to-grid, guided panning.
- Only if the low-level primitives stay clean.
- "Canvas mode" as a presentation layer on top of the same layout engine, not a fork.

**Guiding principles**
- Low-level primitive (HudTiling + computeTilingLayout) stays powerful, testable, and not tied to terminals.
- Higher-level conveniences (workspace manager, split buttons, header integration) can be in HudsonUI or left to consumer.
- Consumers (Scout) should be able to express "I want a 3-col by 2-row grid with these custom widths, scroll if needed, live resize columns" declaratively.
- Performance: 30+ items, smooth resize/drag, no layout thrash on every mouse move.
- Discoverability & feel: quick split (button/gesture/double-click edge), clear affordances ("+ column here"), no clipping of important UI (close buttons, grips).
- Persistence: easy to save/restore bespoke col/row sizes + order per workspace.
- Evolution path: old `maxColumns`/`maxRows` + item customSizes must continue to work or have a clear migration.

## 4. Concrete Things to Explore & Propose

Please analyze current `HudTiling.swift`, `TilingConstraints`, `computeTilingLayout`, the resize/drag logic, and the relayout in `HudTilingView`.

Then produce:

A. **Design document** (in docs/ or a new PR description) covering:
   - Current limitations for the terminal grid use case.
   - Phased API & type changes (additive where possible).
   - Proposed new public surface (e.g.):
     ```swift
     // ideas – feel free to improve
     public struct GridSpec {
         public var columns: [ColumnSpec]   // e.g. .proportional(1), .fixed(360), .min(300)
         public var rows: [RowSpec]
         public var gap: CGFloat
     }
     public enum ColumnSpec { case proportional(CGFloat), fixed(CGFloat), min(CGFloat, max: CGFloat?) ... }
     // or keep array of widths + strategy

     extension TilingConstraints {
         public var columnSpecs: [ColumnSpec]?
         public var rowSpecs: [RowSpec]?
     }

     // Operations on a tiling controller / view
     func insertColumn(at index: Int, spec: ColumnSpec)
     func removeColumn(at index: Int)
     func resizeColumn(at index: Int, by delta: CGFloat, mode: ResizeMode) // live vs commit
     ```

   - How `computeTilingLayout` should evolve or be augmented (return `GridGeometry` with col starts/widths + item layouts).
   - Handling of "maxColumns / maxRows" vs explicit specs (coexistence rules).
   - Multi-workspace story at the primitive level vs composition level.
   - Gesture / interaction primitives: edge hit testing for splits, double-tap to split, etc. (or keep in consumer + expose hit-test helpers).
   - Scroll vs fit strategies when number of items grows.
   - Headers / full-bleed: does anything need to change in the primitive, or is it purely consumer (as today with conditional titleBar + clip)?

B. **Concrete next steps** for Hudson:
   - Prioritized list of changes (smallest valuable first).
   - Any new files (e.g. `HudGridGeometry.swift`, `GridSpec.swift`).
   - Example usage snippets for the Scout terminal case.
   - Backward compatibility story.
   - Test / demo ideas (reference the existing PrimitivesTab or the Scout integration).

C. **Longer-term thoughts**:
   - What a `HudTilingWorkspace` or similar higher-level component might look like.
   - How to expose "quick split" in a way that works for terminals but is reusable (e.g. for image grids, chat panes, etc.).
   - Integration with other Hudson primitives (HudDivider? resizers?).

D. **Questions to answer**:
   - Should bespoke sizes stay purely per-item, or should we canonicalize on per-column / per-row specs?
   - How do we make "number of columns" a first-class mutable thing that items flow into, rather than just a cap?
   - Where does the "virtual size for scrolling" logic live ideally (Hudson helper? or documented pattern for consumers)?
   - Any constraints on the primitive coming from other current/future Hudson consumers?

## 5. References & Starting Points

- HudsonKit source (focus):
  - `packages/native/apple/HudsonKit/Sources/HudsonUI/Primitives/HudTiling.swift`
  - Related tokens: HudSpacing, HudRadius, etc.
  - Any existing grid examples or tests.

- Scout integration (use case driver):
  - `apps/macos/Sources/Scout/ScoutTerminalEmbedView.swift` (especially `terminalBody`, `ScoutNativeTerminalContent`, constraints passed to HudTiling, tile view, addLocalShell logic).
  - Model for multiple PTYs, showHeaders toggle, maxColumns / maxRows @AppStorage.

- Design exploration (visual language):
  - `apps/macos/docs/terminal-grid-navigation.html` (interactive mock – cols/rows, virtual cells, scrolling, hints, early workspace tabs, zoom/fit ideas).

- Product posture notes (for context):
  - Keep things pragmatic for high-trust local dev use. Not enterprise multi-tenant yet.
  - Prefer explicit routing / shape metadata.

Please start by reproducing / understanding the current Scout terminal grid behavior (you may need to build with HUDSONKIT_WITH_TERMINAL=1 in the openscout tree).

Then deliver the design + proposed code changes / diffs (even if illustrative).

Focus on making the foundation in Hudson solid so Scout (and future consumers) can build nice experiences on top without fighting the primitive.

Thanks! Report back with the doc + any immediate small changes we can land, plus questions.
