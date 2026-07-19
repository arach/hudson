# HUD-009 — HudsonKitExperimental quarantine

Status: X1 implemented; X2 level sample and X3 history/coalescing G1 complete

`HudsonKitExperimental` is a separate SwiftPM library product and target for reusable Apple
mechanics that are not yet eligible for stable HudsonKit. It is deliberately not an SPI namespace:
`@_spi(Experimental)` is prohibited.

## Non-negotiable boundary

- Stable Hudson products and targets must not directly or transitively depend on, import, or
  re-export `HudsonKitExperimental`.
- The experimental target has no dependencies. X1 contained only its compile-time module anchor;
  X2 admits the separately documented level-sample primitive; X3 adds bounded history and caller-time
  coalescing, exercised by the same isolated console demo.
- `scripts/apple/check-experimental-boundary.py` validates that boundary from every CI-evaluated
  SwiftPM graph shape and the complete Apple source tree, including conditionally compiled targets.
  Its fixture seam and negative tests protect direct/transitive graph leaks, imports, re-exports,
  and SPI escapes.
- Downstream products may use the rail only through their own isolated proof target and thin,
  allowlisted adapter. Release targets remain independent.

## Incubation sequence

| Step | Outcome | Required evidence |
| --- | --- | --- |
| X1 | Separate product/target, dedicated tests, graph/source enforcement | Isolation checker and stable build pass. **No component is admitted and this does not satisfy G1 demo/evidence.** |
| X2 | `HudLevelSample` and `HudLevelNormalizer` enter the rail | G1 complete for the sample primitive; see HUD-010 |
| X3 | `HudLevelHistory` and `HudLevelCoalescer` add bounded history and coalescing | G1 complete for the history/coalescing primitives; see HUD-011 |
| X4 | A primitive gains deterministic presentation, accessibility, and a synthetic-source demo | Its own G1 admission, deterministic tests, demo, and review record |
| X5 | An isolated downstream proof uses real input through one thin adapter | G2 evidence records API friction and a next action |

## Gates

- **G1 — admission:** generic name; no product-domain imports or nouns; deterministic tests;
  Hudson demo; named owner; review date.
- **G2 — live proof:** one isolated downstream consumer exercises real input through a thin adapter
  and records API friction. This is not a release dependency.
- **G3 — stable promotion:** a second independent live consumer reshapes the API; migration,
  versioning, documentation, and stable tests are complete.

At review, the owner promotes the component, re-incubates it with a written reason, or retires it
when it is no longer used. There is no automatic promotion and no automatic deletion of code a
consumer ships.
