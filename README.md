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

## Case study: Premotion

[![Premotion catalog studio](./docs/images/premotion-case-study.png)](./docs/case-study-premotion.md)

**[Full write-up →](./docs/case-study-premotion.md)**

A video catalog browser built on Hudson SDK. Fresh Next.js 16 + React 19 project, imports `hudsonkit/app-shell`, fills in a single `HudsonApp` with Provider + slots, ships. Left panel + search + status bar + inspector + URL-driven filter state all came from the shell — the only real work was the catalog logic itself.

The case study walks through the build *and* the real friction points we hit consuming the SDK from outside its monorepo (Tailwind scanning, symlink shape, barrel exports, `'use client'` directives) — and what got fixed vs. what's still on the follow-up list.

## Native Vantage

Hudson now has an early Apple-native `HudsonVantage` module: an embeddable
spatial surface for durable runtimes. Scout, Talkie, Fabric, or a standalone
app can each host **a Vantage** and control it from outside through a JSONL
control lane.

The first case study is the Termini canvas app:

```sh
examples/termini-canvas/scripts/run-app.sh
```

See [Hudson Vantage](./docs/hudson-vantage.md) for the module boundary.

## Orientation

```
app/                     # The Hudson workspace itself (Next.js 16)
packages/web/hudsonkit/     # Shell + primitives (workspace-internal package)
packages/native/apple/HudsonKit/ # Apple-native Swift package
packages/services/hudson-relay/  # Terminal relay service
docs/                    # Architecture, case study, builder notes
```

Dev:

```bash
bun install
bun dev           # Hudson workspace on :3500
```

## State

Hudson is **built in the open** — the code is legible, the commits are explicit, the docs are honest — but it is **not packaged for external consumption yet**. The SDK is `private: true` and lives in this monorepo. Pulling it into another app today *is* possible (Premotion does it) but requires manual wiring, and several gaps are documented in the case study.

If you're looking at this to understand *how I think about building apps*, start with the [overview](./docs/overview.md) and the [case study](./docs/case-study-premotion.md).

## Stack

React 19 · Next.js 16 · Tailwind v4 · bun · TypeScript

## Docs

- [Overview](./docs/overview.md) — what Hudson is, the mental model
- [Architecture](./docs/architecture.md) — how the shell is structured
- [Case study: Premotion](./docs/case-study-premotion.md) — the real consumption story
- [Building apps](./docs/building-apps.md) — the `HudsonApp` contract in detail
- [Perf patterns](./docs/perf-drag-resize-patterns.md) — drag/resize/pan tricks worth reusing
- [For agents](./docs/agent/overview.agent.md) — LLM-oriented reference
