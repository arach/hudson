# Mission correction: Studio page IS the design; Paper embeds it

**Agent:** `@paper-screen-opus` · model `opus-4.8`  
**Supersedes:** CompNode-as-design / dual-map-viewer interpretation of the earlier pilot.

---

## The product rule (non-negotiable)

```
Studio page  =  the real design (content)
Paper map card  =  embeds that Studio page
```

**Not** this (current dead end):

```
Paper CompNode tree  →  re-rendered on Paper map
                     →  re-rendered again in /exhibits/paper  (second map)
```

`/exhibits/paper` today is a **Paper canvas mirror**. That is glance-on-glance. It is **not** a Studio design page.

### What “Studio page” means

A first-class Studio exhibit/page — a real designed screen — e.g.:

- Route like `/exhibits/fieldwork/candidate-orientation` (exact path yours to choose)
- Registered in Studio’s page registry like other exhibits
- The **visual design of Candidate Orientation** lives here as React/HudsonKit composition (or whatever Studio’s native page surface is)
- This is what a designer would open to work on the screen

### What Paper does

- Journey map card for **Candidate · Orientation** (`page_8b9f828f572d` on `file_f63343493b36`) **embeds** that Studio page
- Embed mechanism is yours to invent (live mount, iframe to Studio route, snapshot, shared module imported into the card, etc.)
- Opening Paper at  
  http://127.0.0.1:29980/?file=file_f63343493b36&page=page_8b9f828f572d  
  must show the **same design content** inside the page frame — not a thin CompNode scaffold

### Success looks like

1. **Studio URL** — full Orientation design as a Studio page (not a map of pages)
2. **Paper URL** — map card embeds that page content
3. Short write-up of the embed mechanism so Opus can repeat for other journey pages later

---

## Pilot scope (unchanged page)

| | |
|--|--|
| Map | Fieldwork full experience · `file_f63343493b36` |
| Page | Candidate · Orientation · `page_8b9f828f572d` |

Design brief (Orientation prepared desk): same as prior handoff — quiet, exact, capture ledger, AI blessed, calm Start, no scores. Product copy from `/Users/arach/dev/fieldwork/docs/candidate-experience-direction.md`.

---

## Runtime

| Surface | URL |
|---------|-----|
| Paper | http://127.0.0.1:29980/ |
| Studio | http://127.0.0.1:3033/ |
| Paper MCP | http://127.0.0.1:29980/mcp |

Repos: Paper package + Studio app under `/Users/arach/dev/hudson`. Prefer Bun. Do not redesign Frame host. One page only.

**Do not block on permission prompts.** Surfaces are up. Bypass should be on. Skip curl health checks.

---

## Done report

Studio URL · Paper URL · embed mechanism (5–15 lines) · files changed · honest gaps.
