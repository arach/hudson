# HUD-014 — Web app starter and behaviors layer

**Status**: Accepted (owner, 2026-07-20) — integrating (B + A3–A5 + C landed; standalone **green** 2026-07-21 — evidence `docs/agent/standalone-tier-green-evidence.md`; still private until owner publish)
**Owner**: Arach (proposed from the Iris web client build, 2026-07-20)
**Depends on**: hudsonkit 0.4.1 (`hudsonkit/nav` HudSideNav provider + collapse modes)
**Targets**: `packages/web/hudsonkit` (behaviors, nav, app-shell, styles types), new `packages/create-hudson-app` (or `templates/web/`), `AGENTS.md`
**Implementation packages**: `/Users/arach/dev/iris/docs/handoffs/hudson-contrib/` (01–04, each an engineering proposal: problem / solution / alternatives / validation, with code pre-translated to Hudson idioms)

## Summary

Building a complete Hudson web app outside this repo (Iris,
`~/dev/iris/web/`) surfaced a set of problems that hudsonkit's parts
don't solve because they live in the *assembly*: token wiring, app
scaffolding, and headless behaviors. This RFC proposes (1) a small set
of hudsonkit additions, (2) a sanctioned Base UI behaviors layer, and
(3) an opinionated `create-hudson-app` starter that encodes the
debugged end-state of that assembly as the default for new projects.
We want comments before landing anything beyond the two trivial items.

## What we hit (motivation, in the order we hit it)

Spinning up and hardening one real consumer app in one day produced:

1. **Every kit-drawn border rendered near-white on dark themes.**
   Cause: the consumer hand-maps theme seeds to the shadcn-layer
   tokens and mapped `--border`/`--input` to ink. Nothing constrains
   this mapping; the failure is silent and global.
2. **The build never typechecked.** Vite transpiles without checking;
   the consumer had no tsconfig. Three latent type errors shipped
   invisibly until a gate was added.
3. **A rail was hand-rolled while the kit already shipped the answer.**
   `HudSideNav collapsible="icon"` (default!) is exactly the
   icon⇄label morph the app needed; it was discovered only after a
   hand-rolled rail was built and later reconciled.
4. **Tooltips, roving focus, menus, selects were hand-rolled** for
   lack of a behaviors layer — then the hand-rolled tooltips were
   silently lost in a refactor. Accessibility-critical machinery
   should not be per-consumer work.
5. **Panel-drag ⇄ nav-morph coupling required app-side glue** (two
   effects, three refs) whose review found two latent bugs (threshold
   flutter, a strandable pending-width flag).
6. **Assembly traps**: root URL serving the wrong Vite entry, a
   CORS/proxy recipe rediscovered from scratch, `./styles` import
   failing strict tsc for want of a type declaration.

## Proposals

| # | Problem (above) | Proposal | Package |
|---|---|---|---|
| P1 | 1 | Kit-owned **theme adapter**: one typed function from theme seed → complete token set (hud ladder + shadcn layer); incomplete/miscategorized mappings fail to compile | 04 (contract) |
| P2 | 4 | **Behaviors layer** in hudsonkit wrapping `@base-ui-components/react`: `HudTooltip`(+Provider), `HudMenu`, `HudPopover`, `HudSelectBase`; Hudson owns all visual register | 01 |
| P3 | 3, 5 | **Nav/AppShell upgrades**: visible-on-all-themes selection + roving focus in `CollapsedRail`; `snapCollapseAt` option coupling panel width to nav collapse (hysteresis built in); `--hud-nav-live` themeable token; breadcrumb primitive | 02, 03 |
| P4 | 6 | `./styles` **type declarations** in package exports | (self-authored, trivial) |
| P5 | 2, 6 | **`create-hudson-app`**: Vite + strict TS with typecheck wired into the build gate, TanStack Router SPA destinations scaffold on AppShell, the P1 theme adapter, P2 behaviors included, documented entries/proxy layout | 04 |

## Owner rulings (2026-07-20) — all four accepted as written

1. **Base UI doctrine.** `@base-ui-components/react` is the sanctioned
   headless behaviors layer (tooltip, menu, popover, select, context
   menu). Opt-in subpaths only (`hudsonkit/behaviors`,
   `hudsonkit/context-menu`). Full package name in docs. Package 01
   lands as a **diff** against existing ContextMenu chrome — reconcile
   via shared `menuChrome`, do not duplicate.
2. **Second stack.** Vite + TanStack Router blessed **scoped to
   standalone consumer clients**; docs must state the scope.
3. **API commitment — land by risk:** theme adapter; `snapCollapseAt`
   (optional prop + hysteresis); selection/roving **default-off**;
   breadcrumb minimal.
4. **Starter location:** new `standalone` template tier inside existing
   `packages/tools/create-hudson-app`, private until green.

**Integration order:** B (package 01) → A3–A6 (packages 02–03 +
breadcrumb) → C (package 04 as standalone-tier input).

## Validation

Every proposal is proven in the consumer that motivated it: Iris
builds against hudsonkit via file: dep, and each landing is gated on
`cd ~/dev/iris/web && pnpm build && npx tsc --noEmit` staying green.
Package SPECs carry per-item acceptance tests.
