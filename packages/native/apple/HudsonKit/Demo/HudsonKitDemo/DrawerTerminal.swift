import SwiftUI
import HudsonUI

#if HUDSON_TERMINAL
import HudsonTerminal
import Termini
#endif

/// Content the demo mounts inside the `HTerminalDrawer`.
struct DrawerTerminal: View {
    let host: String

    var body: some View {
        #if HUDSON_TERMINAL
        // A/B: mount Termini directly, no Hudson wrappers, mirroring
        // the upstream TerminiDemo. If this works the regression is in
        // HTerminalSurface / HTerminalSSHSurface; if it still crashes the
        // problem is in the host context (HAppShell / HTerminalDrawer).
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
                line(prompt: "~", text: "~/dev/lattices", color: HPalette.muted)
                line(prompt: "$", text: "swift build -c release", color: HPalette.ink)
                Text("Compiling DeckKit…")
                    .font(HFont.mono(11))
                    .foregroundStyle(HPalette.muted)
                Text("Compiling Sources…")
                    .font(HFont.mono(11))
                    .foregroundStyle(HPalette.muted)
                Text("Build complete! (3.42s)")
                    .font(HFont.mono(11))
                    .foregroundStyle(HPalette.statusOk)
                line(prompt: "$", text: "scout send '@hkbridge ack — looks great'", color: HPalette.ink)
                Text("Routed to: hkbridge.m2-bridge.mini")
                    .font(HFont.mono(11))
                    .foregroundStyle(HPalette.muted)

                HStack(spacing: HSpacing.xs) {
                    Text("$")
                        .font(HFont.mono(11, weight: .semibold))
                        .foregroundStyle(HPalette.statusOk)
                    Rectangle()
                        .fill(HPalette.statusOk)
                        .frame(width: 7, height: 13)
                }
                .padding(.top, 2)
            }
            .padding(HSpacing.xl)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(HPalette.chrome)
        .overlay(alignment: .topTrailing) {
            Text(host)
                .font(HFont.mono(9))
                .tracking(0.8)
                .foregroundStyle(HPalette.dim)
                .padding(HSpacing.md)
        }
    }

    private func line(prompt: String, text: String, color: Color) -> some View {
        HStack(spacing: HSpacing.xs) {
            Text(prompt)
                .font(HFont.mono(11))
                .foregroundStyle(HPalette.muted)
            Text(text)
                .font(HFont.mono(11))
                .foregroundStyle(color)
        }
    }
}
