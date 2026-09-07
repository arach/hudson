# Hudson ↔ canonical main reconciliation

**Branch:** `reconcile/canonical-main`
**Worktree:** `/Users/art/dev/hudson-reconcile-canonical-main`
**Merge commit:** `08b7e15` (WIP carry-in: `6bafab9`)
**Canonical:** `origin/main` @ `682fd1a` — now a **full ancestor** (0 behind, 11 ahead)

The source worktree `/Users/art/dev/hudson` was never touched. Its branch is still
`codex/wip-monorepo-cleanup-relay` @ `96f7b72` and its dirty tree is byte-identical to the
backup at `…/scratchpad/backup/dirty-worktree.patch`.

## Why the divergence looked worse than it was

Merge base is `e83b5fa` (#175). The local merge commit `96f7b72` merged an **old** main.
Canonical then landed #177–#180, two of which are the **PR-reviewed versions of local
commits** — local `9c206b9` (Iconoir) → canonical `1748f0a` (#177), local `9a8ef0c`
(floating titlebar) → canonical `f47d7d8` (#178). So most of the "9 ahead" was duplicate
history, and the real gap was ~1900 lines of canonical content the branch was missing.

## Direction corrections vs the original brief

Three items were listed as "local behavior to preserve" but are in fact **canonical**, where
canonical's version is strictly better. Attribution was verified per file against the merge
base, not by reading commit titles.

| Item | Brief said | Actually |
|---|---|---|
| HudSpeech host-lent credential isolation + tests | local | **canonical** (#179) — local lacked it entirely |
| HudChromeShell tokenized row height | local | **canonical** (#178) — local hardcoded `28` |
| hkit framework packaging | local WIP | **canonical** (#180) — local was a thinner parallel re-implementation |

## 1. Canonical changes adopted

- **#179 HudSpeech** — `cleanedCredentials` + the explicit-empty-env host-lent-only contract
  (a provider reports unavailable rather than falling back to process/on-disk credentials),
  plus `HudSpeechTests.swift` (69 lines). Local's variant was simpler in all four conflict
  regions and had nothing unique. Canonical also trims `.whitespacesAndNewlines` vs local's
  `.whitespaces`.
- **#178 HudChromeShell** — `HudLayout.rowHeightCompact` replaces the hardcoded `28`.
- **#177 Iconoir** — `Close`/`Xmark` dropped in favour of `X`. The in-flight local edits were
  already moving this way and merged without conflict.
- **#180 hkit framework embedding** — portable-linkage validation
  (`assertPortableFrameworkLinkage`), `.framework` suffix and duplicate-name checks,
  architecture-aware rpath parsing with per-slice consistency errors, and the exported
  helpers (`normalizeFrameworkPaths`, `parseArchitectureRpaths`, `signingPolicy`, …).
- **Package.swift** — direct `VoxCore` product dependency.

## 2. Local deviations preserved (and why)

- **pi-ai / useHudsonAI reasoning effort** (`effort?: 'off'|'low'|'medium'|'high'`) — canonical
  has no equivalent. Clean merge, canonical never touched these files.
- **HudLogger status presentation** — local `N err` / `N warn` with `statusError`/`statusWarn`
  replaces canonical's `total` + dim `/errors`. Verified canonical has not touched this file
  since the merge base, so this is a genuine local improvement, not staleness.
- **StatusBar `terminalLabel`** — purely additive, defaults to `'Console'`.
- **`packages/web/hudsonkit/vitest.config.ts`** — repointed to `apps/web/vitest.config`.
  **This is a real canonical bug fix**: canonical imports `../../../vitest.config`, and no root
  `vitest.config.ts` exists on canonical *or* at the merge base, so the package's
  `bun run test` is broken upstream. Worth upstreaming on its own.
- **Monorepo cleanup deletions** — `dewey.config.ts`, `.devmux.json`, `.githooks/pre-commit`,
  `examples/hudsonkit-reference/`, `.changeset/config.json`, and the `release.yml` rewrite from
  changesets-based *Release* to the gated *Publish npm packages* workflow. These are coherent
  and deliberate (7bfd35e), so the merge kept them deleted.

## 3. Genuinely reconciled — hkit signing

Not a side-pick. Canonical #180 already solved the ad-hoc/hardened-runtime problem with a
cleaner `signingPolicy(identity)` abstraction, which subsumes the local
`shouldUseHardenedRuntime` helper and the whole `signAppBundle` half of the local fix. Two
refinements from the local WIP were **not** in canonical and were grafted onto canonical's
shape:

1. **Whitespace-safe identity** — canonical's `!identity || identity === '-'` treats `"  "` as a
   real signing identity; now trimmed.
2. **Ad-hoc `--preserve-metadata=identifier` narrowing** — canonical always preserves
   `identifier,entitlements,requirements,flags`. Carrying `flags` over from a previous
   identified signature re-applies Hardened Runtime to a binary with no Team ID, which
   re-introduces exactly the library-validation failure ad-hoc signing is meant to avoid.

`signingPolicy` now returns `preserveMetadata`; canonical's whole-object `toEqual` tests were
updated and two cases added (whitespace/trim, and "never preserves flags when ad-hoc").

## 4. Tests run

| Check | Result |
|---|---|
| `swift test` | **200 passed**, 45 suites (was 195 — the +5 are canonical's adopted HudSpeechTests) |
| root `bun run test` | **459 passed**, 53 files |
| `packages/web/hudsonkit` tests | **138 passed**, 17 files (matches pre-merge baseline) |
| hkit `package.test.mjs` | **9 passed** (canonical's 7 + 2 new) |
| `bun run lint` | **0 errors**, 64 pre-existing warnings, none in reconciled files |
| `tsc --noEmit` (apps/web) | **exit 0** |
| `validate:hudsonkit-package` | **exit 0** (publint + attw) |
| hudsonkit `bun run build` | success |

## 5. Blockers and judgement calls

- **No blockers.** Everything builds and passes.
- **`bun.lock` was regenerated, not text-merged.** Git's textual merge corrupted it
  (`InvalidPackageKey: Duplicate package path`). It was reset to canonical's lock and
  reinstalled; the resulting delta vs canonical is **only `@changesets/*` removals**, consistent
  with the branch dropping changesets. Worth a glance if you expected other dep changes.
- **One deliberate drop, easily reversed:** canonical's `.changeset/calm-icons-glow.md` (the
  Iconoir patch note) returned through the merge and was removed. It is inert here — this
  branch deleted `.changeset/config.json`, has no changeset scripts in `package.json`, and
  replaced the changesets release workflow. Restore with
  `git checkout origin/main -- .changeset/` if you intend to keep changesets after all; that
  would also mean reverting the `release.yml` rewrite.
- **Recommended upstream:** the `vitest.config.ts` fix and the two hkit signing refinements are
  strict improvements to canonical and are good standalone PRs.
