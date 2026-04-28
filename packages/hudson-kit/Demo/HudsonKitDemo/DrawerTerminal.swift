import SwiftUI
import HudsonUI

#if canImport(TermBridgeKit)
import TermBridgeKit
#endif

/// Content the demo mounts inside the `HudsonTerminalDrawer`.
///
/// On iOS demos that link `TermBridgeKit`, this would host the real Ghostty
/// terminal view. Until that's wired into `iOS/project.yml`, both targets fall
/// through to `FakeTerminalContent`, which renders enough mono prompt history
/// to demonstrate the drawer behavior without pulling a heavy dependency.
struct DrawerTerminal: View {
    let host: String

    var body: some View {
        #if canImport(TermBridgeKit)
        // GhosttyTerminalView from TermBridgeKit goes here once wired.
        FakeTerminalContent(host: host)
        #else
        FakeTerminalContent(host: host)
        #endif
    }
}

private struct FakeTerminalContent: View {
    let host: String

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 2) {
                line(prompt: "~", text: "~/dev/lattices", color: HudsonPalette.muted)
                line(prompt: "$", text: "swift build -c release", color: HudsonPalette.ink)
                Text("Compiling DeckKit…")
                    .font(HudsonFont.mono(11))
                    .foregroundStyle(HudsonPalette.muted)
                Text("Compiling Sources…")
                    .font(HudsonFont.mono(11))
                    .foregroundStyle(HudsonPalette.muted)
                Text("Build complete! (3.42s)")
                    .font(HudsonFont.mono(11))
                    .foregroundStyle(HudsonPalette.statusOk)
                line(prompt: "$", text: "scout send '@hkbridge ack — looks great'", color: HudsonPalette.ink)
                Text("Routed to: hkbridge.m2-bridge.mini")
                    .font(HudsonFont.mono(11))
                    .foregroundStyle(HudsonPalette.muted)

                HStack(spacing: HudsonSpacing.xs) {
                    Text("$")
                        .font(HudsonFont.mono(11, weight: .semibold))
                        .foregroundStyle(HudsonPalette.statusOk)
                    Rectangle()
                        .fill(HudsonPalette.statusOk)
                        .frame(width: 7, height: 13)
                }
                .padding(.top, 2)
            }
            .padding(HudsonSpacing.xl)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color.black.opacity(0.45))
        .overlay(alignment: .topTrailing) {
            Text(host)
                .font(HudsonFont.mono(9))
                .tracking(0.8)
                .foregroundStyle(HudsonPalette.dim)
                .padding(HudsonSpacing.md)
        }
    }

    private func line(prompt: String, text: String, color: Color) -> some View {
        HStack(spacing: HudsonSpacing.xs) {
            Text(prompt)
                .font(HudsonFont.mono(11))
                .foregroundStyle(HudsonPalette.muted)
            Text(text)
                .font(HudsonFont.mono(11))
                .foregroundStyle(color)
        }
    }
}
