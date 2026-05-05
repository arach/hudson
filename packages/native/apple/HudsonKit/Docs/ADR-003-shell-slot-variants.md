# ADR-003 — Init-time variants for `HudAppShell` slots

- **Status:** Proposed
- **Date:** 2026-05-03
- **Supersedes:** N/A
- **Superseded by:** N/A
- **Depends on:** ADR-002 (`HudNavigationSidebar` alongside `HudNavigationRail`) — provides the second leading-slot implementation that motivates this principle.

## Context

`HudAppShell` exposes its chrome through a six-slot ViewBuilder API: `leading`, `trailing`, `topDrawer`, `bottomDrawer`, `content`, `statusBar`. The slots are intentionally open — any `View` is valid. This is correct for power: an app can put anything in any slot, including custom-designed chrome, and the shell stays out of the way.

It is also a discovery problem.

When ADR-002 introduced `HudNavigationSidebar`, the leading slot quietly grew from "one canonical implementation" to two. Nothing in the type system or the docs surfaces this — a new consumer reading the `leading: () -> some View` signature has no way to know whether they should reach for `HudNavigationRail`, `HudNavigationSidebar`, both, or hand-roll their own. The same pattern will recur as more slot implementations land: a bottom drawer that's a terminal vs. a console vs. a notifications shelf, a status bar that's minimal vs. a live-metrics ribbon, a takeover that's a sheet vs. a full-screen blow.

The "open slot" pattern *is* the right floor — taking it away would gut Hudson's flexibility — but it leaves a gap above it. Most consumers don't want maximum flexibility; they want a paved path with one obvious choice and an escape hatch when they need to leave the path.

## Decision

Add a parallel **variant enum** for each shell slot. Variants are first-class, named, defaulted, and discoverable. The open ViewBuilder slot stays as the escape hatch.

Three layers of indirection are available simultaneously, each more opinionated than the next:

1. **Default-configured shell.** `HudAppShell()` with no leading-nav config picks a sensible default (`.rail`) for backward compatibility with the current chrome.
2. **Variant-driven slot.** `HudAppShell(leading: .sidebar(entries: …, selection: $sel, progress: $progress))` — the consumer states intent in terms the design system understands; the shell renders the right component with consistent theming and instrumentation.
3. **Open ViewBuilder slot.** `HudAppShell { CustomLeadingNav() } content: { … }` — current behavior preserved verbatim, escape hatch for bespoke chrome.

The variant enum and the open slot are not mutually exclusive — they coexist. Consumers reach for whichever fits the job.

### Variant enums in scope (initial set)

| Slot | Variants | Notes |
|---|---|---|
| `leading` | `.rail(items:selection:isExpanded:)`, `.sidebar(entries:selection:progress:)`, `.minimal`, `.none` | Two existing implementations + a stripped icon-only future variant + opt-out |
| `trailing` | `.inspector(content:)`, `.metadata(items:)`, `.none` | `.metadata` is a future low-key alternative when the inspector is overkill |
| `topDrawer` | `.commandSuggestions`, `.activity`, `.none` | Mostly empty today; variant slot reserves the future surface |
| `bottomDrawer` | `.terminal(host:)`, `.console`, `.notifications`, `.none` | `HudTerminalDrawer` migrates to `.terminal` |
| `statusBar` | `.minimal`, `.live(metrics:)`, `.path`, `.none` | Apps currently roll their own; variants give shared shapes |
| `takeover` | `.fullScreen(content:)`, `.sheet(content:)`, `.inspectorBlow(content:)` | Different presentations of the same intent |
| **Terminal provider** *(runtime, not UI)* | `.embedded(TermBridgeKit)`, `.ssh`, `.local`, `.mock` | Currently gated by `HUDSONKIT_WITH_TERMINAL=1`; the variant enum surfaces the choice without the build flag |

Each variant case carries its own input spec — there is no unified "lowest common denominator" type that strips features. A `.sidebar` variant accepts everything `HudNavigationSidebar` needs; a `.rail` variant accepts everything `HudNavigationRail` needs. The enum is a *typed disjoint union*, not a *common subset*.

### `HudShellConfig`

For consumers who want to compose multiple slot configurations at once (or to drive the chrome from a single source like `@AppStorage` or a feature flag service), wrap the per-slot variants in a `HudShellConfig` struct:

```swift
public struct HudShellConfig {
    public var leading: HudLeadingNavVariant
    public var trailing: HudTrailingVariant
    public var topDrawer: HudTopDrawerVariant
    public var bottomDrawer: HudBottomDrawerVariant
    public var statusBar: HudStatusBarVariant
    public var takeover: HudTakeoverVariant
}

HudAppShell(config: $appConfig) { content }
```

`HudShellConfig` defaults all slots to sensible values, so a partial assignment works:

```swift
HudShellConfig {
    $0.leading = .sidebar(...)
    $0.bottomDrawer = .terminal(host: "arach-laptop")
}
```

### Where the variant choice comes from

Init-time as a runtime parameter is the **strict superset** of all the alternatives, so that's the contract. Anything more rigid can drive into it:

- **Build flag:** `#if HUDSON_USE_SIDEBAR` selects the variant the consumer hardcodes
- **Compile-time type:** generic param feeds the variant
- **Init param:** consumer passes a value
- **Environment:** `.environment(\.hudsonShellConfig, ...)` overrides for a subtree
- **User pref:** `@AppStorage("hudson.leading")` is read into the variant at init

All five mechanisms compose into the same runtime parameter. No new mechanism needed in HudsonKit — consumers wire whichever they want.

## Consequences

### Breaking

None. The current open-slot ViewBuilder API on `HudAppShell` is preserved unchanged. The variant init forms are *additive*.

### Non-breaking but visible

- A new init form on `HudAppShell` taking `HudShellConfig`. The existing init forms stay.
- New public types: one variant enum per slot + `HudShellConfig`.
- Deprecating-by-convention: as variants prove out, the docs nudge consumers toward variant-form for paved-path cases. No warnings on the open slot — it remains a first-class escape hatch.
- Demo grows a "Variants" tab that exercises the principle (see Build order step 3).

### Net positive

- New consumers reading `HudAppShell`'s docs see the menu of available chromes immediately, not buried in component-by-component discovery.
- IDE autocomplete on a variant enum is a navigable surface in a way that "any View" isn't.
- One-line chrome reconfiguration becomes possible (`config.leading = .sidebar(...)`), which unlocks user-facing settings that swap chrome live.
- Telemetry can measure which variants consumers actually pick — informs which to invest in and which to deprecate.
- Future slot implementations have a natural home (add a case) instead of an unbounded surface (add a docs example).

## Build order

Incremental rollout — each phase ships in its own PR, consumers can adopt at their own pace:

1. **Phase 1 — Leading nav variants** (smallest, most pressure, two real implementations exist already)
   - `HudLeadingNavVariant` enum: `.rail`, `.sidebar`, `.custom(AnyView)`, `.none`
   - `HudAppShell` init overload: `HudAppShell(leadingNav: HudLeadingNavVariant, ...)`
   - Demo update: add a leading-nav picker in the existing Sidebar tab so `HudsonKitDemo`'s own chrome can flip live.

2. **Phase 2 — Status bar variants**
   - `HudStatusBarVariant`: `.minimal`, `.live(metrics:)`, `.path`, `.custom(AnyView)`, `.none`
   - `HudAppShell` init overload accepts the variant
   - Three of these (`.live`, `.path`) are net-new implementations to land in this phase.

3. **Phase 3 — Drawer + terminal provider variants**
   - `HudBottomDrawerVariant`: `.terminal(host:)`, `.console`, `.notifications`, `.custom(AnyView)`, `.none`
   - `HudTopDrawerVariant`: `.commandSuggestions`, `.activity`, `.custom(AnyView)`, `.none`
   - Migrate `HudTerminalDrawer` to be the canonical `.terminal` implementation
   - Terminal provider variant (`.embedded`, `.ssh`, `.local`, `.mock`) — separate from the drawer variant; the drawer is *what slot it lives in*, the provider is *what runtime drives it*.

4. **Phase 4 — `HudShellConfig` umbrella + Variants demo tab**
   - `HudShellConfig` struct composes all per-slot variants
   - New `Variants` demo tab with one picker per slot, demonstrating live reconfiguration of a single `HudAppShell` instance
   - The demo tab is the case study artifact: looking at the same shell wear three different leading navs in three seconds is more convincing than any prose.

5. **Phase 5 — Trailing + takeover variants**
   - Lower priority because the existing implementations are sufficient for current consumers; ship when a second implementation justifies the variant enum.

Each phase is independently shippable and independently deprecatable.

## Rejected alternatives

- **Replace open ViewBuilder slots with variants only.** Rejected: gives up Hudson's flexibility for the long tail of bespoke chrome. The escape hatch is load-bearing — without it, every novel UI need becomes a feature request on the design system.

- **Build-flag (`#if`) chrome selection.** Rejected as the *only* mechanism: doesn't compose, doesn't allow per-instance variation, painful to test multiple variants in one binary. Acceptable as a *driver* of the runtime parameter but not as a substitute for it.

- **Generic-over-leading-nav (`HudAppShell<Nav: HudLeadingNavStyle>`).** Rejected: requires designing a protocol that abstracts over genuinely different APIs (`Binding<String>` rail vs. `Binding<Selection?>` sidebar). The protocol either becomes a least-common-denominator that strips features, or stays so loose that the type-system benefit evaporates. Init-time variant enums get the same outcome with less ceremony.

- **One unified `HudLeadingNavSpec<Selection>` value type.** Rejected: forces both the rail and the sidebar to accept the same input shape. The rail loses its `String`-only ergonomics; the sidebar's style axes become awkward to express. Per-variant input specs (each case carries its own associated values) are the right shape.

- **Defer the principle until five slots have multiple implementations.** Rejected: the leading-slot rail/sidebar pair is already there from ADR-002, and the pattern is easier to design when there is exactly one slot with multiple implementations than when retrofitting three or five at once. Land the principle now while the surface area is small.

## Conviction triggers (when to revisit)

- **Expand to more slots.** When a slot has two production-grade implementations and apps are confused about which to pick, that slot earns its variant enum.
- **Remove the open-slot escape hatch.** Probably never. The escape hatch is the contract that keeps Hudson honest about consumer flexibility. Removal would require evidence that no consumer uses it across two release cycles, which is unlikely by construction.
- **Promote a variant to a default.** When usage telemetry shows >70% of new consumers pick a particular variant for a slot, consider making it the default and offering the others by name.
- **Deprecate a variant.** When a variant has zero in-tree consumers and an obvious successor exists.

## Implementation reference

Phase 1 (leading nav variants) is the immediate next PR after #11 lands. Subsequent phases ship as independent PRs — each adds one slot's variant enum, the corresponding `HudAppShell` init form, and a demo update.

The case-study `Variants` demo tab (Phase 4) is the canonical artifact for explaining the principle to new consumers. It should be linked from `HudAppShell`'s docstring and from the `docs/architecture.md` page once it exists.
