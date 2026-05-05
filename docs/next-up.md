# Hudson — next-up

Working list of primitives + initiatives queued for Hudson. Sizes are rough (S = days, M = ~1 week, L = multi-week).

## In flight

Working through these now in roughly this order:

1. **#2 HudLint → macOS demo** — close the asymmetry
2. **#6 `HudQRCode`** — small primitive, useful beyond pairing
3. **#9 `HudPermissionGate`** — unify the scattered Talkie pattern
4. **#4 `HudVault` (iOS)** — lift Scout's Keychain trio + ship `HudSecretField`
5. Integration, stacked PRs, gallery demos

**Parallel track — complete, awaiting review**: HudAI framework spec at `specs/hud-ai-framework.md` (390 lines), written by `@codex-hudai` from brief at `specs/hud-ai-framework-brief.md`.

## The list

### 1. Tables primitive — `HudTable` (M)

Top of the stated wishlist. Iframes the iOS Primitives gallery + HudLint as the natural showcase + drift guard.

Open questions:
- Read-only / presentational only, or sortable + selectable from day one?
- Editable cells in v1, or v2?
- Density variants (compact / cozy / comfortable)?

### 2. HudLint → macOS demo (S)

Today HudLint is wired only into the iOS demo (Run Script Build Phase). The macOS demo uses SPM, which has no build phases, so it's currently uncovered.

Plan: add a Makefile target + git pre-commit hook so macOS demo gets the same drift enforcement.

### 3. `@Environment(\.hudTheme)` runtime theming (M-L)

Move themes from compile-time to environment-driven, so they swap at runtime per-app or per-window. Builds directly on the HudLint enforcement work — the token surface is now tight enough that this is a clean move.

Unlocks: light/dark, per-app theming, theme presets/swatches (which dovetails with Termini's product direction).

### 4. `HudVault` — encrypted KV (S/M)

Scope clarified: opaque secrets in/out, encrypted at rest, single API. **Not** OAuth, **not** rotation, **not** cert management.

```swift
HudVault.set("openai_api_key", value)
HudVault.get("openai_api_key")  // String?
HudVault.list()                  // [String]
HudVault.delete("openai_api_key")
```

Plus a `HudSecretField` primitive (masked input, reveal toggle, copy-with-auto-clear) and a settings section.

**Strategy: harvest from Scout, don't invent.** Scout already has encryption working in production — survey, generalize, lift.

Storage:
- Apple (iOS/macOS): Keychain
- Web: open question — passphrase-unlock (PBKDF2 → AES-GCM → IndexedDB) vs session-only (in-memory after first paste)

### 5. Baseline AI framework (L) — depends on #4

Streaming, tool use, prompt caching by default, model registry. Every downstream Hudson app will need this; they shouldn't each rebuild it.

Hard prerequisite: #4 (you can't ship a useful AI primitive without somewhere safe to put the API key).

Out of scope until #4 lands.

### 6. `HudQRCode` — QR generation (S)

Standalone, ships independently:
- Apple: `CIFilter("CIQRCodeGenerator")`
- Web: small pure-JS implementation

Useful beyond pairing — link sharing, install URLs, etc.

### 7. `HudQRScanner` — iOS QR scanning (S, depends on camera + permissions)

Rides on the camera + permissions infra item that was already queued (`HudPermissionGate` from the Talkie survey). That has to land first.

### 8. `HudPairing` — mobile pairing (M-L) — depends on #6 + #7

**Strategy: harvest from Talkie, don't invent.** Talkie already has pairing flow in production — survey, extract transport + handshake, lift.

Open scoping questions:
- **What does pairing do?** Auth handoff / second-screen / capability handoff / generic data channel? Lean: generic data channel, apps decide semantics.
- **Platform-level or app-level?** Lean: app-level — Hudson ships the primitive, each app handles its own pairing semantics. Keeps Hudson a primitives library, not a session manager.

### 9. Camera + permissions — `HudPermissionGate` (S/M)

Already queued from the Talkie survey. Snap photos, request runtime permissions cleanly. Prerequisite for #7.

### 10. Share sheets (S/M)

Already queued. Both directions: share content out, receive shared content in.

## Explicitly de-prioritized

Per prior conversation — don't suggest unless the user asks:
- Onboarding splash + app icon
- DEBUG layout overlay for Complications

## Sequencing — two natural paths

**Concrete-win-first** (visible deliverables sooner):
1. Tables (#1)
2. HudLint → macOS (#2) as quick clean-up
3. Then start the Vault → AI initiative (#4 → #5)

**Platform-leverage-first** (slower to a deliverable, but every downstream app benefits sooner):
1. HudVault (#4) — survey Scout, lift, ship
2. AI framework (#5) on top
3. Then catch up on Tables / pairing / QR

Either path can absorb the QR + pairing items (#6 #7 #8) once the camera + permissions infra is in place.

## Survey findings (2026-05-05)

Four parallel read-only surveys ran across `openscout`, `talkie`, and `talkie-companion-poc`. Headlines below; full agent reports in conversation history.

### #4 HudVault — from Scout

Surprise: **Scout has no at-rest encryption on the desktop side**. iOS uses Keychain properly via a clean `keychainSave/Load/Delete` private trio at `apps/ios/Scout/Security/Identity.swift:178-231` (lift-and-shift candidate). Bridge/desktop writes plaintext JSON to `~/.scout/` and `~/Library/Application Support/OpenScout/` with `mode: 0o600` — including Telegram bot tokens. Web has no client-side encryption (secrets live on the bridge). Threat model is implicit: defends against casual device theft + cross-app snooping, **not** local malware running as the user.

Recommendation:
- Lift Scout's iOS Keychain wrapper verbatim (already the right shape: `(service, account, Data) -> Data?`, generic-password class, `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`).
- Make `service` namespace a constructor argument so each consuming app gets its own bucket.
- **Do not copy the Node bridge's plaintext-JSON pattern** — if Hudson grows a desktop tier, route through OS keychain.
- Web is greenfield — Scout has nothing. Design from scratch: `crypto.subtle` AES-GCM with a non-extractable IndexedDB-stored CryptoKey. No passphrase prompt for v1.
- Public API stays flat: `set/get/list/delete/clear`. Resist typed sub-stores.
- UI primitives are entirely greenfield (Scout has zero `SecureField` / no masked inputs anywhere). Ship masked input + reveal toggle + copy-with-auto-clear in the iOS Primitives gallery.

### #8 HudPairing — from Talkie + Talkie companion POC

Pattern is much cleaner than expected. Transport is plain HTTP over LAN/Tailscale (a Bun/Elysia server on Mac at port 8765) — **no WebSocket, no WebRTC, no MultipeerConnectivity**. QR payload is JSON `{publicKey, hostname, port, protocol}` generated via `CIFilter.qrCodeGenerator()`. Handshake is ECDH P-256 + HKDF (no challenge-response — TOFU on QR scan). Per-request HMAC with 4-header scheme (`X-Device-ID`, `X-Timestamp`, `X-Nonce`, `X-Signature`), 30s timestamp window, nonce store. 30-day device expiry. Long-lived mutual sessions. Auto-approve by default.

Recommendation:
- Split into `HudPairingHost` (any web/macOS app) + `HudPairingGuest` (iOS).
- The cryptographic core (`crypto/keypair.ts`, `auth/hmac.ts`, `devices/registry.ts`) is generic infrastructure — lift verbatim.
- Post-pairing channel is a generic `signedRequest(path, body)`; apps layer their own routes.
- **Add a transport field to the QR payload** — Talkie's hardcoded HTTP-server-on-LAN assumption breaks for Hudson web apps. Need a relay/WebSocket variant alongside the LAN-HTTP one.
- Parameterize the `protocol` string per app.
- Talkie's QR scanner UX (`QRScannerView.swift`) including 4-step animation + "pairing receipt" is gold — ship as `HudPairingScanner` SwiftUI component with caller-supplied receipt copy.

### #9 HudPermissionGate — from Talkie

**No unified abstraction exists.** Every permission call site is bespoke. Two clear pain points: (1) five different status enums (`AVAudioSession.RecordPermission`, `SFSpeechRecognizerAuthorizationStatus`, `PHAuthorizationStatus`, `CLAuthorizationStatus`, `UNAuthorizationStatus`) so denied-state checks scatter, (2) the "open Settings" deep-link is copy-pasted in 5 files. `DictationReadinessChecker` (an `@Observable` aggregator) is a partial pattern worth generalizing. info.plist usage descriptions are accidentally split between `Info.plist` and `INFOPLIST_KEY_*` in `pbxproj`.

Recommendation:
- Unified `HudPermission` enum (`.microphone`, `.speech`, `.camera`, `.photos(.readWrite)`, `.location(.whenInUse)`, `.notifications`, `.reminders`, `.calendar`, `.faceID`, `.contacts`).
- Single `HudPermissionStatus` (`.notDetermined / .granted / .limited / .denied / .restricted / .unavailable`).
- Imperative API: `HudPermissions.shared.request(.microphone)`.
- Declarative SwiftUI: `.hudPermissionGate(.microphone, rationale: …) { granted in … }` handling pre-prompt, in-place denied banner with auto-Settings link, and the multi-permission readiness aggregator pattern.
- Bonus: debug helper that warns at runtime when `.request()` is called for a permission whose `NS*UsageDescription` is missing — catches the exact `Info.plist`/`pbxproj` drift Talkie has.

### #10 HudShare — from Talkie + Scout

Talkie has both directions (iOS Share Extension + outbound on iOS/macOS); Scout has none. **`ShareSheet` is duplicated** — once in `WorkflowActionSheet.swift:281`, once richer at `VoiceMemoDetailView.swift:3760`. macOS has 4 hand-anchored `NSSharingServicePicker` sites with copy-pasted anchor logic. Inbound pattern uses an App Group + custom URL scheme + JSON queue (`group.com.jdi.talkie`, `talkie://share?id=<uuid>`) — proven and worth preserving. `SharePayload` struct is redeclared in extension and main app.

Recommendation:
- `HudShareItem` value type (text / URL / file / image / typed-payload with optional `LPLinkMetadata`-equivalent preview).
- Single `hudShare(_:)` view modifier resolving to `ShareLink` / `UIActivityViewController` on iOS, `NSSharingServicePicker` (auto-anchored) on macOS, `navigator.share` with clipboard fallback on web.
- Inbound: `HudShareInbox` protocol + generated Share Extension scaffold using Talkie's proven App Group + URL-scheme + JSON-queue pattern.
- `HudSharePayload` defined once in a shared package consumed by both targets (kills Talkie's duplicate definitions).
- `activationRule` builder for `Info.plist`.

## Updated sequencing (post-survey)

The surveys validate "harvest don't invent" — every item shrunk in scope or got a clearer path:
- **#4 HudVault**: iOS lift is mechanical. Web is greenfield but scoped (no passphrase v1).
- **#8 HudPairing**: cryptographic core is reusable verbatim; the only real design work is the web transport variant.
- **#9 HudPermissionGate**: cleanest of the four — pure unification of an existing scattered pattern.
- **#10 HudShare**: dedupe + scaffold; well-trodden ground.

#9 is now the smallest unblocked item with the clearest scope. Suggests revising "concrete-win-first" path:
1. **HudPermissionGate (#9)** — small, scoped, unblocks #7 (QR scanner) for free.
2. **HudVault (#4)** — iOS lift in days; web v1 doable.
3. **Tables (#1)** as the gallery-visible deliverable.
4. **HudShare (#10)** as another small win.
5. **HudPairing (#8)** once #6/#7/#9 are in.
6. **AI framework (#5)** once #4 lands.
7. **Runtime theming (#3)** as the next big platform swing.

Or stick with original "Tables first" for visible momentum and pick from the rest after.
