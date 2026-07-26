# Proposal: Unified Resizable Navigation Sidebar

**Status:** Accepted and implemented

**Owner:** HudsonShell
**Consumers:** SpeakEasy, HudsonKitDemo, HudsonCanvasSurface, future native Hudson apps

The proposed API shipped as written. See [Implementation record](#implementation-record)
for the refinements made during implementation and the one caveat consumers
need to know about.

## Summary

Hudson currently exposes `HudNavigationSidebar` and
`HudResizableNavigationSidebar` as separate public component types. That makes
resizing appear to be a different kind of sidebar even though it is only an
interaction and persistence behavior around the same navigation structure.

Unify the public API around `HudNavigationSidebar`. Consumers should construct
one sidebar and opt into resizing through a binding-based modifier or equivalent
configuration. Preserve source compatibility for existing users of
`HudResizableNavigationSidebar` during a deprecation window.

## Problem

The current API forces application code to choose between two types:

```swift
HudNavigationSidebar(..., isCompact: false, labelWidth: 156)

HudResizableNavigationSidebar(
    ...,
    isCompact: $isCompact,
    labelWidth: $labelWidth
)
```

This causes several problems:

- Resizing is modeled as component identity instead of behavior.
- Consumers must discover a second type to add a normal sidebar capability.
- Switching from fixed to resizable requires rewriting the construction site.
- Header, footer, styling, instrumentation, and selection behavior risk drifting
  between the two entry points.
- Framework consumers cannot infer which type is canonical.

## Goals

1. Make `HudNavigationSidebar` the only canonical public component name.
2. Let consumers opt into resizing with `Binding<Bool>` compact state and
   `Binding<CGFloat>` label width.
3. Retain fixed-width, boolean compact, and progress-scrubbing APIs.
4. Preserve the fixed icon rail and bounce-free label-column behavior.
5. Preserve drag resizing, drag-to-collapse, drag-to-expand, double-click
   toggling, preview edge, cursor behavior, reduced-motion support, and resize
   phase callbacks.
6. Provide a source-compatible migration path for
   `HudResizableNavigationSidebar`.
7. Make persisted width straightforward but storage-agnostic: Hudson owns the
   binding contract; applications choose `@AppStorage`, a model, or another
   persistence layer.

## Non-goals

- Hudson will not persist widths internally.
- This change does not redesign sidebar visuals, entries, or selection styles.
- This change does not make the provider sub-navigation inside SpeakEasy
  resizable.
- This change does not remove progress-driven sidebar animation used by demos
  and design tooling.

## Proposed public API for review

The preferred SwiftUI shape is one component plus a behavior modifier:

```swift
HudNavigationSidebar(
    selection: $selection,
    entries: entries,
    isCompact: isCompact,
    accent: accent,
    railHeader: { AppMark() },
    labelHeader: { Text("SpeakEasy") },
    footer: { SidebarFooter() }
)
.resizable(
    isCompact: $isCompact,
    labelWidth: $labelWidth,
    minLabelWidth: 120,
    maxLabelWidth: 280,
    collapseLabelWidth: 44,
    activationDistance: 6,
    onResizePhaseChange: { isResizing in ... }
)
```

Required modifier signature:

```swift
public extension HudNavigationSidebar {
    func resizable(
        isCompact: Binding<Bool>,
        labelWidth: Binding<CGFloat>,
        minLabelWidth: CGFloat = 100,
        maxLabelWidth: CGFloat = 360,
        collapseLabelWidth: CGFloat = 44,
        activationDistance: CGFloat = 6,
        leadingInset: CGFloat = HudSidebarLayout.leadingInset,
        onResizePhaseChange: @escaping (Bool) -> Void = { _ in }
    ) -> some View
}
```

An internal configuration-based implementation is acceptable if it produces the
same call-site semantics. Do not require consumers to mention a second sidebar
type.

## Behavior contract

### Expanded resizing

- Dragging the trailing edge previews label-column width without moving icons.
- Preview width clamps to `0...maxLabelWidth`.
- Committed width clamps to `minLabelWidth...maxLabelWidth`.
- Crossing `collapseLabelWidth` while dragging left collapses the sidebar.
- The last usable expanded width remains available for re-expansion.

### Compact expansion

- Dragging right from compact expands once the activation threshold is crossed.
- Expanded width is at least `minLabelWidth`.
- Clicking or double-clicking the edge keeps the existing toggle behavior.

### State and persistence

- `isCompact` and `labelWidth` are caller-owned bindings.
- Every committed resize writes through `labelWidth`.
- Every collapse/expand writes through `isCompact`.
- No `UserDefaults` keys are defined by Hudson.

### Accessibility and motion

- The resize handle remains keyboard/accessibility discoverable where supported.
- Reduced Motion suppresses expand/collapse animation and resize decoration
  animation.
- Existing selection and hover accessibility values remain unchanged.

## Architecture

There must be one rendering path for the sidebar contents. The resizable host may
remain an internal implementation detail, but it must not be a peer public
component that applications choose directly.

Recommended organization:

```text
HudNavigationSidebar                 public canonical component
  ├─ fixed/progress initializers     existing behavior
  └─ .resizable(...)                 public behavior opt-in
       └─ internal resize host       edge gesture and binding coordination
            └─ HudNavigationSidebar  same core rendering path
```

Avoid copying header, footer, entry, selection, style, or instrumentation logic
into the resizing layer.

## Compatibility and migration

1. Keep `HudResizableNavigationSidebar` for one compatibility cycle.
2. Mark it deprecated with a fix-it message directing consumers to
   `HudNavigationSidebar.resizable(isCompact:labelWidth:)`.
3. Implement it as compatibility sugar over the same internal resize host.
4. Migrate all Hudson-owned call sites:
   - `HudsonKitDemo`
   - `HudCanvasSurface`
   - reference/example apps
5. Update documentation and demo copy so only `HudNavigationSidebar` is taught.
6. Remove the deprecated symbol only in a major version or explicitly approved
   breaking release.

## SpeakEasy adoption contract

SpeakEasy should use the canonical component and persist only the expanded label
width:

```swift
@AppStorage("settingsSidebarLabelWidth") private var labelWidth = 156.0
@State private var isCompact = false
```

Recommended settings window bounds:

- minimum label width: `120`
- maximum label width: `280`
- collapse label width: `44`
- initial label width: `156`

The secondary provider master column remains fixed at approximately `236–240`
points. Only the primary application sidebar resizes.

## Testing

Add focused tests for the extracted resize state/geometry logic rather than
trying to unit-test raw drag gestures only.

Required cases:

1. Committed widths clamp to min/max.
2. Preview widths allow values below the committed minimum down to zero.
3. Expanded drag below collapse threshold produces compact state.
4. Compact drag right produces expanded state and a valid minimum width.
5. Resize phase callback transitions `false → true → false` once per gesture.
6. Reduced-motion mode changes state without animation-dependent behavior.
7. Fixed/progress initializers retain their existing geometry.
8. Deprecated `HudResizableNavigationSidebar` still compiles during the
   compatibility window.

## Documentation and demo

- Update the sidebar demo to show fixed, compact, and resizable behavior as modes
  of `HudNavigationSidebar`.
- Replace prose that calls the resizable form a wrapper or separate host.
- Add a concise persistence example using `@AppStorage` while stating that
  persistence is application-owned.

## Acceptance criteria

- [x] New application code uses only the name `HudNavigationSidebar`.
- [x] A resizable sidebar is enabled without rebuilding the call site around a
      second component type.
- [x] All current resizing interactions and visual feedback remain intact.
- [x] Fixed icon positions do not move during resizing or collapse animation.
- [x] Hudson-owned call sites no longer instantiate
      `HudResizableNavigationSidebar`.
- [x] The deprecated compatibility API still builds.
- [x] HudsonShell and relevant integration tests pass.
- [x] SpeakEasy can adopt the API with `@AppStorage` width persistence and no
      app-owned resize gesture code.

## Implementation record

### Files

| File | Role |
|---|---|
| `HudsonShell/HudSidebarResizeGeometry.swift` | New. Pure resize math — clamping, activation, drag geometry, outcomes. |
| `HudsonShell/HudNavigationSidebar+Resizable.swift` | New. Canonical `.resizable(...)` modifier, internal `HudSidebarResizeHost`, edge handle. |
| `HudsonShell/HudResizableNavigationSidebar.swift` | Reduced to a deprecated shim over the same host. |
| `HudsonShell/HudSidebarMotion.swift` | Added `expandCollapse(reduceMotion:)`. |
| `HudsonCanvasSurface/HudCanvasSurface.swift` | Migrated to `.resizable(...)`. |
| `Demo/HudsonKitDemo/ContentView.swift` | Migrated to `.resizable(...)`. |
| `Demo/HudsonKitDemo/Tabs/SidebarTab.swift` | Scrub / compact / resizable shown as modes of one component. |
| `Tests/HudsonShellTests/HudSidebarResizeGeometryTests.swift` | Geometry + fixed/progress width contract. |
| `Tests/HudsonShellTests/HudSidebarResizeCompatibilityTests.swift` | Deprecation-window and canonical-API compile guards. |

### Refinements to the proposed design

1. **Architecture inverted.** The exploratory work had `.resizable(...)` build the
   deprecated `HudResizableNavigationSidebar`, which put a deprecated public type
   on the canonical path and warned inside HudsonShell itself. The resize host is
   now internal (`HudSidebarResizeHost`); both the modifier and the deprecated
   shim delegate to it. There is exactly one rendering path and one gesture
   implementation.
2. **Resize math extracted.** `HudSidebarResizeGeometry` is a plain value type
   holding every width decision, so the behavior contract above is unit-tested
   directly rather than through simulated drags.
3. **`onHeaderTap` composed rather than overwritten.** The host previously forced
   the header tap to toggle compact state. A handler supplied at construction now
   wins; the toggle remains the default when none was supplied, so existing
   behavior is unchanged.
4. **Inverted width ranges normalize.** `maxLabelWidth` below `minLabelWidth` used
   to make every committed width snap to the maximum, stranding the sidebar below
   its own minimum. The geometry now raises the maximum to the minimum.
5. **Reduce Motion routed through a token.** `HudSidebarMotion.expandCollapse(reduceMotion:)`
   replaces an inline branch, which makes requirement 6 testable.
6. **Accessibility upgraded.** The edge handle was labelled but had no activation
   path. It now exposes a named toggle action and an adjustable action that steps
   the width by 16pt and crosses the collapse/expand boundary the same way a drag
   would.

### Caveat for consumers

`.resizable(...)` is a method on `HudNavigationSidebar`, not a `View` extension,
so it must be applied directly to the sidebar expression — before anything that
erases the concrete type. `.environment(\.hudsonSidebarStyle, ...)` and `.frame(...)`
go *after* `.resizable(...)`. Storing the sidebar in a `some View` helper and
calling `.resizable(...)` on the result does not compile; use a local `let` (see
`SidebarTab.swift`). Also do not clip the result — the edge handle straddles the
trailing edge.

### Not covered by unit tests

Requirement 5 (resize phase callback transitions `false → true → false` once per
gesture) lives in SwiftUI `@State` inside the host and edge handle. The geometry's
activation rules are tested, but the once-per-gesture guarantee itself is verified
by inspection and the demo's live `Resizing` readout, not by a unit test.
