import SwiftUI
import HudsonTranscription

/// Controlled provider selection. The host owns the existing-engine route and
/// resets dependent configuration when the selection changes. Providers are
/// grouped by where they run so locality is visible without extra badges.
@MainActor
public struct HudTranscriptionProviderPicker: View {
    private let title: String
    private let existingEngineTitle: String
    private let providers: [HudTranscriptionProviderDescriptor]
    @Binding private var selection: String

    public init(_ title: String, providers: [HudTranscriptionProviderDescriptor],
                existingEngineTitle: String, selection: Binding<String>) {
        self.title = title
        self.providers = providers
        self.existingEngineTitle = existingEngineTitle
        _selection = selection
    }

    public var body: some View {
        Picker(title, selection: $selection) {
            Text(existingEngineTitle).tag("")
            if !selection.isEmpty && !providers.contains(where: { $0.id.rawValue == selection }) {
                Text("\(selection) (unavailable)").tag(selection).disabled(true)
            }
            providerSection("On This Mac", origin: .local)
            providerSection("Cloud Services", origin: .remote)
        }
        .accessibilityLabel(title)
    }

    @ViewBuilder
    private func providerSection(_ header: String, origin: HudTranscriptionOrigin) -> some View {
        let group = providers.filter { $0.origin == origin }
        if !group.isEmpty {
            Section(header) {
                ForEach(group, id: \.id) { provider in
                    Text(provider.displayName).tag(provider.id.rawValue)
                }
            }
        }
    }
}
