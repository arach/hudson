---
name: Lattices Editor
description: Read-only Layers inspection with the Lattices preset and Hudson peer-panel components.
---

# Lattices Editor

## Overview

The direction is Operate: a Layers page inside Lattices, built with Hudson's
actual peer-panel, list, composer and source components. The Lattices preset
in `theme.css` adapts kit tokens and component presentation to native
`HudTheme.lattices` / `Palette`. `editor.css` owns layout. This supersedes the
previous unmodified Hudson dark register; it does not replace the kit.

Chrome ownership is capability-gated. With `chrome: 'host'`, native Lattices owns
page chrome and panels start at the top. Without that capability, standalone
web chrome remains available.

The remote reference canvas was inaccessible. The operator's explicit mapping,
local implementation and native theme are the available authority. The
`design-evidence/host-boards-contact-sheet.png` compares shipped Main, Expanded,
Narrow and States equivalents internally; it is not evidence of a match to
unseen canvas boards.

## Colors

`theme.css` is the preset source of truth. The background is `#141416`; panel
surfaces are `#1a1a1a`. White ink uses .92 opacity, secondary text .58 and dim
text .40. Borders use white at .08; stronger lines and hover use .14.

The Lattices accent is `#33c773`, with a .12 selection fill, .32 selection
border and `#8fe6b6` accent text. It marks selected windows, context, focus and
live state. Semantic amber `#f5a623` identifies duplicates, stale reads and
recoverable notices; the preset's error token is `#f04d59`. Ambiguous Source
ranges use amber fill and an amber leading mark, not the normal green mark.

Host groups have no color field. Layer markers therefore use the accent, with
a dim neutral fallback for Unassigned. Do not invent per-layer colors. App
initials use neutral muted tiles.

## Typography

The UI uses `ui-rounded`, SF Pro Rounded and system fallbacks. Data uses bundled
JetBrains Mono. The preset applies tabular numerals; code, count pills and
status data disable ligatures.

- Panel titles: 13px, weight 600, letter spacing -.01em.
- Layer headings: 12px, weight 600.
- Window titles: 12.5px, weight 400; selected titles use weight 500.
- Secondary app names: 11.5px rounded UI, not monospace.
- Panel metadata and context items: 11.5px.
- Count pills and Source metadata: 10.5px monospace.
- Empty-state heading: 19px, weight 700, line height 1.2.
- Context guidance: 12.5px, line height 1.55; examples: 12px.
- Context and Try labels: 10px, weight 600, uppercase, .08em tracking.
- Source code: 12px JetBrains Mono, line height 1.6.
- Standalone subject title: 14px semibold.

## Layout

- Host mode omits the web subject/action header and bottom status bar and hides
  the peer arrangement toolbar. Normal operation starts with panel headers at
  the top; recoverable notices can appear above them.
- Standalone mode retains the 46px-minimum subject/action header, dotted Read
  only badge, Inspect Source and Expanded layout buttons, existing 32px peer
  toolbar and 28px bottom `StatusBar`. Its bottom bar retains selection/Clear,
  layer/window counts, revision and Live/Stale state. Counts hide below 700px;
  the subject header can wrap below 500px.
- Panel headers are 36px tall with 16px horizontal padding. Preview and Source
  metadata use reusable `EditorPanels` header slots in both chrome modes.
- First open shows Chat and Preview side by side at 38:62. Source, History &
  Results and Terminal are initially hidden. Expanded layout shows Chat,
  Preview, History & Results and Source in a filled two-column, two-row grid.
- Layout persistence remains in `lattices.editor.layout.v3`. The preset applies
  once; later user layouts take precedence. Old saved data and other kit
  consumers remain untouched.
- At a panel-host width of 640px or less, CSS stacks panels in one scrolling
  column and hides resize separators. Preview comes first at a minimum of
  62vh, followed by a compact context strip, then Source when visible. History
  and Terminal follow. Chat's header, empty-state copy, Context label, examples
  and composer input/send are hidden; selected context items remain removable.
  This responsive presentation does not rewrite the saved wide layout.

## Elevation & Depth

Panels are flat, with half-pixel preset header rules and no focused-panel
shadow. Selected rows use a subtle accent fill and border. The disabled
composer alone has a restrained inset highlight and soft shadow. Do not animate
data refreshes or replace mounted panels and Source editors. Reduced-motion
preferences disable transitions.

## Shapes

Preview rows use 6px corners, app-initial tiles 5px, count pills 4px, example
rows 7px and the composer shell 10px. Panels remain square. Layer markers are
small rounded squares; selection metadata uses a dot. These are preset
adaptations of actual kit components, not replacement component implementations.

## Components

- **Host synchronization:** validated, subject-matched `ui.command` events in
  host mode control arrangement (`single`, `columns`, `rows`, `grid`), toggle
  Chat/Preview/History/Source or toggle Source directly. Grid uses two columns.
  Commands received before the panel controller is ready are queued, bounded
  to 32. `ui.state` reports arrangement, visible panels and `sourceOpen` when
  the controller mounts and whenever layout changes. Reports are serialized.
  A sync failure shows “Layout controls could not sync.” with Retry; it does
  not imply a configuration write. Standalone mode does not report host UI state.
- **Panel controls:** generic panel Actions menus are hidden. Reorder handles
  and the existing layout controller remain. Standalone Panels includes all
  five panels, including Terminal. Host `togglePanel` does not expose Terminal.
- **Preview header:** total window count, selected count with an accent dot,
  Clear and an amber Duplicates label. The duplicate tooltip gives the matched
  Source-entry count. These are panel-local metadata, not a host-mode global
  status bar.
- **Preview list:** actual `HudGroupedList` and `HudListItem` components form a
  keyboard-operable multiselect listbox. Rows are 34px tall, single-line, with
  18px app-initial tiles, ellipsized titles, rounded-UI secondary app names and
  a checkmark for selected windows. Sticky group headers carry kit count
  badges. Empty groups occupy one line. Unassigned is last and separated.
  Click or Enter/Space selects; Cmd/Ctrl adds or removes a selection. Arrows
  and Home/End move the active row.
- **Chat:** the empty state says “Make room for your work.” and explains that
  an agent arrives in a later version. Three Try examples are display-only.
  `createAgentComposer` owns removable selected-window `contextItems`, mounted
  in the top slot through its leading-tools element. The disabled input/send
  stays at the bottom on wide layouts. Context removal remains enabled.
  The placeholder says “Ask about these windows… (agent arrives in a later
  version)”; submission cannot occur.
- **Source header:** `workspace.json` and the first selected range's line span
  appear in the panel metadata slot. The document remains the layers subset;
  there is no separate repeated filename strip inside the content.
- **Source editor:** `CodeViewer` uses opt-in read-only UTF-16 range selection
  backed by a stable CodeMirror instance. Existing non-range consumers retain
  their behavior. Source and Preview selection follow each other with nearest,
  instant scrolling to the first match. All duplicate ranges remain highlighted;
  ambiguity changes their presentation to amber. Clear and context removal
  update shared selection without replacing the editor or panel mounts.
- **History & Results:** session-local external configuration changes, newest
  first, with relative times, absolute-time tooltips and shortened revisions
  with full-value tooltips. The empty line explains that changes made elsewhere
  appear here.
- **Terminal:** an unavailable placeholder with no connection or execution,
  even when revealed in standalone Panels.
- **Host states:** an unavailable bridge requests a Lattices update. Initial
  subject-read failure shows “Can't read workspace layers” and Retry. Later
  read failures retain the last consistent view with an amber notice and Retry.
  Loading, layout-save failure and host UI-sync failure have distinct copy.
- **Mock controls:** synthetic-host controls require a non-production build
  and the `mock` query parameter. They are not production shell controls.

## Do's and Don'ts

- Do use the Lattices preset in `theme.css`, with layout in `editor.css`.
- Do retain actual kit components, stable mounts and read-only semantics.
- Do respect host chrome capability and retain the standalone fallback.
- Do keep Preview counts and Source metadata in panel header slots.
- Do use amber for ambiguity and failures, including ambiguous Source ranges.
- Don't invent host layer colors or resolver match reasons.
- Don't restore the previous 30px rows or monospace secondary app names.
- Don't duplicate native page chrome in host mode.
- Don't reset saved wide layouts for the narrow view.
- Don't add purple, decorative motion, editing, message submission or terminal
  execution.
- Don't claim the internal contact sheet verifies the inaccessible canvas.

## Read-only flow pass: A–H

The v7 Layers pass preserves the behavior below while superseding the earlier
Hudson-default styling and global chrome placement.

- **A · Chrome:** capability-gated native ownership; standalone header, peer
  toolbar and bottom status remain as a fallback. Kit panel headers carry
  local metadata.
- **B · Labels:** one label per purpose. Source identifies workspace.json in
  its header; the content is still the layers subset. Panel Actions menus stay
  hidden without removing reorder or supported visibility controls.
- **C · Context:** removable app/title context, future-agent guidance, three
  display-only examples and an honestly disabled composer. No writes implied.
- **D · Preview:** dense 34px kit rows, neutral initial tiles, sticky group
  headings and count badges. Empty groups stay compact; Unassigned is last.
  No invented winning-match reason or per-layer color data.
- **E · Follow selection:** nearest instant scrolling both ways, all duplicate
  ranges preserved, amber ambiguity and explicit duplicate-count feedback.
  Panel nodes and CodeMirror survive layout and refresh changes.
- **F · Narrow:** Preview at least 62vh, context strip, then visible Source and
  remaining panels. CSS only; wide saves unchanged.
- **G · History:** one useful empty line, newest-first relative times with
  absolute tooltips and short revisions.
- **H · Copy:** concrete window/configuration language and explicit unavailable
  capabilities. Native Lattices preset; no decorative motion.
