# HUD-011 — Experimental level history and coalescing G1 admission

Status: G1 complete at X3

## Admission

| Field | Record |
| --- | --- |
| Owner | Iris–Hudson integration DRI |
| First intended consumer | `IrisExperimentalProof` at X5 |
| Second independent live consumer | None; G3 remains blocked |
| Review by | 2026-10-16 |
| Generic API | `HudLevelHistory(capacity:)`, `append(_:)`, `removeAll()`, `samples`, `latest`, and `HudLevelCoalescer(minimumInterval:)` with `observe(_:elapsed:)`, `flush()`, and `reset()` |
| Canonical behavioral references | `f251c5b1:apps/ios/Talkie iOS/Models/AudioRecorderManager.swift` and `f251c5b1:apps/ios/Talkie iOS/Views/WaveformView.swift` (read-only) |
| Current Iris scenario | IRIS-002 / X5 amplitude-history proof |

`HudLevelHistory` is a Foundation-free fixed-capacity ring. Its logical value is capacity plus
chronological samples; it retains no timestamps or product state. `HudLevelCoalescer` is a separate
Foundation-free caller-time value. It has no clock, timer, actor, async behavior, or coupling to a
history. The caller supplies monotonic elapsed session time and decides how emitted samples are used.

## Invariants and G1 evidence

- Requested history capacity is clamped to zero or above. Append is a no-op at zero capacity; when
  full, the next append replaces the oldest sample. `samples` is always oldest-to-newest.
- Positive coalescing intervals emit the first sample immediately, retain a within-window peak, and
  emit at most one peak at an exact/after boundary even after a long gap. Regressive elapsed time
  clears old state and emits the current sample. Non-positive intervals pass every sample through.
- `HudsonKitExperimentalTests` covers ring wrapping, capacities, logical equality/copying, removal,
  `Sendable`, peak/boundary/long-gap behavior, flush, reset, regression, and non-positive intervals.
- `HudsonKitExperimentalDemo` retains X2 output and adds fixed elapsed coalescing events plus a
  bounded chronological history result. The boundary checker continues to prove target isolation.

## Exclusions

This admission adds no strategy enum, timestamps on samples, clocks, timers, actors, async work,
smoothing, decay, AVFoundation, PCM, persistence, `Codable`, UI, geometry, accessibility, or product
policy. It is not a live-input proof and does not satisfy G2. No second independent live consumer
exists, so G3 remains blocked.
