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
  defaultOpen
>
  <HudSideNav items={items} selectedId={sel} onSelect={(n) => setSel(n.id)} />
</HudSideNavProvider>;
```

`useHudSideNav()` returns `{ state, open, setOpen, toggle, collapsible, side }`.
The `<nav>` reflects state as `data-state` / `data-collapsible` / `data-side`.
`HudSideNavTrigger` (a button) and `HudSideNavRail` (an edge strip) both toggle.

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
| `rail`                                                                     | `boolean`                | Render a `HudSideNavRail` edge toggle.            |
| `header` / `footer`                                                        | `ReactNode`              | Pinned above / below the tree.                    |
| `density`                                                                  | `'compact' \| 'default'` |                                                   |
| `ariaLabel`                                                                | `string`                 | `<nav>` landmark name.                            |
| `empty`                                                                    | `ReactNode`              | Shown when `items` is empty.                      |

`HudNavNode`: `{ id, label, icon?, count?, badge?, live?, disabled?, children? }`.
