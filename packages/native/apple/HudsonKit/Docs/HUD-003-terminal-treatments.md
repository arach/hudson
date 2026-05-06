# HUD-003 — Terminal treatments

- **Status:** Proposed
- **Date:** 2026-05-04
- **Supersedes:** N/A
- **Superseded by:** N/A
- **Depends on:** ADR-003 (init-time variants for `HudAppShell` slots) — `bottomDrawer` and `content` variant lists are where new treatments land.

## Context

HudsonKit ships one terminal renderer (`Termini`, the Ghostty-backed renderer + local PTY + SSH package) wired through one host treatment (`HudTerminalDrawer` in `HudAppShell.bottomDrawer`, plus a one-off `TerminalApp` mounted via `HudTakeover` in the demo).

The renderer story is fully settled: Termini + Ghostty already runs in production in **Talkie on both macOS and iOS** — we have a working donor to port from, exactly like we did for `HudNavigationSidebar`. The interesting design space is the *frame* around the terminal, where Hudson can actually differentiate. We have at least four meaningfully different framings to ship.

Build flag posture stays as-is: `HUDSONKIT_WITH_TERMINAL=1` env var gates the heavy renderer dep so default consumers don't pay for it. Without the flag, `DrawerTerminal` falls back to `FakeTerminalContent` and the build stays light. This ADR doesn't touch the flag — it just adds chrome above it.

### Donor reference (Talkie)

| Treatment | Talkie source | What to lift |
|-----------|---------------|--------------|
| 1 — Drawer | (n/a — Hudson-native) | Already shipped here |
| 2 — Canvas | (n/a — net-new) | Designed from scratch |
| 3 — Window | `macOS/Talkie/Views/Console/ConsolePopoutManager.swift` | NSHostingController + NSWindow pop-out pattern; "claim the listener while popped, show placeholder inline" semantics |
| 4 — Tabs | (n/a — net-new) | Builds on treatment 3's window plumbing |
| Surface (macOS) | `macOS/Talkie/Views/Console/ManagedAgentTerminalView.swift` | `TerminiTerminalController` + `TerminiTerminalView` embed pattern |
| Surface (iOS) | `iOS/Talkie iOS/SSH/SSHTerminalGhosttySurfaceView.swift` | iOS-specific surface — confirms cross-platform parity |

## Decision

Land four terminal treatments as separate chrome surfaces in `HudsonShell`, each fitting cleanly into ADR-003's slot-variant pattern.

| # | Name | Module | Slot / scene | One-liner |
|---|------|--------|--------------|-----------|
| 1 | **Drawer** (`HudTerminalDrawer`) | `HudsonShell` | `HudAppShell.bottomDrawer` | Single session, slides up from the bottom. The paved path. |
| 2 | **Canvas** (`HudTerminalCanvas`) | `HudsonShell` | `HudAppShell.content` (or top-level) | Many terminals as draggable/resizable cards on a pan-and-zoom canvas. |
| 3 | **Window** (`HudTerminalScene`) | `HudsonShell` | SwiftUI `WindowGroup` | Each session is its own native `NSWindow`. Cmd+N / Cmd+W. |
| 4 | **Tabbed window** (`HudTerminalScene` + `tabbingMode = .preferred`) | `HudsonShell` | SwiftUI `WindowGroup` + `.nsWindow { … }` | Same as #3 but native macOS tabs. Cmd+T / drag tabs between windows. |

Treatment 1 already exists. Treatments 2–4 are net-new.

### Backend seam

A small protocol so the chrome compiles whether or not the heavy renderer is present:

```swift
public protocol HudTerminalBackend: Sendable {
    associatedtype Surface: View
    func makeSurface(
        host: String,
        appearance: HudTerminalAppearance,
        onState: @escaping (HudTerminalSessionState) -> Void
    ) -> Surface
}
```

Two implementations only:

- `TerminiBackend` — current behavior, wraps `HudTerminalSSHSurface`. Lives in `HudsonTerminal` (behind the flag).
- `MockBackend` — formalizes today's `FakeTerminalContent` so previews and tests have a real type. Lives in `HudsonShell` so it's always available.

This isn't a multi-backend story. It's a seam — exactly enough indirection to let chrome (`HudTerminalCanvas`, `HudTerminalScene`, `HudTerminalDrawer`) compile unconditionally and only resolve to a real renderer when the flag is set. Today's `#if HUDSON_TERMINAL` blocks in `DrawerTerminal.swift` and `TerminalApp.swift` collapse to a single backend resolution.

### Treatment details

#### Treatment 1 — Drawer (existing)

Already shipped. After this ADR, the `content: () -> View` slot stays generic (apps can drop a console / notifications panel / anything), but a convenience init lands:

```swift
HudTerminalDrawer.terminal(
    isOpen: $open,
    host: target.host,
    appearance: .init(fontSize: 11)
)
```

Maps to ADR-003 `bottomDrawer: .terminal(host:)` variant.

#### Treatment 2 — Canvas

A single `HudTerminalCanvas` view holds N `HudTerminalCard`s. Each card is independently draggable, resizable, and z-orderable. Canvas-level pan and zoom — same vocabulary as the web `WorkspaceShell` (`/app` route), applied to terminals instead of full apps.

```swift
HudTerminalCanvas(sessions: $sessions) { session in
    HudTerminalCard(session: session) {
        HudTerminalSurface(host: session.host)
    }
}
```

Card chrome is Hudson's own (not native window chrome); the canvas is *not* a window manager — every card lives inside one `NSWindow`. Card positions persist per workspace.

Maps to a new `HudAppShell.content` variant `.terminalCanvas(sessions:)`, or as a sibling top-level `HudTerminalCanvasShell` if it grows enough chrome of its own to justify it (decide once we've built it).

#### Treatment 3 — Window

Each session can pop out into its own native `NSWindow`. Two valid mechanisms:

- **SwiftUI `WindowGroup`** — declarative, gets `Cmd+N`, state restoration, and Mission Control for free. Right for *new* sessions opened from the menu / command palette.
- **`NSHostingController` + `NSWindow` (Talkie's pattern)** — imperative, right for "pop *this existing* session out into its own window" without re-creating the session. This is what `ConsolePopoutManager.swift` does and it's the pattern to port.

```swift
// Imperative pop-out — port from ConsolePopoutManager.swift
@MainActor @Observable
public final class HudTerminalPopoutManager {
    public static let shared = HudTerminalPopoutManager()
    public private(set) var poppedOutSessionIDs: Set<HudTerminalSessionID> = []
    // …NSWindow per session, willCloseNotification observer, etc.

    public func openOrFocus(session: HudTerminalSession) { … }
}
```

Critical detail Talkie surfaced and we need to honor: **a session has a single listener**. When a session pops out, the inline view (drawer, canvas card, etc.) must show a placeholder until the popout window closes — it can't render the same session in two places. The `poppedOutSessionIDs` set on the manager is what inline views read to decide between "render terminal" and "render placeholder."

```swift
@main
struct HudsonTerminalApp: App {
    var body: some Scene {
        // Declarative path — for fresh sessions
        WindowGroup("Terminal", id: "terminal", for: HudTerminalSessionID.self) { $sessionID in
            HudTerminalScene(sessionID: sessionID ?? .new())
        }
    }
}
```

State ownership: the `WindowGroup`'s value (`HudTerminalSessionID`) is light; the *session* (PTY, scrollback, env) lives in a process-wide `HudTerminalSessionStore` actor. Window restoration replays the ID; the store re-attaches.

#### Treatment 4 — Tabbed window

Same `WindowGroup` as #3 but with `NSWindow.tabbingMode = .preferred`. macOS draws the tab bar; we own the tab content. Cmd+T = new tab in the current window; drag a tab out → becomes a window (treatment 3 behavior); drag onto another window → merges.

```swift
HudTerminalScene(sessionID: …)
    .nsWindow {
        $0.tabbingMode = .preferred
        $0.tabbingIdentifier = "hudson.terminal"
    }
```

`.nsWindow { … }` is a small `NSViewRepresentable` bridge that runs once on window attach. Lands as a generic helper in `HudsonShell` (`HudNSWindowConfig.swift`) — useful well beyond this treatment.

This is the closest treatment to "looks like Terminal.app / iTerm" — the most familiar UX for power users.

### Module layout

```
Sources/
├── HudsonShell/
│   ├── HudTerminalDrawer.swift      (existing)
│   ├── HudTerminalCanvas.swift      (NEW — treatment 2)
│   ├── HudTerminalCard.swift        (NEW — treatment 2 building block)
│   ├── HudTerminalScene.swift       (NEW — treatments 3 & 4)
│   ├── HudNSWindowConfig.swift      (NEW — treatment 4 helper, generic)
│   └── HudTerminalBackend.swift     (NEW — protocol + MockBackend)
└── HudsonTerminal/                (existing, behind flag)
    ├── HudTerminalSurface.swift     (refactor: backend-resolved)
    ├── HudTerminalSSHSurface.swift  (existing)
    ├── HudTerminalAppearance.swift  (existing)
    └── TerminiBackend.swift       (NEW — wraps current behavior, no behavior change)
```

## Phasing

| Phase | Scope | Ship value |
|-------|-------|-----------|
| **0** | Backend protocol + `MockBackend` formalized + `HudTerminalSurface` resolves through it. **No behavior change.** Today's `#if HUDSON_TERMINAL` in the demo collapses to backend resolution. | Foundation. Unblocks 2–4 without breaking anyone. |
| **1** | Treatment 1 polish + ADR-003 `.terminal` variant on `bottomDrawer`. Demo's drawer renders a real terminal when built with the flag. | Paved path solid. |
| **2** | Treatment 3 (windows). New demo target `HudsonTerminalDemo` showing window-per-session. | Validates `WindowGroup` + session-store split. Smallest of the three new treatments. |
| **3** | Treatment 4 (tabs). Builds directly on phase 2's `HudTerminalScene`. | Familiar pro-user UX; closes the gap with Terminal.app / iTerm. |
| **4** | Treatment 2 (canvas). Most experimental, lands once the others are stable. | The actual differentiator — no shipping terminal does this. |

Each phase = separately mergeable PR. Phases 2–4 can parallelize once phase 0 lands.

## Alternatives considered

- **One treatment per build flag (`HUDSONKIT_TREATMENT_CANVAS=1`).** Heavier than ADR-003's variant approach. Variants compose at runtime; build flags don't.
- **Make canvas/windows top-level shells (siblings to `HudAppShell`).** Tempting for purity but inconsistent with how the rest of HudsonKit composes. Slot variants on `HudAppShell` are the right place to start; promote to a sibling shell only if the canvas grows chrome that doesn't fit (status bar, header, takeovers).
- **Skip the backend protocol, keep `#if HUDSON_TERMINAL`.** Cheaper, but the chrome treatments would need their own `#if` blocks and previews would diverge from the real surfaces. The protocol is one file and pays for itself the moment the second treatment lands.

## Open questions

1. **Session lifecycle across treatments.** Should a session be portable between treatments? (Drag from canvas → window? Detach from drawer → window?) MVP: no — each treatment owns its own sessions. Revisit once we've lived with isolation and felt the friction.
2. **Scrollback persistence.** Per-session, in-memory only for MVP. Disk persistence is the same problem in all four treatments and can land in a follow-up ADR.
3. **Multi-window state restoration.** macOS `WindowGroup` with `for: HudTerminalSessionID` handles the ID side, but only if `HudTerminalSessionStore` survives an app relaunch. Decide whether to persist sessions or replay them as fresh PTYs — defer to phase 2.

## Demo plan

Add a "Terminal" section to `HudsonKitDemo`'s sidebar with four tabs:

- **Drawer** — current chrome, real terminal in the bottom drawer (when built with the flag)
- **Canvas** — five preset sessions on a pan-and-zoom canvas
- **Window** — button that opens a new window via `WindowGroup`
- **Tabs** — button that opens a new tabbed window

Each tab is also a screenshot opportunity for the docs site.

## Migration notes

- `DrawerTerminal.swift` and `TerminalApp.swift` in the demo currently wrap their entire body in `#if HUDSON_TERMINAL`. After phase 0, those collapse to a single backend resolution; the chrome compiles unconditionally. Existing API surface unchanged.
- `HUDSONKIT_WITH_TERMINAL` env var stays. New consumers don't need it unless they want a real backend; the chrome treatments work with `MockBackend` by default.
