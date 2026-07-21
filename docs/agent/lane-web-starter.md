# Lane charter: opinionated web starter + Iris backports (owner: Grok)

**Granted:** 2026-07-20 · durable lane. Owner directive: "contribute to
the Hudson project with this opinionated stance that'll make spinning
up new projects more convenient."

## Why

Iris built a full Hudson web client (`/Users/arach/dev/iris/web/`) and
nearly every defect was an *assembly* gap, not a parts gap: theme
tokens hand-mapped wrong (`--border`→ink), no tsconfig so builds never
typechecked, `collapsible="icon"` undiscovered while a rail got
hand-rolled, tooltips/roving hand-rolled for lack of a behaviors
layer. The starter encodes the assembled end-state as the beginning.
Read `/Users/arach/dev/iris/docs/reference/surface-primitives-architecture.md`
(HudsonKit upstream section) — that punch list is this lane's backlog.

## Rule amendment (owner-authorized, land it in AGENTS.md)

AGENTS.md currently says Base UI is for context menu only. The owner
has widened this: **@base-ui/react is the sanctioned headless
*behaviors* layer — tooltip, menu, popover, select, context menu —
with Hudson owning all visual register.** Custom-built stays the rule
for everything the eye touches. Update the AGENTS.md line as part of
workstream B.

## Workstreams (checkpoint each separately)

### A. Upstream punch list (hudsonkit)
1. Type declarations for the `./styles` export subpath (consumers hit
   TS2882 under strict tsc today).
2. `--hud-nav-live` themeable token on HudSideNav so consumers retint
   live dot/count without `!important` on generated utilities.
3. Visible-on-all-themes selection + roving keyboard focus in
   `CollapsedRail` (donor: Iris client's layered overrides +
   `useRovingNav`).
4. `snapCollapseAt` option on AppShell/SideNav — drag a panel past a
   threshold morphs the nav compact⇄labeled (donor: Iris client's
   two-effect glue in `web/src/client/IrisClient.tsx`, incl. the
   reviewer-flagged hysteresis + pending-width hardening).
5. Breadcrumb/back-nav chrome primitive in `hudsonkit/nav`.
6. HudSideNav reading the theme edge ladder directly (no `--border`
   override burden on consumers).

### B. Behaviors backport (hudsonkit)
Port Iris `web/src/behaviors/**` per its written backport map (in the
module + `/Users/arach/dev/iris/docs/handoffs/baseui-behaviors.md`):
`HudTooltip`(+Provider), `HudMenu`, `HudPopover`, `HudSelectBase`,
shared overlay chrome folded into the ContextMenu skin. Strict tsc
green is the bar (the Iris copies already are). Then the AGENTS.md
amendment above.

### C. `create-hudson-app` starter
A template (suggest `packages/create-hudson-app/` or `templates/web/`
— follow whatever this repo's tooling favors; propose in the DM if
ambiguous): Vite + React + TS strict with `typecheck` wired into the
build gate; TanStack Router SPA mode with a destinations scaffold
(rail + contextual sidebar + content on AppShell, morph + ⌘B wired);
a **theme adapter** that maps one seed to both the `--hud-*` ladder
AND the shadcn-layer tokens correctly (make `--border`→ink
unwritable); behaviors included; `/` serves the app, extra entries
under `/embeds/` as a documented pattern; local-backend proxy recipe;
README. Starter apps follow the HudsonApp interface and repo rules
(no purple; cyan/blue/teal/emerald).

## Constraints

- **bun, never npm/pnpm — this repo is bun-only** (opposite of
  iris/web; do not confuse them).
- Tailwind v4 idioms; tokens live in `packages/web/hudsonkit/src/lib/theme.ts`.
- Read AGENTS.md fully before touching anything; existing exports must
  not break (Iris consumes hudsonkit via file: dep — after each
  hudsonkit checkpoint, verify Iris still builds:
  `cd /Users/arach/dev/iris/web && pnpm build` — yes, pnpm THERE).
- Do not touch `packages/native/**` (an unrelated edit is parked in
  the tree — leave it unstaged and uncommitted).
- Commit in-lane per checkpoint: gitmoji summary, no co-author or
  generated-with footers.

## Working agreement

Report each checkpoint in the Scout DM this charter arrives in: what
shipped, reuse accounting (what came from the Iris donors vs new),
gates (hudson's own build/lint + the Iris cross-check above),
screenshot when visual. Cross-harness review happens from those
reports; steers land in the same DM. Order: A1–A2 (small, unblock
Iris cleanups) → B → A3–A6 → C.
