---
title: CLI Tooling
description: Command-line tools for scaffolding and terminal relay.
section: cli
order: 1
---

# CLI Tooling

Hudson ships a set of command-line tools that support the full development lifecycle: scaffolding new apps and relaying terminal sessions to the browser.

## Tools Overview

| Package | Command | Purpose |
|---------|---------|---------|
| `create-hudson-app` | `bunx create-hudson-app` | Scaffold a new Hudson app with templates |
| `@hudson/relay` | `hudson-relay` | WebSocket PTY relay for embedded terminals |

## How They Fit Together

A typical development session uses both tools:

```
1. create-hudson-app my-tool         # scaffold a new app
2. hudson-relay                      # start the terminal relay
3. bun dev                           # start Hudson on :3500
```

The **scaffolder** generates app boilerplate that follows the Provider + Slots + Hooks pattern described in [Building Apps](./building-apps.md). The **relay** provides the PTY bridge that powers embedded terminals via the `useTerminalRelay` hook (see [API Reference](../npm/sdk/api-reference.md#useterminalrelay)).

### Architecture Diagram

```
Browser (Hudson :3500)
  |
  '--- WebSocket -----> hudson-relay :3600   (PTY sessions)
```

## Individual Guides

- [create-hudson-app](./create-hudson-app.md) -- scaffold a new app interactively or via flags
- [relay](./relay.md) -- WebSocket PTY relay and the terminal session protocol
