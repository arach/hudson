# Hudson docs

> Personal notes on how the shell is built, what it does, and how I use it across projects. Not product documentation — read it as a sketchbook.

## Start here

- **[Overview](./overview.md)** — what Hudson is, the two shell modes, the `HudsonApp` contract
- **[Case study: Premotion](./case-study-premotion.md)** — a real catalog studio built on Hudson + the friction points that surfaced during build

## Build on it

- **[Building apps](./building-apps.md)** — the contract with walkthrough
- **[API reference](./api.md)** — every `@hudson/sdk` export, organized by subpath
- **[Systems](./systems.md)** — Intents (LLM/voice), Services (process deps), Ports (inter-app piping)

## How it's made

- **[Architecture](./architecture.md)** — monorepo layout, data flow, key decisions
- **[Perf patterns](./perf-drag-resize-patterns.md)** — drag/resize/pan techniques used inside the shell
- **[CLI: terminal relay](./cli/relay.md)** — WebSocket-based terminal relay protocol

## For agents / LLMs

- **[Agent overview](./agent/overview.agent.md)** — terse, accurate reference for agents working in the Hudson codebase
