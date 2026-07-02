import SwiftUI
import HudsonUI
import HudsonCanvasCompanion
import HudsonCanvasCore
import HudsonCanvasSurface

private enum HudCanvasHostRootMetrics {
    static let minWidth: CGFloat = 980
    static let minHeight: CGFloat = 680
}

public struct HudCanvasHostRootView: View {
    @ObservedObject private var model: HudCanvasHostAppModel

    public init(model: HudCanvasHostAppModel) {
        self.model = model
    }

    public var body: some View {
        HudCanvasSurface(configuration: model.configuration)
            .frame(
                minWidth: HudCanvasHostRootMetrics.minWidth,
                minHeight: HudCanvasHostRootMetrics.minHeight
            )
            .hudsonAppManifest(model.identity.appManifest.withVersion(model.appVersion))
            .sheet(isPresented: $model.showsAbout) {
                HudCanvasHostAboutView(model: model)
                    .hudsonAppManifest(model.identity.appManifest)
            }
    }
}

private extension HudAppManifest {
    func withVersion(_ version: String) -> HudAppManifest {
        var copy = self
        copy.version = version
        return copy
    }
}
