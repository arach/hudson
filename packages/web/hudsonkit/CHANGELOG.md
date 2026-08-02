# Changelog

All notable changes to `hudsonkit` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This changelog was backfilled from git history on 2026-07-02; entries marked “inferred” were reconstructed from version-bump commits, package diffs, and nearby merged PR history rather than from pre-existing release notes.

## [Unreleased]

### Added

- Add the `hudsonkit/nav` subpath with a data-driven `HudSideNav`, provider-
  backed composable primitives, icon/off-canvas collapse modes, persistence,
  breadcrumbs, roving focus, and responsive snap-collapse behavior.
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
- Pack gate for sealed artifacts: `assert-dist` (pre-pack: dist must contain
  `styles.css` + tokens + type decls) and `verify-pack` (post-pack: tarball
  listing must include those paths). `bun run pack` runs both.

### Changed

- Replaced Lucide with Hudson's shared Iconoir adapter and added the
  `hudsonkit/icons` export.
- Preserve CSS pipeline outputs across JavaScript-only tsup cleans, and recover
  missing styles with the cheaper CSS build during source-package preparation.
- Clear `useSnapCollapseAt`'s pending programmatic-width guard after a bounded
  180ms timeout when host clamping prevents the requested width from settling.

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
