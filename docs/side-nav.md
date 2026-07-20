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
are app-*interior* rails and lists for a surface's own content, whereas
`HudSideNav` is the structural nav that drops into `AppShell`'s `slots.LeftPanel`
and drives the app's top-level places.

One data-driven tree renders up to three tiers inside a single panel:

| Tier | Node | Renders as |
|------|------|------------|
| 1 — destinations | top-level `items` | icon + label rows; the primary rail |
| 2 — sections | a child that itself has `children` | mono-eyebrow collapsible group |
| 3 — items | leaf nodes | dense selectable rows |

Two-level use is natural: give a destination leaf `children` (no nested groups)
and you get destinations → items with no section headers.

## Import

```tsx
import { HudSideNav, type HudNavNode } from 'hudsonkit/nav';
```

## Usage

```tsx
import { HudSideNav, type HudNavNode } from 'hudsonkit/nav';
import { Boxes, FileText, Home } from 'lucide-react';

const items: HudNavNode[] = [
  { id: 'home', label: 'Home', icon: Home },
  {
    id: 'agents',
    label: 'Agents',
    icon: Boxes,
    count: 3,
    children: [
      {
        id: 'active',
        label: 'Active',              // a section (has children)
        children: [
          { id: 'atlas', label: 'Atlas', live: true },
          { id: 'echo', label: 'Echo' },
        ],
      },
      { id: 'archived', label: 'Archived' },
    ],
  },
  { id: 'docs', label: 'Docs', icon: FileText },
];

function Nav() {
  const [selected, setSelected] = useState('atlas');
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
- **Live** — set `live` on a node. This is the *only* accent usage: a pulsing
  accent dot, an accent count tone, and an accent left spine. It answers "what
  is working right now", kept orthogonal to selection.
- **Disabled** — `disabled` dims the node and blocks interaction.

## Selection is yours

`HudSideNav` assumes no router. It reports `onSelect(node)` and reflects
`selectedId`; wiring that to routes, tabs, or local state is the consumer's
business. The ancestors of `selectedId` are revealed automatically so the
current node is always visible.

## Collapse

- **Groups** — destinations and sections with children are caret-collapsible.
  Pass `defaultExpandedIds` for the uncontrolled default, or drive it with
  `expandedIds` + `onExpandedChange`.
- **Icons-only rail** — pass `collapsed` to render level-1 destinations as
  centred icons (labels + deeper tiers hidden), for a narrowed panel.

## Props

| Prop | Type | Notes |
|------|------|-------|
| `items` | `HudNavNode[]` | Level-1 destinations. |
| `selectedId` | `string \| null` | Selected node id (any tier). |
| `onSelect` | `(node) => void` | Row activation. |
| `expandedIds` / `defaultExpandedIds` / `onExpandedChange` | | Controlled or seeded expansion. |
| `collapsed` | `boolean` | Icons-only rail. |
| `header` / `footer` | `ReactNode` | Pinned above / below the tree. |
| `density` | `'compact' \| 'default'` | |
| `ariaLabel` | `string` | `<nav>` landmark name. |
| `empty` | `ReactNode` | Shown when `items` is empty. |

`HudNavNode`: `{ id, label, icon?, count?, badge?, live?, disabled?, children? }`.
