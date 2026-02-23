# CLAUDE.md

Project-specific instructions for AI agents working on Hudson.

## Project

Hudson is a multi-app canvas workspace platform built with React 19, Next.js 16, and Tailwind CSS v4.

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
- Every app must implement the `HudsonApp` interface from `frame-ui`
- Apps do not manage shell chrome — the shell reads from app hooks and renders slots

## Key Paths

| Path | Purpose |
|------|---------|
| `app/page.tsx` | Entry point (mounts WorkspaceShell) |
| `app/shell/WorkspaceShell.tsx` | Main shell orchestrator |
| `app/apps/` | App implementations |
| `app/workspaces/` | Workspace definitions |
| `packages/frame-ui/src/types/app.ts` | HudsonApp interface |
| `packages/frame-ui/src/types/workspace.ts` | HudsonWorkspace interface |
| `packages/frame-ui/src/types/intent.ts` | AppIntent interface |
| `packages/frame-ui/src/` | Component library source |

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
- Hooks are called inside Provider scope via Bridge component
- Window bounds tracked in refs (not state) during drag, flushed via 60ms debounce
- All persistent state uses `usePersistentState()` backed by localStorage
