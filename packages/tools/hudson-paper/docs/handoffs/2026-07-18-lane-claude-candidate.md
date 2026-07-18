# Lane: Claude — Candidate journey screens (sketch)

**Harness:** Claude Code
**Model:** prefer `opus` (or best available Claude)
**Project:** `/Users/arach/dev/hudson`
**Product:** Fieldwork
**Bar:** Look-and-feel sketch, not production polish. Fast and legible.

---

## Goal

Create **4** Fieldwork Studio design surfaces for the Candidate row (Orientation already exists — leave it):

| Slug | Journey page name | Map page id |
|------|-------------------|-------------|
| `candidate-active-work` | Active work | `page_2f09e630dbce` |
| `candidate-pause` | Pause | `page_0a76b270118f` |
| `candidate-handoff` | Handoff | `page_f9330f46e4d5` |
| `candidate-done` | Done | `page_0dc0a514fd32` |

Skip Share unless you finish the four above with time left (`page_860589c7f37b`).

---

## Files you create (only these components)

```
apps/studio/src/exhibits/fieldwork/CandidateActiveWork.tsx
apps/studio/src/exhibits/fieldwork/CandidatePause.tsx
apps/studio/src/exhibits/fieldwork/CandidateHandoff.tsx
apps/studio/src/exhibits/fieldwork/CandidateDone.tsx
```

**Do not** edit `exhibits/index.ts`, `EmbedPage.tsx`, `embedSurfaces.tsx`, or the `.hpaper.json` map file — Grok will wire registrations after your components land (or wire only if you finish early and the files are free). Prefer **components only** to avoid merge conflicts with Codex.

---

## Design rules (must match Orientation vibe)

- Import helpers from `./SurfaceShell` (`SurfaceShell`, `regionProps`) when useful.
- Warm paper room (`--room` / ink / mono eyebrows / sparingly serif titles). Active work may use **dark instrument** (`variant="dark"`) for the work surface.
- Self-contained: absolute fill, own CSS or SurfaceShell.
- **No scores, no webcam, no proctor vibe.** Capture is calm if shown.
- Add `data-paper-region` + `data-paper-label` on 3–6 major blocks per screen (for map pick/discuss).

### Content intent (Fieldwork)

1. **Active work** — Header (role · clock · capture chip), left margin brief, dark center instrument (fake editor + run strip), optional AI rail placeholder. One-instrument hierarchy.
2. **Pause** — Full-width amber pause band, dimmed instrument, copy: technical pause, clock frozen, not performance.
3. **Handoff** — Light writing surface (what changed / risk / next step), recap column of “what shipped”, pre-loaded notes placeholder.
4. **Done** — Quiet close: work saved · no score · a person decides · retention one-liner.

Reference: `/Users/arach/dev/fieldwork/docs/candidate-experience-direction.md` (skim, don’t re-litigate).

---

## Done when

- Four components export named React components and render without error.
- Each looks like a real stage of the session (readable at map zoom and full exhibit).
- Report paths + any open questions. **Stop.** Do not start Review/Producer screens.

```bash
# Check
# open http://127.0.0.1:3033/exhibits/<slug> after Grok registers
```
