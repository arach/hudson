---
title: "macOS shell"
description: "HudAppShell, navigation, inspector, command palette, drawers"
order: 12
section: "macOS Apps"
---

# macOS shell

## Overview

HudsonShell is the chassis Hudson apps wear on macOS and iPad regular-width — container, leading nav, trailing inspector, content canvas, drawers, overlays. Apps own state and render into slots; the shell handles dividers, background, and responsive collapse. Counterpart to the web SDK's `<AppShell>`. Compact iPhone uses `HudPhoneAppShell`. See HUD-001 and HUD-002 in `packages/native/apple/HudsonKit/Docs/` for design context.

## HudAppShell

The top-level chassis. Six ViewBuilder slots — `leading`, `trailing`, `topDrawer`, `bottomDrawer`, `content`, `statusBar`. The trailing slot is hidden in iOS compact size class; convenience inits drop the drawers or render bare content.

```swift
HudAppShell {
    HudNavigationRail(selection: $section, items: items, isExpanded: $expanded) { Footer() }
} trailing: {
    HudInspector(isCollapsed: $inspectorCollapsed) { InspectorBody() }
} content: {
    HudCanvas { CanvasBody() }
} statusBar: {
    StatusBar()
}
```

## HudNavigationSidebar / HudNavigationRail

Two leading-slot implementations, both first-class (HUD-001).

**Use the rail** for a flat list of 3–7 destinations with icons-only-by-default and string selection.

```swift
HudNavigationRail(
    selection: $section,
    items: [HudRailItem(id: "home", label: "Home", icon: "house")],
    isExpanded: $expanded
) {
    VariantPicker()
}
```

| Param | Type | Purpose |
|---|---|---|
| `selection` | `Binding<String>` | Active item id |
| `items` | `[HudRailItem]` | Rows (`id`, `label`, `icon`) |
| `isExpanded` | `Binding<Bool>` | 64pt collapsed ↔ 220pt expanded |
| `showHeaderToggle` | `Bool` | Inline hamburger (default `true`) |

**Use the sidebar** for hierarchical or sectioned nav, bounce-free compaction, or typed-enum selection. Icons sit in a fixed 32pt rail; a parallel label column animates width 200 → 0, so icons never translate.

```swift
HudNavigationSidebar(
    selection: $section,
    entries: [
        .item(HudSidebarItem(id: .home, title: "Home", icon: "house", selectedIcon: "house.fill")),
        .section(id: "system", title: "System"),
        .item(HudSidebarItem(id: .settings, title: "Settings", icon: "gear")),
    ],
    isCompact: sidebarCompact,
    railHeader: { HudAppLogo() },
    labelHeader: { HudAppWordmark() },
    footer: { VariantPicker() }
)
```

| Param | Type | Purpose |
|---|---|---|
| `selection` | `Binding<Selection?>` | Typed active id (`Selection: Hashable`) |
| `entries` | `[HudSidebarEntry<Selection>]` | `.item(...)` or `.section(id:title:)` |
| `isCompact` / `progress` | `Bool` / `Double` | Boolean form, or `0…1` for scrub |
| `accent` | `Color?` | Override `manifest.accent` |
| `railHeader` / `labelHeader` / `footer` | `() -> View` | Header slots + footer |

Restyle the subtree with `.environment(\.hudsonSidebarStyle, ...)` — see `HudSidebarStyle` below.

## HudInspector + HudInspectorToggle

`HudInspector` is the trailing-slot panel — 280pt wide (`HudLayout.panelWidth`) when expanded, removed from layout when collapsed. `HudInspectorToggle` lives wherever app-owned chrome makes sense (status bar, toolbar) — intentionally separate so the affordance isn't locked to one location.

```swift
HudInspector(isCollapsed: $inspectorCollapsed) {
    HudSectionLabel("Inspector")
} content: {
    InspectorBody()
}

// Elsewhere in app chrome:
HudInspectorToggle(isCollapsed: $inspectorCollapsed)
```

| Param | Type | Purpose |
|---|---|---|
| `isCollapsed` | `Binding<Bool>` | Drives panel and toggle |
| `header` | `() -> View` | Optional header at `HudLayout.navHeight` |
| `content` | `() -> View` | Scrolling body |

## HudCanvas

Free-form work surface for the content slot. Optional grid background, optional pinned header, scrolling body. No opinion on what lives inside.

```swift
HudCanvas(showGrid: true) {
    CanvasHeader()
} content: {
    CanvasBody()
}
```

| Param | Type | Default | Purpose |
|---|---|---|---|
| `showGrid` | `Bool` | `true` | Render `HudGridBackground` behind content |
| `header` | `() -> View` | — | Pinned header; omit for none |
| `content` | `() -> View` | — | Scrolling body |

## HudCommandPalette

Centered overlay — search field, filterable list, keyboard-driven (typing filters, ↑/↓ select, ⏎ runs, ⎋ dismisses). Mount with `.hudsonCommandPalette(isPresented:commands:)`; trigger from a ⌘K handler. Optional `group` produces sectioned lists.

```swift
contentView
    .hudsonCommandPalette(isPresented: $paletteOpen, commands: [
        HudCommand(id: "new",  title: "New file",  icon: "doc",  group: "Files") { newFile() },
        HudCommand(id: "open", title: "Open file", icon: "folder", group: "Files") { openFile() },
    ])
```

`HudCommand` fields: `id`, `title`, `subtitle?`, `icon?`, `group?`, `action`.

## HudTerminalDrawer

Bottom-attached drawer with a hairline header (status dot, title, optional subtitle, chevron) and a collapsible content area (default 280pt). The content slot is generic — Termini, a fake mono shell, a console.

```swift
HudTerminalDrawer(
    isOpen: $terminalOpen,
    title: "Terminal",
    subtitle: "arach-laptop",
    statusColor: HudPalette.statusOk
) {
    TerminalView(host: "arach-laptop")
}
```

| Param | Type | Default | Purpose |
|---|---|---|---|
| `isOpen` | `Binding<Bool>` | — | Expand/collapse |
| `title` | `String` | `"Terminal"` | Mono header label |
| `subtitle` | `String?` | `nil` | Secondary header text |
| `statusColor` | `Color` | `HudPalette.statusOk` | Status dot, pulses while open |
| `expandedHeight` | `CGFloat` | `280` | Content height when open |

## HudTakeover

Full-viewport blocking surface for flows that need full attention — connection setup, onboarding, destructive confirms, terminal sessions. Mount with `.hudsonTakeover(isPresented:content:)`; fades + slides up from the bottom (opacity-only under reduce-motion).

```swift
HudAppShell { ... }
    .hudsonTakeover(isPresented: $isConnecting) {
        HudTakeover(isPresented: $isConnecting) {
            Text("Connecting to arach-laptop")
        } content: {
            ConnectFlow()
        }
    }
```

## Layout primitives

**`HudVisualEffectView`** bridges `NSVisualEffectView` into SwiftUI on macOS — `.sidebar` + `.behindWindow` matches stock macOS sidebars; iOS falls back to `.ultraThinMaterial`.

```swift
HudVisualEffectView(material: .sidebar, blendingMode: .behindWindow)
    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
```

**`HudSidebarLayout`** holds the geometry tokens — `railWidth` (32), `labelWidth` (200), `rowHeight` (30), `headerHeight` (44), `intrinsicWidth(progress:labelWidth:)`. **`HudSidebarStyle`** bundles four style axes (`surface`, `indicator`, `icon`, `motion`) plus a `liquidGlass` config; propagate via `.environment(\.hudsonSidebarStyle, ...)`.
