#if HUDSON_TERMINAL
import SwiftUI
import HudsonUI
import HudsonTerminal
import Termini

/// Full-page local shell for the demo — lives in primary navigation, not Canvas chrome.
struct TerminalTab: View {
    @State private var workspace = TerminiLocalPTYWorkspace()

    var body: some View {
        HudTerminalSurface(controller: workspace.controller)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(HudSurface.base)
            .onAppear { workspace.start() }
            .onDisappear { workspace.stop() }
    }
}
#else
import SwiftUI
import HudsonUI

struct TerminalTab: View {
    var body: some View {
        VStack(alignment: .leading, spacing: HudSpacing.lg) {
            HudSectionLabel("Terminal")
            HudCard {
                VStack(alignment: .leading, spacing: HudSpacing.md) {
                    Text("Termini is not built into this binary.")
                        .font(HudFont.ui(HudTextSize.sm))
                        .foregroundStyle(HudPalette.muted)
                    Text("Rebuild with HUDSONKIT_WITH_TERMINAL=1 or run `make run-canvas` from packages/native/apple/HudsonKit.")
                        .font(HudFont.mono(HudTextSize.xxs))
                        .foregroundStyle(HudPalette.dim)
                }
            }
            .frame(maxWidth: HudLayout.dialogWidth)
        }
        .padding(HudSpacing.xxl)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}
#endif