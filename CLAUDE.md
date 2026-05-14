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
- Use `@base-ui/react` for context menu only, `motion` sparingly
- NEVER use purple in designs — prefer cyan/blue/teal/emerald
- Every app must implement the `HudsonApp` interface from `hudsonkit`
- Apps do not manage shell chrome — the shell reads from app hooks and renders slots

## Routes

Production routes the marketing deck and the product on **different subdomains**, both served by the same Cloudflare Worker (`cloudflare-static-worker.ts`) against the static export in `site/out/`:

| Subdomain | Worker rewrite | Source |
|-----------|----------------|--------|
| `hudsonkit.com` / `www.hudsonkit.com` | `/` → `/landing/` | `app/landing/page.tsx` (SiteRoot) |
| `app.hudsonkit.com` | `/` → `/app/` | `app/app/page.tsx` (WorkspaceShell) |

In local dev (`localhost:3500`) there's no host split — `/` is a thin redirect to `/app`, and `/landing` is the marketing deck. **Treat `/` as the product surface** when adding routes; never dump page content into `app/page.tsx` again.

If you add a new top-level static page, append its route to `staticRoutes` in `site/export-pages.mjs` — that allow-list is what gets copied into the Cloudflare deploy bundle.

## Key Paths

| Path | Purpose |
|------|---------|
| `app/page.tsx` | Client-side redirect to `/app`; dev-only choice surface |
| `app/landing/page.tsx` | Marketing deck (mounts `<SiteRoot>`). Served at `hudsonkit.com/` via Worker rewrite |
| `app/app/page.tsx` | Mounts `<WorkspaceShell>` with `allWorkspaces` from the registry. Served at `app.hudsonkit.com/` via Worker rewrite |
| `app/apps/logo-designer/LogoComparisonSheet.tsx` | Matrix-view primitive (NxM grid renders any built-in template's renderBody). Used by Logo Designer's matrix view |
| `app/apps/logo-designer/LogoMatrixPresets.ts` | Per-template default families (rows × values) for the matrix view |
| `app/shell/WorkspaceShell.tsx` | Main shell orchestrator |
| `app/apps/registry.ts` | Canonical app list (built-in + local) |
| `app/apps/` | App implementations |
| `app/local/apps.local.ts` | Gitignored; developer-local app/workspace registrations |
| `app/workspaces/` | Workspace definitions |
| `marketing/sheets/index.ts` | Sheets that compose the public deck. Add here only if it's HudsonKit marketing copy |
| `marketing/primitives/` | Reusable building blocks for sheets (Sheet, Eyebrow, LogoComparisonSheet, …) |
| `cloudflare-static-worker.ts` | Per-host root rewrites + AI chat handler |
| `site/export-pages.mjs` | Allow-list of routes copied into `site/out` for deploy |
| `packages/web/hudsonkit/src/components/AppShell.tsx` | Default single-app shell |
| `packages/web/hudsonkit/src/types/app.ts` | `HudsonApp` interface |
| `packages/web/hudsonkit/src/types/workspace.ts` | `HudsonWorkspace` interface |
| `packages/web/hudsonkit/src/types/intent.ts` | `AppIntent` interface |
| `packages/web/hudsonkit/src/` | Component library source |
| `packages/web/hudsonkit/src/styles/bundle.css` | Source for the precompiled CSS bundle |

## Adding a New App

1. Create directory in `app/apps/your-app/`
2. Implement `HudsonApp` interface (Provider, slots, hooks)
3. Register in a workspace file in `app/workspaces/`
4. Add workspace to the registry if new

See `docs/building-apps.md` for the full guide.
See `app/apps/shaper/` as the reference implementation.

## Architecture

- **Provider + Slots + Hooks** pattern — apps own state, shell renders UI
- Shell nests all app Providers recursively
- Hooks are called inside Provider scope via an internal Bridge component
- Window bounds, pan/zoom offsets tracked in refs (not state) during drag; flushed via `BOUNDS_FLUSH_MS = 500` debounce (see `WorkspaceShell.tsx`)
- All persistent state uses `usePersistentState()` backed by localStorage
- SDK's precompiled CSS bundle is built via `cd packages/web/hudsonkit && bun run build:css`; output lands at `packages/web/hudsonkit/dist/styles.css` (gitignored)
