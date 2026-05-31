import SwiftUI
import HudsonUI

public struct HudVantageHostRootView: View {
    @ObservedObject private var model: HudVantageHostAppModel

    public init(model: HudVantageHostAppModel) {
        self.model = model
    }

    public var body: some View {
        HudVantageSurface(configuration: model.configuration)
            .frame(minWidth: 980, minHeight: 680)
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
