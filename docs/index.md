# Hudson docs

Hudson is a shell + primitives library for building app-like interfaces across web, iOS, and macOS. These docs cover the architecture, shell contracts, and the primitive surface — web (`hudsonkit/*` subpaths) and Apple-native (`Hud*` Swift modules in HudsonKit).

## Start here

- **[Quickstart](./quickstart.md)** — mount `AppShell` with a minimal app in 5 minutes
- **[Overview](./overview.md)** — what Hudson is, the two shell modes, the `HudsonApp` contract
- **[Architecture](./architecture.md)** — monorepo layout, data flow, key decisions

## Web

- **[Building apps](./building-apps.md)** — the `HudsonApp` contract with walkthrough
- **[Building app AI](./building-app-ai.md)** — adding an AI surface to a Hudson app
- **[API reference](./api.md)** — every `hudsonkit` export, organized by subpath
- **[Settings](./settings.md)** — declarative app-level settings with persisted values
- **[Multi-instance](./multi-instance.md)** — per-instance state scoping
- **[Systems](./systems.md)** — Intents, Services, Ports
- **[Theming](./theming.md)** — runtime theme/template switching
- **[Theme Designer](./theme-designer.md)** — the surface for editing the token matrix
- **[Controls](./controls.md)** — parameter controls and code components for inspectors
- **[Cache](./cache.md)** — shared cache primitive (`hudsonkit/cache`)

## iOS apps

- **[iOS Shell](./ios-shell.md)** — `HudPhoneAppShell` + `HudPhoneComplications`
- **[Permissions](./permissions.md)** — `HudPermissionGate` for camera, mic, photos, notifications
- **[QR Code](./qr.md)** — `HudQRCode` generation + `HudQRScanner`

## macOS apps

- **[macOS Shell](./macos-shell.md)** — `HudAppShell` anatomy: rails, inspector, canvas, palette, drawers
- **[Terminal](./terminal.md)** — `HudTerminalSurface` (Termini-backed)

## Cross-platform primitives

- **[Vault](./vault.md)** — encrypted KV: Keychain on Apple, WebCrypto + IndexedDB on web
- **[AI](./ai.md)** — provider-neutral inference: Claude, OpenAI, OpenRouter
- **[Voice](./voice.md)** — voice input/output (web `hudsonkit/voice` + Apple `HudsonVoice`)
- **[Observability](./observability.md)** — logs, metrics, traces
- **[Table](./table.md)** — tabular data primitive on both surfaces
- **[Patterns](./patterns.md)** — optional app-interior rails, trees, grouped lists, cards, context panels

## Design system

- **[Theme](./theme.md)** — runtime theming via `@Environment(\.hudTheme)`

## Tooling

- **[HudLint](./hudlint.md)** — compile-time drift guard for design tokens
- **[Perf patterns](./perf-drag-resize-patterns.md)** — drag/resize/pan techniques used inside the shell
- **[CLI: terminal relay](./cli/relay.md)** — WebSocket-based terminal relay protocol

## For agents / LLMs

- **[Agent overview](./agent/overview.agent.md)** — terse, accurate reference for agents working in the Hudson codebase
