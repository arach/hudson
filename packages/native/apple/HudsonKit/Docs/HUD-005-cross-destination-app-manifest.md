# HUD-005 — Cross-destination Hudson app manifest

- **Status:** Proposed
- **Date:** 2026-05-07
- **Supersedes:** N/A
- **Superseded by:** N/A
- **Related:** HUD-002 (`HudAppShell` slot variants), HUD-004 (`Canvas JSONL Control API v0`)

## Context

Hudson now has enough surface area that "make an app" means different things
depending on the destination:

- Web Hudson app: a TypeScript `HudsonApp` object with Provider, slots, hooks,
  intents, and workspace registration.
- Native desktop app: a SwiftUI root using `HudAppShell`, `HudAppManifest`,
  leading/trailing/content/status slots, and optional drawers.
- Native mobile app: a SwiftUI root using `HudPhoneAppShell`, `NavigationStack`,
  page content, and HUD complications.
- Canvas host: an embeddable native surface with product-owned identity,
  control paths, runtime capabilities, setup manifests, and appearance policy.

The conceptual overlap is high. In all cases an app declares identity, brand,
navigation, commands, search, status, capabilities, and one or more content
surfaces. The implementation split is mostly projection: desktop gets sidebars
and inspectors; phone gets pages, sheets, and complications; web gets shell
slots and canvas windows.

Without a shared app-definition layer, every new product repeats the same early
work: choose shell shape, define manifest, wire nav, register commands, map
surface IDs to views, and decide which features exist on which destination.
That repetition is the drag Hudson should remove.

## Decision

Introduce a **cross-destination Hudson app manifest** as the highest-level
semantic brief for a Hudson-enabled app. The manifest is data-first and
portable across TypeScript and Swift. Platform code remains idiomatic and
typed, but it binds to the same named concepts.

There are two layers:

1. **`HudsonAppManifest` data document.** Codable/JSON-compatible identity,
   destinations, shell projection hints, capabilities, commands, intents,
   navigation, appearance, persistence, and scaffolding metadata.
2. **Runtime app definition per language.** A typed Swift or TypeScript object
   that binds manifest IDs to real state, actions, and views.

The manifest is not a view language. It does not encode SwiftUI or React trees,
and it should not become a rigid layout DSL. It names concepts so generators,
shells, agents, docs, tests, and workspace setup tools can agree on the app's
shape before platform code is written.

Put another way: the manifest is an elegant structured prompt. It gives Codex,
other codegen tools, and human implementers enough semantic alignment to move
fast across destinations while still letting each destination produce native,
hand-tuned code.

## Design Principles

1. **Concept alignment over layout prescription.** The manifest says "there is
   an agent inspector"; macOS may project that as a trailing panel, iPhone may
   project it as a detail route, and web may project it as a right panel.
2. **Stable IDs are the currency.** Surfaces, commands, settings, navigation
   destinations, runtime lanes, and intents get durable IDs that codegen,
   tests, agents, docs, and shell adapters can all reference.
3. **Generated code is allowed to be idiomatic.** A scaffold should output real
   React or SwiftUI, not a generic renderer that tries to flatten every
   platform into the same UI.
4. **Small schema, strong checker.** Prefer a compact manifest plus conformance
   checks over a large manifest that tries to model every implementation
   detail.
5. **Escape hatches stay first-class.** Hand-authored surfaces, custom chrome,
   and product-specific flows remain normal. The manifest coordinates them; it
   does not own them.

## Manifest Shape

Initial document kind:

```json
{
  "kind": "hudson.app.manifest",
  "schemaVersion": 1,
  "id": "scout",
  "name": "Scout",
  "version": "0.1.0",
  "brand": {
    "tint": "cyan",
    "targetLabel": "Agent",
    "cobrand": "powered by Hudson"
  },
  "destinations": {
    "web": { "shell": "workspace", "defaultMode": "canvas" },
    "macOS": { "shell": "desktop", "leading": "sidebar", "trailing": "inspector" },
    "iOS": { "shell": "phone", "complications": "tray" }
  },
  "capabilities": ["search", "commands", "settings", "canvas"],
  "externalControl": {
    "mode": "localOptIn",
    "trust": "hostLaunchedAgents",
    "confirmation": "destructiveAndNetwork"
  },
  "navigation": [
    { "id": "overview", "title": "Overview", "icon": "rectangle.grid.2x2" },
    { "id": "agents", "title": "Agents", "icon": "sparkles", "entity": "agent" },
    { "id": "logs", "title": "Logs", "icon": "list.bullet.rectangle" }
  ],
  "surfaces": [
    { "id": "overview", "role": "content", "destinations": ["web", "macOS", "iOS"] },
    { "id": "agentInspector", "role": "inspector", "destinations": ["web", "macOS"] },
    { "id": "agentDetail", "role": "detail", "destinations": ["iOS"] },
    { "id": "canvas", "role": "runtimeCanvas", "destinations": ["macOS"] }
  ],
  "commands": [
    { "id": "agent.new", "title": "Create Agent", "category": "workspace" },
    { "id": "canvas.open", "title": "Open Canvas", "category": "view" }
  ],
  "settings": [
    { "id": "appearance", "title": "Appearance", "scope": "workspace" },
    { "id": "runtime", "title": "Runtime", "scope": "product" }
  ]
}
```

The field names should stay intentionally boring. A manifest must be easy for
apps, agents, and scaffolding tools to produce without linking HudsonKit.

## External Control Policy

Apps that expose Canvas or another agent-addressable runtime need a policy that
keeps setup seamless without making every local process a controller. The app
manifest can name that policy at the same semantic level as commands and
capabilities, while the host enforces the platform details.

Initial `externalControl` hints:

| Field | Values | Meaning |
| --- | --- | --- |
| `mode` | `none`, `localOptIn`, `hostManaged` | Whether an external control surface exists and how it is enabled. |
| `trust` | `hostLaunchedAgents`, `sameUser`, `signedClient` | Which callers should get a smooth path without repeated prompts. |
| `confirmation` | `none`, `destructive`, `destructiveAndNetwork`, `allMutations` | Which command classes require user-visible approval. |

The default product stance should be `localOptIn` +
`hostLaunchedAgents` + `destructiveAndNetwork`. In practice that means a host
can launch an agent with the right control file paths or future session token,
and that agent can set up canvases, select nodes, tile terminals, restore
workspaces, and apply style without a modal storm. Commands that install
software, kill sessions, cross into SSH/network access, or operate outside the
current workspace still need explicit confirmation or a host policy grant.

The manifest does not encode secrets, tokens, SSH credentials, or file paths.
Those are runtime concerns. It only declares the intended trust shape so
scaffolds, docs, command palettes, and host adapters can make the same promise:
agent setup should be low-friction when the user has invited it, and bounded
when it reaches destructive or networked territory.

## Projection Rules

Projection maps the same manifest concepts to destination-native chrome:

| Manifest concept | Web Hudson | macOS / iPad regular | iPhone |
| --- | --- | --- | --- |
| `brand` | Workspace/app metadata and tokens | `HudAppManifest` environment | `HudAppManifest` environment |
| `navigation` | App switcher, left panel, command palette | `HudNavigationSidebar` or rail | Navigation sheet/list |
| `surfaces.role == content` | `slots.Content` or canvas node | `HudAppShell` content slot | `NavigationStack` page |
| `surfaces.role == inspector` | right panel | trailing `HudInspector` | detail page or sheet |
| `surfaces.role == runtimeCanvas` | canvas app or external launch | `HudCanvasSurface` | viewer/controller route |
| `commands` | command palette + intents | command palette/menu/shortcuts | complications, toolbar, commands |
| `settings` | settings route/panel | settings surface or inspector section | settings page/sheet |

The shell owns projection. The app owns state and behavior.

## Runtime Binding

The generated runtime binding should look similar on both sides.

Swift:

```swift
struct ScoutHudsonApp: HudNativeAppDefinition {
    static let manifest = HudsonAppManifest.load("scout.hudson.json")

    var store: ScoutStore

    func surface(_ id: HudsonSurfaceID) -> some View {
        switch id {
        case "overview": ScoutOverview(store: store)
        case "agentInspector": ScoutAgentInspector(store: store)
        case "canvas": ScoutCanvasHost(store: store)
        default: HudEmptyState("Unknown surface")
        }
    }

    func perform(_ command: HudsonCommandID) {
        store.dispatch(command)
    }
}
```

TypeScript:

```tsx
export const scoutHudsonApp = defineHudsonApp({
  manifest,
  Provider: ScoutProvider,
  surfaces: {
    overview: ScoutOverview,
    agentInspector: ScoutAgentInspector,
    canvas: ScoutCanvasHost,
  },
  commands: scoutCommands,
});
```

The exact Swift protocol and TypeScript helper can evolve, but the important
shape is stable: one manifest, per-language bindings, destination adapters.

## Scaffolding Flow

A future `hudson` scaffold command should be able to create the destination
shape from the manifest:

```sh
hudson new app scout --destinations web,macos,ios --capabilities commands,settings,canvas
hudson add destination scout ios
hudson check manifest scout.hudson.json
```

Generated output should include:

- Manifest document with stable IDs.
- Shared domain/store placeholder.
- Web app wrapper implementing the existing `HudsonApp` interface.
- macOS SwiftUI wrapper using `HudAppShell`.
- iOS SwiftUI wrapper using `HudPhoneAppShell`.
- Test stubs that assert every declared surface and command is bound.
- Docs page summarizing supported destinations and capabilities.

This makes "Hudson-enable this app" a mechanical first pass instead of a fresh
architecture exercise. The scaffold is free to make opinionated choices, but
those choices live in generated code where a product team or agent can revise
them naturally.

## Sharing Target

The practical goal is not 100% shared UI. It is predictable leverage.

| Layer | Expected sharing |
| --- | --- |
| Manifest, identity, capability list, command IDs, intents | 90-100% |
| Domain models, state store, persistence schema | 70-90% |
| Services/runtime clients | 60-90%, depending on platform APIs |
| Core content views | 40-75%, highest when views are SwiftUI universal or React responsive |
| Shell chrome, navigation, inspector/detail projection | 20-50% |
| Windowing, popout, local PTY ownership, mobile permissions | destination-specific |

For a normal HudsonKit-enabled product, 70% shared is a reasonable target. For
a Canvas-style terminal/runtime surface, the first version is lower because
local PTY, popout windows, SSH, and mobile runtime permissions are platform
heavy. Extracting the Canvas model/control/runtime contracts should move that
closer to the normal app target.

## Build Order

1. **Semantic schema draft.** Add `hudson.app.manifest` JSON schema plus
   Swift/TypeScript decoding tests. Keep it data-only and concept-focused.
2. **Native bridge.** Add a Swift `HudNativeAppDefinition` protocol and adapter
   that can render a manifest into `HudAppShell` or `HudPhoneAppShell`.
3. **Web bridge.** Add `defineHudsonApp({ manifest, ... })` that projects the
   manifest into the existing web `HudsonApp` contract.
4. **Scaffold command.** Generate a minimal app for requested destinations. The
   scaffold treats the manifest as a structured prompt and emits idiomatic
   platform code.
5. **One real host.** Convert either Scout or the Termini Canvas case study to
   prove the manifest reduces setup work rather than adding paperwork.
6. **Conformance checks.** Add a `hudson check manifest` path that fails when
   a declared surface, command, destination, or setting is unbound.

## Anti-goals

- Do not create a lowest-common-denominator UI language.
- Do not create a universal runtime renderer for app chrome.
- Do not force iPhone to pretend it has desktop sidebars and inspectors.
- Do not force macOS to use phone complications.
- Do not make the manifest responsible for exact spacing, hierarchy, view
  composition, or control placement.
- Do not replace hand-written SwiftUI or React where custom product work is
  genuinely needed.
- Do not require the manifest to know implementation details like file paths
  for views.

## Open Questions

- Should the manifest live beside each app as JSON, or should Swift/TypeScript
  code generate it and export a JSON artifact for agents?
- How much of the existing web `HudsonApp` interface should be renamed or
  wrapped to match native terminology?
- Should Canvas setup manifests embed a `hudson.app.manifest` reference, or
  stay separate and simply share IDs?
- Should command/intents be one list with optional destination availability, or
  two lists where commands are executable and intents are semantic metadata?
- What is the first real product host: Scout, Talkie, or Canvas itself?
- Should the public name emphasize artifact or intent? Candidates:
  `HudsonAppManifest`, `HudsonAppSpec`, `HudsonAppBlueprint`, or
  `HudsonAppBrief`.

## Consequences

### Breaking

None. This proposal is additive.

### Non-breaking but visible

- A new manifest document kind becomes part of Hudson's public vocabulary.
- New app scaffolds have a manifest file at their root.
- Native and web APIs gain optional manifest-driven helpers, but the current
  shell and app contracts remain valid.

### Net positive

- A product can become Hudson-enabled incrementally and destination-by-
  destination.
- Agents can inspect app capabilities without loading a product runtime.
- App docs, command palettes, settings, and setup flows share stable IDs.
- Web, macOS, and iOS get a common starting line without sacrificing native
  platform idioms.
- Codegen tools get enough structure to produce good first drafts without
  freezing the app into a rigid schema.
