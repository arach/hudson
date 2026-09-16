import SwiftUI
import HudsonTranscription

/// A controlled catalog picker. The host supplies use-case exclusion reasons;
/// request-specific compatibility must still be checked before using audio.
@MainActor
public struct HudTranscriptionModelPicker: View {
    private let models: [HudTranscriptionModelDescriptor]
    private let exclusions: [HudTranscriptionModelID: String]
    @Binding private var selection: String

    public init(models: [HudTranscriptionModelDescriptor],
                exclusions: [HudTranscriptionModelID: String] = [:],
                selection: Binding<String>) {
        self.models = models
        self.exclusions = exclusions
        _selection = selection
    }

    public var body: some View {
        VStack(alignment: .leading) {
            Picker("Model", selection: $selection) {
                if selection.isEmpty {
                    Text("Choose a model").tag("")
                } else if !models.contains(where: { $0.id.rawValue == selection }) {
                    Text("\(selection) (unavailable)").tag(selection).disabled(true)
                }
                ForEach(models, id: \.id) { model in
                    Text(model.displayName).tag(model.id.rawValue)
                        .disabled(exclusions[model.id] != nil)
                }
            }
            if let reason = exclusions[.init(rawValue: selection)] {
                Text(reason).foregroundStyle(.secondary)
            }
            if models.contains(where: { exclusions[$0.id] != nil }) {
                DisclosureGroup("Models unavailable for this use") {
                    ForEach(models.filter { exclusions[$0.id] != nil }, id: \.id) { model in
                        VStack(alignment: .leading) {
                            Text(model.displayName)
                            Text(exclusions[model.id] ?? "").foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
    }
}
