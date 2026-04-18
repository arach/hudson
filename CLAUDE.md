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
- Every app must implement the `HudsonApp` interface from `@hudson/sdk`
- Apps do not manage shell chrome — the shell reads from app hooks and renders slots

## Key Paths

| Path | Purpose |
|------|---------|
| `app/page.tsx` | Redirects to `/app` |
| `app/app/page.tsx` | Mounts `<WorkspaceShell>` with `allWorkspaces` from the registry |
| `app/shell/WorkspaceShell.tsx` | Main shell orchestrator |
| `app/apps/registry.ts` | Canonical app list (built-in + local) |
| `app/apps/` | App implementations |
| `app/local/apps.local.ts` | Gitignored; developer-local app/workspace registrations |
| `app/workspaces/` | Workspace definitions |
| `packages/hudson-sdk/src/components/AppShell.tsx` | Default single-app shell |
| `packages/hudson-sdk/src/types/app.ts` | `HudsonApp` interface |
| `packages/hudson-sdk/src/types/workspace.ts` | `HudsonWorkspace` interface |
| `packages/hudson-sdk/src/types/intent.ts` | `AppIntent` interface |
| `packages/hudson-sdk/src/` | Component library source |
| `packages/hudson-sdk/src/styles/bundle.css` | Source for the precompiled CSS bundle |

## Adding a New App

1. Create directory in `app/apps/your-app/`
2. Implement `HudsonApp` interface (Provider, slots, hooks)
3. Register in a workspace file in `app/workspaces/`
4. Add workspace to `app/page.tsx` if new

See `docs/building-apps.md` for the full guide.
See `app/apps/shaper/` as the reference implementation.

## Architecture

- **Provider + Slots + Hooks** pattern — apps own state, shell renders UI
- Shell nests all app Providers recursively
- Hooks are called inside Provider scope via an internal Bridge component
- Window bounds, pan/zoom offsets tracked in refs (not state) during drag; flushed via `BOUNDS_FLUSH_MS = 500` debounce (see `WorkspaceShell.tsx`)
- All persistent state uses `usePersistentState()` backed by localStorage
- SDK's precompiled CSS bundle is built via `cd packages/hudson-sdk && bun run build:css`; output lands at `packages/hudson-sdk/dist/styles.css` (gitignored)
