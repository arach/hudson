import SwiftUI
import HudsonUI

#if HUDSON_TERMINAL
import HudsonTerminal
import Termini
#endif

/// Content the demo mounts inside the `HudTerminalDrawer`.
struct DrawerTerminal: View {
    let host: String

    var body: some View {
        #if HUDSON_TERMINAL
        // A/B: mount Termini directly, no Hudson wrappers, mirroring
        // the upstream TerminiDemo. If this works the regression is in
        // HudTerminalSurface / HudTerminalSSHSurface; if it still crashes the
        // problem is in the host context (HudAppShell / HudTerminalDrawer).
        DirectTermBridgeProbe()
        #else
        FakeTerminalContent(host: host)
        #endif
    }
}

#if HUDSON_TERMINAL
private struct DirectTermBridgeProbe: View {
    @State private var workspace = TerminiLocalPTYWorkspace()
    @State private var appearance = TerminiTerminalAppearance(
        theme: .midnightBloom,
        fontSize: 13
    )

    var body: some View {
        TerminiTerminalView(
            controller: workspace.controller,
            appearance: appearance
        )
        .onAppear { workspace.start() }
        .onDisappear { workspace.stop() }
    }
}
#endif

private struct FakeTerminalContent: View {
    let host: String

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 2) {
                line(prompt: "~", text: "~/dev/lattices", color: HudPalette.muted)
                line(prompt: "$", text: "swift build -c release", color: HudPalette.ink)
                Text("Compiling DeckKit…")
                    .font(HudFont.mono(11))
                    .foregroundStyle(HudPalette.muted)
                Text("Compiling Sources…")
                    .font(HudFont.mono(11))
                    .foregroundStyle(HudPalette.muted)
                Text("Build complete! (3.42s)")
                    .font(HudFont.mono(11))
                    .foregroundStyle(HudPalette.statusOk)
                line(prompt: "$", text: "scout send '@hkbridge ack — looks great'", color: HudPalette.ink)
                Text("Routed to: hkbridge.m2-bridge.mini")
                    .font(HudFont.mono(11))
                    .foregroundStyle(HudPalette.muted)

                HStack(spacing: HudSpacing.xs) {
                    Text("$")
                        .font(HudFont.mono(11, weight: .semibold))
                        .foregroundStyle(HudPalette.statusOk)
                    Rectangle()
                        .fill(HudPalette.statusOk)
                        .frame(width: 7, height: 13)
                }
                .padding(.top, 2)
            }
            .padding(HudSpacing.xl)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(HudPalette.chrome)
        .overlay(alignment: .topTrailing) {
            Text(host)
                .font(HudFont.mono(9))
                .tracking(0.8)
                .foregroundStyle(HudPalette.dim)
                .padding(HudSpacing.md)
        }
    }

    private func line(prompt: String, text: String, color: Color) -> some View {
        HStack(spacing: HudSpacing.xs) {
            Text(prompt)
                .font(HudFont.mono(11))
                .foregroundStyle(HudPalette.muted)
            Text(text)
                .font(HudFont.mono(11))
                .foregroundStyle(color)
        }
    }
}
