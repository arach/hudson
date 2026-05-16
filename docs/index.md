# Hudson docs

Hudson is a shell + primitives library for building app-like interfaces across web, iOS, and macOS. These docs cover the architecture, shell contracts, and the primitive surface — web (`hudsonkit/*` subpaths) and Apple-native (`Hud*` Swift modules in HudsonKit).

## Start here

- **[Quickstart](./quickstart.md)** — mount `AppShell` with a minimal app in 5 minutes
- **[Overview](./overview.md)** — what Hudson is, the two shell modes, the `HudsonApp` contract
- **[Case study: Premotion](./case-study-premotion.md)** — a real catalog studio built on Hudson + the friction points that surfaced during build

## Web

- **[Building apps](./building-apps.md)** — the `HudsonApp` contract with walkthrough
- **[API reference](./api.md)** — every `hudsonkit` export, organized by subpath
- **[Settings](./settings.md)** — declarative app-level settings schema with persisted values
- **[Multi-instance](./multi-instance.md)** — per-instance state scoping
- **[Systems](./systems.md)** — Intents (LLM/voice), Services (process deps), Ports (inter-app piping)
- **[Theming](./theming.md)** — runtime theme/template switching, token surface
- **[Controls](./controls.md)** — parameter controls and code components for inspectors

## iOS apps

- **[iOS Shell](./ios-shell.md)** — `HudPhoneAppShell` + `HudPhoneComplications` (5-zone HUD, three render styles, long-press = alternative actions)
- **[Permissions](./permissions.md)** — `HudPermissionGate` for camera, microphone, photos, notifications
- **[QR Code](./qr.md)** — `HudQRCode` generation + `HudQRScanner`

## macOS apps

- **[macOS Shell](./macos-shell.md)** — `HudAppShell` anatomy: navigation rail/sidebar, inspector, canvas, command palette, drawers, takeover
- **[Native canvas workspace](./native-canvas-workspace.md)** — draft extraction spec for pan/zoom, selection, persistence, and workspace-hostable native apps
- **[tmux + Graphite workspaces](./tmux-graphite-workspaces.md)** — durable terminal identity, searchable path names, group actions, and offshoot canvases
- **[Native terminal canvas roadmap](./native-terminal-canvas-roadmap.md)** — phased implementation plan for sample hardening, canvas extraction, tmux orchestration, and offshoot workspaces
- **[Terminal](./terminal.md)** — `HudTerminalSurface` (Termini-backed)

## Cross-platform primitives

- **[Vault](./vault.md)** — encrypted KV: Keychain on Apple, WebCrypto + IndexedDB on web
- **[AI](./ai.md)** — provider-neutral inference: Claude, OpenAI, OpenRouter
- **[Voice](./voice.md)** — voice input/output (web `hudsonkit/voice` + Apple `HudsonVoice`)
- **[Observability](./observability.md)** — logs, metrics, traces (web `hudsonkit/observability` + Apple `HudsonObservability`)
- **[Table](./table.md)** — tabular data primitive on both surfaces
- **[Patterns](./patterns.md)** — optional app-interior rails, trees, grouped lists, cards, and context panels

## Design system

- **[Theme](./theme.md)** — runtime theming via `@Environment(\.hudTheme)`
- **[Theming (web)](./theming.md)** — see web theming above

## Tooling

- **[HudLint](./hudlint.md)** — compile-time drift guard for design tokens

## How it's made

- **[Architecture](./architecture.md)** — monorepo layout, data flow, key decisions
- **[Perf patterns](./perf-drag-resize-patterns.md)** — drag/resize/pan techniques used inside the shell
- **[CLI: terminal relay](./cli/relay.md)** — WebSocket-based terminal relay protocol

## For agents / LLMs

- **[Agent overview](./agent/overview.agent.md)** — terse, accurate reference for agents working in the Hudson codebase
