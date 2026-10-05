# @hudsonkit/ai

## [Unreleased]

- Release project-owned source under Apache-2.0, replacing FSL-1.1-MIT. Previously published versions retain their included license.

## 0.3.0

### Minor Changes

- ac82340: Add `@hudsonkit/ai/scout`: `createScoutBackend` runs one-shot turns on local agent harnesses (codex, opencode v2, pi, grok, kimi, cursor via `@openscout/agent-sessions/local`; Claude via `claude -p`), and `listHarnessModels` lists what each ready harness can run. Server-only; `@openscout/agent-sessions` is an optional peer.
- e994260: Add the `@hudsonkit/ai/conversation` entry: conversational voice adapters (OpenAI and Gemini live) and settings import.
- 8c6901d: Add reasoning effort controls to the pi-ai backend.

### Patch Changes

- 5cea3f7: Discover model options from the current pi-ai runtime.

## 0.2.2

### Patch Changes

- e17f9c6: Realign the package version with the npm registry. 0.2.1 was published out-of-band without committing the bump back to the repo, leaving the checked-in version at 0.1.1 — publishing from CI would have regressed the `latest` dist-tag. This rolls the repo forward past the published version and ships the accumulated unreleased changes.
