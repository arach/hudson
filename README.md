# Hudson

![Hudson workspace with Shaper, Logo Designer, and Notepad apps sharing chrome](./docs/images/hudson-hero.png)

An opinionated app shell for browser-based multi-app workspaces. Chrome once, apps plug in.

## What this is

Hudson is a **shell**, not a framework. It owns the workspace chrome — nav bar, side panels, command palette, terminal, status bar, canvas pan/zoom — and hosts **apps** that plug in via a small `HudsonApp` interface: a Provider for state, slot components for the shell to render, and hooks the shell reads for labels, search, status.

Two modes:

- **`AppShell`** — the default. One app, full chrome. Best for single-purpose products.
- **`WorkspaceShell`** — multi-app canvas. Apps float as windows on a shared dotted-grid workspace. The screenshot above: Shaper (vector editing), Logo Designer, and Notepad all sharing one set of chrome.

## Why

I build a lot of small apps. Each one was ~70% chrome: sidebar, settings, command palette, status bar, keyboard shortcuts, persistent-state plumbing, AI panel. Hudson is that chrome extracted as a primitive, so every new project starts from *build the interesting part* instead of *build yet another sidebar*.

## Native Vantage

Hudson ships **Vantage** — a native macOS spatial canvas for tmux sessions,
terminals, and workspace artifacts. The surface is embeddable via `HudsonVantage`;
Scout, Talkie, Fabric, or your own app can host one too.

```sh
apps/hudson/scripts/run-app.sh
```

## Orientation

```
app/                     # The Hudson workspace itself (Next.js 16)
apps/hudson/            # Native Hudson macOS app (Vantage main window + local services)
packages/web/hudsonkit/     # Shell + primitives (workspace-internal package)
packages/native/apple/HudsonKit/ # Apple-native Swift package
packages/services/hudson-relay/  # Terminal relay service
docs/                    # Architecture, case study, builder notes
examples/                # SDK reference apps (hudsonkit-reference, …)
```

Dev:

```bash
bun install
bun dev           # Hudson workspace on :3500
```

## State

Hudson is **built in the open** — the code is legible, the commits are explicit, the docs are honest — but it is **not packaged for external consumption yet**. The SDK is `private: true` and lives in this monorepo. Pulling it into another app today *is* possible (Premotion does it) but requires manual wiring, and several gaps are documented in the case study.

If you're looking at this to understand *how I think about building apps*, start with the [overview](./docs/overview.md).

## Stack

React 19 · Next.js 16 · Tailwind v4 · bun · TypeScript

## Docs

- [Overview](./docs/overview.md) — what Hudson is, the mental model
- [Architecture](./docs/architecture.md) — how the shell is structured
- [Building apps](./docs/building-apps.md) — the `HudsonApp` contract in detail
- [Perf patterns](./docs/perf-drag-resize-patterns.md) — drag/resize/pan tricks worth reusing
- [For agents](./docs/agent/overview.agent.md) — LLM-oriented reference
