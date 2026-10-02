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
  surface-band: "#142128"
  hover: "#172a33"
  chip: "#18333e"
  glyph-slate: "#263b46"
  glyph-blue: "#203e56"
  glyph-teal: "#1d4547"
typography:
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

## Typography

System UI text provides compact operational labels. The page title is 15px,
semibold; panel headings and body text are 13px. Source uses monospace JSON
with line numbers and syntax highlighting.

## Layout

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
  column and hides resize separators. This does not rewrite the saved wide
  layout. The toolbar and page heading can wrap.

## Elevation & Depth

Peer panels are flat, separated by borders rather than raised cards. Selected
Preview rows use a cyan-toned fill and inset outline. Do not animate data
refreshes; preserve panel mounts and the existing Source editor.

## Shapes

Controls have modest rounded corners: buttons use 5px, Preview rows 4px and
the disabled Chat field 6px. Panel divisions remain straight and compact.

## Components

- **Chat:** inspection guidance and a disabled composer labeled “Agent coming
  in slice 3.” It does not send messages.
- **Preview:** window rows grouped by workspace layer, with counts and empty
  group feedback. Rows support selection and Cmd/Ctrl additive selection.
- **Source:** read-only CodeMirror JSON. “Inspect Source” reveals this panel.
  Selection links source ranges with Preview rows; ambiguous matches receive
  textual feedback and highlight all candidate ranges.
- **History & Results:** session-local external configuration changes, newest
  first, with timestamps and revision identifiers; an explicit empty state
  appears before any change.
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
