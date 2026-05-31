# HUD-011 — Agent Contract Annotations

**Status**: Draft (Cursor-authored; pending Hudson Codex review)
**Owner**: TBD (Arach)
**Targets**: hudsonkit web, `app/apps/*`, `app/api/ai/toolsets/*`, `scripts/agent-snapshot.ts`
**Related**: HUD-006 (AI backends / toolsets), HUD-008 (app backends), `docs/building-app-ai.md`, `docs/hudson-playbooks/brand-commission.md`

## Summary

Hudson apps expose capabilities to orchestrators (@hudson workspace AI, Scout, voice, pipes, dev agents). Today that surface is fragmented: some apps have `agentContext`, some have rich toolsets, some have intents and ports — but there is no cheap, consistent way for an orchestrator to discover *what an app knows* (e.g. Logo brand `Talkie → t-decoration`) without re-reading source.

**HUD-011** introduces **source annotations** (JSDoc tags on code authors already touch) and a **build-time extractor** that emits machine JSON + Agent Skills markdown as **generated artifacts**. Authors never hand-maintain parallel manifest files or `SKILL.md`.

```
Source code (annotations + existing structured decls)
        │
        ▼
  scripts/extract-agent-contract.ts
        │
        ├── app/apps/{id}/.generated/agent-contract.json   (runtime + snapshot)
        └── app/apps/{id}/.agents/skills/{id}/SKILL.md   (pi / Flue / Cursor scan)
        │
        ▼
  Shell: deriveAgentContract(app) + workspace AI context + dispatch bus (later)
```

## Motivation

### Problem

Cross-app commissions fail at discovery, not execution:

| Ask | What breaks today |
|-----|-------------------|
| "Latest Talkie logos" | No stable brand entity index; orchestrator greps `types.ts` |
| "@hudson tweak Logo bg" | Workspace toolset lacks Logo ops; `hudson:workspace-tool` listener missing on LogoProvider |
| Scout brand-commission playbook | Handler prose is ad hoc; no aggregated capability card |

Day Stack is the only app with a full manual stack (`agent-context.ts` + intents + ports + toolset). Logo has the richest toolset but no agent guide or entity index. Maintaining separate `agent-context.ts` + `capability-manifest.ts` per app does not scale.

### Design goals

1. **Annotate in place** — tags live on exports, domain constants, query helpers, API handlers.
2. **Generate outputs** — MD/JSON are compiler artifacts, like `.d.ts`.
3. **Passive harvest** — intents, ports, toolset Zod schemas require zero new tags when already structured.
4. **Progressive disclosure** — cheap index at session start; full tool schemas when app is focused.
5. **Interop** — emitted `SKILL.md` follows [Agent Skills](https://agentskills.io/specification) for pi, Flue, Cursor.
6. **Orchestrator-neutral** — Hudson shell aggregates; Scout/voice/pipes are ingress adapters (Phase 2+).

### Industry alignment

| External pattern | Hudson mapping |
|------------------|----------------|
| A2A Agent Card `skills[]` | `agent-contract.json` operations + entities |
| Agent Skills `SKILL.md` | generated `.agents/skills/{id}/SKILL.md` |
| Cloudflare `@callable()` | `@agentOp` on shared executors + future dispatch bus |
| MCP `tools/list` | toolset registry harvest |
| Flue / pi `AGENTS.md` | `@agentGuide` on `HudsonApp` export |

## Non-goals (v1)

- TypeScript decorators (`@callable()`-style) — JSDoc tags only; no transform pipeline.
- A2A wire protocol or HTTP agent servers per app.
- Replacing toolsets or intents — they remain the invocation layer.
- Auto-generating prose quality for `@agentGuide` — authors still write voice/rules; extractor copies verbatim.
- Apple / Swift side — web-only for v1.

## Terminology

| Term | Meaning |
|------|---------|
| **Agent guide** | Prose operating instructions (tone, reply shape, when to explore vs use structure). Tag: `@agentGuide`. |
| **Agent contract** | Full generated snapshot: guide + entities + operations + data sources + toolset refs. |
| **Entity** | Stable domain concept with aliases (e.g. brand Talkie → root template `t-decoration`). Tag: `@agentEntity`. |
| **Operation** | Named callable capability (`query` / `mutate` / `navigate`). Tags: `@agentOp`, or harvested from intents/ports/tools. |
| **Passive harvest** | Extractor reads existing `AppIntent[]`, port decls, toolset `description` + Zod `.describe()` without new tags. |

Keep **`AppManifest`** (shell inventory: commands, sidebar tools) separate — do not merge into agent contract.

## Annotation vocabulary

All tags are **JSDoc block tags** parsed by `ts-morph`. Block body text (before/after tags) is preserved as description prose.

### `@agentGuide` — app-level operating guide

Place on the `HudsonApp` export in `app/apps/{id}/index.ts`.

```ts
/**
 * @agentGuide logo
 *
 * Voice: elite logo designer — intentional, minimal, never purple.
 * After tool calls, name the exact template or param changed.
 * Do not claim a design changed unless a logo tool ran.
 *
 * Brands use kind=brand + parentId hierarchy. "Latest" means sort by
 * updatedAt desc within the brand subtree.
 */
export const logoApp: HudsonApp = { ... };
```

**Replaces** hand-maintained `agent-context.ts` files (Day Stack migrates by moving prose here).

Optional short form on first line after tag name: `@agentGuide logo` sets skill name metadata.

### `@agentEntity` — domain entity declaration

Place on constants, seed records, or exported domain objects.

```ts
/**
 * @agentEntity brand:talkie
 * @agentAliases Talkie, talkie
 * @agentRoot t-decoration
 * @agentQuery list brand subtree; sort updatedAt desc for "latest"
 */
export const TALKIE_BRAND_ROOT = 't-decoration' as const;
```

Parsed fields:

| Sub-tag | Required | Example |
|---------|----------|---------|
| `@agentEntity` | yes | `brand:talkie` → `{ kind: 'brand', id: 'talkie' }` |
| `@agentAliases` | no | comma-separated |
| `@agentRoot` | no | stable id / root template |
| `@agentQuery` | no | free-text query hint for orchestrators |

Alternative inline form (single line):

```ts
/** @agentEntity brand:talkie aliases=Talkie,talkie root=t-decoration */
```

### `@agentOp` — explicit operation on a function

Place on shared executors, API helpers, or route handlers.

```ts
/**
 * List logo templates belonging to a brand family.
 *
 * @agentOp query list_templates_for_brand
 * @agentExamples latest Talkie logos | show t-decoration variants
 * @agentParams brand:string sort?:updatedAt|name
 */
export function listTemplatesForBrand(
  templates: LogoTemplate[],
  brand: string,
  sort: 'updatedAt' | 'name' = 'updatedAt',
): LogoTemplate[] { ... }
```

Sub-tags:

| Sub-tag | Meaning |
|---------|---------|
| `@agentOp` | `{kind} {id}` — kind ∈ `query` \| `mutate` \| `navigate` |
| `@agentExamples` | pipe-separated example utterances |
| `@agentParams` | lightweight param grammar (not full JSON Schema) |
| `@agentDangerous` | boolean flag — confirm before dispatch |

**Id collision rule**: manual `@agentOp` wins over passive harvest on same id.

### Passive harvest (no tags)

| Source file | Extracted as |
|-------------|--------------|
| `intents.ts` → `AppIntent[]` | `mutate`/`navigate` ops; maps `commandId`, title, description, params, keywords → examples |
| `index.ts` → `ports.outputs[]` | `query` op `read_port:{portId}` + dataSource entry |
| `index.ts` → `ports.inputs[]` | `mutate` op `write_port:{portId}` |
| `app/api/ai/toolsets/{id}.ts` | tool name, description, Zod field descriptions |
| `HudsonApp.backend` | hint: server routes at `/api/{id}/*` |
| `app/api/{id}/**/route.ts` | `@agentOp` from JSDoc if present; else `GET` → query, `POST`/`PUT`/`PATCH`/`DELETE` → mutate with route path id |

Toolset `system` string: included in generated SKILL.md appendix, not duplicated into JSON index (too large for snapshot).

## Generated artifacts

Per app `{id}`:

```
app/apps/{id}/
  .generated/
    agent-contract.json      # machine index (gitignored)
  .agents/skills/{id}/
    SKILL.md                 # Agent Skills format (gitignored or committed — see policy)
```

### `agent-contract.json` schema (v1)

```ts
interface AgentContract {
  version: 1;
  appId: string;
  name: string;
  description?: string;
  generatedAt: string;

  guide?: string;                    // from @agentGuide body

  entities: Array<{
    id: string;                      // e.g. brand:talkie
    kind: string;
    aliases?: string[];
    root?: string;
    queryHint?: string;
    source: { file: string; line: number };
  }>;

  operations: Array<{
    id: string;
    kind: 'query' | 'mutate' | 'navigate';
    title?: string;
    description?: string;
    examples?: string[];
    params?: Record<string, unknown>;
    dangerous?: boolean;
    source: 'intent' | 'port' | 'toolset' | 'jsdoc' | 'route';
    sourceRef?: string;              // file:line or commandId or tool name
  }>;

  dataSources: Array<{
    portId: string;
    name: string;
    dataType: string;
    description?: string;
  }>;

  toolsetId?: string;                // app.id if registered in defaultRegistry
  backendPrefix?: string;            // /api/{id}
}
```

### `SKILL.md` format

Auto-generated header:

```markdown
---
name: logo
description: Lattice logo designer. Query brands (Talkie→t-decoration), tweak params, author templates.
metadata:
  app: logo
  generated: true
---

<!-- AUTO-GENERATED by extract-agent-contract — do not edit -->

## Guide
...

## Entities
...

## Operations
...

## Tools
(merged from toolset harvest)
```

## Extractor

**Script**: `scripts/extract-agent-contract.ts`

**Invocation**:

```bash
bun scripts/extract-agent-contract.ts              # all apps
bun scripts/extract-agent-contract.ts --app logo   # one app
bun scripts/extract-agent-contract.ts --watch      # dev mode
```

**Implementation approach (v1)**:

1. Discover apps: directories under `app/apps/*/index.ts`.
2. Parse with `ts-morph`:
   - JSDoc on `export const {id}App` / named exports
   - `@agentGuide`, `@agentEntity`, `@agentOp` and sub-tags
3. Passive harvest per app id:
   - Read `intents.ts` if exists (AST or structured eval — prefer AST import of const array)
   - Read ports from `index.ts` ports block
   - Read `app/api/ai/toolsets/{id}.ts` — extract `tool({ description, inputSchema })` names
   - Glob `app/api/{id}/**/route.ts` for HTTP methods
4. Merge with collision rules; write JSON + SKILL.md.
5. Exit non-zero on parse errors; warn on apps with zero guide and zero entities (informational).

**Package dependency**: `ts-morph` as devDependency at repo root.

**npm script**:

```json
"build:agent-contracts": "bun scripts/extract-agent-contract.ts",
"dev:agent-contracts": "bun scripts/extract-agent-contract.ts --watch"
```

Hook into `bun dev` optionally (watch) — not blocking v1.

## Runtime integration

### `deriveAgentContract(app: HudsonApp): AgentContract`

New module: `packages/web/hudsonkit/src/lib/agent-contract.ts`

```ts
export function deriveAgentContract(app: HudsonApp): AgentContract {
  // 1. Try import app/apps/{id}/.generated/agent-contract.json (build artifact)
  // 2. Fallback: minimal contract from app.id, name, description, intents, ports only
  // 3. Overlay app.agentContext if still set (deprecated path during migration)
}
```

**Migration**: `HudsonApp.agentContext` remains optional; if present and no `@agentGuide`, prefer explicit field until app migrates. If both exist, generated guide wins (log dev warning).

### Workspace AI

`app/api/ai/toolsets/workspace.ts` `context()` adds per-app compact block:

```markdown
## App capabilities · logo
entities: brand:talkie (Talkie → t-decoration)
ops: list_templates_for_brand [query], set_variant [mutate], …
guide: (first 400 chars or "see focused app")
```

Full guide injected when `focusedAppId === 'logo'`.

### `scripts/agent-snapshot.ts`

Replace regex guessing with `.generated/agent-contract.json` when present; keep regex fallback for apps not yet extracted.

### Future: dispatch bus (HUD-011 Phase 2, separate PR)

```ts
interface CapabilityRequest {
  appId: string;
  operation: string;   // matches AgentContract.operations[].id
  params?: Record<string, unknown>;
  source: 'workspace-ai' | 'scout' | 'intent' | 'pipe' | 'api';
}

interface CapabilityResult {
  summary: string;
  data?: unknown;
  error?: string;
}
```

`@agentOp` ids become stable dispatch targets. Cloudflare `agentTool()` semantics: parent (@hudson) orchestrates, child app executes, structured `{ summary, data }` return.

## Author conventions (what sub-apps do)

**Required for AI-enabled apps** (already implied by `docs/building-app-ai.md`):

- `app/api/ai/toolsets/{id}.ts` registered in toolset index
- `use{id}AI.ts` client hook

**Required for orchestrator-visible apps** (new):

- `@agentGuide` on `HudsonApp` export **OR** legacy `agentContext` until migrated

**Optional**:

- `@agentEntity` on domain constants (Logo brands, Shaper project types, etc.)
- `@agentOp` on shared query/mutation functions and API route handlers

**Do not**:

- Hand-edit `.generated/` or generated `SKILL.md`
- Duplicate tool descriptions in `@agentGuide` — guide = voice/rules; toolset = capabilities

## Git policy

| Path | Policy |
|------|--------|
| `app/apps/*/.generated/` | **gitignore** |
| `app/apps/*/.agents/skills/**/SKILL.md` | **gitignore** v1 (regenerate on dev/build). Revisit committing if clone-without-build must scan skills. |

## Migration plan

### Phase 0 — Spec + extractor skeleton (this HUD)

- [ ] Land this spec
- [ ] Add `ts-morph`, extractor script, gitignore entries
- [ ] `deriveAgentContract()` with JSON import + fallback
- [ ] Extend `agent-snapshot.ts`

### Phase 1 — Logo pilot

- [ ] `@agentGuide` on `logoApp`
- [ ] `@agentEntity brand:talkie` on `TALKIE_BRAND_ROOT` (or `builtinRenderBodies` seed)
- [ ] `listTemplatesForBrand()` + `@agentOp` + `GET /api/logo/templates`
- [ ] Workspace context renders Logo contract block

### Phase 2 — Day Stack migration

- [ ] Move `DAY_STACK_AGENT_GUIDE` prose into `@agentGuide` on `dayStackApp`
- [ ] Delete `agent-context.ts`; verify generated guide matches

### Phase 3 — Dispatch bus + workspace tool wiring

- [ ] Fix `hudson:workspace-tool` listener in LogoProvider
- [ ] `invoke_app_capability` workspace tool mapped from contract ops
- [ ] Scout playbook references contract JSON path

## Acceptance criteria (v1)

1. `bun scripts/extract-agent-contract.ts --app logo` emits valid JSON + SKILL.md without hand-maintained manifest files.
2. Logo contract lists `brand:talkie`, ≥1 harvested toolset tool, ≥1 intent, ≥2 port data sources.
3. `agent-snapshot.ts` prints Logo entities and op count from JSON.
4. Workspace AI context includes Logo capability index when Logo is in workspace.
5. Extractor is idempotent; CI step `build:agent-contracts` can run in lint/build pipeline.

## Open questions

1. **Commit SKILL.md?** — default gitignore; opt-in commit for pi scan on fresh clone.
2. **AST vs grep for intents** — AST import preferred; grep fallback acceptable for v1 snapshot parity.
3. **HUD number** — filed as HUD-011; confirm no collision with in-flight specs.
4. **Optional `agentOp()` helper** — typed wrapper attaching metadata for non-JSDoc ergonomics; defer until extractor stable.

## References

- `specs/hud-006-ai-backends.md` — toolsets, `buildIntentsToolset`
- `app/apps/day-stack/agent-context.ts` — migration source for `@agentGuide`
- `app/apps/logo/` — pilot app
- `packages/web/ai-backends/src/toolsets/registry.ts` — `buildIntentsToolset`
- `scripts/agent-snapshot.ts` — session bootstrap
- [Agent Skills specification](https://agentskills.io/specification)
- [Cloudflare Agents — callable methods & agent tools](https://developers.cloudflare.com/agents/api-reference/agent-tools/)
