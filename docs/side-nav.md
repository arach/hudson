---
title: Side Navigation
description: Data-driven application side navigation — destinations, sections, and items in one panel
order: 18
section: Primitives
---

# Side Navigation

## Overview

`hudsonkit/nav` provides `HudSideNav`: the application-level side navigation a
web app is organised around. It is distinct from `hudsonkit/patterns` — those
are app-_interior_ rails and lists for a surface's own content, whereas
`HudSideNav` is the structural nav that drops into `AppShell`'s `slots.LeftPanel`
and drives the app's top-level places.

One data-driven tree renders up to three tiers inside a single panel:

| Tier             | Node                               | Renders as                          |
| ---------------- | ---------------------------------- | ----------------------------------- |
| 1 — destinations | top-level `items`                  | icon + label rows; the primary rail |
| 2 — sections     | a child that itself has `children` | mono-eyebrow collapsible group      |
| 3 — items        | leaf nodes                         | dense selectable rows               |

Two-level use is natural: give a destination leaf `children` (no nested groups)
and you get destinations → items with no section headers.

## Import

```tsx
import { HudSideNav, type HudNavNode } from "hudsonkit/nav";
```

## Usage

```tsx
import { HudSideNav, type HudNavNode } from "hudsonkit/nav";
import { Boxes, FileText, Home } from "lucide-react";

const items: HudNavNode[] = [
  { id: "home", label: "Home", icon: Home },
  {
    id: "agents",
    label: "Agents",
    icon: Boxes,
    count: 3,
    children: [
      {
        id: "active",
        label: "Active", // a section (has children)
        children: [
          { id: "atlas", label: "Atlas", live: true },
          { id: "echo", label: "Echo" },
        ],
      },
      { id: "archived", label: "Archived" },
    ],
  },
  { id: "docs", label: "Docs", icon: FileText },
];

function Nav() {
  const [selected, setSelected] = useState("atlas");
  return (
    <HudSideNav
      items={items}
      selectedId={selected}
      onSelect={(node) => setSelected(node.id)}
    />
  );
}
```

Mount it in the shell by returning it from the app's `LeftPanel` slot; `AppShell`
supplies the panel chrome, collapse toggle (`Cmd`/`Ctrl`+`[`), and resize.

## States

- **Selected** — a neutral filled chip (`bg-secondary`) plus a neutral left
  spine. Never accent: selection answers "where am I".
- **Hover** — a subtle `bg-muted` wash.
- **Live** — set `live` on a node. This is the _only_ accent usage: a pulsing
  live-tone dot, a live count tone, and a live left spine. It answers "what
  is working right now", kept orthogonal to selection. Colour comes from the
  themeable `--hud-nav-live` token (defaults to accent); consumers retint by
  setting the var on a wrapper — no `!important` fights with generated utilities.
- **Disabled** — `disabled` dims the node and blocks interaction.

## Selection is yours

`HudSideNav` assumes no router. It reports `onSelect(node)` and reflects
`selectedId`; wiring that to routes, tabs, or local state is the consumer's
business. In uncontrolled expansion mode, the ancestors of `selectedId` are
revealed automatically on initial render and later selection changes so the
current node stays visible. With controlled `expandedIds`, the consumer owns
that reveal policy.

## Collapse

Collapse is owned by `HudSideNavProvider` (see below). `HudSideNav` self-provides
one when used standalone, so these work with no wrapper:

- **Groups** — destinations and sections with children are caret-collapsible.
  Pass `defaultExpandedIds` for the uncontrolled default, or drive it with
  `expandedIds` + `onExpandedChange`.
- **Whole sidebar** — `collapsible` chooses the mode: `icon` (default) folds to
  an icons-only rail, `offcanvas` hides it entirely, `none` disables collapse.
  The legacy `collapsed` boolean still forces the icon rail.

## Provider, hook, and shortcut

For persisted collapse, a keyboard shortcut, or hand-composed navs, wrap in
`HudSideNavProvider` and (optionally) read `useHudSideNav()`.

```tsx
import { HudSideNavProvider, HudSideNav } from "hudsonkit/nav";

<HudSideNavProvider
  collapsible="icon" // 'offcanvas' | 'icon' | 'none'
  side="left" // 'left' | 'right'
  persistKey="app.nav" // persists open state to localStorage
  keyboardShortcut="b" // Cmd/Ctrl+B toggles; false disables
  defaultExpandedWidth={260} // persisted resize width when persistKey is set
  collapsedWidth={48} // real icon rail; offcanvas resolves to 0
  tooltipDelay={500} // settled-hover labels in compact mode
  defaultOpen
>
  <HudSideNav items={items} selectedId={sel} onSelect={(n) => setSel(n.id)} />
</HudSideNavProvider>;
```

`useHudSideNav()` returns collapse state plus structural width controls:
`{ state, open, setOpen, toggle, collapsible, side, width, expandedWidth,
defaultExpandedWidth, minExpandedWidth, maxExpandedWidth, setExpandedWidth,
resetExpandedWidth, collapsedWidth, tooltipDelay }`. The resolved `width` is the
expanded width while open, compact width in `icon` mode, and `0` when an
`offcanvas` sidebar is closed. The `<nav>` reflects state as `data-state` /
`data-collapsible` / `data-side`. `HudSideNavTrigger` is the shared directional
caret; it accepts children when the whole brand/title row should toggle.

## Composable primitives

When the data-driven tree isn't enough, hand-compose the anatomy — the pieces
share the same look and honor the provider's collapse mode:

```tsx
import {
  HudSideNavProvider,
  HudSideNav,
  HudSideNavHeader,
  HudSideNavContent,
  HudSideNavFooter,
  HudSideNavGroup,
  HudSideNavGroupLabel,
  HudSideNavMenu,
  HudSideNavMenuItem,
  HudSideNavMenuButton,
  HudSideNavRail,
} from "hudsonkit/nav";

<HudSideNavProvider persistKey="app.nav">
  <HudSideNav rail>
    {/* children mode: compose the body */}
    <HudSideNavHeader>Acme</HudSideNavHeader>
    <HudSideNavContent>
      <HudSideNavGroup>
        <HudSideNavGroupLabel>Agents</HudSideNavGroupLabel>
        <HudSideNavMenu>
          <HudSideNavMenuItem>
            <HudSideNavMenuButton asChild isActive live icon={Boxes}>
              <a href="/atlas">Atlas</a>
            </HudSideNavMenuButton>
          </HudSideNavMenuItem>
        </HudSideNavMenu>
      </HudSideNavGroup>
    </HudSideNavContent>
    <HudSideNavFooter>…</HudSideNavFooter>
  </HudSideNav>
</HudSideNavProvider>;
```

`HudSideNavMenuButton` takes `icon`, `isActive` (neutral emphasis),
`live` (the only accent), `count`, `badge`, `asChild`, `expanded`, and `tooltip`.
`asChild` keeps the child element and routing props while Hudson composes its
icon, collapsed label, live state, count, and badge inside it. Use `expanded`
on hand-composed disclosure rows so the control exposes `aria-expanded`. Nest
with `HudSideNavMenuSub` / `HudSideNavMenuSubButton`.

## Full-height navigation with a separate context rail

`HudSideNavLayout` is the additive shell composition for products that need the
next-generation anchored-L anatomy rather than a single `AppShell` left panel:

- primary navigation owns the full-height top corner;
- one app-wide top row begins beside it;
- contextual content lives in a separate `HudSideRail`, not in the destination
  tree;
- context and main content begin below the top row;
- the bottom bar spans all columns.

The repository includes a live example at [`/demo/side-nav`](/demo/side-nav).

The layout reads and resizes the primary width through `HudSideNavProvider`.
`HudSideRail` owns its independent expanded/compact width. Its expanded subtree
stays mounted while compact, so reopening a live list does not remount or
refetch it. Hidden remains different from compact: omit `contextRail` to consume
zero width.

```tsx
import {
  HudSideNav,
  HudSideNavLayout,
  HudSideNavProvider,
  HudSideNavTrigger,
  HudSideRail,
} from "hudsonkit/nav";

function WorkspaceChrome() {
  const [selected, setSelected] = useState("home");
  const [contextCollapsed, setContextCollapsed] = useState(false);

  return (
    <HudSideNavProvider
      collapsible="icon"
      defaultOpen={false}
      persistKey="acme.primary-nav"
      defaultExpandedWidth={260}
      collapsedWidth={48}
    >
      <HudSideNavLayout
        resizable
        navigation={
          <HudSideNav
            items={items}
            selectedId={selected}
            onSelect={(node) => setSelected(node.id)}
            header={<HudSideNavTrigger label="Toggle Acme navigation"><AcmeMark /> Acme</HudSideNavTrigger>}
            collapsedHeader={<HudSideNavTrigger label="Toggle Acme navigation"><AcmeMark /></HudSideNavTrigger>}
            footer={<GlobalActions />}
            collapsedFooter={<GlobalActionIcons />}
            rovingFocus
          />
        }
        contextRail={
          <HudSideRail
            label="Projects"
            collapsed={contextCollapsed}
            onCollapsedChange={setContextCollapsed}
            resizable
            collapsedContent={<ProjectGlyphs />}
            footer={<ProjectSummary />}
          >
            <ProjectList />
          </HudSideRail>
        }
        contextRailAriaLabel="Project context"
        topRow={<WorkspaceHeader />}
        bottomBar={<WorkspaceStatus />}
        contentAriaLabel="Workspace"
      >
        <WorkspaceSurface />
      </HudSideNavLayout>
    </HudSideNavProvider>
  );
}
```

The default geometry is a shared `48px` logo/top/header band, `28px` bottom bar,
`260px` expanded primary nav, `48px` primary icon rail, `240px` expanded context
rail, and `48px` compact context rail. Every value is configurable. Right-side
primary navigation is mirrored automatically through
`HudSideNavProvider side="right"`.

Set `resizable` on `HudSideNavLayout` and/or `HudSideRail` for the shared resize
behavior. Pointer drag resizes live. Dragging inward through the minimum-width
margin collapses without overwriting the remembered expanded width; dragging
out from compact revives the rail after deliberate travel. Double-click resets
to the configured default. The separator is keyboard reachable: Left/Right
resize, Home/End choose min/max, and Enter/Space toggles compact state.

Compact destination labels use Hudson's Base UI tooltip behavior with a `500ms`
settled-hover delay. The tooltip mounts only in icon mode, so expanding the rail
also clears any open compact label. Override `tooltipDelay` on the provider when
the product has a measured reason; do not restore native `title` tooltips, which
open immediately and cannot share Hudson's visual register.

## Props

| Prop                                                                       | Type                     | Notes                                             |
| -------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------- |
| `items`                                                                    | `HudNavNode[]`           | Level-1 destinations.                             |
| `selectedId`                                                               | `string \| null`         | Selected node id (any tier).                      |
| `onSelect`                                                                 | `(node) => void`         | Row activation.                                   |
| `children`                                                                 | `ReactNode`              | Hand-composed body (ignored when `items` is set). |
| `expandedIds` / `defaultExpandedIds` / `onExpandedChange`                  |                          | Controlled or seeded expansion.                   |
| `collapsed`                                                                | `boolean`                | Legacy shorthand for the icons-only rail.         |
| `collapsible` / `side` / `defaultOpen` / `persistKey` / `keyboardShortcut` |                          | Provider defaults, used only when self-providing. |
| `defaultExpandedWidth` / `expandedWidth` / `onExpandedWidthChange`          | `number` / callback      | Uncontrolled or controlled structural width.     |
| `minExpandedWidth` / `maxExpandedWidth` / `collapsedWidth` / `tooltipDelay` | `number`                | Resize bounds, compact width, and label intent.   |
| `rail`                                                                     | `boolean`                | Render a `HudSideNavRail` edge toggle.            |
| `header` / `footer` / `collapsedHeader` / `collapsedFooter`                | `ReactNode`              | Pinned chrome with optional compact overrides.    |
| `density`                                                                  | `'compact' \| 'default'` |                                                   |
| `selectionWash` / `rovingFocus`                                            | `boolean`                | Opt-in selection wash and keyboard roving.        |
| `ariaLabel`                                                                | `string`                 | `<nav>` landmark name.                            |
| `empty`                                                                    | `ReactNode`              | Shown when `items` is empty.                      |

`HudNavNode`: `{ id, label, accessibilityLabel?, icon?, count?, badge?, live?, disabled?, children? }`.
