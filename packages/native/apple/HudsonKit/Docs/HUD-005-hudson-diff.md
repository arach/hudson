# HUD-005: HudsonDiff Presentation Model

HudsonDiff is the shared diff presentation layer for Hudson surfaces. It is not
a diff algorithm, canvas renderer, or web view. It owns a small document model
for unified patches so native, web, and agent-driven hosts can render the same
diff consistently.

## Responsibilities

- Accept unified diff text from git, agents, hosts, or external tools.
- Produce a stable `hudson.diff.v1` document.
- Track files, hunks, rows, line numbers, row kind, stats, and optional spans.
- Stay independent from SwiftUI, AppKit, WebKit, Termini, and Canvas.

## Non-responsibilities

- HudsonDiff does not compute diffs from source snapshots.
- Hosts decide which diff engine or tool creates the unified patch.
- Canvas decides how to put diffs on a canvas.
- Hudson web decides whether to render with a React diff component.
- Hosts decide how to resolve comparison sources such as git refs, workspace
  files, remote files, or literal text.

## Shape

The model is:

```text
HudDiffDocument
  files[]
    hunks[]
      rows[]
```

`HudUnifiedDiffParser` parses existing unified patches into this model.

## Canvas Use

Canvas consumes `HudDiffDocument` for:

- cheap native canvas cards
- native focused diff viewing
- pop-out/detail diff surfaces

That keeps the canvas free of large DOM/WebKit trees. Web renderers can still
consume the same JSON document later when the host wants Diffs.com-style polish.

## Host Contract

Hosts should send either unified diff text or a prebuilt `hudson.diff.v1`
document. That lets Scout, Talkie, Codex, Hudson web, and native Hudson apps
share one render shape while using whatever diff engine already makes sense for
their source data.
