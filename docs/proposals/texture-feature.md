# Texture Feature — Logo Designer

**Status:** Draft proposal · **Anchor:** `be23f4ad.js` (Talkie T · Instrument Viewer-v2-metal-v1)

## 1. Why

Templates keep reinventing texture systems. `talkie-v2-metal-frame.js` ships an inline `renderTexture()` dispatcher with five named treatments (`pcb-grid`, `brushed`, `perforated`, `hairline-cross`, `concentric`) and a single `textureIntensity` knob. Its child `be23f4ad.js` walks away from that dispatcher and grows a 13-param hand-rolled `renderEngraving()` for ticks/crosshair/datum bands/serial. Sibling glyph templates (`talkie-halftone`, `talkie-dot-matrix`, `talkie-etched`) each ship their own per-texture geometry inline. Same surface vocabulary, five different implementations, five different param namespaces. Promoting these treatments into first-class **textures** removes the duplication and makes "give panel X surface Y" a one-liner for template authors.

## 2. Two textural modes (and the one we're spec'ing)

Reading the existing 64 templates surfaces two distinct uses of texture, and the difference matters:

- **Surface textures** — applied as a clipped overlay on an already-formed shape. The shape exists either way; the texture decorates it. Examples: `talkie-v2-metal-frame` (textured beam panels), `be23f4ad` (engraved beam panels). **This is what v1 ships.**
- **Constitutive textures** — the texture *is* the glyph; there is no underlying solid shape. Examples: `talkie-dot-matrix` (T-shaped field of dots), `talkie-halftone` (T-shaped halftone), `talkie-etched` (T filled with cross-hatching). These need glyph-aware sampling and stay out of v1.

The v1 mental model is therefore: **"a template hands a texture a box and a clip path; the texture fills it."** Constitutive treatments can later be expressed as `applyTexture(name, glyphPath, ...)` once we have a glyph path-source API, but that's a separate motion.

## 3. v1 catalog

Six textures, chosen so each pulls visual weight from a distinct vocabulary. Treatments that overlap with another, or that exist in only one template, fold into a sibling:

| Texture | Keep? | Notes |
|---|---|---|
| `engraving` | ✅ | New. Promoted wholesale from `be23f4ad` (ticks + crosshair + bullseye + sighting circle + datum bands + serial). Hero use-case for the abstraction. |
| `brushed` | ✅ | Promoted from `talkie-v2-metal-frame.tx_brushed`. Spacing + jitter + contrast knobs. |
| `pcb-grid` | ✅ | Promoted from `talkie-v2-metal-frame.tx_pcbGrid`. Divisions + dot-vs-line knobs. |
| `perforated` | ✅ | Promoted from `talkie-v2-metal-frame.tx_perforated`. Hole size + spacing + offset rows. |
| `halftone` | ✅ | Distinct vocabulary (variable-size dots on a regular grid) that nothing else gives us. Generalize `talkie-halftone`'s dot generator. |
| `concentric` | ✅ | Cheap and visually unique. Promoted from `tx_concentric`. Spacing + center-bias knobs. |
| `hairline-cross` | ⛔ → fold | Visually a low-contrast sibling of `etched-hatch`/`brushed`. Drop as a distinct texture; expose `crossHatch: bool` as a `brushed` knob. |
| `dot-matrix` | ⛔ → fold | LED-grid look duplicates `halftone` at fixed dot size. Expose `uniformDot: bool` on `halftone`. |
| `etched-hatch` | ⛔ → fold | Cross-hatching is `brushed` with two angles. Expose `secondAngle` on `brushed`. |

**Missing candidates worth adding later, not now:** `noise` (procedural perlin), `wood-grain`, `scanline` (CRT/raster). Skipped because v1 should ship a tight, opinionated set.

## 4. Application model

A texture is a **clipped overlay layer** with a declared *composite mode*. The template owns geometry and palette; the texture owns the marks it draws. The template calls in, the texture returns SVG markup that the template inserts inside its own `<defs>` + clip-path scaffolding.

Compositing options on the texture itself:

- `mode: 'overlay'` (default) — draws on top of the existing fill, alpha-blended via the texture's `opacity`. Works for `engraving`, `brushed`, `concentric`, `pcb-grid`. Matches what `be23f4ad` does today.
- `mode: 'fill'` — replaces the panel's solid fill (used when the texture *is* the surface, e.g. dense `perforated` or `halftone`). The texture is responsible for drawing its own background.
- `mode: 'mask'` — uses the texture as an alpha mask against a caller-supplied fill. Out of scope for v1 unless an early adopter needs it.

**Who picks?** Hybrid. The template *declares which boxes are textured* (`{ id: 'cap', rect, clipPath }`, `{ id: 'stem', rect, clipPath }`) and *which textures are compatible* (an enum of allowed names plus a default). The user picks from that enum in the inspector. This preserves template authors' control over composition (e.g. metal-frame says "engraving/brushed/pcb-grid only — halftone would look wrong here") while keeping the choice in the user's hands.

## 5. Param surface

Two-tier:

**Shared baseline** (every texture, every template gets these for free):

```
opacity   number  0..1
density   number  0..2   (texture-specific scale: tick spacing, dot grid, hatch freq)
ink       color   defaults to template's detailInk
scale     number  0.5..2  (overall feature size)
```

**Texture-specific extras**, declared by the texture itself:

```
engraving: showTicks, tickMajorEvery, showCrosshair, bullseyeRadius,
           showSightingCircle, showDatumBands, datumBandCount, showSerialMark
brushed:   spacing, jitter, crossHatch, secondAngle
halftone:  dotMin, dotMax, uniformDot, grid
…
```

**Inspector strategy:** the four shared params render as a fixed "Texture" group at the top. Per-texture extras render as a collapsible sub-group named for the active texture (`"Engraving"`, `"Brushed"`). When the user switches texture, the sub-group swaps. This avoids the current `be23f4ad` problem where 13 engraving params live as siblings of Geometry/Colors/Hardware and clutter the inspector even when engraving is off.

Param defs come from the texture catalog itself — the template doesn't redeclare them, it just opts in. Inspector reads `texture.paramDefs` and merges into the rendered group list.

## 6. Authoring API

Template author writes:

```js
// Declare which boxes are textured (template-side)
const surfaces = [
  { id: 'cap',  rect: { x, y, w, h }, clipPath: capD },
  { id: 'stem', rect: { x, y, w, h }, clipPath: stemD, surface: 'stem' /* affordance for textures that vary by panel, e.g. sighting circle */ },
];

// Apply the user's chosen texture to each
svg += renderTextureFor(surfaces, p);
```

`renderTextureFor()` is a runtime-provided helper (alongside `vb`, `p`, etc.) that:

1. Reads the active texture name + params from `p.texture`, `p.textureOpacity`, etc.
2. Wraps the texture's marks in the supplied `<clipPath>`.
3. Returns the composed SVG string.

The texture itself is a small module exporting `{ name, paramDefs, render($box, params, ctx) }`. `ctx` carries the surface id and palette so e.g. `engraving` can draw its sighting circle only on `stem`.

Declarative-only ("texture: engraving on cap, brushed on stem") was considered and rejected for v1 — templates already compose freely in JS and forcing a config layer fights the existing authoring style.

## 7. Compatibility & migration

64 existing templates. **No forced migration.** Adoption is opt-in, per template:

1. Ship the texture runtime + `engraving`, `brushed`, `pcb-grid`, `perforated`, `halftone`, `concentric` as the v1 catalog.
2. Migrate `talkie-v2-metal-frame` first — it's the obvious win, its current dispatcher already maps 1:1 onto five of the six.
3. Migrate `be23f4ad` second — replaces `renderEngraving()` with `applyTexture('engraving', ...)`, keeps every param the user already has, deletes ~100 lines.
4. Templates that don't want textures keep working untouched; the runtime is additive.

Param-name continuity matters: when migrating `be23f4ad`, namespace the old engraving params under the texture (`texture.showTicks`, not `showTicks`) but support a one-version compat shim that reads top-level names and re-routes. Drop the shim after the next pass.

## 8. Out of scope for v1

- **Animated textures** (anything time-varying). Static-render-only for now.
- **Raster textures** (PNG/JPG fills via `<pattern>` or `<image>`). Adds an export/asset pipeline we don't need yet.
- **User-uploaded patterns.** Same reason.
- **Procedural noise** (perlin, simplex). Tempting but every knob is hard to make legible — defer.
- **Constitutive textures** (texture-as-glyph). Needs a glyph-path API first; tracked separately.
- **Multi-texture per panel** (layering `brushed` *under* `engraving`). Possible later; v1 is one texture per surface.

## 9. Open questions

- Should `density` and `scale` really be separate, or is that two knobs for one mental thing? Lean toward keeping both — `density` controls feature *count* (tick spacing), `scale` controls feature *size* (tick length). They diverge in practice.
- Where do texture defs live? Likely `app/apps/logo/textures/{name}.ts` so they're tree-shakable and editable without a server round-trip.
- Inspector: should switching texture preserve overlapping param values (e.g. `opacity` carries over)? Yes for shared baseline, reset for texture-specific.
- Naming: `engraving` is precise but template-author-coded. Worth a usability check against "instrument" or "calibration" once the feature is wired up.
