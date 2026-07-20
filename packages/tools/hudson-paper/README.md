# Hudson Paper

**Agent-driven design tool for whole user journeys.**

Lay out multi-screen product flows in one call. Pages on a canvas · primitives + props · local MCP · no quota.

Not a drawing app. Agents spin up entire product maps; humans zoom out and glance.

## Mental model

```
File  (= product map)
 ├── Journey "Producer"     (row)  Role world → Mint → Compile
 ├── Journey "Candidate"    (row)  Orient → Work → Handoff → Done
 ├── Journey "Interviewer"  (row)  Attention → Mark → Reveal
 └── Journey "Review"      (row)  Index → Document → Source
```

Left → right = time. Top → bottom = role.

## Agent happy path (fastest)

```text
list_packs
create_product_map { pack: "fieldwork-full" }
# → 4 journeys · 16 pages · chrome scaffolds · grid layout

# Or invent a flow:
create_product_map {
  name: "Checkout",
  journeys: [
    { name: "Buyer", pages: ["Browse","Cart","Pay","Receipt"] },
    { name: "Ops", pages: ["Queue","Fulfill"] }
  ]
}

# Then fill a screen:
get_tree { pageId }
upsert_node { pageId, parentId: bodyRoot, type: "Text", props: { … } }

# Bring one page into Studio for focused work:
open_in_studio { pageId }
# → http://localhost:3033/flows?file=…&page=…
```

## Paper engine → Studio Flows

Studio Flows hosts Paper documents on the native **HudsonKit Canvas** with shell-owned navigation, rails, status, and commands. Each journey page is a world-space card; Hud* nodes render via `hudsonkit/primitives`.

| | Paper | Studio |
|---|-------|--------|
| Job | Agent layout + library | Canvas glance + focus |
| Tool | `create_product_map` | `open_in_studio` |
| URL | MCP + `/api/*` + `/api/files/:id/canvas` | `/flows?file=&page=` |

```bash
# Studio (includes Flows + Paper API proxy)
bun run --cwd apps/studio dev
# open http://127.0.0.1:3033/flows
# design pages: http://127.0.0.1:3033/exhibits/candidate-orientation
# embed (chrome-free): http://127.0.0.1:3033/embed/candidate-orientation

# Optional: standalone Paper host (dev-only, not the product shell)
bun run --cwd packages/tools/hudson-paper serve   # :29980 + API :29982
```

## Quick start

```bash
bun run --cwd packages/tools/hudson-paper serve
# → http://127.0.0.1:29980/   Frame canvas + HUD chrome (overview)
# → http://127.0.0.1:29980/mcp  agent MCP (proxied)
```

| Surface | URL |
|---------|-----|
| **Overview canvas** | http://127.0.0.1:29980/ |
| MCP | http://127.0.0.1:29980/mcp |
| REST | http://127.0.0.1:29980/api/* |

`hpaper serve` runs the internal API on :29982 and the Vite Hudson host on :29980 (proxies `/api` + `/mcp`).

## Host architecture

The overview host is **Frame-owned canvas + HUD chrome** (not AppShell panel mode):

- `Frame` owns pan/zoom and the dot-grid canvas.
- `PaperWorld` is pure world-space content (journey pages).
- Rails (journeys, inspector, minimap footer), nav, status, and Cmd+K are HUD over the frame.
- AppShell is not used here — its canvas mode hides side panels, which Paper needs.

```toml
# ~/.grok/config.toml
[mcp_servers.hudson-paper]
url = "http://127.0.0.1:29980/mcp"
enabled = true
```

## Tools

| Speed | Tool | Purpose |
|-------|------|---------|
| ★★★ | `create_product_map` | Whole multi-journey map in one call (pack or custom) |
| ★★ | `create_journey` | One named row of pages |
| ★★ | `layout_journeys` | Re-grid all rows for glance |
| ★ | `scaffold_page` | blank / app-shell / doc / modal |
| | `upsert_node` / `update_props` / `set_text` | Fill content with primitives |
| | `list_packs` · `list_primitives` · `get_basic_info` · `get_tree` | Orient |

## Packs

| Pack | Journeys |
|------|----------|
| `fieldwork-full` | Producer · Candidate · Interviewer · Review |
| `candidate-only` | Candidate (Orient → Done) |

## Composition

- **Layout:** `Stack` · `Box` · `Text` · `Spacer`
- **Hudson:** `HudButton` · `HudBadge` · `HudInput` · `HudTextarea` · `HudPanelSection` · `HudListItem` · `HudCheckbox` · `HudToolbar`
- **Scaffolds:** `blank` · `app-shell` · `doc` · `modal`

## Renderer

```tsx
import { PaperCanvas } from "./src/render.tsx";
// Drop onto any Hudson canvas — pages already positioned by layout_journeys
```

## Spec

[docs/specs/hudson-paper.md](../../../docs/specs/hudson-paper.md)
