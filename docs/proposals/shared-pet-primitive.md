# Proposal: Shared Native Pet Primitive

**Status:** Proposed — docs only; no implementation authorized
**Owner:** HudsonUI (proposed), with HudsonCanvas host adapter
**Consumers:** Lattices, Scout and Linea

## Intent

Move atlas loading and sprite playback into HudsonKit while products retain
characters, reading/agent state, placement policy and overlay ownership.
This complements [Hudson Canvas](../hudson-canvas.md); a pet is an actor,
not a terminal runtime or a requirement of the Canvas terminal feature flag.

## Proposed boundary

- A portable `HudPetManifest` loads a local `pet.json` and PNG/lossless WebP
  atlas from an explicit product-owned asset root. Support existing
  `displayName`, `spritesheetPath`, per-state row/frame count/cell size, plus
  explicit grid dimensions, per-state fps and variable frame durations.
  Normalize compatible legacy manifests; never assume an undocumented grid.
- Validate image dimensions, alpha, finite positive timing, frame bounds,
  path traversal and alias cycles before playback. Unknown states fall back
  to idle. Missing/invalid assets return a diagnosable error and static
  placeholder; no implicit network fetch, Codex home scan or pet registry.
- `HudPetPlayer` supplies deterministic elapsed-time frame selection,
  state-entry reset, loop/once completion, and optional sixteen look poses.
  An injectable monotonic clock makes frame selection unit-testable.
- State aliases map product names to canonical states, optional frame
  indices/durations/fps, loop policy and a completion destination. Linea's
  `answer ready` plays one jumping cycle then rest; `thinking` uses the
  running row at 130 ms, not the renderer's generic running speed.
- `HudPetView` is a SwiftUI view with an AppKit representable renderer on
  macOS (and a native SwiftUI/image backend for iOS). Decode/cache an atlas
  once, draw a source cell without re-decoding, and preserve transparent
  pixels. Centralize top-left atlas to AppKit bottom-left source conversion.
- Scale is an explicit visual size, independent of atlas resolution and
  Canvas zoom. Preserve aspect ratio and define a feet/baseline anchor.
  Reduce Motion holds a stable frame, suppressing hop/sway/shimmer; state
  changes remain visible. Stop clocks when hidden, paused or offscreen.
  Accessibility exposes name/state once, not repeated frame announcements.

Proposed names above describe the seam, not an already-shipped API.

## Canvas and screen overlay placement

A host owns actor ID, asset root, state/alias, look index, scale and anchor.
Canvas converts world coordinates through its existing viewport transform;
HUD actors use viewport coordinates instead. Screen overlays provide screen
coordinates. The player knows neither window management nor terminal sessions.
Use a small placement adapter rather than adding actor fields to runtime
commands prematurely. Host decides clipping, z-order, click-through, hit tests,
visibility and pointer routing. Persist the stable asset/state/placement, not
clock ticks or animation frames. A future web adapter can share the manifest
and playback semantics without sharing AppKit rendering.

## What Lattices hands over

Current `ScreenOverlayCanvasController.swift` has a `.pet` payload, a 60 Hz
animation timer and `CodexPetAssetCache`. That cache resolves bundled or Codex
roots, caches NSImage/metadata, selects frames with wall-clock modulo at a
fixed 8 fps and converts the source rectangle. Hudson should take the loader,
manifest normalization, atlas cache, frame clock and source-cell drawing.
Lattices keeps its payload routing, glyph fallback, name/message/actor HUD,
application targeting, screen placement, dragging, collision/arrival motion,
activation and lifetime. Its controller timer may still drive actor movement;
Hudson's player independently handles sprite timing and reduced motion.

Scout currently supplies assets rather than a shared player; adoption means
providing its asset root and state. Linea ships twelve local Broad nib actors
with `linea_aliases`; adoption requires no regenerated character artwork.

## Implementation slices and acceptance (future work)

1. Manifest/atlas loader and pure clock tests, including legacy Scout and
   Lattices fixtures plus Linea aliases and 9-row/16-look v2 fixtures.
2. SwiftUI + AppKit player: fps, variable durations, single-shot completion,
   alpha, scale, Y inversion, missing asset and Reduce Motion tests.
3. Lattices adapter removes duplicated sprite loader/timing/drawing only;
   screenshot and interaction checks preserve its overlay behavior.
4. Scout/Linea host adapters and an optional Canvas actor sample.

No uploads, global pet creation, model generation or rendering implementation
are part of this proposal. Product-owned assets remain in their own repos.
