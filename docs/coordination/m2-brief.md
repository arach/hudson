# Hudson · M2 · HudsonBridge — Coordination Brief

**Status:** Handed off to codex agent on `m2-bridge` branch / worktree.
**Issued:** 2026-04-28
**Author:** hudson (main)
**Recipient:** hkbridge (codex harness, scoped to `~/dev/hudson-worktrees/m2-bridge`)
**Parallel track:** M3 (HudsonShell) on `main` — owned by hudson.

---

## Intent

HudsonBridge is the Hudson-native layer for talking to a Hudson app from
an iOS/iPadOS/macOS companion: discovery, identity, encrypted transport,
pairing.

Hudson's broader posture is **hybrid by default** — local LAN +
Tailscale, both first-class transports — because we don't know in
advance where the peer will be. Scout is the reference model.

You own:
- Discovery (Bonjour/mDNS for local LAN)
- Identity + Keychain trust
- Encrypted transport (Noise + WebSocket, à la Scout)
- Pairing flow (QR payload + scan/ingest UX)
- Transport selection — see Open Question below

## Source codebases to learn from

- **Scout (primary reference)** — already implements hybrid transport,
  URL-driven:
  - `/Users/arach/dev/openscout/apps/ios/Scout/Security/{Identity,NoiseProtocol,SecureTransport}.swift`
  - `/Users/arach/dev/openscout/apps/ios/Scout/Services/{BonjourRelayDiscovery,ConnectionManager}.swift`
  - Note especially the helpers around relay URL inspection
    (`relayURLDependsOnTailscale`, `isTailscaleAddress`, etc.)
- **Lattices (alternative crypto pattern)** — signed-HTTP rather than
  Noise+WS:
  - `/Users/arach/dev/lattices/iOS/LatticesCompanion/Sources/DeckBridgeSecurityStore.swift`
- **Hudson server** — wire format you must speak:
  - `/Users/arach/dev/hudson/packages/hudson-relay/`

## Open Question — recommend before implementing

Scout today uses **URL-driven hybrid**: caller passes a relay URL, and
the bridge adapts based on whether the URL is local or Tailscale.

The user is asking us to consider an alternative: **explicit strategy
modes**:

1. `local-first` (default) — try mDNS-discovered local route, fall back
   to Tailscale.
2. `tailscale-first` — prefer Tailscale; fall back to local.
3. `tailscale-only` — Tailscale exclusively; **suppress mDNS advertising
   entirely** (privacy/security: don't broadcast presence on LAN).

Mode #3 specifically is interesting — when a user has Tailscale on, they
may not want to advertise on local DNS for security reasons.

**Deliverable before code:** a short design note (1–3 paragraphs) at
`packages/hudson-kit/Sources/HudsonBridge/DESIGN.md` recommending one
approach and explaining why. Lean on your judgment + Scout's existing
pattern. Then implement.

## Exit gate

- HudsonBridge target compiles standalone (`swift build` in
  `packages/hudson-kit/`).
- A small demo wiring (could be a new test target or an addition to
  `Demo/HudsonKitDemo/`) connects to a mock WebSocket relay on
  `ws://localhost:3600` and completes the Noise handshake.
- Pairing flow ingests a QR payload and stores trust in Keychain.
- `DESIGN.md` committed at the start of the work; final implementation
  matches the recommended approach.

## Constraints

- Target iOS 17 + macOS 14 (matches `Package.swift`).
- Free to add HudsonBridge-only deps to `Package.swift` (commit them).
- DO NOT touch `Sources/HudsonUI/`, `Sources/HudsonShell/`, or `Demo/` —
  those are owned by the parallel M3 track on `main`.
- Use `HudsonAppManifest` fields where present; add new fields if needed
  (e.g., `serviceType`, `keychainService`, `transportStrategy` if you go
  that route) and document at the top of `HudsonAppManifest.swift`.
- Vocabulary should align with the web SDK (`@hudsonos/sdk`); a quick
  scan of `packages/hudson-sdk/src/` will surface the relevant terms
  (`BridgeClient`, `Identity`, etc.).
- This is a worktree: `.git` is a file, not a directory — don't trip on
  any path-assumption code.

## Coordination

- Commit to `m2-bridge` with gitmoji prefixes (`✨` for new files,
  `♻️` for refactors).
- Ping `@hudson` via scout when:
  - `DESIGN.md` is committed (we want to see the recommendation).
  - The target compiles standalone.
  - The handshake works against a mock relay.
  - M2 is done (open PR against `main`).
- If you hit a blocker that needs human judgment, also ping `@hudson` —
  don't get stuck.

Run `bun install` in the worktree before starting if you intend to use
any tooling beyond Swift; otherwise SwiftPM-only is fine for this work.
