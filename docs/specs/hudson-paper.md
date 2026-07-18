# Hudson Paper

**Status:** S1.1 — agent-driven journey layout
**One-liner:** Agent-driven design tool that lays out whole **user journeys** in one call — multi-page canvas, Hudson primitives + props.

## Thesis

Hudson Paper lets an agent (or human+agent) **spin up an entire product journey in minutes**:

- Multiple **pages** (screens) on one **canvas**
- Grouped into **journeys** (named flows: Candidate, Interviewer, Review…)
- Each page is a **tree of primitives with props** (not freeform drawing)
- Local MCP, no quota — iterate as fast as the agent can write

Glance left→right = time. Glance top→bottom = role/journey.

```text
[PRODUCER]    Role world → Mint → Compile
[CANDIDATE]   Orient → Work → Share → Pause → Handoff → Done
[INTERVIEWER] Attention → Mark → Reveal
[REVIEW]      Index → Document → Source → Calibrate
```

## What it is

| Is | Isn’t |
|----|--------|
| Agent-driven journey layout | Figma / Paper Desktop design studio |
| Multi-page canvas for product flows | Single-screen mockup only |
| Primitives + props composition | Pen, vectors, freeform HTML soup |
| Local MCP for Grok / Claude / Cursor | Cloud design SaaS with quotas |

## Core objects

```ts
type Journey = {
  id: string;
  name: string;           // "Candidate", "Reviewer"
  y: number;              // canvas row
  pageIds: string[];      // ordered left → right
};

type Page = {
  id: string;
  name: string;
  journeyId?: string;
  x: number; y: number;
  width: number; height: number;
  root: CompNode;         // Stack/Box + children
};

type CompNode = {
  id: string;
  type: PrimitiveType;    // closed allowlist
  props: Record<string, unknown>;
  children?: CompNode[];
};
```

## Agent workflow (happy path)

**Fastest — whole product in one call:**

1. `list_packs` → see `fieldwork-full`, `candidate-only`, …
2. `create_product_map { pack: "fieldwork-full" }`
   → file + 4 journeys + 16 scaffolded pages + grid layout
3. `get_tree` / `upsert_node` to fill Orientation, Active work, …
4. **`open_in_studio { pageId }`** → bring one page into Hudson Studio for focused work

**Custom product map:**

```text
create_product_map {
  name: "Checkout",
  journeys: [
    { name: "Buyer", pages: ["Browse","Cart","Pay"] },
    { name: "Ops", pages: ["Queue","Fulfill"] }
  ]
}
open_in_studio { pageId: "<Cart page>" }
# → http://localhost:3033/exhibits/paper?file=…&page=…
```

**Incremental:**

1. `create_file`
2. `create_journey { name, pages, scaffold }` per role
3. `layout_journeys`
4. Fill with `upsert_node`
5. `open_in_studio` for pages that need Studio polish

## Paper → Studio handoff (HudsonKit web canvas)

| Surface | Job |
|---------|-----|
| **Paper** | Agent layout tool (MCP + REST library) |
| **Studio** | **HudsonKit Canvas** host — pan/zoom world with page cards |

```text
create_product_map  →  journey map on disk
open_in_studio      →  Studio /exhibits/paper (Canvas + ZoomControls)
```

Studio exhibit uses the same host pattern as canvas-terminals:

- `Canvas` (dot grid + pan)
- World layer (`left:50% top:50%` + `pan` + `zoom: scale`)
- Page cards at Paper `x/y/width/height` with `CompRenderer` + real `hudsonkit/primitives`
- Journey rail + `ZoomControls`

REST (same server as MCP):

- `GET /api/files`
- `GET /api/files/:fileId`
- `GET /api/files/:fileId/canvas` — full trees + world positions (canvas host)
- `GET /api/files/:fileId/pages/:pageId`
- `GET /view/:fileId/:pageId` → 302 to Studio

Handoff records: `~/.hudson-paper/handoffs/*.json`

Studio: Hudson Studio → Compositions → **Paper pages**.

## MCP tools

### Library
`list_files` · `create_file` · `open_file`

### Journey (fast path)
| Tool | Purpose |
|------|---------|
| `list_packs` | Built-in multi-journey blueprints |
| `create_product_map` | **Whole product** — pack or custom journeys in one call |
| `create_journey` | One named row of pages |
| `list_journeys` | Journeys + ordered page ids |
| `layout_journeys` | Re-grid all journeys (row gap, page gap) |
| `add_pages` | Append pages to an existing journey |
| `open_in_studio` | **Focus one page** in Hudson Studio (writes handoff + deep-link) |
| `export_page` | Page tree + Studio/API URLs without writing handoff |

### Page
`create_page` · `move_page` · `rename_page` · `delete_pages` · `get_basic_info`

### Composition
`list_primitives` · `get_tree` · `get_tree_summary` · `upsert_node` · `update_props` · `set_text` · `delete_nodes` · `export_tree`

### Templates
`scaffold_page` — apply chrome recipe: `blank` \| `app-shell` \| `doc` \| `modal`

## Packs

| Pack | Journeys | Pages |
|------|----------|-------|
| `fieldwork-full` | Producer · Candidate · Interviewer · Review | 16 |
| `candidate-only` | Candidate | 5 |

## Primitives (closed allowlist)

**Layout:** `Box` · `Stack` · `Text` · `Spacer`
**Hudson:** `HudButton` · `HudBadge` · `HudInput` · `HudTextarea` · `HudPanelSection` · `HudListItem` · `HudCheckbox` · `HudToolbar`

## Renderer

```tsx
<PaperCanvas file={file} />
// pages absolutely positioned; each root CompNode → CompRenderer
// optional: inject real hudsonkit components via components prop
```

No pen. No design chrome. Canvas = glance surface for journeys.

## Runtime

- **UI (Hudson AppShell + Canvas):** `http://127.0.0.1:29980/`
- MCP: `http://127.0.0.1:29980/mcp` (Vite proxies to internal API)
- Files: `~/.hudson-paper/files/*.hpaper.json`
- CLI: `hpaper serve` → host on public port + API internal (`:port+2`)
- `--api-only` skips the canvas host

## Slices

| Slice | Outcome |
|-------|---------|
| **S1** | Primitive trees + MCP + CompRenderer |
| **S1.1** | Journeys + `create_product_map` + packs |
| **S1.2** | `open_in_studio` + REST API + Studio Paper pages exhibit ← **now** |
| **S2** | Thin glance host for full multi-row canvas (pan/zoom) |
| **S3** | More packs + richer scaffolds + real hudsonkit inject in Studio |

## Success criterion

An agent can, in one session:

> “Lay out the full Fieldwork journey: producer, candidate, interviewer, review — and fill Orientation + Active Work with real chrome.”

…in **one tool call** for the skeleton, then targeted `upsert_node`s for content — and the human zooms out to a readable multi-row canvas without opening a design tool.
