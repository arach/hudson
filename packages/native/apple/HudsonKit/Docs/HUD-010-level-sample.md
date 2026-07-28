# HUD-010 — Experimental level sample G1 admission

Status: G1 complete at X2

## Admission

| Field | Record |
| --- | --- |
| Owner | Iris–Hudson integration DRI |
| First intended consumer | `IrisExperimentalProof` at X5 |
| Second independent live consumer | None; G3 remains blocked |
| Review by | 2026-10-16 |
| Generic API | `HudLevelSample(unitValue:)`, `HudLevelNormalizer.unit(_:)`, and `HudLevelNormalizer.linear(_:from:to:)` |
| Canonical behavioral reference | `f251c5b1:apps/ios/Talkie iOS/Views/WaveformView.swift` (read-only) |
| Current Iris scenario | IRIS-002 / X5 amplitude-history proof |

`HudLevelSample` is a Foundation-free `Equatable`, `Hashable`, `Sendable` value with immutable
`unitValue`. Construction normalizes the stored value to a finite closed `0...1` interval.
`HudLevelNormalizer` is a pure namespace: `unit(_:)` rejects non-finite values, clamps finite input,
and canonicalizes negative zero; `linear(_:from:to:)` rejects non-finite input or bounds plus
reversed/equal bounds, otherwise clamps a finite linear mapping through `unit(_:)`.

The API uses level and normalization vocabulary only: it carries no product nouns or imports because
the reusable boundary is a scalar mapping, while Iris retains live-input policy and its proof adapter.

## G1 evidence

- The API uses generic level/normalization names and imports no product framework or product domain.
- `HudsonKitExperimentalTests` covers unit edges, NaN/infinities, negative zero, the `-80...0`
  golden range, custom ranges, invalid bounds, the sample invariant, and `Sendable` conformance.
- `HudsonKitExperimentalDemo` depends only on `HudsonKitExperimental` and prints fixed synthetic
  unit and linear normalization examples; the Apple CI job executes it explicitly.
- The experimental-boundary checker proves stable products/targets remain independent and permits
  experimental imports only in the exact experimental source, test, and demo paths.

## Exclusions

This admission does not add a timestamp, `Codable`, persistence, AVFoundation, recording or audio
policy, product nouns, history, coalescing, smoothing, geometry, or SwiftUI visualization. Those
are separate admissions, if needed. X2 is not a live-input proof and does not satisfy G2. There is
no second independent live consumer, so G3 remains blocked.
