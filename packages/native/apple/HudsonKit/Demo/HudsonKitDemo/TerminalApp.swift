import SwiftUI
import HudsonUI
import HudsonShell

#if HUDSON_TERMINAL
import HudsonTerminal

private typealias DemoTerminalSessionState = HudTerminalSessionState
#else
private struct DemoTerminalSessionState {
    var isConnected: Bool
    var isConnecting: Bool
    var statusMessage: String
    var columns: Int?
    var rows: Int?
}
#endif

/// Floating "Terminal app" — a self-contained HudAppShell whose content slot
/// is a terminal surface. Distinct from the chrome-level
/// `HudTerminalDrawer` (which attaches to the bottom of any host app):
/// this one *is* the app. It carries its own header (path / target), its own
/// status bar (rows×cols, connection state), and no rail/inspector chrome.
///
/// Mounted inside `HudTakeover` from the demo so it floats above the
/// LATTICES app shell, but the structure is identical to a top-level app and
/// can be hosted in a window, a workspace, or a dedicated route.
struct TerminalApp: View {
    let target: TargetMock
    var onClose: () -> Void

    @State private var rows: Int = 38
    @State private var cols: Int = 132
    @State private var connected: Bool = true
    @State private var statusMessage: String = "Ready"

    @Environment(\.hudsonAppManifest) private var manifest

    var body: some View {
        HudAppShell {
            EmptyView()
        } trailing: {
            EmptyView()
        } topDrawer: {
            terminalHeader
        } bottomDrawer: {
            EmptyView()
        } content: {
            TerminalSurface(host: target.host) { state in
                connected = state.isConnected
                statusMessage = state.statusMessage
                if let nextRows = state.rows {
                    rows = nextRows
                }
                if let nextCols = state.columns {
                    cols = nextCols
                }
            }
        } statusBar: {
            terminalStatusBar
        }
    }

    // MARK: Header (mounted in topDrawer slot for visual separation from the
    // takeover's own header)

    private var terminalHeader: some View {
        HStack(spacing: HudSpacing.lg) {
            Image(systemName: "terminal")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(manifest.accent)
                .frame(width: 28, height: 28)
                .background(RoundedRectangle(cornerRadius: HudRadius.standard).fill(manifest.accent.opacity(0.14)))

            VStack(alignment: .leading, spacing: 1) {
                Text("zsh · \(target.name)")
                    .font(HudFont.mono(12, weight: .semibold))
                    .foregroundStyle(HudPalette.ink)
                Text("~/dev/lattices · \(target.host)")
                    .font(HudFont.mono(10))
                    .foregroundStyle(HudPalette.muted)
            }

            Spacer()

            HudBadge("\(rows)×\(cols)", tint: HudPalette.muted)
            HudBadge(
                connected ? "LIVE" : "DEAD",
                tint: connected ? HudPalette.statusOk : HudPalette.statusError,
                dot: true
            )
        }
        .padding(.horizontal, HudSpacing.xxl)
        .frame(height: HudLayout.navHeight)
        .background(HudPalette.chrome)
    }

    // MARK: Status bar

    private var terminalStatusBar: some View {
        HStack(spacing: HudSpacing.xl) {
            HudStatusDot(
                color: connected ? HudPalette.statusOk : HudPalette.statusError,
                size: 6,
                pulses: connected
            )
            Text(connected ? "READY" : "DISCONNECTED")
                .font(HudFont.mono(9, weight: .bold))
                .tracking(1.0)
                .foregroundStyle(connected ? HudPalette.statusOk : HudPalette.statusError)

            sep
            Text(statusMessage)
                .font(HudFont.mono(10))
                .foregroundStyle(HudPalette.muted)
            sep
            Text("\(rows)×\(cols)")
                .font(HudFont.mono(10))
                .foregroundStyle(HudPalette.ink)
            sep
            Text("zsh 5.9")
                .font(HudFont.mono(10))
                .foregroundStyle(HudPalette.muted)

            Spacer()

            Button(action: onClose) {
                HStack(spacing: HudSpacing.xs) {
                    Image(systemName: "xmark")
                        .font(.system(size: 9, weight: .semibold))
                    Text("close")
                        .font(HudFont.mono(9))
                        .tracking(0.6)
                }
                .foregroundStyle(HudPalette.dim)
                .padding(.horizontal, HudSpacing.md)
                .padding(.vertical, 2)
                .overlay(
                    RoundedRectangle(cornerRadius: HudRadius.tight)
                        .stroke(HudHairline.standard, lineWidth: 1)
                )
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close terminal")
        }
        .padding(.horizontal, HudSpacing.xxl)
        .frame(height: HudLayout.statusBarHeight)
    }

    private var sep: some View {
        Text("·")
            .font(HudFont.mono(10))
            .foregroundStyle(HudPalette.dim)
    }
}

// MARK: - Terminal surface (placeholder until Termini is wired)

private struct TerminalSurface: View {
    let host: String
    var onStateChange: (DemoTerminalSessionState) -> Void = { _ in }

    var body: some View {
        #if HUDSON_TERMINAL
        HudTerminalSSHSurface(
            hostLabel: host,
            showsSystemKeyboard: true,
            appearance: HudTerminalAppearance(fontSize: 12),
            onStateChange: onStateChange
        )
        #else
        FakeTerminalSurface(host: host)
        #endif
    }
}

private struct FakeTerminalSurface: View {
    let host: String
    @State private var blink: Bool = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 4) {
                line("Last login: Tue Apr 28 09:14:22 on ttys001", color: HudPalette.dim)
                line("\(host)", color: HudPalette.muted)
                Spacer().frame(height: 8)

                prompt
                lineMono("swift build -c release")

                output("Compiling DeckKit (4 sources)")
                output("Compiling LatticesUI (12 sources)")
                output("Compiling Sources (3 sources)")
                output("Build complete! (3.42s)", color: HudPalette.statusOk)

                Spacer().frame(height: 4)

                prompt
                lineMono("scout send '@hkbridge ack — DESIGN.md looks great'")

                output("From: hudson.main.mini")
                output("Route: dm")
                output("DM: dm.hkbridge.m2-bridge.mini.hudson.main.mini")
                output("Routed to: hkbridge.m2-bridge.mini")

                Spacer().frame(height: 4)

                prompt
                lineMono("git log --oneline -5")

                output("8a82fc4 💄 HudsonKit demo — DashboardBottomChrome cloudRow on 28pt grid")
                output("ec97e8c 💄 HudsonKit demo — alignment pass: equal-height cards")
                output("cc648e9 ✨ HudsonKit demo — Shell tab documenting M3 chrome primitives")
                output("5adc33e 💄 HudsonKit demo — status-bar context + inspector reflects selection")
                output("09c3dd8 ✨ HudsonKit M3d — HudCommandPalette overlay surface")

                Spacer().frame(height: 4)

                HStack(spacing: HudSpacing.xs) {
                    Text("$")
                        .font(HudFont.mono(11, weight: .semibold))
                        .foregroundStyle(HudPalette.statusOk)
                    Rectangle()
                        .fill(HudPalette.statusOk)
                        .frame(width: 7, height: 14)
                        .opacity(blink ? 0 : 1)
                        .animation(.easeInOut(duration: 0.55).repeatForever(autoreverses: true), value: blink)
                }
            }
            .padding(.horizontal, HudSpacing.xxl)
            .padding(.vertical, HudSpacing.xl)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(HudPalette.chrome)
        .onAppear { blink = true }
    }

    private var prompt: some View {
        HStack(spacing: HudSpacing.xs) {
            Text("➜")
                .font(HudFont.mono(11, weight: .semibold))
                .foregroundStyle(HudPalette.statusOk)
            Text("lattices")
                .font(HudFont.mono(11, weight: .semibold))
                .foregroundStyle(HudTint.cyan.color)
            Text("git:(\u{e0a0}m3-shell)")
                .font(HudFont.mono(11))
                .foregroundStyle(HudTint.amber.color)
        }
    }

    private func lineMono(_ text: String) -> some View {
        Text(text)
            .font(HudFont.mono(11))
            .foregroundStyle(HudPalette.ink)
    }

    private func line(_ text: String, color: Color = HudPalette.ink) -> some View {
        Text(text)
            .font(HudFont.mono(11))
            .foregroundStyle(color)
    }

    private func output(_ text: String, color: Color = HudPalette.muted) -> some View {
        Text(text)
            .font(HudFont.mono(11))
            .foregroundStyle(color)
    }
}
