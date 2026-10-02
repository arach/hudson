---
name: Lattices Editor
description: Read-only Layers Overview with a persistent Hudson Workspace for inspection.
---

# Lattices Editor

## Overview

Layers opens on **Overview** by default. It explains the selected layer before
opening the denser **Workspace** for Preview, Source or History. Both views use
real bridge data and remain read-only.

The v8 visual authority is the operator's specification and the inspected
Talkie `workflow-detail.ts` detail-content, glance and composer patterns:
restrained index, top-spaced UI title, two-column facts, an 820px reading
measure and a bottom-anchored composer. This is not a return to the prior
rounded-UI preset. `overview.css` defines the `.lv` palette and overrides the
underlying `theme.css` kit mappings for both views; `editor.css` retains
Workspace layout rules.

The remote canvas remains unavailable. Local wide/narrow captures verify the
implemented specification and internal consistency, not a match to unseen
canvas boards. The earlier Main/Expanded/Narrow/States contact sheet documents
the Workspace pass, not proof of the v8 Overview's reference fidelity.

## Colors

The `.lv` palette in `overview.css` is authoritative:

| Role | Value |
| --- | --- |
| Sidebar | `#17191d` |
| Page | `#131417` |
| Card | `#1c1f24` |
| Raised surface | `#24282e` |
| Floor | `#101114` |
| Soft / normal / lit lines | white at `.07` / `.11` / `.17` |
| Ink | `#ecedef` |
| Dim ink | `#d3d5d8` |
| Muted | `#b0b3b8` |
| Faint | `#92969d` |
| Subtle | `#6c7178` |
| Green | `#33c773` |
| Green text | `#7fdca6` |

Green is reserved for open-layer indicators, selection, context and primary
navigation into Preview. A very faint green radial wash sits above Overview
content. Semantic amber `#f5a623` remains for ambiguity and recoverable notices;
the inherited error token is `#f04d59`. Ambiguous Source ranges use amber fill
and a leading mark instead of the ordinary green selection treatment.

Host groups have no color field. Overview dots indicate whether windows are
open, not a layer's assigned color. Workspace uses the same rule, including Unassigned: filled green when windows
are open, otherwise a hollow 1px faint ring. Clear is borderless quiet text,
with an outline only on keyboard focus (:focus-visible). Do not invent per-layer colors.

## Typography

The UI uses the system/SF Pro Text stack at 13px, weight 400 and line height 1.5,
not SF Pro Rounded. Notes use 12px. Data uses JetBrains Mono at 12px or 11px;
small tracked labels use weight 600. The layer title uses the system/SF Pro Display stack,
weight 600, 28px, line height 1.1 and -.015em tracking in ink. Sidebar headings,
eyebrows and section labels use 10px weight-600 mono with 2px tracking.

Workspace titles and body text follow the same `.lv` UI stack: row titles,
context and history are 13px; secondary app names are 12px UI, not monospace.
Panel titles remain 13px semibold. Source code uses 12px JetBrains Mono with
line height 1.6. Use tabular numerals and disable ligatures for code/data.

JetBrains Mono 400/600 are local WOFF2 assets; no
remote font request is required. `build.ts` emits six distribution files:
HTML, CSS, JavaScript, two font files and one font license. The system UI
font is not bundled.

## Layout

- Overview has a 212px scrolling index and an independently scrolling main
  region. The centered reading wrapper is at most 900px including 40px side
  padding, leaving an 820px content measure. Windows and Matched by form a
  two-column summary above the Preview actions and panel shortcuts.
- The layer composer sits at the bottom when content fits. Longer content
  scrolls normally; no content is clipped to preserve the composition.
- At widths of 640px or less, including the 560px Overview Narrow target, the
  index becomes a compact layer picker. Content uses 24px side padding, the
  summary becomes one column and Matched by is hidden. Source remains
  reachable from Show source. Actions and the chat heading can wrap.
- Overview and Workspace stay mounted and switch through `hidden`. The
  CodeMirror instance, panel mounts, current context and saved layout survive
  view changes. View choice is persisted per subject in
  `lattices.editor.view.v1:<subjectId>`; unavailable storage leaves the session
  usable. Panel layout remains separately persisted in
  `lattices.editor.layout.v3`.
- With `chrome: 'host'`, native Lattices owns page-level view/layout controls;
  the web subject header, peer arrangement toolbar and bottom status are absent.
  Standalone retains its subject header and Overview/Workspace switch.
  Its 28px status bar appears only in Workspace.
- Workspace starts with Chat/Preview at 38:62. Expanded layout is the
  Chat/Preview/History & Results/Source two-by-two grid. Existing user layouts
  take precedence. Panel headers are 36px with 16px side padding.
- Workspace's separate 640px container breakpoint keeps Preview at least 62vh,
  then a removable-context strip, visible Source and remaining panels. It hides
  resize separators, Chat chrome/examples and composer input/send without
  rewriting saved wide layouts.

## Elevation & Depth

Overview uses tonal separation and fine rules, not raised cards for every
section. Buttons use a restrained gradient and inset highlight; the composer
has a subtle inset highlight and soft shadow. Workspace panels remain flat
with no focused-panel shadow. `.lv` uses 1px panel and row rules rather than
the older half-pixel presentation. Refresh and view changes do not animate or
replace the source surface. Reduced-motion preferences disable transitions.

## Shapes

The index selection, action buttons and Workspace rows use 6px corners; the
composer uses 10px. Overview layer indicators are 7px circles, filled green
only when that group has open windows. Workspace app-initial tiles remain
neutral and compact. Preserve actual Hudson components where used rather than
building replacement composer, panel or source systems.

## Components

### Overview

- **Index and picker:** enumerate actual groups. The layer total excludes
  Unassigned; Unassigned is separated below the layer list. Row numbers count
  open projection rows, with an em dash for zero in the wide index. The footer
  identifies `workspace.json` and elapsed time since the successful read.
- **Layer facts:** use `overviewFacts` from `overview-data.ts`. Window counts
  are the group's actual rows. Rule counts sum each entry's Source-range
  occurrences, including duplicate entries, rather than counting deduplicated
  keys. Unmatched rule counts use the same occurrence rule. Open matches come
  from each row's `entryKeys`.
- **Optional facts:** pinned counts appear only when canonical content has an
  explicit `pins` array, and count pins per occurrence. Displays appear only
  for explicit string or number `display` fields. Never infer either from
  group names or window totals.
- **Windows and Matched by:** show actual titles/apps and canonical match
  fields (`app`, `title`, `url`, `path`, `group`) when available. Duplicate
  occurrences are explicit. Do not turn these configuration conditions into
  an invented explanation of the resolver's winning rule.
- **Preview actions:** Preview layout opens Workspace Preview and selects that
  layer's windows. Show source and View in Source open Workspace Source and
  select the layer's entry keys, preserving all ranges, including unmatched
  rules. The Add to this page buttons also open Workspace panels; they do not
  create configuration or new Overview content. Open Workspace preserves the
  saved panel arrangement.
- **No thumbnail:** the bridge provides no frame geometry. Explain inspection
  in text; do not fabricate a spatial layout preview, screenshot or placement.
- **Layer composer:** the real `createAgentComposer` shows one layer context
  item with its actual window count. Input/send and the context item are
  disabled. “Answers arrive in a later version” states the limitation. No
  agent request is sent.
- **Empty groups:** no windows is a factual state; rules can still exist and
  Source remains useful. An entirely empty projection shows “No layers
  configured” with Open Workspace.

### Workspace and host integration

- **UI synchronization:** subject-matched, validated `ui.command` supports
  `view` (`overview`/`workspace`), arrangement, supported panel toggles and
  `toggleSource`. View updates are handled in the model. Serialized `ui.state`
  reports include current view, arrangement, supported visible panels and
  `sourceOpen`. View changes do not alter panel geometry. Terminal is excluded
  from host state and hidden in host mode; standalone retains its unavailable
  placeholder.
- **Preview:** `HudGroupedList`/`HudListItem` retain 34px rows, sticky group
  headers, count badges, keyboard multiselect, selected checkmarks and neutral
  app initials. Preview header slots show total/selected counts, Clear and
  amber duplicate feedback. Source header slots show filename and line span.
- **Selection:** opt-in UTF-16 `CodeViewer` ranges retain all duplicate matches.
  Preview and Source follow selection with nearest instant scrolling. Clear
  and removable Workspace context items update shared state without remounts.
- **Chat:** “Arrange your windows” introduces selection context and the future
  agent. Examples are display-only; input/send stays disabled while selected
  window context remains removable. This differs from Overview's fixed,
  disabled layer context.
- **History:** external configuration changes remain session-local,
  newest-first, with relative times, absolute tooltips and shortened revisions.
- **Failures:** initial read failure offers Retry; later failure preserves the
  last consistent view. Unsupported hosts request an update. Loading, layout
  persistence failure and host UI-sync failure have distinct notices. Retrying
  UI synchronization does not write workspace configuration.
- **Mock controls:** synthetic host controls remain development-only and
  require the `mock` query parameter.

## Do's and Don'ts

- Do treat Overview as the default and Workspace as the persistent inspector.
- Do use the exact `.lv` palette, SF Pro Text hierarchy and local display/data
  fonts rather than the superseded rounded-UI styling.
- Do derive counts and context from the projection, including duplicate rules.
- Do preserve keyboard selection, range ambiguity, stable mounts and saves.
- Do keep capability-gated chrome and unavailable functions explicit.
- Don't invent frames, thumbnails, pins, displays, layer colors or match reasons.
- Don't imply that Preview moves windows, shortcuts edit configuration, Chat
  sends messages, Source edits files or Terminal runs commands.
- Don't add purple or decorative motion.
- Don't claim that local screenshots match the inaccessible remote canvas.

## Short host heights

Overview reserves a non-shrinking bottom chat block with a soft 1px divider.
Only the reading content above it scrolls; the picker remains outside that
scroll region. Workspace Chat similarly reserves the full composer and scrolls
its context/intro/Try region instead. Panel and CodeViewer mounts are unchanged.
Verified at 1280×650, 1280×820 and 560×650, plus a roughly 290px grid Chat.
