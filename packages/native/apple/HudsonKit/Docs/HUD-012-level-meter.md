# HUD-012 — Experimental live-level meter G1 admission

Status: G1 complete at X4

## Admission

| Field | Record |
| --- | --- |
| Owner | Iris–Hudson integration DRI |
| First intended consumer | `IrisExperimentalProof` at X5 |
| Second independent live consumer | None; G3 remains blocked |
| Review by | 2026-10-16 |
| Generic API | `HudLevelMeterGeometry`, `HudLevelMeterBarGeometry`, `HudLevelMeterAccessibility`, and guarded `HudLevelMeter` |
| Canonical behavioral reference | `f251c5b1:apps/ios/Talkie iOS/Views/WaveformView.swift` (read-only) |
| Current Iris scenario | IRIS-002 / X5 amplitude-history proof |

`HudLevelMeterGeometry` is a Foundation-free value layout. It keeps a chronological suffix that fits
fixed bars and spacing, anchors the newest sample at the trailing edge, and preserves a centered
vertical baseline with a minimum visible height. `HudLevelMeterAccessibility` is a structural
snapshot: an empty history is distinct from a history of silent samples. The guarded SwiftUI
`HudLevelMeter` renders that geometry in a single Canvas pass with a caller-supplied tint and one
combined accessibility element.

## G1 evidence

- The public mechanics use only generic level-history vocabulary and remain in the zero-SwiftPM-
  dependency `HudsonKitExperimental` target.
- Deterministic tests cover exact geometry, trailing suffix truncation, minimum height, invalid and
  extreme dimensions, copying, `Sendable`, and empty/current/peak/count accessibility snapshots.
- `HudsonKitExperimentalVisualDemo` is an isolated executable target with a fixed synthetic sequence
  and explicit Advance and Reset controls. CI builds it; an explicit `--snapshot PATH` mode renders
  the same initial surface offscreen for repeatable visual evidence without screen-capture access,
  with `--dark` selecting the matching semantic appearance.
- On 2026-07-19, the executable was rebuilt and relaunched on macOS. The light and dark snapshot
  artifacts `hudson-x4-level-meter-final.png` and `hudson-x4-level-meter-dark.png` were reviewed at
  1,800 × 900 pixels. Both show the same right-anchored 36-sample history, semantic lane and
  centerline, readable status, and deterministic Advance/Reset controls without clipping or theme
  corruption.
- The experimental-boundary checker permits the visual demo only at its exact path and proves that
  stable Hudson products and targets cannot depend on the experimental rail.

## Exclusions

This admission adds no clock, timer, animation loop, async work, random source, audio input,
permission, recording, PCM, persistence, `Codable`, product policy, product styling, or stable
promotion. It is not a live-input proof and does not satisfy G2. No second independent live consumer
exists, so G3 remains blocked.
