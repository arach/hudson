# Codex review ask: Paper-in-Studio (direction + implementation)

**From:** Grok session on Hudson Paper × Fieldwork
**To:** Codex (fresh eyes)
**Mode:** Review only — do not implement unless asked.
**Project:** `/Users/arach/dev/hudson` (Paper package + Studio app). Product context: Fieldwork.

---

## Product direction (locked)

1. **Paper is a Studio capability**, not a standalone product host. Journeys map runs **inside Studio** (`/paper`). Individual screens are Studio design pages (`/exhibits/…`, `/embed/…`).
2. **Per-project use:** Studio hosts Paper for a product (Fieldwork today). Discuss agent is calibrated to **Fieldwork**, not Hudson package home.
3. **Map embeds real designs** (same React surface as Studio), not a second CompNode map viewer.
4. **Inspect is not a design tool:** click region → selection → quick discuss. No preemptively listed region catalog as the main UX.
5. Old `/exhibits/paper` dual-map exhibit is **out** of the product path (file may still exist as dead code).

---

## Implementation map (what to read)

| Area | Paths |
|------|--------|
| Paper host (map UI) | `packages/tools/hudson-paper/host/src/` — `PaperHost`, `PaperWorld`, `PaperState`, `inspect`, `embedSurfaces`, `slots/Inspector` |
| Paper domain/API | `packages/tools/hudson-paper/src/` — `model`, `render`, `http-api`, `discuss`, `tools`, `store` |
| Studio integration | `apps/studio/src/main.tsx`, `pages/PaperPage.tsx`, `router/routes.ts`, `registry/pages.ts`, `vite.config.ts`, `scripts/dev.mjs` |
| Design surface example | `apps/studio/src/exhibits/fieldwork/CandidateOrientation.tsx` |
| Prior architecture review | Earlier Codex consensus: Frame owns canvas; kill panel+nested-canvas sandwich |

---

## Review questions (answer these)

### Direction
1. Is “Paper inside Studio + design pages as embeds + Fieldwork-calibrated discuss” the right long-term split for multi-product Hudson Studio?
2. Any wrong coupling (Paper package ↔ Fieldwork paths, hardcoded file ids, embed registry)?

### Architecture / choices
3. Full-bleed `/paper` root (outside AppShell) vs nesting under Studio shell — sound?
4. Live React embed under CSS `zoom` (vs iframe) — acceptable, and any better Frame strategy?
5. `POST /api/discuss` → Scout `--project fieldwork` — right boundary, or should discuss be a Studio service?
6. Dual process (Studio Vite + Paper API on 29982) — ok for M1, what hardens next?

### Implementation quality
7. Stale-host / vite cache issues we hit — structural footguns remaining?
8. Dead code: `exhibits/paper/PaperPagesExhibit.tsx`, standalone `:29980` host — delete, archive, or keep as diagnostic?
9. Inspect/discuss UX: selection-only + chat — missing invariants or security (path, scout, CSRF)?
10. Package exports (`@hudsonkit/paper/host`) and Studio aliases — clean or fragile?

### Priority list
Return: **keep / fix-now / fix-later / reject**, with file pointers. Be opinionated. No implementation unless a one-line blocker.

---

## Success for this review

A short written verdict we can use to decide whether to continue filling Fieldwork screens on this spine, or re-cut boundaries first.
