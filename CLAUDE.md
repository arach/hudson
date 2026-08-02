# CLAUDE.md

Project-specific instructions for AI agents working on Hudson.

## Project

Hudson is a shell + primitives library for building app-like interfaces in the browser. It ships two top-level shells:

- **`AppShell`** — single-app, full chrome (the default for most consumers)
- **`WorkspaceShell`** — multi-app canvas workspace with windowed apps (Hudson's own `/app` route uses this)

Built with React 19, Next.js 16, Tailwind CSS v4, bun.

## Commands

```bash
bun install    # Install dependencies
bun dev        # Dev server on port 3500
bun run build  # Production build
bun run lint   # ESLint
```

## Critical Rules

- Use **bun** as the package manager — never npm or pnpm
- All UI components are custom-built — do not replace with library components
- Use `@base-ui-components/react` as the sanctioned headless *behaviors* layer (tooltip, menu, popover, select, context menu) via opt-in subpaths (`hudsonkit/behaviors`, `hudsonkit/context-menu`); Hudson owns all visual register. Motion sparingly.
- NEVER use purple in designs — prefer cyan/blue/teal/emerald
- Every app must implement the `HudsonApp` interface from `hudsonkit`
- Apps do not manage shell chrome — the shell reads from app hooks and renders slots

## Routes

Production routes the marketing deck and the product on **different subdomains**, both served by the same Cloudflare Worker (`apps/web/site/cloudflare-static-worker.ts`) against the static export in `apps/web/site/out/`:

| Subdomain | Worker rewrite | Source |
|-----------|----------------|--------|
| `hudsonkit.com` / `www.hudsonkit.com` | `/` → `/landing/` | `apps/web/app/landing/page.tsx` (SiteRoot) |
| `app.hudsonkit.com` | `/` → `/app/` | `apps/web/app/app/page.tsx` (WorkspaceShell) |

In local dev (`localhost:3500`) there's no host split — `/` is a thin redirect to `/app`, and `/landing` is the marketing deck. **Treat `/` as the product surface** when adding routes; never dump page content into `apps/web/app/page.tsx` again.

If you add a new top-level static page, append its route to `staticRoutes` in `apps/web/site/export-pages.mjs` — that allow-list is what gets copied into the Cloudflare deploy bundle.

## Key Paths

| Path | Purpose |
|------|---------|
| `apps/web/app/page.tsx` | Client-side redirect to `/app`; dev-only choice surface |
| `apps/web/app/landing/page.tsx` | Marketing deck (mounts `<SiteRoot>`). Served at `hudsonkit.com/` via Worker rewrite |
| `apps/web/app/app/page.tsx` | Mounts `<WorkspaceShell>` with `allWorkspaces` from the registry. Served at `app.hudsonkit.com/` via Worker rewrite |
| `packages/web/hudsonkit/src/workspace/shell/WorkspaceShell.tsx` | Main shell orchestrator (package-owned; exported via `hudsonkit/workspace`) |
| `apps/web/app/lib/hudsonShellEnvironment.tsx` | Hudson-owned route/terminal/AI-settings bindings passed into the shell |
| `apps/web/app/apps/registry.ts` | Canonical app list (built-in + local) |
| `apps/web/app/apps/` | App implementations |
| `apps/web/app/local/apps.local.ts` | Gitignored; developer-local app/workspace registrations |
| `apps/web/app/workspaces/` | Workspace definitions |
| `apps/web/marketing/sheets/index.ts` | Sheets that compose the public deck. Add here only if it's HudsonKit marketing copy |
| `apps/web/marketing/primitives/` | Reusable building blocks for sheets (Sheet, Eyebrow, TitleBlock, …) |
| `apps/web/site/cloudflare-static-worker.ts` | Per-host root rewrites + AI chat handler |
| `apps/web/site/export-pages.mjs` | Allow-list of routes copied into `apps/web/site/out` for deploy |
| `packages/web/hudsonkit/src/components/AppShell.tsx` | Default single-app shell |
| `packages/web/hudsonkit/src/types/app.ts` | `HudsonApp` interface |
| `packages/web/hudsonkit/src/types/workspace.ts` | `HudsonWorkspace` interface |
| `packages/web/hudsonkit/src/types/intent.ts` | `AppIntent` interface |
| `packages/web/hudsonkit/src/` | Component library source |
| `packages/web/hudsonkit/src/styles/bundle.css` | Source for the precompiled CSS bundle |

## Adding a New App

1. Create directory in `apps/web/app/apps/your-app/`
2. Implement `HudsonApp` interface (Provider, slots, hooks)
3. Register in a workspace file in `apps/web/app/workspaces/`
4. Add workspace to the registry if new

See `docs/building-apps.md` for the full guide.
See `apps/web/app/apps/stage-design/` as a compact reference implementation
(Provider + Content + LeftPanel + Chrome + hooks); `apps/web/app/apps/theme-designer/`
is a fuller example with intents.

## Architecture

- **Provider + Slots + Hooks** pattern — apps own state, shell renders UI
- Shell nests all app Providers recursively
- Hooks are called inside Provider scope via an internal Bridge component
- Window bounds, pan/zoom offsets tracked in refs (not state) during drag; flushed via `BOUNDS_FLUSH_MS = 500` debounce (see `WorkspaceShell.tsx`)
- All persistent state uses `usePersistentState()` backed by localStorage
- SDK's precompiled CSS bundle is built via `cd packages/web/hudsonkit && bun run build:css`; output lands at `packages/web/hudsonkit/dist/styles.css` (gitignored)

## Fulfilling agentic Hudson work

When a Scout message, CLI prompt, Codex task, Claude Code task, or direct
operator request asks Hudson to create/change/deliver something:

1. Orient with `docs/agent/overview.agent.md` — a dense structural map of the
   codebase written for agent consumption.
2. Enumerate what's callable: `curl -s localhost:3500/api/intents | jq` if
   the dev server is up, or read `apps/web/app/apps/<id>/intents.ts` + grep for `intent(`
   in `apps/web/app/api/**`.
3. Start a task envelope before making changes. Prefer `run` when the work can
   be represented as one command; it writes both the started event and the
   terminal completed/failed event with the same trace id:

   ```bash
   bun scripts/agent-action.ts run \
     --prompt "Run agent-intent tests" \
     --action intents.test \
     --actor "${USER:-agent}" \
     -- bun run test apps/web/test/lib/agent-intent.test.ts
   ```

   For interactive or multi-step work, use `start` and keep the trace id:

   ```bash
   TRACE=$(bun scripts/agent-action.ts start \
     --prompt "Create a theme preset" \
     --action theme.create \
     --actor "${USER:-agent}" | jq -r .traceId)
   ```

   Use `--source scout`, `--source codex`, or `--source claude-code` when known.
   This writes to `.data/agent-actions.jsonl`, which HudLogger renders.
4. **Server intents** (those wrapped with `intent({...}, fn)`) are directly callable —
   import them from a script or a Bun one-liner. Each call auto-emits started/completed
   spans to `.data/agent-actions.jsonl`, which HudLogger renders.
5. **Sub-actions outside an intent call** — use the CLI logger for milestones:

   ```bash
   bun scripts/agent-action.ts log --trace "$TRACE" --action theme.create \
     --message "Picked the base palette"
   ```

   Log the milestones a human would want to see in HudLogger (picked a template,
   wrote a file, finished a build) — not every keystroke. For direct server code,
   import from `@/app/lib/agent-log-core`; `@/app/lib/agent-log` is Next
   server-only and is not CLI-safe.
6. Complete or fail every manually started envelope:

   ```bash
   bun scripts/agent-action.ts complete --trace "$TRACE" --action theme.create \
     --message "Delivered theme preset and preview"
   ```

   On failure, use `fail --error "..."`. Do not leave a `started` task without
   a matching terminal event.
7. Reply to Scout/operator with the result. The HudLogger trail is the durable
   record; the reply doesn't need to re-narrate every step.
