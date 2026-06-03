---
title: Table
description: Tabular data primitive — Apple + web
order: 17
section: Primitives
---

# Table

## Overview

`HudTable` is the tabular-data primitive. Same conceptual API on both surfaces: items + column descriptors + optional selection + density. Apple ships `HudTable` as a SwiftUI view; web ships `hudsonkit/table` (TS) with web-native affordances the native side doesn't have, namely resizable columns with localStorage persistence.

v1 is presentational and selectable. Sorting, editing, and built-in detail-mode are deliberately deferred. Apps that need drill-down compose `onSelect` with `NavigationStack` / sheet / their own inspector.

## Apple — `HudTable` (SwiftUI)

```swift
import HudsonUI

HudTable(agents, columns: [
    HudTableColumn("Name") { Text($0.name) },
    HudTableColumn("Status", alignment: .center) {
        HudBadge($0.status, tint: .green)
    },
    HudTableColumn("Updated", alignment: .trailing) { Text($0.updatedAt) },
]) { agent in
    selectedAgent = agent
}
```

### Initializer

```swift
public init(
    _ items: [Item],
    columns: [HudTableColumn<Item>],
    density: HudTableDensity = .regular,
    selection: Binding<Item.ID?>? = nil,
    onSelect: ((Item) -> Void)? = nil
)
```

| Name | Type | Description |
|------|------|-------------|
| `items` | `[Item]` where `Item: Identifiable` | Row data. |
| `columns` | `[HudTableColumn<Item>]` | Column descriptors with title, alignment, cell builder. |
| `density` | `HudTableDensity` | `.compact` (28pt) or `.regular` (44pt). Defaults to `.regular`. |
| `selection` | `Binding<Item.ID?>?` | Optional external selection binding. If omitted, selection is held internally. |
| `onSelect` | `((Item) -> Void)?` | Fired on row tap. |

### `HudTableColumn`

```swift
HudTableColumn("Updated", alignment: .trailing) { agent in
    Text(agent.updatedAt).foregroundStyle(HudPalette.muted)
}
```

Cell builders receive the row item and return any `View` — including Hudson primitives like `HudBadge`, `HudStatusDot`, etc.

### Density

| Case | Row height | When to use |
|------|-----------|-------------|
| `.compact` | `HudLayout.rowHeightCompact` (28pt) | Dense data tables, log views. |
| `.regular` | `HudLayout.rowHeightRegular` (44pt) | Primary content, tap-target lists. |

Tighter than the iOS `List` defaults so tables stay dense without losing legibility.

## Web — `hudsonkit/table`

```tsx
import { HudTable } from 'hudsonkit/table';

<HudTable
  items={agents}
  rowKey={(a) => a.id}
  selectedKey={selected}
  onSelect={(a) => setSelected(a.id)}
  storageKey="hudson:agents-table"
  columns={[
    { key: 'name',    title: 'Name',    defaultWidth: 240, cell: (a) => a.name },
    { key: 'status',  title: 'Status',  defaultWidth: 120, alignment: 'center',  cell: (a) => <StatusBadge of={a} /> },
    { key: 'updated', title: 'Updated', defaultWidth: 120, alignment: 'trailing', cell: (a) => a.updated },
  ]}
/>
```

### `HudTableProps<Item>`

| Name | Type | Description |
|------|------|-------------|
| `items` | `readonly Item[]` | Row data. |
| `columns` | `HudTableColumn<Item>[]` | Column descriptors. |
| `rowKey` | `(item: Item) => string` | Stable key per row. Used for selection comparison and React keys. |
| `density` | `'compact' \| 'regular'` | Defaults to `'regular'`. |
| `selectedKey` | `string \| null` | Externally controlled selection. |
| `onSelect` | `(item: Item) => void` | Fired on row click. |
| `storageKey` | `string` | localStorage key for persisted column widths. Omit to skip persistence. |

### `HudTableColumn<Item>`

| Name | Type | Description |
|------|------|-------------|
| `key` | `string` | Stable column id (used by the resize state). |
| `title` | `string` | Header label. |
| `alignment` | `'leading' \| 'center' \| 'trailing'` | Defaults to `'leading'`. |
| `defaultWidth` | `number` | Initial width in px. Defaults to `160`. |
| `minWidth` / `maxWidth` | `number` | Clamped during drag. Defaults: 48 / 720. |
| `cell` | `(item: Item) => ReactNode` | Cell renderer. |

### Resizable columns

Drag the right edge of any header to resize. Double-click resets to `defaultWidth`. Widths persist to localStorage under `storageKey` and survive remounts.

`useResizableColumns` is exported separately for tables that aren't built on `HudTable`:

```ts
import { useResizableColumns } from 'hudsonkit/table';

const { getColumnProps, getResizeHandleProps, resetAll } = useResizableColumns({
  storageKey: 'my-table',
  columns: [{ key: 'name', defaultWidth: 240 }, ...],
});
```

The hook was lifted near-verbatim from OpenScout's Atop screen; already battle-tested.

## Tokens consumed

Both surfaces read from the shared design system: surfaces from `--hud-surface` / `HudPalette.surface`, hairlines from `--hud-border` / `HudHairline`, selected-row tint from `--hud-accent-soft` / `HudSurface.tintFill(HudPalette.accent)`, header type from the mono `xxs` size with `HudPalette.dim`.
