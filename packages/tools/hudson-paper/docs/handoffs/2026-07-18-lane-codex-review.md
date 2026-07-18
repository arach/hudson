# Lane: Codex — Review (+ optional Interviewer) journey screens (sketch)

**Harness:** Codex
**Project:** `/Users/arach/dev/hudson`
**Product:** Fieldwork
**Bar:** Look-and-feel sketch, not production polish. Fast and legible.

---

## Goal

Create **4** Fieldwork Studio design surfaces for the **Review** row:

| Slug | Journey page name | Map page id |
|------|-------------------|-------------|
| `review-index` | Index | `page_d6854a04953f` |
| `review-document` | Document | `page_12ad43a4f942` |
| `review-source` | Source | `page_8fe081d4f064` |
| `review-calibrate` | Calibrate | `page_590da978e5c6` |

If you finish early, optional Interviewer sketches (lower priority):

| Slug | Page | id |
|------|------|-----|
| `interviewer-attention` | Attention | `page_63ab5c9a35ba` |
| `interviewer-mark` | Mark | `page_a0e5abd1ceff` |
| `interviewer-reveal` | Reveal | `page_3e4e99c63a26` |

---

## Files you create

```
apps/studio/src/exhibits/fieldwork/ReviewIndex.tsx
apps/studio/src/exhibits/fieldwork/ReviewDocument.tsx
apps/studio/src/exhibits/fieldwork/ReviewSource.tsx
apps/studio/src/exhibits/fieldwork/ReviewCalibrate.tsx
# optional
apps/studio/src/exhibits/fieldwork/InterviewerAttention.tsx
apps/studio/src/exhibits/fieldwork/InterviewerMark.tsx
apps/studio/src/exhibits/fieldwork/InterviewerReveal.tsx
```

**Do not** edit shared registries (`exhibits/index.ts`, `EmbedPage.tsx`, paper `embedSurfaces.tsx`, map JSON) — Grok wires those. **Components only.**

---

## Design rules

- Use `./SurfaceShell` (`SurfaceShell`, `regionProps`) for shared tokens.
- Warm paper room; Review can feel more “archive / evidence” (mono for paths, source-linked lists).
- **No totals, no hire score, no ranking.** Conflicting evidence stays visible as mixed.
- `data-paper-region` on 3–6 blocks per screen.

### Content intent

1. **Index** — Work-tape moment list (fake moments): framing · verification · handoff risk. Filter chips optional. Click row = source-linked.
2. **Document** — Artifact + candidate handoff tabs; handoff text blocks.
3. **Source** — Large source viewer: command log / file diff mock in mono; “traceable to event” framing.
4. **Calibrate** — Two reviewers side-by-side notes on same moment; disagreement visible; no average score.

Reference: fieldwork `docs/work-tape.md`, `docs/product-boundary.md`.

---

## Done when

Four Review components render. Report paths. **Stop** — do not touch Candidate or Producer files.
