# Hudson: take OpenScout’s next-gen sidebar

## Goal

Own the work to bring OpenScout’s **next-gen sidebar** into Hudson — not as a copy-paste of Scout chrome, but as a proper HudsonKit / native contribution that products can share.

## Context (already established)

- OpenScout shipped next-gen nav as product-local chrome (`sco-083` / `sco-084` → `ScoutSidebar` / `ScoutUnifiedSidebar` under `packages/web/client/scout/sidebar/`).
- An OpenScout audit intentionally kept Scout on that path and did **not** migrate onto Hudson’s rail-oriented sidebar.
- Hudson already has parallel surfaces: native resizable `HudNavigationSidebar` (#102 / #175) and web `HudSideNav` / `hudsonkit/nav` (#191).
- Conclusion so far: the OpenScout next-gen sidebar was **not** contributed back. This task is to close that gap the right way.

## Source of truth to study

- OpenScout: `/Users/art/dev/openscout`
  - `packages/web/client/scout/sidebar/`
  - `packages/web/client/components/ui/sidebar.tsx`
  - `packages/web/client/OpenScoutAppShell.tsx`
  - PRs / specs around sco-083, sco-084, sco-085+
- Hudson: `/Users/art/dev/hudson`
  - `packages/web/hudsonkit/src/components/nav/` (`HudSideNav`, primitives)
  - Native sidebar under `packages/native/apple/`
  - `docs/side-nav.md`

## What “take it” means

1. **Audit first:** map OpenScout next-gen sidebar capabilities vs Hudson `HudSideNav` / native sidebar (collapse modes, icon rail vs content rail, tooltips, persistence, focus, live state, resize, a11y).
2. **Decide the contribution shape:** extend `hudsonkit/nav`, native API, or both — prefer additive HudsonKit APIs over forking Scout CSS/IA into Hudson.
3. **Implement the missing next-gen pieces** Hudson still lacks (the ones that made Scout’s sidebar feel “next gen”: pure-nav icon rail + separate side rail, hover-intent labels, full-height chrome, anchored top row, etc. — only where they fit Hudson’s visual ownership).
4. **Prove it:** focused tests + a small example / docs update. Open a PR on Hudson when ready.
5. **Do not** blindly port Scout branding, Scout IA seats, or OpenScout-only routes into Hudson.

## Constraints

- Work in `/Users/art/dev/hudson` as the primary repo; OpenScout is read-only reference (`--add-dir` available).
- Prefer Bun for JS tooling where Hudson already does.
- Follow Hudson `AGENTS.md` / CONTRIBUTING.
- No force-push; no unrelated refactors.
- Report: gap matrix, proposed API delta, files changed, tests run, PR URL if opened.

## First move

Start with the gap matrix (OpenScout next-gen vs Hudson today), then propose the smallest merge path before coding.

## Launch

Owned OMP sessions for this work run in **Herdr**, not Terminal.app:

```bash
/Users/art/dev/hudson/scripts/omp-next-gen-sidebar.sh
```
