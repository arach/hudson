# Standalone tier greening evidence (HUD-014 C)

**Date:** 2026-07-21  
**Verdict:** **GREEN** (private template scaffolds → installs → typechecks → builds → serves destinations scaffold)  
**Publish decision:** still owner (not taken here)

## Gate results

| Step | Result | Notes |
|------|--------|--------|
| CLI scaffold `--tier standalone` | pass | 12 files under `<cwd>/<appId>/` |
| Wire local pack | pass | Auto `file:` to monorepo `hudsonkit-0.4.1.tgz` (or `HUDSONKIT_TGZ`) |
| `bun install` | pass | 158 packages; hudsonkit from local tgz |
| `bun run typecheck` (`tsc --noEmit`) | pass | App `src/**` only |
| `bun run build` (`vite build`) | pass | ~14s; main JS ~799 kB, CSS ~175 kB (includes `hudsonkit/styles`) |
| `bun run test` (theme adapter) | pass | 2/2 edge ≠ ink |
| `bun run check` | pass | typecheck && build |
| Preview serve | pass | `vite preview` → HTTP 200 on `/`, CSS, JS |
| Destinations in bundle | pass | `Home`, `Settings`, `Navigate`, `READY`, `data-hudson-template`, `Destinations` |

## Reproduction (fresh)

```bash
# requires monorepo pack present
cd packages/web/hudsonkit && bun run pack   # hudsonkit-0.4.1.tgz

# from monorepo root (auto-wires file: pack) OR set HUDSONKIT_TGZ=/abs/path/to.tgz
cd /tmp && mkdir -p standalone-green && cd standalone-green
HUDSONKIT_TGZ=/Users/arach/dev/hudson/packages/web/hudsonkit/hudsonkit-0.4.1.tgz \
  bun run /Users/arach/dev/hudson/packages/tools/create-hudson-app/src/index.ts green-check \
  --tier standalone \
  --description "Standalone greening evidence app" \
  --no-workspace

cd green-check
bun install
bun run check   # typecheck + build
bun run test
bun run preview # http://127.0.0.1:4173 — SPA shell + destinations
```

## What was red before this slice

1. **`tsc --noEmit` failed** — `vite.config.ts` used `__dirname` / `process` / `node:path` without Node types, and was included in the app tsconfig.
2. **`hudsonkit: "latest"`** resolves npm **0.3.4**, which lacks `hudsonkit/behaviors`, `hudsonkit/nav` (0.4.x HUD-014 surface). Install without a local pack cannot green the template against the APIs it imports.

## Fixes landed with greening

| Change | Path |
|--------|------|
| Exclude vite config from app typecheck; ESM-safe root via `import.meta.url` | `templates/standalone/{tsconfig.json,vite.config.ts}.tmpl` |
| Pin template dep `hudsonkit: ^0.4.1`; add `@types/node` | `templates/standalone/package.json.tmpl` |
| Pre-publish `file:` wire (exact versioned tgz / `HUDSONKIT_TGZ`) | `src/wireHudsonkit.ts`, `src/index.ts` |
| Standalone next-steps in CLI summary | `src/log.ts`, `src/index.ts` |
| README pre-publish install path | `templates/standalone/README.md.tmpl` |
| **verify-pack** uses `package.json` version filename (Iris optional steer) | `packages/web/hudsonkit/bin/verify-pack.mjs` |

## Evidence snapshot (2026-07-21 run)

- Scaffold dir: `/tmp/hudson-standalone-green/green-check` (ephemeral)
- `bun run check`: exit 0
- `bun run test`: 2 passed
- Preview `GET /`: 200, title **Green Check**, `#root`, module entry `./assets/main-*.js`, stylesheet `./assets/main-*.css` (174764 bytes — styles flow tarball → install → Vite CSS chunk)
- Bundle markers: `Destinations`, `Green Check`, `data-hudson-template`, Home/Settings rail labels

## Out of scope / remaining

- **Owner publish** of create-hudson-app standalone tier + hudsonkit 0.4.1 to npm (not greened here as a release).
- TanStack Router is a declared stack point (`src/router.tsx` stub); destinations currently use local view state under AppShell slots — intentional minimal SPA scaffold.
- Headless browser DOM screenshot not collected (no playwright/chromium in agent env); preview HTTP + bundle markers used instead.
- Iris **useSnapCollapseAt 180ms-belt** hardening proposal: integrated as package-03 amendment (`PENDING_PROGRAMMATIC_WIDTH_CLEAR_MS` + unmount cleanup + clamp never-settle unit test).
