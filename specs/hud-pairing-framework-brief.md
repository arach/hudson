# HudPairing — framework brief

## What

Mobile-companion pairing primitive for Hudson. Apps pair a desktop session (web or macOS host) with a mobile companion (iOS guest) via QR scan. HudPairing provides the cryptographic handshake + signed-RPC channel; apps decide what flows over the channel.

## Where to harvest

Talkie has the working pattern in production:

- `/Users/arach/dev/talkie`
- `/Users/arach/dev/talkie-companion-poc` (canonical — weight this heavily)

A read-only survey of the pattern was already done; key findings are captured in `docs/_internal/next-up.md` under "Survey findings #8 HudPairing":

- Transport: HTTP over LAN/Tailscale, port 8765 (Bun/Elysia server on Mac). No WebSocket/WebRTC/MultipeerConnectivity.
- QR payload: JSON `{publicKey, hostname, port, protocol}` via `CIFilter.qrCodeGenerator()`.
- Handshake: ECDH P-256 + HKDF, no challenge-response (TOFU on QR scan).
- Per-request HMAC: 4-header scheme (`X-Device-ID`, `X-Timestamp`, `X-Nonce`, `X-Signature`), 30s window, nonce store.
- Long-lived mutual sessions, 30-day device expiry.
- Server keypair persisted, generated once, exposed via `GET /pair/info`.
- The cryptographic core (`crypto/keypair.ts`, `auth/hmac.ts`, `devices/registry.ts`) is essentially generic infrastructure — lift verbatim.

Treat Talkie as the reference implementation. Don't reinvent.

## Hard dependencies

All shipped — HudPairing builds on these:

- **HudVault** (Apple #23, web #25): server keypair + trusted-peer storage + paired-device-derived state
- **HudQRCode** (#21): QR generation on the host
- **HudQRScanner** (#24): QR scanning on the iOS guest
- **HudPermissionGate** (#22): camera permission on the iOS guest

## What ships

A design spec at `specs/hud-pairing-framework.md`. **Not implementation code.**

Cover at minimum:

1. **`HudPairingHost` public API** (web + macOS)
   - keypair lifecycle, advertised QR payload, pending/approve/reject device registry, signed-request endpoint dispatcher
2. **`HudPairingGuest` public API** (iOS)
   - QR scan → ECDH derivation → register flow → persisted paired-device state, signed-request client
3. **QR payload schema** — generalize Talkie's `{publicKey, hostname, port, protocol}` to support multiple transports. Add `transport: "lan-http" | "ws-relay"` field.
4. **Handshake state machine**
5. **Post-pairing channel** — generic `signedRequest(path, body)`; apps layer their own routes
6. **Persistence shape** — what goes in HudVault on host vs guest
7. **Web transport variant** — Talkie's LAN-HTTP doesn't work for web hosts (browsers can't bind a port). Sketch how a relay/WebSocket-based variant works. Could be an opt-in companion service or an existing relay (Tailscale Funnel, Cloudflare Tunnel, etc.) — propose, don't decide.
8. **Error model** — typed errors paralleling HudAI's style
9. **v1 acceptance criteria**
10. **Anything you couldn't decide cleanly** — flag for human review

## Out of scope

- Specific app payloads (Talkie audio, Scout commands). Apps layer their own routes.
- WebRTC P2P / Bonjour / MultipeerConnectivity transports. Single transport in v1 (LAN-HTTP for macOS, WS-relay for web).
- Multi-device or device-to-device pairing. Host-to-guest only.

## Constraints

- Web: bun, React 19, Next.js 16, Tailwind v4. No purple in designs (cyan/blue/teal/emerald).
- Apple: SwiftUI. iOS demo is HudLint-strict — design tokens only.
- Commits: gitmoji, no co-author footers.

## Reply

When the spec is written, scout-reply with the file path + a ~150-word executive summary covering: transport choice for web, key reusability from Talkie, and any open human-review items.
