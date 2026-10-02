---
name: Lattices Editor
description: Read-only configuration inspection in the Hudson peer-panel shell.
colors:
  background: "#0a0f12"
  ink: "#e5edf0"
  muted: "#a6b9c2"
  border: "#2c3c43"
  accent: "#67e8f9"
  selected-row: "#164e63"
  surface: "#10191d"
  text-selection: "#155e75"
  selected-ink: "#ecfeff"
  selected-secondary: "#cffafe"
  selected-outline: "#36849a"
  scrollbar: "#47616c"
  notice-ink: "#fcd34d"
  notice-background: "#241e12"
  surface-band: "#142128"
  hover: "#172a33"
  chip: "#18333e"
  glyph-slate: "#263b46"
  glyph-blue: "#203e56"
  glyph-teal: "#1d4547"
typography:
  title:
    fontSize: "14px"
    fontWeight: 600
  label:
    fontSize: "12px"
  metadata:
    fontSize: "11px"
  micro:
    fontSize: "10px"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "13px"
    lineHeight: 1.5
---

# Lattices Editor

## Overview

The pinned direction is Operate: expand the existing Hudson agent-workspace
language, not a new brand. The built surface uses a dark native-host shell,
custom Hudson chrome, cyan selection and a flat grid of peer panels.

## Colors

Dark backgrounds and muted blue-gray dividers keep configuration content
primary. Light ink carries labels; muted ink carries secondary context. Cyan
marks focus and selection. Amber notices distinguish stale or failed reads.
Surface bands, hover fills and chips provide quiet grouping; deterministic
slate, blue and teal glyph fills distinguish app initials without adding new
accents. Selection uses separate fill, outline, primary and secondary ink
colors; text selection has its own cyan-toned fill. Scrollbars stay muted.

## Typography

System UI text provides compact operational labels. The implemented type ramp
is 10/11/12/13/14px: badges and initials, metadata and toolbar labels, panel
headings and controls, body text, then the semibold page title. At narrow
widths the title reduces to 12px and header actions to 11px. Source uses
monospace JSON with line numbers and syntax highlighting.

## Layout

- The main header combines subject, Read only, selection summary, Clear and
  actions in a compact 46px minimum height. The layout toolbar and panel
  headers are 28px tall. Below 500px, the selection summary wraps to a new row.
- First open shows Chat and Preview side by side at 38:62, with Preview wider.
  Source, History & Results and Terminal open on demand through Panels;
  Inspect Source also opens Source without losing selection or panel state.
- Expanded layout shows Chat, Preview, History & Results and Source in a
  filled two-column, two-row grid. Terminal remains hidden.
- The app uses the lattices.editor.layout.v3 storage namespace to apply this
  preset once in place of old layouts. Subsequent user layouts take precedence;
  the old namespace and other kit consumers remain untouched.
- The Panels picker includes all five panels, including Terminal. Preserve
  the shell's Single, Columns, Rows and Grid layouts, focus, visibility,
  reorder and resize controls.
- At a panel-host width of 680px or less, CSS stacks panels in one scrolling
  column and hides resize separators. Preview comes first at a minimum of
  60vh; compact chips-only Chat follows (or its selection hint when empty),
  with examples and composer hidden. Other visible panels follow. This does
  not rewrite the saved wide layout.

## Elevation & Depth

Peer panels are flat, separated by borders rather than raised cards. Selected
Preview rows use a cyan-toned fill and inset outline. Do not animate data
refreshes; preserve panel mounts and the existing Source editor.

## Shapes

Controls have modest rounded corners: buttons and app glyphs use 4px,
Preview rows and group bands 3px, and context chips and the disabled composer
5px. Panel divisions remain straight and compact.

## Components

- **Chat:** removable app/title context chips mirror selected windows; an
  empty selection shows a short hint. Three examples are explicitly introduced
  as requests for when an agent is available. The disabled composer says
  “Ask about these windows… (agent arrives in a later version)”; it cannot send.
- **Preview:** a keyboard-operable multiselect listbox with 30px single-line
  rows, deterministic app-initial glyphs, ellipsized titles and secondary app
  names. Sticky group bands carry count badges; empty groups occupy one line.
  Unassigned appears last, separated by a divider. Click or Enter/Space selects;
  Cmd/Ctrl adds or removes a selection. Arrows and Home/End move the active row.
  Panel Actions menus are hidden here; handles retain reorder and Panels
  retains visibility controls.
- **Source:** read-only CodeMirror JSON. “Inspect Source” reveals this panel.
  Its label is “workspace.json · layers subset.” Selection links source ranges
  with Preview rows and scrolls the first match into view using nearest,
  instant scrolling in either direction. Duplicate matches retain all range
  highlights and an explicit entry count in the header. Clear and chip removal
  update the shared selection without replacing the editor or panel mounts.
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
- **Mock controls:** the synthetic-host controls visible in development
  screenshots require a non-production build and the `mock` query parameter.
  They are not production shell controls.

## Do's and Don'ts

- Do preserve the dark Hudson shell, cyan selection and flat peer grid.
- Do describe actual loading, unavailable, empty, ambiguous and stale states.
- Do keep read-only and unavailable capabilities explicit.
- Don't add purple, decorative motion or a replacement visual identity.
- Don't reset saved wide layouts to implement narrow-screen stacking.
- Don't imply that Chat sends messages, Source edits files or Terminal runs
  commands.

## Read-only flow pass — before → after (A–H)

The following note was written before implementation and is preserved as the
pass brief. A–H are now implemented; the sections above describe the built
surface, checked against the desktop and narrow design-evidence captures.

- **A · Chrome:** four stacked chrome rows → one compact subject/selection/action
  header, a 28px kit layout toolbar, and compact panel headers. No new shell fork.
- **B · Labels:** repeated Chat/Read only/Actions → one label per purpose;
  Source identifies workspace.json's layers subset. Generic opt-in panel action
  visibility defaults to today's kit behavior; this app hides those menus.
  Reorder remains available on panel handles and visibility in Panels.
- **C · Context:** empty Chat and dead box → removable app/title selection chips,
  a selection hint, three plainly labelled future examples, and an honestly
  disabled composer. No agent functionality or writes implied.
- **D · Preview:** loose two-line rows → 30px single-line rows, deterministic
  blue/teal/slate initial glyphs, sticky surface-band headers and count badges.
  Empty groups collapse to one line; Unassigned is last and separated. No
  invented match reason: entry canonical content describes configuration but
  does not reliably identify the resolver's per-row winning reason.
- **E · Follow selection:** highlights alone → nearest instant scrolling in both
  directions, all duplicate ranges preserved, explicit duplicate-count summary.
  Panel nodes and CodeMirror remain mounted through layout and refresh changes.
- **F · Narrow:** equal-height stack → Preview first at least 60vh, compact
  chips-only Chat next, then other visible panels. CSS only; wide saves unchanged.
- **G · History:** verbose empty state and hashes → one useful empty line,
  newest-first relative timestamps with absolute tooltips and short revisions.
- **H · Copy:** implementation terms → concrete window/configuration language.
  Dark Hudson surfaces and cyan selection/focus remain; no decorative motion.

Additional tokens: surface-band #142128, hover #172a33, chip #18333e;
glyph slate #263b46, blue #203e56, teal #1d4547. These are quiet content
grouping surfaces, not new accent colors.
