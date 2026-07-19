# HUD-009 — HudsonKitExperimental quarantine

Status: X1 implemented; no component admitted

`HudsonKitExperimental` is a separate SwiftPM library product and target for reusable Apple
mechanics that are not yet eligible for stable HudsonKit. It is deliberately not an SPI namespace:
`@_spi(Experimental)` is prohibited.

## Non-negotiable boundary

- Stable Hudson products and targets must not directly or transitively depend on, import, or
  re-export `HudsonKitExperimental`.
- The experimental target has no dependencies at X1. It contains only a compile-time module anchor,
  not a component, API family, or demo.
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
| X2 | A narrowly generic primitive enters the rail | G1 admission for that primitive |
| X3 | The primitive gains its bounded behavior and deterministic tests | G1 evidence remains current |
| X4 | Deterministic presentation plus accessibility and a synthetic-source demo | G1 is complete for the component |
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
