# HUD-001 — Introduce `HudNavigationSidebar` alongside `HudNavigationRail`

- **Status:** Proposed
- **Date:** 2026-05-03
- **Supersedes:** N/A
- **Superseded by:** N/A

> ADR-001 is reserved for the original `HudAppShell` M3 design; this Docs/ directory is created by this ADR. Numbering preserves the future slot for ADR-001 to be backfilled.

> **Scope note.** An earlier draft of this ADR proposed replacing `HudNavigationRail` outright and bundled a macOS 26 platform raise + iOS drop. Both are deferred. This ADR is purely additive: the rail stays, the sidebar joins it, and the implementer picks per app. Platform-floor and iOS questions move to a separate ADR if and when they earn conviction on their own merits.

## Context

`HudNavigationRail` (`Sources/HudsonShell/HudNavigationRail.swift:33`) ships as a binary-state rail: `64pt` collapsed (icons only) ↔ `220pt` expanded (icons + labels). For icon-led, single-column chrome it works well — the per-row icon button has hover/focus/selection states wired to the manifest accent, instrumentation lands through `HudInstrumentation.ui`, reduce-motion is respected. Apps whose nav reads as "a stripe of icons" should keep using it.

What it does not cover well:

1. **Bounce-free width transitions.** `HudRailRow` reflows from a centered icon to a leading icon + trailing label inside the same `HStack`, so icons translate sideways during the width animation. The reliable fix is a **two-parallel-column** layout: a fixed-width rail that *never* moves, plus a label column whose **width** animates from `labelWidth → 0`. Icons cannot bounce because their x-position depends on nothing that animates. Talkie's prototype (`Sidebar.swift:6-27` in the Talkie repo) demonstrates this in production. This is a structural property of the layout, not a tuning fix on the existing rail.
2. **Type-safe selection.** The `Binding<String>` API (`HudNavigationRail.swift:34`) forces every consumer to either use stringly-typed enums or stringify a `Hashable` selection. Talkie, Scout, and Lattices all carry typed enums; the conversion shim is pure ceremony for those consumers.
3. **Hierarchical entries.** The rail's flat `[HudRailItem]` is correct for a stripe of equals. Apps with section headers ("System", "Library", etc.) currently fake them via spacer items or skip them.
4. **Mode-aware accents.** A "bottom accent bar under the icon" pattern is a stronger visual idiom for compact iconic chrome than the rail's current rounded-rect fill. It is meaningful enough to want, but not so wrong about the rail that the rail should be removed for not having it.

Both shapes are legitimate. The rail is the right answer for app-icon-stripe chrome; a sidebar with hierarchical entries and a bounce-free transition is the right answer for navigation-as-document-tree chrome. Hudson should offer both and let the app pick.

## Decision

Add a new component family in `HudsonShell` and supporting primitives in `HudsonUI`, leaving the existing rail untouched:

1. **New public types in `HudsonShell`:** `HudNavigationSidebar<Selection: Hashable, RailHeader, LabelHeader, Footer>`, `HudSidebarItem<Selection>`, `HudSidebarEntry<Selection>` (`.item` or `.section`), `HudSidebarTransition` (env value), `HudSidebarLayout` (token enum), `HudSidebarMotion` (token enum).
2. **New public types in `HudsonShell` for split layouts:** `HSplitView<Sidebar, Secondary, Detail>`, `HudSecondaryNav<Selection: Hashable, Item, Header, Footer>`. These are independent of the sidebar — apps that want a split layout with the existing rail in the leading slot can use `HSplitView` too.
3. **New public types in `HudsonUI`:** `HudSurface` (modifier + view), `HudSelectionUnderlay`, `HudResizableDivider`. `HudResizableDivider` is genuinely new — it does not replace the existing private `HudShellVRule` (which stays where it is, used by `HudAppShell`).
4. **Implementer chooses.** `HudAppShell`'s leading slot accepts any `View`. `HudNavigationRail`, `HudNavigationSidebar`, or anything custom all drop into the same slot. No internal change to `HudAppShell` is required for this ADR.
5. **Theming via existing patterns.** New components read brand from `@Environment(\.hudsonAppManifest)` (`HudsonUI/Manifest/HudAppManifest.swift:61-65`). Motion consumes `HudMotion.chromeSpring` (`HudsonUI/Tokens/HudMotion.swift:6`). Tokens stay per-domain — `HudSidebarLayout` is a new enum in the per-component-family pattern that `HudSpacing`/`HudLayout` already use. No unified `HudStyle` umbrella.
6. **Solid surface is default.** `HudSurface(style: .solid)` is the default; `.vibrant` is opt-in. Existing `HudPalette.chrome` is documented as solid-by-design (`HudPalette.swift:13-16`) — that comment stays the source of truth.
7. **Animations gated on reduce-motion.** All new components follow the existing pattern from `HudNavigationRail.swift:148-164` and `HudInspector.swift`: read `@Environment(\.accessibilityReduceMotion)` and either skip `withAnimation` or pass `nil` to `.animation(_:value:)` when reduced.
8. **Drag-resizable is opt-in per column.** `HSplitView` declares each column as `.locked`, `.snap(min:max:)`, or `.draggable(min:max:)`. The sidebar column is `.locked` to its intrinsic width (sized by `HudSidebarLayout.intrinsicWidth(progress:)`).
9. **Instrumentation via `HudInstrumentation.ui`.** New event/span names: `Sidebar.select`, `Sidebar.toggle`, `SecondaryNav.select`, `SplitView.collapse`, `SplitView.dragResize`, `Surface.measure`. Same `HudInstrumentation.ui.event(...)` / `HudInstrumentation.ui.span(...)` shape as the existing rail (`HudNavigationRail.swift:80-83`).
10. **`Sendable` + `public init` conventions match `HudRailItem`.** `HudSidebarItem<Selection>` is `Identifiable, Equatable, Sendable` when `Selection: Sendable`; `HudSidebarEntry<Selection>` is `Identifiable`. `public init` everywhere.

## Build order

Each commit compiles on its own and adds only:

1. `HudSurface` (HudsonUI primitive — no dependencies on other new code).
2. `HudResizableDivider` (HudsonUI primitive — independent of existing private `HudShellVRule`).
3. `HSplitView` (HudsonShell — depends on `HudResizableDivider`, `HudSurface`).
4. `HudSelectionUnderlay` (HudsonUI primitive — no deps on shell).
5. `HudNavigationSidebar` family (HudsonShell — depends on the above).
6. `HudSecondaryNav` (HudsonShell — depends on `HudSurface`, `HudSelectionUnderlay`).
7. Demo additions: a sidebar variant in `Demo/HudsonKitDemo/Tabs/ShellTab.swift` shown side-by-side with the existing rail variant.

No deletions. `HudNavigationRail`, `HudRailItem`, `HudShellVRule`, `HudAppShell`'s current internal layout — all unchanged.

## Consequences

### Breaking

None. This ADR is purely additive.

### Non-breaking but visible

- Two leading-slot components ship in the same release. Docs need a "choosing a leading-slot component" page that frames the trade-off honestly (rail = stripe of icons, sidebar = hierarchical entries with bounce-free transition) so consumers do not flip a coin.
- The demo grows a second variant. This is the cost of optionality; it should also serve as the comparison page.

### Net positive

- Type-safe sidebar selection is available for consumers who want it; the rail's `Binding<String>` stays for consumers who don't.
- The bounce-free transition is available where it matters; apps that don't care can stay on the rail.
- The new primitives (`HudSurface`, `HudResizableDivider`, `HudSelectionUnderlay`, `HSplitView`, `HudSecondaryNav`) are useful independent of the sidebar — they serve any app building richer chrome.
- No migration is forced on any consumer.

### Conviction triggers (when to revisit)

A future ADR would argue for replacement only if one of these holds:

- All new in-tree apps adopt the sidebar; the rail is unused for two release cycles.
- A concrete behavior the rail must support to remain viable cannot be added without a structural rewrite (e.g., bounce-free transition demanded as table-stakes).
- Maintenance cost of the rail provably exceeds the cost of a migration recipe for its remaining users.

Until one of those, both ship.

## Choosing a leading-slot component

| Use the **rail** when | Use the **sidebar** when |
|---|---|
| Nav is a flat list of 3–7 destinations | Nav is hierarchical or sectioned |
| You want the icons-only-by-default mode | You want a labeled column that can compact to icons without bounce |
| Selection is naturally identified by string | Selection is a typed enum |
| App is already wired to `Binding<String>` selection and doesn't need to change | You're starting fresh or already carry typed selection |
| You don't need section headers | You need section headers ("System", "Library", etc.) |

Both consume `HudAppManifest` for brand, both wire through `HudInstrumentation.ui`, both respect reduce-motion. Switching later is mechanical, not architectural.

## Opt-in migration — `HudNavigationRail` → `HudNavigationSidebar`

Provided for consumers who choose to switch; not required.

**Before:**

```swift
enum Section: String { case home, library, settings }
@State private var selection: String = Section.home.rawValue
@State private var navExpanded: Bool = true

let items: [HudRailItem] = [
    HudRailItem(id: Section.home.rawValue,    label: "Home",    icon: "house"),
    HudRailItem(id: Section.library.rawValue, label: "Library", icon: "rectangle.stack"),
    HudRailItem(id: Section.settings.rawValue, label: "Settings", icon: "gear"),
]

HudAppShell {
    HudNavigationRail(
        selection: $selection,
        items: items,
        isExpanded: $navExpanded
    ) {
        VariantPicker()
    }
} trailing: { ... } content: { ... } statusBar: { ... }
```

**After:**

```swift
enum Section: Hashable { case home, library, settings }
@State private var selection: Section? = .home
@State private var sidebarCompact: Bool = false

let entries: [HudSidebarEntry<Section>] = [
    .item(HudSidebarItem(id: .home,     title: "Home",     icon: "house",           selectedIcon: "house.fill")),
    .item(HudSidebarItem(id: .library,  title: "Library",  icon: "rectangle.stack", selectedIcon: "rectangle.stack.fill")),
    .section(id: "system", title: "System"),
    .item(HudSidebarItem(id: .settings, title: "Settings", icon: "gear",            selectedIcon: "gearshape.fill")),
]

HudAppShell {
    HudNavigationSidebar(
        selection: $selection,
        entries: entries,
        isCompact: $sidebarCompact,
        railHeader: { HudAppLogo() },
        labelHeader: { HudAppWordmark() },
        footer: { VariantPicker() }
    )
} trailing: { ... } content: { ... } statusBar: { ... }
```

### Key API deltas

- `selection: Binding<String>` → `selection: Binding<Selection?>` (`Selection: Hashable`).
- `items: [HudRailItem]` → `entries: [HudSidebarEntry<Selection>]` (entries are `.item` or `.section`).
- `isExpanded: Bool` flips polarity to `isCompact: Bool` (default `false` = expanded). Polarity matches the Talkie prototype and reads more naturally because compact is the activated state.
- The single hamburger button at the rail header is replaced with two header slots: `railHeader` (centered in the rail column) and `labelHeader` (left-anchored in the label column). Apps that want the old hamburger behavior pass a `Button` in `railHeader` that toggles `isCompact`.
- `HudRailItem(id:label:icon:)` → `HudSidebarItem(id:title:icon:selectedIcon:tooltipLabel:)`. The `selectedIcon` slot is what makes the SF Symbol fill on selection.

## Rejected alternatives

- **Replace `HudNavigationRail` outright in this ADR.** Rejected: the rail is a working, instrumented, theme-wired component covering a real shape (icon stripe). Removing it before the sidebar earns conviction is a one-way decision made on aesthetic grounds. The bar for removal is usage data and migration evidence, not preference.
- **Bundle a macOS 26 platform raise and iOS drop into this ADR.** Rejected: those are independent decisions and were only justified earlier as "we need them to do the sidebar without `@available` ladders." Since the sidebar can ship on the existing platform floor (with `@available` where needed), the platform raise is not required by this ADR. If those decisions earn conviction on their own merits, they get their own ADR.
- **Keep the rail but add the sidebar's features to it (sections, typed selection, two-column layout) in place.** Rejected: those features change the rail's shape enough that consumers would either need a versioned API or the rail would grow into "two components in one type." Cleaner to ship as a sibling.
- **Make `Selection` non-generic but typed (e.g., `AnyHashable`).** Rejected: `AnyHashable` reintroduces conversion ceremony at the call site and removes type-safety from the binding setter. Generics are the right hammer; SwiftUI `NavigationSplitView` itself is generic over selection.
- **Make the sidebar width binding-driven progress (0…1) rather than boolean compact.** Considered, partially adopted: the `isCompact` boolean is the public contract because it is what apps persist; the `progress: Double` is internal to `HudSidebarTransition` and only exposed to advanced consumers via `\.hudsonSidebarTransition` for design-tool scrub.

## Implementation reference

The full implementation plan, public API surfaces, file structure, internal helpers, demo updates, test plan, and PR sequencing live in the consumer-side design doc:

- `talkie:docs/planning/2026-05-03-hudsonkit-sidebar-replacement.md` (sections 2–11)

That document predates this ADR's scope reduction and still describes a replacement-shaped PR; for this ADR, treat its **additive** sections (new types, build order steps 1–6) as canonical and ignore the rail-removal, demo-replacement, and platform-raise sections. Those revert to a future ADR.
