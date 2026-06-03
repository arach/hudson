---
title: Patterns
description: Optional app-interior patterns for rails, trees, grouped lists, cards, and context panels
order: 18
section: Primitives
---

# Patterns

## Overview

`hudsonkit/patterns` is an optional app-interior UI layer. It does not replace
an app's visual system or shell slots. It gives apps a shared vocabulary for
dense navigation, object hierarchy, preview surfaces, and selection context.

Use it when an app wants Hudson's default rhythm. Ignore it when an app needs a
fully custom surface.

## Components

| Component | Use |
|-----------|-----|
| `HudRail` | Side navigation with optional search, grouped sections, selected rows, status badges, and footer content. |
| `HudGroupedList` | Sectioned lists with counts, empty states, selected rows, descriptions, badges, and trailing actions. |
| `HudTree` | Recursive disclosure tree with selected state, depth rails, badges, and trailing actions. |
| `HudPreviewCard` | Single previewable entity card with media/preview, status, metrics, footer, and actions. |
| `HudCardGrid` | Responsive grid for preview cards or app-rendered custom cards. |
| `HudContextPanel` | Right-side selected-object summary with metadata rows and collapsible sections. |

## Import

```tsx
import {
  HudRail,
  HudTree,
  HudPreviewCard,
  HudCardGrid,
  HudContextPanel,
} from 'hudsonkit/patterns';
```

## Rail

```tsx
<HudRail
  title="Assets"
  search={{ value: query, onChange: setQuery, placeholder: 'Search assets...' }}
  selectedId={selectedId}
  onSelect={(item) => setSelectedId(item.id)}
  sections={[
    {
      id: 'active',
      title: 'Active',
      count: activeAssets.length,
      items: activeAssets.map(asset => ({
        id: asset.id,
        title: asset.name,
        subtitle: asset.path,
        status: asset.kind,
        statusTone: 'accent',
      })),
    },
  ]}
/>
```

## Tree

```tsx
<HudTree
  nodes={assetTree}
  selectedId={selectedAssetId}
  defaultExpandedIds={['root']}
  onSelect={(node) => setSelectedAssetId(node.id)}
/>
```

`HudTree` owns disclosure state by default. Pass `expandedIds` and
`onExpandedChange` when an app needs controlled expansion.

## Grouped List

```tsx
<HudGroupedList
  groups={[
    { id: 'working', title: 'Working', count: working.length, tone: 'success', items: working },
    { id: 'done', title: 'Done', count: done.length, items: done },
  ]}
  itemKey={(item) => item.id}
  selectedKey={selectedId}
  onSelect={setSelectedItem}
  renderTitle={(item) => item.title}
  renderDescription={(item) => item.summary}
/>
```

## Cards

```tsx
<HudCardGrid
  items={shots}
  itemKey={(shot) => shot.id}
  selectedKey={selectedShotId}
  onSelect={(shot) => setSelectedShotId(shot.id)}
  minCardWidth={220}
  getCardProps={(shot) => ({
    title: shot.name,
    subtitle: shot.description,
    media: <img src={shot.thumbnailUrl} alt="" className="h-full w-full object-cover" />,
    status: shot.status,
    metrics: [
      { label: 'Frames', value: shot.frames },
      { label: 'Assets', value: shot.assetCount },
    ],
  })}
/>
```

## Context Panel

```tsx
<HudContextPanel
  title={asset.name}
  subtitle={asset.path}
  status={asset.status}
  rows={[
    { label: 'Kind', value: asset.kind },
    { label: 'Size', value: asset.sizeLabel },
  ]}
  sections={[
    {
      id: 'metadata',
      title: 'Metadata',
      rows: metadataRows,
    },
  ]}
/>
```

## Boundary

Patterns are deliberately optional and slot-heavy:

- Apps own data meaning, hierarchy, and domain actions.
- Hudson owns consistent density, selected state, disclosure behavior, focus
  styling, grouping rhythm, and token usage.
- Workspace, canvas, map, and saved workspace behavior remain in their current
  layers. `hudsonkit/patterns` only covers app interiors.
