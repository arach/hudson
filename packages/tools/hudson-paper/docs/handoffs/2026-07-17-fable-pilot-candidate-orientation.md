# Mission: Opus pilot — design Candidate · Orientation via Studio → Paper

**Status:** pilot (Fable attempt stalled on interactive Bash/curl permission — superseded)  
**Model:** Claude harness, **`opus-4.8`**  
**Owner:** Scout-dispatched Opus worker (`@paper-screen-opus`)  
**When done:** report mechanism + Studio URL + Paper map verification so we can decide whether to scale to remaining screens.

---

## Goal

Fill **one** Paper journey page with a real, appropriate design using this strategy:

1. **Build / compose in Hudson Studio** (focused page surface).
2. **Embed / reflect that work into the Paper map representation** so the same page looks designed on the Frame glance canvas.
3. Invent the **smart mechanism** that keeps Studio work and Paper page content in sync (or projects one into the other). Do not wait for a pre-specified architecture — choose something workable, document it, and leave it repeatable for Opus later.

Paper remains the **journey map / glance**. Studio remains the **focused design surface**.

---

## Pilot scope (only this)

| | |
|--|--|
| **Map** | Fieldwork full experience |
| **File id** | `file_f63343493b36` |
| **Journey** | Candidate |
| **Page** | Orientation |
| **Page id** | `page_8b9f828f572d` |

Do **not** fill other pages in this pilot. One excellent screen beats a thin map.

### Design brief — Candidate · Orientation

This is the Fieldwork candidate **prepared desk** before the clock starts (see fieldwork `docs/candidate-experience-direction.md` if available under `/Users/arach/dev/fieldwork`).

Should feel: quiet, exact, trustworthy, serious — archive/atelier, not a monitoring dashboard.

Must communicate (top → bottom story, not equal-weight cards):

1. Eyebrow: role · timebox (e.g. ENGINEER · 75-MINUTE WORK SESSION)
2. Title + one-sentence outcome
3. What you'll hand off
4. What to hold true (constraints)
5. Tools **including declared AI** (blessed, not a shortcut)
6. Capture ledger (calm, sunken) — on/off channels, mic as real choice, retention, who reviews, never-captured line
7. Acknowledgement — candidate-authored sentence + checkbox + mono consent fingerprint
8. Start work — calm ink CTA, disabled until acknowledged

Signals: no pulsing recording halo; capture is calm slate-teal if used; no scores; no hot orange CTA glow.

Use HudsonKit primitives where Paper renders them (`HudButton`, `HudBadge`, `HudInput`, `HudPanelSection`, `HudListItem`, `HudCheckbox`, `HudToolbar`, plus layout/text nodes Paper supports). Prefer Paper MCP tools and Studio over inventing a second renderer.

---

## Runtime (already up)

| Surface | URL |
|---------|-----|
| **Paper host (Frame + HUD)** | http://127.0.0.1:29980/ |
| **Paper MCP** | http://127.0.0.1:29980/mcp |
| **Paper REST** | http://127.0.0.1:29980/api/* |
| **Studio** | http://127.0.0.1:3033/ |
| **Studio deep-link (this page)** | http://127.0.0.1:3033/exhibits/paper?file=file_f63343493b36&page=page_8b9f828f572d |

Repos roots:

- Paper package: `/Users/arach/dev/hudson/packages/tools/hudson-paper`
- Studio app: `/Users/arach/dev/hudson/apps/studio`
- HudsonKit: `/Users/arach/dev/hudson/packages/web/hudsonkit`
- Product brief: `/Users/arach/dev/fieldwork` (docs only unless you need product source)

Library files live under `~/.hudson-paper/files` (Paper store).

---

## Suggested agent path (you may deviate if smarter)

1. Wire or use **Paper MCP** (`list_packs`, `open_file` / get tree for `file_f63343493b36`, `get_tree` for `page_8b9f828f572d`).
2. Call `open_in_studio({ pageId: "page_8b9f828f572d" })` and work the Studio exhibit.
3. Compose the Orientation design — either:
   - as CompNode tree via Paper tools (`upsert_node`, etc.) that Studio already renders, and/or
   - as Studio-side composition that you then **project back** into the Paper page tree.
4. **Mechanism requirement:** when someone opens Paper at http://127.0.0.1:29980/?file=file_f63343493b36&page=page_8b9f828f572d they must see the designed Orientation page on the map card without hand-copying pixels. Document how Studio ↔ Paper stays linked (e.g. shared file store, export, iframe/snapshot, source path, MCP write-back, etc.).
5. Visually check both surfaces. Iterate until Orientation reads as a finished prepared desk.

If the existing Studio exhibit only *views* Paper trees and is not a full design tool yet, **extend the minimum** needed for this pilot (prefer writing CompNodes through Paper so both surfaces share one truth). Do not rebuild the Frame host.

---

## Constraints

- Do not redesign Paper host architecture (Frame + HUD is settled).
- Do not fill all 16 pages.
- No webcam / personality / scoring UI on candidate surfaces.
- No unpaid production work content — keep scenario synthetic / expired Fieldwork role-world language.
- Prefer Bun. Prefer editing existing Paper/Studio code over new packages.
- No co-author footers on commits. Gitmoji if you commit (only if changes need to land; draft mechanism can live uncommitted if you say so).
- **Do not block on permission prompts.** Prefer Paper MCP / local file tools over `curl` health checks. Surfaces are already up (Paper :29980, Studio :3033). If a tool asks for confirmation you cannot get, skip it and keep designing.
- Permission profile is `trusted_local` — use write access productively; do not wait for the operator.

---

## Done criteria (report back)

1. **Studio URL** for the designed Orientation page.
2. **Paper URL** with file + page query showing the same design on the map.
3. **Mechanism:** 5–15 lines on how Studio work embeds into Paper (and how Opus would repeat it for the next page).
4. **Files changed** (paths).
5. **Honest gaps** (what was faked, deferred, or fragile).
6. Optional: screenshot paths or describe what to click to verify.

Stop after the pilot page. Do not start Opus-scale fill without human approval.
