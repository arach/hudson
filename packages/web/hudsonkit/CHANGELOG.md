# Changelog

All notable changes to `hudsonkit` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This changelog was backfilled from git history on 2026-07-02; entries marked “inferred” were reconstructed from version-bump commits, package diffs, and nearby merged PR history rather than from pre-existing release notes.

## [Unreleased]

### Added

- Ship TypeScript declarations for the `./styles` and `./styles/tokens.css`
  export subpaths (clears TS2882 under strict tsc for side-effect CSS imports).
- Themeable `--hud-nav-live` token on `HudSideNav` live signal (dot, count
  badge, left spine). Defaults to accent; consumers retint without `!important`
  on generated utilities.
- Opt-in `hudsonkit/behaviors` subpath: Base UI wrappers `HudTooltip` (+
  Provider), `HudMenu`, `HudPopover`, `HudSelectBase` (popup select alongside
  native `HudSelect`). Shared `menuChrome` (`OVERLAY_*`) is the single
  register for ContextMenu + behaviors — edges on the chrome/border ladder,
  accent only for highlight/selected.
- `hudsonkit/nav` HUD-014 A3–A5: `selectionWash` + `rovingFocus` props on
  `HudSideNav` (both default off); `useRovingNav`; `useSnapCollapseAt` with
  hysteresis + pending-width hardening; minimal `HudBreadcrumb`; header/footer
  borders read the chrome edge ladder; `--hud-action-tint` token.
### Changed

- **package-03 amendment — `useSnapCollapseAt` 180ms anti-strand belt:**
  `pendingProgrammaticWidth` still clears on settle (`Math.abs <= 1`), and now
  also clears on a bounded ~180ms timeout (`PENDING_PROGRAMMATIC_WIDTH_CLEAR_MS`)
  with unmount cleanup. Prevents the B-guard from stranding forever when
  AppShell clamps the requested natural width so drag-to-morph stays live.
  (Iris client lane ee00367; adopted into kit after local glue deleted.)

## [0.4.1] - 2026-07-20

### Added

- Grew `hudsonkit/nav` into a first-class sidebar anatomy (modeled on shadcn's
  Base UI sidebar) alongside the data-driven `HudSideNav`:
  - `HudSideNavProvider` + `useHudSideNav` own collapse state, add a Cmd/Ctrl+B
    keyboard shortcut (configurable/disable-able), and persist open/closed via
    `usePersistentState` (localStorage) when given a `persistKey`.
  - `collapsible` modes `offcanvas` | `icon` | `none`, a `side` (`left`/`right`),
    and controlled/`defaultOpen` state — surfaced as `data-state` /
    `data-collapsible` / `data-side` on the `<nav>`.
  - Composable primitives: `HudSideNavHeader`, `HudSideNavContent`,
    `HudSideNavFooter`, `HudSideNavGroup`, `HudSideNavGroupLabel`,
    `HudSideNavMenu`, `HudSideNavMenuItem`, `HudSideNavMenuButton` (`isActive`,
    `live`, `count`, `badge`, `asChild`), `HudSideNavMenuSub` /
    `HudSideNavMenuSubButton`, plus `HudSideNavRail` (edge toggle) and
    `HudSideNavTrigger`.
  - `HudSideNav` now self-provides a provider when standalone and accepts
    hand-composed `children`; the shipped `items` API is unchanged. The
    two-tier accent rule (accent === live only) holds across both layers.

## [0.4.0] - 2026-07-20

### Added

- Added the `hudsonkit/nav` subpath with `HudSideNav` — a data-driven,
  up-to-three-tier application side navigation (destinations → sections → items)
  that drops into `AppShell`'s `slots.LeftPanel`. Supports selected/hover/live/
  disabled states (accent reserved for the live signal per the two-tier accent
  rule), caret-collapsible groups with selected-ancestor reveal, and an optional
  icons-only collapsed rail. Exposes `HudNavNode` / `HudSideNavProps`.

## [0.3.3] - 2026-07-01

### Changed

- Bumped `hudsonkit` package version to `0.3.3` (commit `aa98116`).

## [0.3.2] - 2026-07-01

### Added

- Added the `hudsonkit/terminal` subpath and terminal relay client surface, including relay hook/component tests (commit `cbc4e7c`).

### Fixed

- Fixed published-package subpath exports for `hudsonkit` and `@hudsonkit/ai` (commit `053a220`).

## [0.3.1] - 2026-06-21 (inferred)

### Added

- Shipped the HudsonKit XCFramework distribution metadata/version handoff (commit `5ec441f`).

### Notes

- No committed `packages/web/hudsonkit/package.json` state with version `0.3.1` was found in this repository history. The package version moved from `0.3.0` history to `0.3.2`; this section is retained as an inferred backfill because release activity between `0.3.0` and `0.3.2` appears in git history.

## [0.3.0] - 2026-05-20

### Added

- Published the post-runaway-fixes `0.3.0` release marker (commit `54dc8cd`).
- Added `createEmbedApp` and the minimal explicit-placement `WorkspaceShell` API for passive embeds (inferred from commit `91ff99d`).
- Added the `prepare` hook that builds `dist/` for file/git installs (inferred from commit `ed863d3`).
- Added `hudsonkit preflight` to fail fast on dangerous consumer configuration and watcher hazards (inferred from commit `247fc06`).
- Added `hudsonkit status` and `hudsonkit panic` commands for identifying and safely terminating escaped Hudson-related dev processes (inferred from commit `c92db70`).

### Changed

- Sealed the npm package contents to built artifacts (`dist/` and `bin/`) instead of publishing source (inferred from commit `fe5d4da`).

### Fixed

- Backfilled as the “post-runaway-fixes” release; the release notes above focus on the package-safety and consumer-preflight work visible in the preceding git history.
