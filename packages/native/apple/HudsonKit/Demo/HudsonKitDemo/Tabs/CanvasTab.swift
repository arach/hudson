#if HUDSON_TERMINAL
import SwiftUI
import HudsonUI
import HudsonCanvas

struct CanvasTab: View {
    @StateObject private var model = HudCanvasHostAppModel(
        configuration: .hostApplication(
            workspaceID: "hudsonkit-demo-canvas",
            surfaceTitle: "Canvas",
            surfaceSubtitle: "Hudson monorepo checkout",
            applicationSupportSubpath: "HudsonKitDemo/Canvas",
            launchSetupURL: DemoResources.canvasPracticeSetupURL,
            workingDirectoryURL: DemoResources.repositoryRoot,
            restoresStateOnLaunch: false,
            showsStatusFooter: true,
            embedChrome: .embedded
        ),
        identity: HudCanvasHostIdentity(
            appName: "HudsonKit Lab",
            tagline: "Canvas rooted at the Hudson checkout beside you.",
            tint: .cyan,
            targetLabel: "Canvas",
            menuBarTitle: "HudsonKit Lab",
            menuBarSystemImage: "square.grid.2x2",
            windowTitle: "HudsonKit Lab · Canvas"
        )
    )

    var body: some View {
        HudCanvasHostRootView(model: model)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
#else
import SwiftUI
import HudsonUI

/// Stub when HudsonCanvas isn't built. Rebuild with HUDSONKIT_WITH_TERMINAL=1
/// (or `make build-terminal` / `make run-canvas` from the kit dir).
struct CanvasTab: View {
    var body: some View {
        VStack(alignment: .leading, spacing: HudSpacing.lg) {
            HudSectionLabel("Canvas")
            HudCard {
                VStack(alignment: .leading, spacing: HudSpacing.md) {
                    Text("HudsonCanvas is not built into this binary.")
                        .font(HudFont.ui(HudTextSize.sm))
                        .foregroundStyle(HudPalette.muted)
                    Text("Rebuild with HUDSONKIT_WITH_TERMINAL=1 swift build, or run `make run-canvas` from packages/native/apple/HudsonKit.")
                        .font(HudFont.mono(HudTextSize.xxs))
                        .foregroundStyle(HudPalette.dim)
                }
            }
            .frame(maxWidth: HudLayout.dialogWidth)
        }
    }
}
#endif