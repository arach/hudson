# Playbook · Brand commission

For "render N directions of a mark and show them side-by-side on a page" requests from narrative-studio, product owners, or external designers. Derived from the 2026-05 talkie-mark-hudson-round (3-direction commission).

## When to use

- An agent or stakeholder addresses Hudson with: "design / explore / show me N options for a brand mark"
- The deliverable is a **live URL** for review, not a static file dump
- The mark needs to survive a format ladder (typically 16 / 64 / 256 / 1024)
- Each direction needs supporting context: app icon variant, wordmark lockup, rationale

If the ask is "package an existing mark into icns/ico/iOS xcassets" — that's an [asset-export](#) workflow, not this one. (No playbook yet — write one when next encountered.)

## Surfaces touched

Expect to write to / read from all of these:

| Path | Why |
|------|-----|
| `app/<route-name>/page.tsx` | New Next route hosting the exploration UI |
| `public/fonts/` | Drop the wordmark TTF here (copy from upstream brand repo, e.g. narrative-studio) |
| `output/<commission-name>/` | Static deliverables — only if the brief asks for them (icns, social previews, etc.) |
| The brief itself | Usually under `<upstream>/docs/specs/*.md` — read this end-to-end before designing |
| Existing brand assets | Reference PNG masters under upstream `public/` for visual continuity |
| `BRAND.md` for the brand | Color tokens, type system, do's and don'ts |
| `.coordination/commissions.md` | Append-only commissions log entry when done |

Do NOT typically modify:
- `site/export-pages.mjs` `staticRoutes` — internal exploration pages stay dev-only (don't deploy to hudsonkit.com/app.hudsonkit.com)
- Existing logo app templates (`app/apps/logo/`) — unless the commission is asking for parametric variants, which is a different shape of work
- Marketing deck sheets — only if the commission is genuinely for the public deck

## Steps

1. **Read the brief end-to-end.** Note explicitly: brand tokens, type system, format ladder, no-go list (no mics, no certain colors, etc.), reference URLs to compare against.

2. **Pull the canonical brand state.** `BRAND.md` for the brand, palette tokens from the upstream repo, current canonical asset PNGs from `<upstream>/public/`. **Don't reinvent the palette or type system.** Mirror the tokens into your page file as a `const C = {...}` block so the SVG fills don't drift.

3. **Set up the font.** If the wordmark uses a custom font, copy it into `hudson/public/fonts/` (e.g. `Talkie-Medium.ttf` from narrative-studio). Inline an `@font-face` rule in the page or add to `app/layout.tsx`.

4. **Survey existing related pages.** Look for a precedent file (e.g. `app/talkie-textures/page.tsx`) — they often have brand tokens, glyph geometry helpers, frame components, and wordmark layout code worth lifting verbatim.

5. **Design each direction as an inline SVG component.** Don't pull from the parametric Logo Studio templates unless the brief specifically asks for parametric exploration. Each mark is its own component:
   - viewBox `0 0 1024 1024` for the icon-square master, or aspect-ratio-appropriate
   - Constants for proportions (`u = vb / 8` for an 8-unit grid, etc.)
   - Take a `size` and `ink` prop so the same component renders at every ladder size with the same color
   - Optional `showGrid` / `accent` props for construction or detail views

6. **Compose the per-direction layout:**
   - Section header — direction number + title + short claim sentence
   - Format ladder — render at 16 / 64 / 256 / 1024 (use smaller display sizes for layout)
   - App icon — squircle (rx ≈ 0.225 × dim), canonical (Studio Cream on Ribbon Black) + one inverted
   - Wordmark lockup — mark + wordmark text in custom font on canonical canvas
   - Rationale — 2-3 paragraphs covering claim and trade-offs
   - Optional construction detail (grid lines, callouts) — only if construction is part of the rationale

7. **Verify** before reply:
   - `bunx tsc --noEmit -p .` for typecheck
   - Headless Chrome screenshot at the dev URL (`http://localhost:3500/<route>`) to confirm the page renders, font loads, and the format ladder reads at every size
   - **Monochrome check:** every direction must be readable in single color at 16pt. If color is doing the lifting, the direction fails the brief.
   - **No-go check:** the brief's no-go list (no mics, no purple, etc.) — sanity-check every direction against it

8. **Surface tensions** at the page footer. Things the designer (or you) wasn't sure about — wordmark choice (existing vs custom), color use, depth on app icons, whether one direction broke a brand convention deliberately. The brief usually expects discussion to continue.

9. **Reply via the broker** with:
   - Page URL (`http://localhost:3500/<route>`)
   - Source path (`/Users/arach/dev/hudson/app/<route>/page.tsx`)
   - One-paragraph summary of each direction's claim
   - The tensions list inline (or pointing to the page footer)
   - Acceptance checklist (✓ items confirming the brief was met)
   - Whether you want it deployed (default: no, dev-only)

10. **Log the commission.** Append a 6-8 line entry to `.coordination/commissions.md`:
    ```
    ## YYYY-MM-DD · <commission-slug>
    from: <agent-id> (ask:<id>)
    brief: <path>
    delivered:
      - page: http://localhost:3500/<route> (src: app/<route>/page.tsx)
      - other artifacts: ...
    status: open · waiting on <reviewer>
    tensions: <count> surfaced — see page footer
    ```

## Gotchas

- **SVG `<text>` rendering.** ImageMagick can't render SVG `<text>` reliably — falls back to outlines or skips. For PNG export of mark SVGs, use headless Chrome (`chrome-headless-shell` at `~/.cache/puppeteer/chrome-headless-shell/...`). The `talkie-textures` page and the `output/talkie-family/` rasterizers both do this.
- **iOS app icons must be opaque.** No alpha channel — iOS applies its own squircle mask. The brief allows depth (gradient backgrounds), but the underlying PNG is opaque RGBA → RGB.
- **Wordmark fonts:** Talkie Medium has dotless `i` with sidebearings baked in. The wordmark renders as plain `text` element — no manual i-dot needed unless the brief calls for a state indicator. The Hot Mic dot (recording state) is overlaid separately.
- **Don't repaint the parametric mark.** If a canonical mark already exists (e.g. `t-decoration` in the Logo Studio), the new commission's directions are *parallel to* it — not replacements. State this in the rationale.
- **Static routes allowlist.** New `app/<route>/page.tsx` files are NOT added to `site/export-pages.mjs` `staticRoutes` by default. Internal explorations stay dev-only. Only add to the allowlist if the brief asks for deployment.
- **Memory of which agent owns brand:** address replies to the agent that asked (narrative-studio, talkie-claude, etc.). Don't sub-delegate to a "logos" agent — see the orientation answer in commissions.md for why hudson-orchestrates is the current pattern.

## Acceptance

Before replying:

- [ ] N directions complete (mark + app icon + wordmark lockup for each)
- [ ] Format ladder verified at 16 / 64 / 256 / 1024
- [ ] Monochrome reading works at every size in every direction
- [ ] No-go list audited (no mics, no excluded colors, etc.)
- [ ] Headless Chrome screenshot confirms the live page renders
- [ ] Typecheck passes (`bunx tsc --noEmit -p .`)
- [ ] Rationale per direction inline on the page
- [ ] Tensions / open questions surfaced at footer
- [ ] Commission logged to `.coordination/commissions.md`

## Reference work

- 2026-05 talkie-mark-hudson-round — 3 directions (Geometric T, T+waveform, Wave-motion cell), commissioned by narrative-studio. Source: `app/talkie-marks/page.tsx`. Brief: `/Users/arach/dev/narrative-studio/docs/specs/talkie-mark-hudson-round.md`. URL: `http://localhost:3500/talkie-marks`.
- 2026-05 talkie-textures — earlier 8-texture catalog on the locked t. Source: `app/talkie-textures/page.tsx`. Useful precedent for: brand token block, glyph geometry constants, frame components, wordmark layout helpers.
