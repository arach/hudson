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
