---
name: Lattices Editor
description: Read-only configuration inspection using Hudson's dark theme and peer-panel components.
---

# Lattices Editor

## Overview

The pinned direction is Operate: extend the Hudson agent workspace, not a new
brand. The editor inherits hudsonkit's `hudson` dark theme and uses its actual
components. `editor.css` owns layout only; it does not define a parallel palette
or restyle the kit's visual language.

The reference canvas was unavailable. The operator's explicit component mapping
and the local kit are the visual authority for this correction.

## Colors

Neutral surfaces, borders and text come from the inherited Hudson dark tokens.
Emerald accent tokens mark selection, focus and live status. Semantic amber
warning tokens identify ambiguous selection, stale data and recoverable read
failures. App-initial glyphs use neutral muted tokens, not an app-specific color
palette. Use kit tokens for hover, selection, badges and source highlights.

## Typography

The editor inherits Hudson's compact system UI typography. The subject title is
14px semibold; context and history text are 12px. Source metadata is 11px and
secondary app names are 10px monospace. Source code uses bundled JetBrains Mono
with line numbers and JSON syntax highlighting. Keep kit component typography
intact rather than reproducing it in `editor.css`.

## Layout

- The main header combines the subject, dotted Read only badge and action
  toolbar in a 46px minimum height. Selection and Clear are in the bottom
  status bar, not the header. The header can wrap below 500px.
- The existing peer-panel layout toolbar remains 32px tall. Preserve the kit's
  panel headers and controls; do not introduce a compact 28px toolbar override.
- The embedded bottom `StatusBar` is 28px tall. It carries selection and Clear,
  duplicate-match feedback, layer/window counts, revision and Live/Stale status.
  Layer/window counts hide below 700px.
- First open shows Chat and Preview side by side at 38:62, with Preview wider.
  Source, History & Results and Terminal open on demand through Panels;
  Inspect Source also opens Source without losing selection or panel state.
- Expanded layout shows Chat, Preview, History & Results and Source in a
  filled two-column, two-row grid. Terminal remains hidden.
- The app uses the `lattices.editor.layout.v3` storage namespace to apply this
  preset once in place of old layouts. Subsequent user layouts take precedence;
  the old namespace and other kit consumers remain untouched.
- The Panels picker includes all five panels, including Terminal. Preserve
  the shell's Single, Columns, Rows and Grid layouts, focus, visibility,
  reorder and resize controls.
- At a panel-host width of 680px or less, CSS stacks panels in one scrolling
  column and hides resize separators. Preview comes first at a minimum of
  60vh; compact chips-only Chat follows, or its selection hint when empty.
  Examples and composer input/send are hidden. Other visible panels follow.
  This does not rewrite the saved wide layout.

## Elevation & Depth

Peer panels are flat and separated by kit borders. Selected Preview rows use
`HudListItem`'s accent border and selection treatment. Do not add custom inset
outlines or raised cards. Data refreshes do not animate or replace panel mounts
or the existing Source editor.

## Shapes

Buttons, badges, rows, groups and composer context items retain their kit-owned
shapes and radii. Panel divisions remain straight and compact. App CSS controls
placement and dimensions, not a second component styling system.

## Components

- **Header:** actual `HudButton` controls sit in `HudToolbar` with a kit
  separator. Inspect Source is ghost; Expanded layout is soft. A neutral
  `HudBadge` with a dot labels the subject Read only.
- **Chat:** `createAgentComposer` owns removable `contextItems` for selected
  windows. Its leading-tools context items mount in the top slot; its disabled
  input and send controls remain below the examples. Context removal stays
  enabled despite disabled submission. Empty selection shows a short hint.
  Three examples are explicitly introduced as requests for when an agent is
  available. The disabled composer says “Ask about these windows… (agent
  arrives in a later version)”; it cannot send.
- **Preview:** actual `HudGroupedList` and `HudListItem` components form a
  keyboard-operable multiselect listbox. Rows are 30px, single-line, with
  neutral app-initial glyphs, ellipsized titles and secondary app names.
  Selected rows retain the kit accent border. Sticky group headers use
  `HudBadge` counts; empty groups occupy one line. Unassigned appears last,
  separated by a divider. Click or Enter/Space selects; Cmd/Ctrl adds or removes
  a selection. Arrows and Home/End move the active row. Panel Actions menus
  are hidden; handles retain reorder and Panels retains visibility controls.
- **Source:** `CodeViewer` uses the new opt-in read-only UTF-16 range mode,
  backed by a stable CodeMirror instance. Existing non-range consumers keep
  their prior behavior. Inspect Source reveals this panel, labelled
  “workspace.json · layers subset.” Selection links source ranges with Preview
  rows and scrolls the first match into view using nearest, instant scrolling
  in either direction. Duplicate matches retain all range highlights and an
  explicit entry count in the bottom status bar. Clear and context removal
  update shared selection without replacing the editor or panel mounts.
- **Status:** the embedded chrome `StatusBar` provides the bottom selection,
  counts and revision surface. Revision tooltips retain the full value.
  Dotted `HudBadge` status distinguishes Live from Stale; ambiguous matches
  use semantic warning text.
- **History & Results:** session-local external configuration changes, newest
  first, with relative times, absolute-time tooltips and shortened revisions
  whose tooltips retain the full value. Before changes, one line explains that
  changes made elsewhere appear here.
- **Terminal:** an unavailable placeholder with no terminal connection or
  execution side effects, even when revealed through Panels.
- **Host states:** an unavailable bridge shows the Lattices update message.
  A recoverable initial subject-read failure shows “Can't read workspace
  layers” and Retry. Later read failures preserve the last consistent view
  with an alert and Retry. Loading and layout-save failure have distinct copy.
- **Mock controls:** synthetic-host development controls require a
  non-production build and the `mock` query parameter. They are not production
  shell controls.

## Do's and Don'ts

- Do inherit Hudson's neutral/emerald dark tokens and semantic amber warnings.
- Do use actual kit components and keep `editor.css` layout-only.
- Do preserve the flat peer grid, saved layouts and stable Source editor.
- Do describe actual loading, unavailable, empty, ambiguous and stale states.
- Do keep read-only and unavailable capabilities explicit.
- Don't add purple, a custom palette, decorative motion or replacement chrome.
- Don't move selection back into the header or shrink the peer toolbar.
- Don't reset saved wide layouts to implement narrow-screen stacking.
- Don't imply that Chat sends messages, Source edits files or Terminal runs
  commands.

## Read-only flow pass: A–H

These behaviors survive the operator's kit-register correction. Component and
placement details above supersede the earlier custom presentation.

- **A · Chrome:** compact subject/action header, unchanged 32px peer controls
  and kit panel headers; selection now lives in the 28px bottom `StatusBar`.
  No new shell fork.
- **B · Labels:** one label per purpose; Source identifies workspace.json's
  layers subset. Generic opt-in panel action visibility defaults to today's
  kit behavior; this app hides those menus. Reorder remains available on panel
  handles and visibility in Panels.
- **C · Context:** removable app/title context items, a selection hint, three
  plainly labelled future examples and an honestly disabled composer. Actual
  `createAgentComposer` context items remain removable in the top slot. No
  agent functionality or writes implied.
- **D · Preview:** 30px single-line kit rows, neutral initial glyphs, sticky
  group headers and kit count badges. Empty groups collapse to one line;
  Unassigned is last and separated. No invented match reason: entry canonical
  content describes configuration but does not reliably identify the
  resolver's per-row winning reason.
- **E · Follow selection:** nearest instant scrolling in both directions,
  all duplicate ranges preserved and an explicit duplicate-count summary in
  the bottom status bar. Panel nodes and CodeMirror remain mounted through
  layout and refresh changes.
- **F · Narrow:** Preview first at least 60vh, compact context-only Chat next,
  then other visible panels. CSS only; wide saves unchanged.
- **G · History:** one useful empty line, newest-first relative timestamps
  with absolute tooltips and short revisions.
- **H · Copy:** concrete window/configuration language. Inherited dark Hudson
  surfaces and emerald selection/focus remain; no decorative motion.
