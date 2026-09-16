import SwiftUI
import HudsonTranscription

/// Controlled setup fields for a registered adapter. The host owns validation,
/// credentials, consent, preparation, and persistence. No services are invoked.
/// Raw endpoint text is retained so invalid input is not silently discarded.
@MainActor
public struct HudTranscriptionConfigurationFields: View {
    private let schema: [HudTranscriptionConfigurationField]
    @Binding private var endpoint: String
    @Binding private var region: String
    @Binding private var credentialReference: String
    @Binding private var modelLocation: String
    @Binding private var options: [String: String]

    public init(schema: [HudTranscriptionConfigurationField],
                endpoint: Binding<String>, region: Binding<String>,
                credentialReference: Binding<String>, modelLocation: Binding<String>,
                options: Binding<[String: String]>) {
        self.schema = schema
        _endpoint = endpoint
        _region = region
        _credentialReference = credentialReference
        _modelLocation = modelLocation
        _options = options
    }

    public var body: some View {
        VStack(alignment: .leading) {
            ForEach(schema, id: \.key) { field in
                // Outside a Form, a text field's title is not rendered; a
                // visible label keeps filled-in fields identifiable.
                switch field.kind {
                case .endpoint:
                    labeledField(field, text: $endpoint)
                case .region:
                    labeledField(field, text: $region)
                case .credentialReference:
                    labeledField(field, text: $credentialReference)
                case .localModelLocation:
                    labeledField(field, text: $modelLocation)
                case .text:
                    labeledField(field, text: Binding(
                        get: { options[field.key] ?? "" },
                        set: { options[field.key] = $0 }))
                case .model:
                    // The host supplies a capability-filtered model picker.
                    EmptyView()
                }
            }
        }
        .autocorrectionDisabled()
    }

    private func labeledField(_ field: HudTranscriptionConfigurationField, text: Binding<String>) -> some View {
        LabeledContent(field.displayName) {
            TextField(field.displayName, text: text)
                .labelsHidden()
                .multilineTextAlignment(.leading)
        }
    }
}
