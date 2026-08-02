# Hudson Connection Orchestration

## Status

Initial implementation contract for a shared host-to-companion connection
control plane. This sits beside `HudPairing`: pairing establishes identity and
trust; connection orchestration decides which trusted route to use now.

## Decision

Hudson owns connection orchestration. Providers supply routes. Apps choose
policy.

```text
Bonjour / Tailscale / managed relay providers
                    |
                    v
         HudConnectionRouteCatalog
                    |
                    v
 policy + persisted consent + remembered success
                    |
                    v
          HudConnectionCascade
                    |
                    v
       app-owned secure connection attempt
```

The framework must not hardcode one product cascade. Blink can choose LAN only
or LAN → Tailscale; OpenScout can choose LAN → Tailscale → OSN. OSN remains an
OpenScout provider, represented by an extensible route-kind string rather than
a Hudson enum case.

## Ownership

### Hudson

- route and provider contracts;
- built-in LAN, Tailscale, remote, loopback, and manual classifications;
- user consent and route/provider enablement;
- app-supplied route ordering;
- sequential fallback with bounded attempts;
- promotion of the last successful route per host;
- provider and attempt diagnostics;
- persisted connection settings;
- eventually, reusable Bonjour and Tailscale providers;
- eventually, the secure paired request/response primitive.

### Providers

- discover or resolve current endpoints;
- map provider-specific state into `HudConnectionRoute`;
- retain provider-specific authentication and service semantics;
- never decide the global cascade order.

### Apps

- choose default policy and which provider packages to install;
- supply the concrete secure connection attempt;
- own all app messages, payload schemas, and sync semantics;
- expose product-specific connection settings and diagnostics UI.

## Public model

- `HudConnectionRouteKind`: extensible raw-value category. Hudson publishes
  built-ins; providers may publish their own values.
- `HudConnectionRoute`: endpoint, kind, provider id, and diagnostic metadata.
- `HudConnectionRouteProvider`: async route discovery for a paired host.
- `HudConnectionInventory`: viable routes plus non-fatal provider failures.
- `HudConnectionPolicy`: app defaults for order, timeout, and success promotion.
- `HudConnectionSettings`: sparse user overrides and remembered winning route.
- `HudConnectionSettingsStore`: persistence boundary with in-memory and
  UserDefaults implementations.
- `HudConnectionPlanner`: pure filtering, ranking, and URL deduplication.
- `HudConnectionCascade`: sequential attempts and winning-route persistence.

## Ordering rules

1. Remove routes disabled explicitly by route id, provider id, or route kind.
2. Use user ordering when present; otherwise use app policy.
3. Promote the last successful route for the host when policy permits.
4. Preserve provider order within the same route-kind rank.
5. Deduplicate by endpoint URL after ranking, so the preferred provider keeps
   ownership of a duplicate endpoint.

LAN-first and Tailscale-first are policies, not universal truths. A static
framework preference is incorrect because a same-network notes viewer and a
work-from-anywhere operations client have different priorities.

## OpenScout donation map

The initial behavior is harvested from:

- `packages/scout-ios-core/.../TransportClassification.swift`: route
  classification, consent, filtering, and promote-on-success;
- `BonjourMacDiscovery.swift` and `BonjourRelayDiscovery.swift`: separate
  discovery-grade and trusted-route discovery;
- `pairing-lan-beacon.ts`: two-grade advertisements and duplicate-advert claim
  handling;
- `Identity.swift`: persistent device identity and trusted peer semantics;
- `NoiseProtocol.swift`: eventual transport-neutral handshake and session core.

A donation is complete only after OpenScout imports Hudson's implementation and
deletes the corresponding fork. OpenScout-specific broker RPCs, OSN sessions,
relay rooms, notifications, and terminal provisioning remain in OpenScout.

## Security boundary

Connection orchestration does not make a route secure. It selects a candidate
and invokes an app-supplied connection operation. Release consumers must use a
paired channel that provides confidentiality plus request and response
authentication. A bearer token or request MAC over ordinary LAN HTTP is not
sufficient for private content because a passive Wi-Fi observer can still read
response bodies.

The secure transport API should remain opaque to this layer so QR-pinned TLS,
Noise, or a managed relay can satisfy the same connection attempt contract.

## First adoption sequence

1. Land route model, settings, planning, cascade, and strict Tailscale
   classification in Hudson.
2. Move OpenScout route policy onto Hudson and keep OSN as a provider.
3. Add reusable Bonjour and Tailscale providers.
4. Extract persistent pairing trust and transport-neutral secure channel pieces.
5. Let Blink begin LAN-only while retaining the same provider/cascade boundary
   for Tailscale or a hosted relay later.
