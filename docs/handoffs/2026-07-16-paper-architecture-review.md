# Handoff: Hudson Paper architecture review (fresh eyes)

**From:** Grok session on Fieldwork/Hudson Paper  
**To:** Codex sibling, **same base repo** (`/Users/arach/dev/hudson`)  
**Model / effort requested:** **gpt-5.6**, **xhigh** effort  
**Ask:** Architectural critique + recommended re-cut. **Do not implement** unless a change is trivial and obviously unblocking; prefer a written review.

---

## One-liner

We built **Hudson Paper**: an agent-driven journey layout tool (multi-page product maps on a Hudson canvas). The product idea is solid. The **host architecture currently feels bootleg** because we nested a home-made canvas inside AppShell panel mode instead of using Hudson’s real canvas path (Frame / WorkspaceShell). Operator wants fresh eyes.

---

## Where the code lives

| Path | Role |
|------|------|
| `packages/tools/hudson-paper/` | Whole package |
| `src/model.ts` | Journeys, pages, CompNode trees, packs, layout |
| `src/tools.ts` | MCP tools (`create_product_map`, `open_in_studio`, upsert, etc.) |
| `src/mcp-http.ts` + `http-api.ts` | MCP + REST (`/api/files`, `/canvas`, handoffs) |
| `src/cli.ts` | `hpaper serve` — **API on :29982**, **Vite host on :29980** (proxy) |
| `host/` | Vite React host (what you open in the browser) |
| `host/src/paperApp.tsx` | `HudsonApp` definition (Atelier/Shaper-shaped) |
| `host/src/PaperCanvas.tsx` | Nested `Canvas` + world cards + **custom wheel zoom** |
| `host/src/PaperState.tsx` | Shared React context |
| `host/src/hooks.ts` | Shell hooks (commands, status, viewport) |
| `host/src/slots/*` | LeftPanel, LeftFooter (minimap), Inspector, Settings tool, NavActions |
| `host/src/styles.css` | Tokens + style convention classes |
| `docs/specs/hudson-paper.md` | Spec |
| Sibling reference | `/Users/arach/dev/atelier` — real Atelier host + Shaper `LeftFooter` minimap pattern |

Library on disk: `~/.hudson-paper/files/*.hpaper.json`  
Run: `bun run --cwd packages/tools/hudson-paper serve` → http://127.0.0.1:29980/

---

## Mental model (product)

```
File (map)
 ├── Journey "Producer"    (row)  Role world → Mint → Compile
 ├── Journey "Candidate"   (row)  Orient → Work → Handoff → Done
 ├── Journey "Interviewer" (row)  Attention → Mark → Reveal
 └── Journey "Review"     (row)  Index → Document → Source
```

- Left→right = time  
- Top→bottom = role  
- Agent MCP lays out journeys; human glares at canvas  
- Pages = trees of primitives (`Stack`/`Text`/`Hud*`) not freeform design soup  

Packs: `fieldwork-full`, `candidate-only`.

---

## Runtime topology (current)

```
Browser  →  Vite :29980  (AppShell + Paper UI)
              ├─ /api /mcp /health  →  proxy  →  Bun :29982
              └─ host SPA

MCP clients → http://127.0.0.1:29980/mcp (proxied)
```

- Dual process, proxy for MCP/SSE  
- Studio exhibit also exists (`apps/studio` Paper pages) — secondary; **primary glance is :29980**  

---

## Host composition (current)

Inspired by Atelier/Shaper, but **panel AppShell + nested Canvas**:

```ts
// paperApp.tsx sketch
HudsonApp {
  mode: "panel",
  slots: {
    Content: PaperCanvas,      // owns its own Canvas + world layer + wheel
    LeftPanel: maps + journeys,
    LeftFooter: minimap,       // Atelier convention (good)
    Inspector: page inspect,
  },
  tools: [{ id: "settings", ... }],
  hooks: useCommands, useStatus, useStatusLeft, useViewport, useNavCenter, useNavActions, ...
}
```

Chrome: overlay panels, inspector pin, Cmd+K palette, status center viewport via new `useViewport` hook on AppShell.

### Critical architecture smell

Hudson **`Frame mode:"canvas"`** owns:
- grid  
- drag pan  
- **ctrl/meta wheel zoom** (pinch)  
- ZoomControls  
- world layer at 50%/50%  

We put AppShell in **`mode: "panel"`**, then:
1. Nested `hudsonkit/canvas` **Canvas** (pan only — **no wheel**)  
2. Reimplemented world layer + CSS `zoom`  
3. Bolted on custom wheel zoom later  

So every “why does this feel fake?” moment is partly **wrong shell path**, not missing polish.

Also:
- CustomEvents (`paper:open-right`, etc.) because shell controls aren’t available inside `useCommands` the same way  
- Page card content is still scaffold (app-shell/doc recipes)  
- CompRenderer maps layout to divs; Hud* inject real primitives  

---

## What’s good to keep

1. **Domain model** — journeys/pages/CompNode, packs, `layout_journeys`  
2. **MCP tools** — agent-first layout (`create_product_map`, etc.)  
3. **Local library** — no design SaaS  
4. **Atelier slot naming** — LeftFooter minimap, Inspector, tools for settings  
5. **Status strip** — map · focus · center viewport  

## What to question / re-cut

**Recommended direction (operator leaning this way):**

> Map host = **Frame `mode="canvas"` + fixed HUD** (not AppShell panel sandwich).  
> One process if possible.  
> Content cards stay; chrome stops fighting the map.

Alternate: full Shaper-style panel app where **Content fully owns** canvas+wheel+grid (no nested half-Frame).

Do **not** keep piling chrome patches on the sandwich without choosing a path.

---

## Reference: Atelier

`/Users/arach/dev/atelier`

- `/` → `WorkspaceShell` multi-app canvas  
- `/<app-id>` → single `AppShell`  
- Shaper: `LeftFooter` = minimap, `Inspector`, `useCommands` / `useStatus` / `useNav*`  
- Style: dark default, `@theme inline` tokens, section-head mono rails  

Paper host should **feel like Shaper-on-a-map**, or like Frame canvas + HUD — not Studio + nested canvas.

---

## Review questions for Codex

Please answer as an architecture review (prose + short tables). Priority:

1. **Shell choice:** AppShell panel + nested Canvas vs Frame canvas + HUD vs WorkspaceShell. Recommend one for M1 of Paper.  
2. **Serve topology:** dual Vite+Bun proxy vs single Bun (static + MCP) vs Vite middleware only.  
3. **What to freeze vs rewrite** in `host/` without killing MCP/model value.  
4. **Wheel/pan contract** that matches Hudson kit so we stop reimplementing Frame.  
5. **Studio exhibit** — keep, kill, or demote.  
6. **Minimal PR plan** (ordered, outcome-led) to de-bootleg the host in 1–3 PRs.  
7. Any **security/path** notes on workspace file API (secondary).

Out of scope unless trivial: filling Fieldwork page content, new packs, Studio polish.

---

## How to verify locally

```bash
cd /Users/arach/dev/hudson
bun run --cwd packages/tools/hudson-paper serve
# open http://127.0.0.1:29980/
# MCP: http://127.0.0.1:29980/mcp
# Seed map may exist: Fieldwork full experience under ~/.hudson-paper/files/
```

Atelier (reference only): `bun run --cwd /Users/arach/dev/atelier dev` → :3034

---

## Desired output format

1. **Verdict** (1 paragraph)  
2. **Root causes of bootleg feel** (bullets)  
3. **Recommended architecture** (diagram or bullet topology)  
4. **Cut list / keep list**  
5. **PR sequence** (3 max, each shippable)  
6. **Risks**  

Reply in the Scout DM. No large code dump unless a tiny patch is essential to prove a point.
