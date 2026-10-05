# Contributing

Hudson is solo-maintained and built in the open. The code is legible, the
commits are explicit, the docs are honest.

## Issues and discussion

Issues and discussion are welcome. If you have a bug report, question, or idea,
open an issue.

**For pull requests: open an issue first.** Changes should be agreed on before
code is written. Unsolicited PRs for large changes will likely be closed.

## Dev setup

```bash
bun install
bun dev        # Hudson workspace on :3500
```

**bun is required** — not npm, not pnpm.

## Before submitting

```bash
bun run lint
bun run typecheck
bun run test
```

All three should pass clean.

## Changes to published packages

If your change touches `packages/web/hudsonkit` or `packages/web/ai-backends`,
update that package's `CHANGELOG.md`. Bump `version` in its `package.json` when
you're ready to release, then merge to `main`. CI does not run automatically:
start the **CI** workflow on `main` from the Actions tab and wait for it to pass
on the exact merge commit. Then run the **Publish npm packages** workflow from
`main`, enter that full commit SHA, and keep `latest` for stable releases;
prereleases must use an explicit non-`latest` dist-tag.

`packages/web/admin` is build- and typecheck-gated, but it does not yet have a
release lane. Do not assume the npm publish workflow includes it.

## Orientation

- [`docs/building-apps.md`](./docs/building-apps.md) — the `HudsonApp` contract
- [`docs/architecture.md`](./docs/architecture.md) — how the shell is structured
- [`AGENTS.md`](./AGENTS.md) — notes for AI-agent contributors

## License

By contributing you agree that your changes will be licensed under the project
license: **Apache-2.0** (see [LICENSE.md](./LICENSE.md)).
