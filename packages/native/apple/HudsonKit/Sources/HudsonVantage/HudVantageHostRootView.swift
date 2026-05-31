import SwiftUI
import HudsonUI
import HudsonVantageCompanion
import HudsonVantageCore
import HudsonVantageSurface

private enum HudVantageHostRootMetrics {
    static let minWidth: CGFloat = 980
    static let minHeight: CGFloat = 680
}

public struct HudVantageHostRootView: View {
    @ObservedObject private var model: HudVantageHostAppModel

    public init(model: HudVantageHostAppModel) {
        self.model = model
    }

    public var body: some View {
        HudVantageSurface(configuration: model.configuration)
            .frame(
                minWidth: HudVantageHostRootMetrics.minWidth,
                minHeight: HudVantageHostRootMetrics.minHeight
            )
            .hudsonAppManifest(model.identity.appManifest.withVersion(model.appVersion))
            .sheet(isPresented: $model.showsAbout) {
                HudVantageHostAboutView(model: model)
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
