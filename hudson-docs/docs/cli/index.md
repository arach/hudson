---
title: CLI Tooling
description: Command-line tools for scaffolding, service discovery, and terminal relay.
section: cli
order: 1
---

# CLI Tooling

Hudson ships a set of command-line tools that support the full development lifecycle: scaffolding new apps, running a local service registry, and relaying terminal sessions to the browser.

## Tools Overview

| Package | Command | Purpose |
|---------|---------|---------|
| `create-hudson-app` | `bunx create-hudson-app` | Scaffold a new Hudson app with templates |
| `@hudsonos/hx` | `hx` | Local service registry and smart router daemon |
| `@hudson/relay` | `hudson-relay` | WebSocket PTY relay for embedded terminals |

## How They Fit Together

A typical development session uses all three tools:

```
1. create-hudson-app my-tool         # scaffold a new app
2. hx up                             # start the service registry
3. hudson-relay                      # start the terminal relay
4. bun dev                           # start Hudson on :3500
5. hx register my-agent --port 4500  # register external services
```

The **scaffolder** generates app boilerplate that follows the Provider + Slots + Hooks pattern described in [Building Apps](./building-apps.md). Once you have an app, **hx** manages discovery of any external services your app depends on (agent backends, APIs), and the **relay** provides the PTY bridge that powers embedded terminals via the `useTerminalRelay` hook (see [API Reference](../npm/sdk/api-reference.md#useterminalrelay)).

### Architecture Diagram

```
Browser (Hudson :3500)
  |
  |--- WebSocket -----> hudson-relay :3600   (PTY sessions)
  |
  |--- HTTP ----------> hx daemon :4800     (service discovery)
  |                       |
  |                       |--- proxy -----> Agent A :4500
  |                       |--- proxy -----> Agent B :4600
  |                       '--- proxy -----> API service :3000
```

## Individual Guides

- [create-hudson-app](./create-hudson-app.md) -- scaffold a new app interactively or via flags
- [hx](./hx.md) -- service registry daemon, proxying, and the `hx push` pipeline
- [relay](./relay.md) -- WebSocket PTY relay and the terminal session protocol
