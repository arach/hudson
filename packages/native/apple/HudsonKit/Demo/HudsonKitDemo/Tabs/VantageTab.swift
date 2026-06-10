#if HUDSON_TERMINAL
import SwiftUI
import HudsonUI
import HudsonVantage

struct VantageTab: View {
    @StateObject private var model = HudVantageHostAppModel(
        configuration: .hostApplication(
            workspaceID: "hudsonkit-demo-vantage",
            surfaceTitle: "Vantage",
            surfaceSubtitle: "Hudson monorepo checkout",
            applicationSupportSubpath: "HudsonKitDemo/Vantage",
            launchSetupURL: DemoResources.vantagePracticeSetupURL,
            workingDirectoryURL: DemoResources.repositoryRoot,
            restoresStateOnLaunch: false
        ),
        identity: HudVantageHostIdentity(
            appName: "HudsonKit Demo",
            tagline: "Canvas rooted at the Hudson checkout beside you.",
            tint: .cyan,
            targetLabel: "Canvas",
            menuBarTitle: "HudsonKit Demo",
            menuBarSystemImage: "square.grid.2x2",
            windowTitle: "HudsonKit Demo · Vantage"
        )
    )

    var body: some View {
        HudVantageHostRootView(model: model)
            .frame(minHeight: 520)
    }
}
#else
import SwiftUI
import HudsonUI

/// Stub when HudsonVantage isn't built. Rebuild with HUDSONKIT_WITH_TERMINAL=1
/// (or `make build-terminal` / `make run-vantage` from the kit dir).
struct VantageTab: View {
    var body: some View {
        VStack(alignment: .leading, spacing: HudSpacing.lg) {
            HudSectionLabel("Vantage")
            HudCard {
                VStack(alignment: .leading, spacing: HudSpacing.md) {
                    Text("HudsonVantage is not built into this binary.")
                        .font(HudFont.ui(HudTextSize.sm))
                        .foregroundStyle(HudPalette.muted)
                    Text("Rebuild with HUDSONKIT_WITH_TERMINAL=1 swift build, or run `make run-vantage` from packages/native/apple/HudsonKit.")
                        .font(HudFont.mono(HudTextSize.xxs))
                        .foregroundStyle(HudPalette.dim)
                }
            }
            .frame(maxWidth: HudLayout.dialogWidth)
        }
    }
}
#endif