# Remote Capability Sources

Status: Proposal

Owner: Hudson

Audience: Hudson framework work, plus Scout, Lattices, Talkie, and Linea app
integrations.

## Summary

Hudson should gain a small, reusable baseline for connecting to local machines,
nearby helpers, loopback companions, SSH targets, app-specific bridges, and
cloud fallback runtimes.

The concept is not "a universal remote transport". The concept is a **remote
capability source**:

- a thing the app can discover, trust, select, monitor, reconnect to, and ask
  for app-specific capabilities.
- a thing that may be a Mac, local daemon, browser companion, SSH host,
  relay-backed bridge, cloud service, or one endpoint inside a larger fleet.

Hudson should own the generic connection quality layer: identity, routes,
discovery candidates, connection state, route policy, retry, logs, diagnostics,
and multi-remote UI.

Apps should own the product semantics: what the remote can do, how trust is
established, what protocol is spoken, which payloads are legal, and when a
connection is healthy enough for a user action.

## Why This Belongs In Hudson

Hudson is meant to make new apps fast to ship without flattening them into the
same product. Remote work is now one of the repeated app shapes:

- Scout needs a mobile connection to paired Macs, brokers, relays, and focused
  fleet machines.
- Lattices needs an iPad cockpit for nearby and previously paired Macs that can
  expose workspace state and actions.
- Talkie needs iOS to connect to a paired Mac bridge, SSH terminal routes, and
  optional AI gateways.
- Linea needs Helper Macs, optional loopback companions, local-first job
  execution, and cloud fallback.

All four products need the same baseline user experience:

- "What am I connected to?"
- "Which route is being used?"
- "Is this local, Tailscale, relay, cloud, loopback, or manual?"
- "What changed after a restart, sleep, foreground, or spotty mobile network?"
- "What was tried, what failed, and what is the next attempt?"
- "Can I switch remotes or inspect logs without guessing?"

Those questions are framework-level. The answers should be crisp, visible, and
diagnostic by default.

## Design Goal

Make Hudson the turnkey base for "this app can use one or more remote capability
sources" without making Hudson the owner of every app's networking stack.

The desired product posture:

- new app, new helper runtime, or new companion service can start from the same
  remote-source shape.
- the app provides product-specific probes, trust, and operations.
- Hudson provides connection state, route policy, reconnect ergonomics,
  multi-remote presentation, and structured logs.

## Non-Goals

Hudson should not become:

- a broker.
- a relay service.
- a generalized remote desktop system.
- a fleet coordination system.
- a generic file sync engine.
- a guarantee of exactly-once delivery or session resumption.
- the owner of app-specific trust, encryption, protocol, or capability rules.
- the source of truth for Scout messages, Talkie memos, Lattices workspaces, or
  Linea artifacts.
- an authorization layer. Route classification is for display, attempt
  ordering, retry behavior, and diagnostics only.
- a generic work item system for every app's jobs, streams, requests, and
  actions.

Hudson should make the common shape excellent. Apps keep their domain.

## Core Boundary

Hudson owns **connection primitives and presentation**.

Apps own **connection meaning and protocol behavior**.

Example:

```text
Hudson
  remote id
  display name
  endpoint candidates
  route kind
  route policy
  connection state
  reconnect policy
  remote-faceted log entries
  remote picker UI
  connection inspector UI

Scout
  bridge identity
  trust records
  Noise handshake
  relay room resolution
  broker protocol
  fleet machine state
  conversation availability
```

The same boundary applies to Lattices, Talkie, and Linea.

## App Lenses

### Scout

Scout's remote source is a paired Mac or broker-backed machine. It may be
reachable through LAN, Tailscale, relay, or an OpenScout Network route.

Hudson helps with:

- active machine picker.
- connection status and route labels.
- retry/backoff after relay, broker, app, or mobile-network restarts.
- logs for route resolve, fallback, reconnect, and network availability.
- per-machine status rows.

Scout owns:

- bridge keys and trust.
- relay rooms.
- Noise/tRPC transport.
- broker requests and events.
- fleet/focused-Mac semantics.
- conversation/message health.

Boundary example:

- Hudson may say "reconnecting over Tailscale, attempt 3, next try in 4s".
- Scout decides whether the broker session is usable and whether conversations
  can be loaded.

### Lattices

Lattices already has nearby Mac discovery, bridge health, pairing, trusted
Macs, active endpoints, snapshots, polling priority, and fallback endpoint
attempts.

Hudson helps with:

- Bonjour discovered source rows.
- trusted-but-offline machine rows.
- route candidate ordering.
- connection label normalization.
- route-attempt logs.
- generic active/online/standby/offline badges.
- multi-machine picker and per-machine diagnostics.

Lattices owns:

- deck manifests.
- workspace snapshots.
- tmux/session/window semantics.
- trackpad/control payloads.
- Lattices bridge capability names.
- polling choices based on voice, attention, or cockpit state.

Boundary example:

- Hudson may present "MacBook Pro, local network, last seen 2m ago, offline".
- Lattices decides whether that Mac has a usable deck manifest and which
  workspace actions are allowed.

### Talkie

Talkie has several related but distinct remote shapes:

- a paired Mac bridge for sessions, windows, compose, dictation, and companion
  control.
- SSH terminal hosts with route cascades.
- a Gateway Protocol endpoint for AI services.
- optional local or remote service paths.

Hudson helps with:

- route classification shared across bridge and SSH.
- route cascade logs.
- foreground and network-up reconnect triggers.
- paired-Mac list UI.
- active paired-Mac switching.
- status and last-success contact display.
- event-stream connected/degraded state.

Talkie owns:

- HMAC/auth clock correction.
- pairing approval.
- session, memo, dictation, compose, and terminal access payloads.
- gateway protocol messages.
- direct-vs-bridge AI routing.

Boundary example:

- Hudson may handle "try local network, then Tailscale, then direct".
- Talkie decides how to sign the request and whether a 401 means refresh
  pairing, pending approval, or clock skew.

### Linea

Linea is the cleanest product framing: Helper Mac, local-first transport, cloud
fallback, narrow capabilities, and explicit non-goals.

Hudson helps with:

- Helper Mac discovery.
- "Use this Mac as a Helper" status surface.
- helper availability and selected helper display.
- local-first route policy.
- app-supplied progress rows inside connection inspectors.
- loopback companion probing.
- graceful degraded states when local acceleration is unavailable.

Linea owns:

- audio.generate, ocr.document, artifact.fetch, and library.lookup semantics.
- document identity.
- artifact delivery and retention.
- Cloudflare Durable Object and R2 fallback rules.
- companion origin policy.
- audiobook and OCR job payloads.

Boundary example:

- Hudson may present "Helper Mac available locally, audio.generate supported".
- Linea decides whether a document can be submitted, how the job is encoded,
  and how artifacts are stored or expired.

## Existing Hudson Primitives To Build On

This proposal should extend the Hudson surface that already exists. It should
not create a second stack with different vocabulary.

Relevant current primitives:

- `HudPairingEndpointKind`, `HudPairingEndpoint`, `HudPairingPayload`, and
  `HudPairingCandidate` already cover QR/deep-link pairing payloads, endpoint
  extraction, and rough route classification.
- `HudQRCode` and `HudQRScanner` already cover native QR generation and
  scanning.
- `HudLogger`, `HudLogStore`, and `HudInstrumentation` already provide a
  bounded log buffer, sinks, spans, and metrics.
- `HudStatusDot`, `HudBadge`, `HudInspectorSettings`, and related primitives
  already cover the visual language for compact status and inspector rows.
- `HudTerminalSessionState` and `HudTerminalSSHSurface` already express a
  simple terminal connection status model.
- `HudVoxProbe` and `HudVoxLiveSession` already prove that Hudson can wrap a
  local WebSocket daemon without depending on its implementation package.
- Hudson Vantage already has remote tmux health checks and remote-host status
  classification that can inform SSH-style source diagnostics.

The remote capability source layer should consolidate these patterns:

- pairing endpoint vocabulary becomes part of route/source vocabulary.
- QR and deep-link parsing produce `HudRemoteSource` candidates.
- observability gains remote-specific logger facets and views.
- status primitives gain remote-specific composition helpers.
- terminal and Vox surfaces map their current states into the shared status
  model without losing their specialized behavior.

## Concepts Hudson Should Own

### Remote Source

A remote source is a stable, selectable provider of capabilities.

Possible source kinds:

- `machine`
- `helper`
- `companion`
- `daemon`
- `sshHost`
- `cloudService`
- `relayPeer`
- `manualEndpoint`

Suggested shape:

```swift
public struct HudRemoteSource: Identifiable, Codable, Equatable, Sendable {
    public var id: String
    public var displayName: String
    public var kind: HudRemoteSourceKind
    public var capabilities: [HudRemoteCapability]
    public var endpoints: [HudRemoteEndpoint]
    public var lastSeenAt: Date?
    public var lastSuccessfulContactAt: Date?
    public var metadata: [String: String]
}
```

Hudson should not require the `id` to be globally meaningful. Apps can map it
to bridge public keys, device ids, host fingerprints, account ids, or service
ids.

Apps may have an ordered set of active sources, with one primary source used for
default chrome. Hudson UI must not assume "active remote" is a singleton:
Lattices may watch more than one Mac, Scout may keep a bridge and broker session
active together, and Talkie may have a paired Mac, SSH route, and gateway online
at the same time.

### Capability

A capability is a fact advertised or inferred about a source. It is not a
promise that the action will succeed.

Examples:

- `deck.read`
- `deck.perform`
- `input.trackpad`
- `sessions.read`
- `terminal.access`
- `audio.generate`
- `ocr.document`
- `artifact.fetch`
- `alignment.local`

Suggested shape:

```swift
public struct HudRemoteCapability: Codable, Hashable, Sendable {
    public var id: String
    public var label: String?
    public var status: HudRemoteCapabilityStatus
    public var metadata: [String: String]
}
```

Capability ids are opaque app strings. Hudson stores, filters, and displays
them; it does not define, namespace, validate, or reserve any id.

### Endpoint

An endpoint is one possible way to reach a source.

Suggested route kinds:

- `loopback`
- `localNetwork`
- `tailscale`
- `relay`
- `cloud`
- `direct`
- `manual`
- `unixSocket`
- `unknown`

Suggested shape:

```swift
public struct HudRemoteEndpoint: Identifiable, Codable, Hashable, Sendable {
    public var id: String
    public var url: URL?
    public var host: String?
    public var port: Int?
    public var route: HudRemoteRouteKind
    public var source: HudRemoteEndpointSource
    public var priority: Int?
    public var metadata: [String: String]
}
```

This should be compatible with existing `HudPairingEndpoint`, not a parallel
world. Keep `HudPairingEndpoint` and `HudRemoteEndpoint` distinct:
`HudPairingEndpoint` is what a QR or deep link contained, while
`HudRemoteEndpoint` is a mutable attempt target. Pairing endpoints become remote
endpoints when admitted to a source.

### Route Classification

Hudson should centralize host and URL classification so every app stops
reimplementing:

- `localhost`, `127.0.0.1`, `::1`.
- `.local`, `.lan`, link-local addresses.
- private LAN IPv4 ranges.
- Tailscale `.ts.net`.
- Tailscale `100.64.0.0/10`.
- Tailscale IPv6 tailnet ranges.
- direct internet names.
- explicit relay/cloud URLs.

Apps can override classification when they have richer knowledge.

Route classification is never authorization input. Apps must not treat
`.localNetwork`, `.loopback`, or any other route kind as proof of trust.

### Route Policy

A route policy turns endpoint candidates into an ordered attempt plan.

Default policies:

- local-first: loopback, local network, Tailscale, relay/cloud, direct.
- mobile-aware: prefer already-known stable route if the app was recently
  connected; otherwise probe cheap local routes quickly.
- remote-first: for browser/cloud apps where local helpers are optional.
- manual-only: for explicit user-entered SSH or debug endpoints.

Suggested shape:

```swift
public struct HudRemoteRoutePolicy: Codable, Equatable, Sendable {
    public var preferredOrder: [HudRemoteRouteKind]
    public var perRouteTimeout: [HudRemoteRouteKind: TimeInterval]
    public var allowFallback: Bool
    public var retry: HudReconnectPolicy
}
```

Hudson should produce an attempt plan. The app performs the actual network
operation.

### Route Memory

Route memory records the last-known-good route for a source. This is distinct
from current reachability: on a spotty mobile network, the best first attempt is
often the route that worked seconds ago.

Suggested shape:

```swift
public struct HudRouteMemory: Codable, Equatable, Sendable {
    public var sourceID: String
    public var endpointID: String
    public var route: HudRemoteRouteKind
    public var succeededAt: Date
    public var expiresAt: Date
    public var metadata: [String: String]
}
```

Reconnect policy can read route memory before building an attempt plan. The
app-owned connect operation writes route memory only after a successful contact.

### Discovery Candidate

A candidate is a not-yet-trusted or not-yet-selected source found through a
specific discovery path.

Candidate sources:

- QR code.
- deep link.
- Bonjour.
- manual host entry.
- loopback port probe.
- account presence.
- relay room resolve.
- restored saved source.

Hudson can normalize candidate identity, display, endpoints, route labels, and
capabilities. The app decides whether and how to trust it.

### Trust Handle

Hudson should not own cryptographic trust, but it should provide a place for
apps to attach trust state to a source.

Trust states:

- `unknown`
- `pairingRequired`
- `pendingApproval`
- `trusted`
- `expired`
- `revoked`
- `rejected`
- `invalid`

This is display and routing metadata. The app still owns keys, signatures,
approval windows, token exchange, and encrypted payloads.

### Connection State

Hudson should standardize app-facing connection state without prescribing
transport internals.

Suggested states:

- `idle`
- `discovering`
- `connecting`
- `connected`
- `reconnecting`
- `degraded`
- `offline`
- `failed`

`degraded` means connected but below the preferred route or quality level, such
as falling from LAN to relay, losing a secondary event stream while requests
still work, or using cloud fallback while a helper is unavailable. It is not the
same as `reconnecting` or `offline`.

Suggested fields:

```swift
public struct HudConnectionStatus: Equatable, Sendable {
    public var state: HudConnectionState
    public var sourceID: String?
    public var endpointID: String?
    public var route: HudRemoteRouteKind?
    public var attempt: Int
    public var message: String?
    public var lastError: String?
    public var lastFailureReason: HudConnectionFailureReason?
    public var nextAttemptAt: Date?
    public var updatedAt: Date
}
```

Apps can map their richer state into this status for shell chrome,
inspectors, settings rows, and logs.

Apple-specific permission failures such as denied Local Network access should
map into `lastFailureReason` or a platform extension, not be flattened into
generic offline state.

### Reconnect Policy

Hudson should provide reusable reconnect policy primitives:

- exponential backoff with jitter.
- max delay.
- immediate reconnect on foreground.
- reconnect on network-up.
- pause while offline.
- avoid duplicate reconnect tasks.
- suppress intentional-disconnect noise.
- reset attempt count after successful contact.

This policy should be reusable, not magical. Apps should call into it or adopt
a small coordinator and still own the actual `connect()` work.

### Reachability

Hudson should provide a thin reachability monitor around Network.framework on
Apple platforms and a browser equivalent where useful.

Useful facts:

- online/offline.
- expensive network.
- constrained network.
- interface hints when available.
- last transition time.

The monitor should inform reconnect policy and diagnostics. It should not make
product decisions by itself.

### Diagnostics Log

Every remote attempt should leave useful breadcrumbs.

Hudson should define remote facets for existing `HudLogger` entries, not a
parallel diagnostic entry type or store. A remote facet carries structured
fields for connection work:

- timestamp.
- level.
- source id.
- source display name.
- action.
- route.
- endpoint.
- attempt.
- duration.
- status.
- reason.
- error.
- metadata.

Example actions:

- `discover.start`
- `discover.result`
- `probe.start`
- `probe.result`
- `connect.start`
- `connect.result`
- `route.fallback`
- `reconnect.schedule`
- `reconnect.pause`
- `reconnect.resume`
- `network.offline`
- `network.online`
- `trust.pending`
- `trust.approved`

The log should be bounded, exportable, copyable, and filterable. Hudson already
has `HudLogStore`; remote diagnostics should build on that rather than creating
a separate logging island.

Hudson should also ship a default `HudLogRedactor` for remote diagnostics.
Defaults should mask URL credentials, bearer tokens, pairing codes, and internal
host/address details. Apps can extend or replace the redactor when product
semantics require it.

### Multi-Remote Presentation

Hudson should provide reusable UI for common surfaces:

- remote list.
- primary remote picker.
- compact status chip.
- route badge.
- last-contact row.
- capability summary.
- connection inspector.
- per-remote logs.
- retry/reconnect/disconnect actions.
- "nearby sources" section.
- "trusted but offline" section.

Apps supply labels, actions, and product-specific rows. Hudson handles the
stable layout and interaction patterns.

### Deferred: Work And Session Progress

Remote sources often run work, but a v1 Hudson remote layer should not define a
generic work item envelope. Scout broker requests, Talkie streams, Lattices
workspace actions, Linea helper jobs, and local Vox alignment jobs have
different lifecycles. Hudson can present app-supplied progress rows inside
remote inspectors, but a first-class Hudson work progress API should wait for a
separate proposal backed by real Linea Helper Mac runtime data.

## Proposed Package Shape

Apple-native:

```text
HudsonKit/Sources/HudsonRemote/
  HudRemoteSource.swift
  HudRemoteEndpoint.swift
  HudRemoteRouteClassifier.swift
  HudRemoteRoutePolicy.swift
  HudRouteMemory.swift
  HudConnectionStatus.swift
  HudReconnectPolicy.swift
  HudReachability.swift
  HudRemoteLogging.swift
  HudLogRedactor.swift
  HudRemoteDiscovery.swift
  HudRemoteInspector.swift
  HudRemotePicker.swift
```

Web:

```text
packages/web/hudsonkit/src/remote/
  types.ts
  route-classifier.ts
  route-policy.ts
  route-memory.ts
  reconnect-policy.ts
  logging.ts
  hooks.ts
  components/
```

Exports should be explicit:

```swift
import HudsonRemote
```

```ts
import { HRemoteSource, HConnectionStatus } from 'hudsonkit/remote';
```

The first implementation can be Apple-first because ScoutNext, Lattices iOS,
Talkie iOS, and Linea native helper work are the immediate forcing functions.
The web types can follow with parity where Linea's browser companion and
Hudson web apps need them.

## Adapter Pattern

Hudson should define a closure-based coordinator, not a transport protocol.
The coordinator schedules attempts and publishes status. The app owns the live
connection object, keep-alive behavior, teardown, and final health semantics.

```swift
let coordinator = HudRemoteConnectionCoordinator(
    source: source,
    routePolicy: .localFirst,
    probe: { endpoint in try await appProbe(endpoint) },
    connect: { endpoint in try await appConnect(endpoint) }
)
```

The coordinator can:

- classify routes.
- order attempts.
- run backoff.
- append remote-faceted `HudLogger` entries.
- publish `HudConnectionStatus`.

The app still owns:

- request signing.
- WebSocket or HTTP details.
- pairing refresh.
- bridge protocol.
- job payloads.
- final health semantics.

## Boundary Examples

### QR Pairing

Hudson owns:

- QR scanning.
- QR generation.
- deep-link parsing.
- endpoint extraction.
- route labels.
- candidate display.

App owns:

- payload schema beyond common endpoint fields.
- public keys.
- pairing code validation.
- approval request.
- trust persistence.

### Bonjour Discovery

Hudson owns:

- generic service browser helper.
- TXT record normalization.
- candidate source rows.
- last seen.
- logs.

App owns:

- service type.
- required TXT keys.
- health endpoint.
- capability semantics.
- trust decision.

### Loopback Companion

Hudson owns:

- port candidate probing.
- cached working base URL.
- health/capabilities presentation.
- degraded fallback state.

App owns:

- origin policy.
- session token handshake.
- job schema.
- fallback behavior.

### SSH

Hudson owns:

- saved source display.
- route cascade.
- timeout defaults.
- connection status.
- "try next route" diagnostics.

App owns:

- SSH credentials.
- host key policy.
- terminal session behavior.
- startup command.

### Cloud Fallback

Hudson owns:

- cloud route labeling.
- degraded/remote state presentation.

App owns:

- Cloudflare, relay, or backend protocol.
- auth/session model.
- object storage rules.
- cost policy.

## Implementation Phases

### Phase 0: Reconcile Existing Primitives

Before adding new public types, define the bridge from current Hudson
primitives into the remote model.

Resolve:

- how `HudPairingEndpoint` becomes or feeds `HudRemoteEndpoint`.
- how remote diagnostics are represented as a facet of `HudLogger`.
- how `HudStatusDot`, `HudBadge`, and inspector primitives compose into remote
  rows.
- how terminal, Vox, and Vantage connection states map into the shared status
  vocabulary without losing their specialized behavior.

Success criteria:

- no duplicated pairing, logging, or status vocabulary ships as a second stack.
- existing Hudson users have a clear migration path.

### Phase 1: Types, Logging, And Redaction

Add core types:

- `HudRemoteSource`
- `HudRemoteEndpoint`
- `HudRemoteRouteKind`
- `HudConnectionStatus`
- `HudReconnectPolicy`
- remote logging facet for `HudLogger`
- `HudLogRedactor`

Add route classification that improves the current pairing endpoint
classification without breaking existing `HudPairing` users.

Add default redaction for URL credentials, bearer tokens, pairing codes, and
internal host/address details, with app-level extension points.

Success criteria:

- Scout, Lattices, Talkie, and Linea can map their current state into the same
  Hudson status and logging vocabulary.
- logs can be shown through existing Hudson observability surfaces.

### Phase 2: Reconnect, Reachability, And Route Memory

Add:

- `HudReachabilityMonitor`.
- reconnect scheduler with jittered backoff.
- foreground/network-up hooks on Apple platforms.
- intentional disconnect suppression.
- `HudRouteMemory` for per-source last-known-good endpoint and route with a TTL.

Success criteria:

- ScoutNext reconnect can be expressed with Hudson policy while keeping Scout
  bridge semantics in Scout.
- Talkie-style auto reconnect can use the same policy.
- mobile-aware policies prefer a recently successful route before probing every
  route again.

### Phase 3: Discovery And Multi-Remote UI

Add:

- Bonjour browser.
- loopback port prober.
- pairing candidate normalizer.
- manual endpoint parser.
- `HudRemoteStatusChip`.
- `HudRemotePicker`.
- `HudRemoteList`.
- `HudConnectionInspector`.
- `HudRemoteLogView`.

Success criteria:

- Lattices-style machine cards, Talkie paired-Mac settings, and Scout fleet
  connection panels can share structure without sharing app payloads.
- Linea Helper Mac and Talkie nearby Mac discovery avoid duplicating basic
  browser/candidate UI logic.

### Phase 4: Web Parity

Bring the same type names and logging facet model to `hudsonkit/remote` for web.

Success criteria:

- Linea browser companion and Hudson web apps can use the same conceptual
  model as native apps.

## Migration Notes

### Scout

Keep Scout's bridge connection, reconnect semantics, and logs initially. Start
by mapping Scout state into `HudConnectionStatus` and remote-faceted
`HudLogger` entries.

Later, consider moving only the generic reconnect scheduler and route labels
into Hudson.

For Scout, a remote source maps primarily to bridge identity and broker session.
Fleet machines are a view over that source, not automatically one Hudson source
per machine.

### Lattices

Map:

- `BridgeEndpoint` to `HudRemoteEndpoint`.
- discovered/trusted bridges to `HudRemoteSource`.
- `HomeMachineStatus` to `HudConnectionState`.
- fallback attempts to remote-faceted `HudLogger` entries.

Do not move deck manifests or snapshots into Hudson.

### Talkie

Map:

- `PairedMac` to `HudRemoteSource`.
- `TalkieNetworkRoute` to `HudRemoteRouteKind`.
- bridge status to `HudConnectionStatus`.
- SSH route cascade logs to remote-faceted `HudLogger` entries.

Do not move HMAC, pairing approval, session APIs, or gateway messages into
Hudson.

### Linea

Use the new Hudson model as Linea adds Helper Mac runtime:

- Helper Mac is a `HudRemoteSource`.
- `audio.generate` and `ocr.document` are app-owned capabilities.
- local/cloud route selection uses `HudRemoteRoutePolicy`.
- helper job progress stays app-owned until a separate async job proposal has
  real Linea runtime data to abstract from.

Do not make Linea inherit Scout-grade broker security or generic fleet
coordination.

## Open Questions

1. Should `HudRemoteSource` live in a new `HudsonRemote` module, or inside the
   current `HudsonBridge` module at first?
2. How much of the reconnect coordinator should be a concrete object versus
   a policy helper that apps call manually?
3. Should native and web use identical names even where platform behavior
   differs?
4. Should Apple-only permission states live in `HudConnectionStatus`, or in a
   platform extension over the shared model?

## Recommendation

Create a new Hudson remote capability layer, starting Apple-native:

- keep it small.
- make diagnostics a first-class `HudLogger` facet.
- make route classification shared and non-authoritative.
- make reconnect policy reusable.
- make multi-remote UI crisp.
- keep transports app-owned.

The win is not that Hudson solves networking for every app. The win is that
every new app starts with a clear, tested, inspectable remote-source model, and
then only has to implement the product-specific part.
