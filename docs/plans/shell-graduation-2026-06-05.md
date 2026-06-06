# Shell Graduation: WorkspaceShell into HudsonKit

**Date:** 2026-06-05
**Status:** Stages 1-3 complete; downstream smoke tests next

## Goal

HudsonKit owns the multi-app shell implementation. Hudson should consume
`WorkspaceShell` from `hudsonkit/workspace` instead of carrying a private
`app/shell/WorkspaceShell.tsx` implementation.

Downstream apps such as Atelier are useful smoke-test consumers. They should
have as little workspace/app-shell code as possible: app code implements
`HudsonApp`, while shell behavior lives in HudsonKit unless a consumer is
deliberately overriding a slot or environment binding.

## Current State

- Stage 1 foundation contexts and settings types live in
  `packages/web/hudsonkit/src/workspace/`.
- `hudsonkit/workspace` exports the graduated multi-app `WorkspaceShell` plus
  the shell runtime extension points used by workspace apps.
- Hudson render/type sites import `WorkspaceShell` from `hudsonkit/workspace`.
- The private `app/shell/` implementation has been removed.
- `hudsonkit/app-shell` no longer exports the old lightweight
  `components/WorkspaceShell.tsx` embed shell.

## Work Items

### Stage 1 - Foundation

Done. Contexts, settings types, service registry plumbing, and event-source
invalidation helpers have been started under `hudsonkit/workspace`.

### Stage 2 - Graduate The Shell Into The Kit

Done.

- Moved chrome, ports, decor, workspace-manager, AI runtime, and supporting
  shell components into `packages/web/hudsonkit/src/workspace/shell/`.
- Moved the heavy `WorkspaceShell` into the kit and exported it from
  `hudsonkit/workspace`.
- Added package-owned settings components/types under
  `packages/web/hudsonkit/src/workspace/settings/`.
- Removed the lightweight `components/WorkspaceShell.tsx` export and source.
- Verified `bun run build:js` in `packages/web/hudsonkit`.

### Stage 3 - Flip Hudson To The Kit Shell

Done.

- Repointed Hudson render/type sites and workspace-app shell helper imports to
  `hudsonkit/workspace`.
- Deleted duplicated private shell implementation from `app/shell`.
- Verified `bun run build`.

### Stage 4 - Downstream Consumer Smoke Tests

Use Atelier or another small app as a downstream fixture:

- `/` renders a multi-app workspace from `hudsonkit/workspace`.
- `/<app-id>` renders a single-app surface from `hudsonkit/app-shell`.
- No forked shell behavior is required in the consumer.

### Stage 5 - Decompose For Simplicity

After both the kit and Hudson are green, split the graduated orchestrator into
coherent workspace modules. This is cleanup, not a blocker for the shell
graduation.

## Done When

- `WorkspaceShell` is exported by `hudsonkit/workspace`.
- Hudson uses that kit shell rather than `app/shell/WorkspaceShell.tsx`.
- The old lightweight `WorkspaceShell` export is removed from `hudsonkit/app-shell`.
- Kit build and Hudson build pass.
- A downstream consumer can render the workspace without forked shell behavior.
