import SwiftUI
import UniformTypeIdentifiers
import HudsonConversation

/// Sample settings surface for conversational voice: provider choice, a
/// refreshable provider-discovered model list that preserves unknown saved
/// choices, a thinking-level picker only where the model supports it, and a
/// masked credential field routed to host storage. Hosts embed and restyle it;
/// it holds no secrets and performs no provider calls beyond discovery.
///
/// Credentials are scoped per provider: switching providers clears the typed
/// secret and the credential reference so one provider's key can never be
/// sent to another by a later refresh or save.
public struct HudConversationSettingsSample: View {
    public struct Store {
        public var saveCredential: @Sendable (String, String) -> Void
        public var saveConfiguration: @Sendable (HudConversationConfiguration) -> Void
        public init(saveCredential: @escaping @Sendable (String, String) -> Void,
                    saveConfiguration: @escaping @Sendable (HudConversationConfiguration) -> Void) {
            self.saveCredential = saveCredential
            self.saveConfiguration = saveConfiguration
        }
    }

    private let adapters: [any HudConversationAdapter]
    private let store: Store
    @State private var configuration: HudConversationConfiguration
    @State private var entries: [HudConversationModelCatalog.Entry] = []
    @State private var status = ""
    @State private var secret = ""
    @State private var refreshID = UUID()
    @State private var refreshing = false
    @State private var importing = false
    @State private var importID = UUID()

    public init(adapters: [any HudConversationAdapter], saved: HudConversationConfiguration, store: Store) {
        self.adapters = adapters
        self.store = store
        _configuration = State(initialValue: saved)
    }

    private var adapter: (any HudConversationAdapter)? {
        adapters.first { $0.descriptor.id == configuration.providerID }
    }

    private var selectedModel: HudConversationModelCatalog.Entry? {
        entries.first { $0.descriptor.id == configuration.modelID }
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Picker("Assistant", selection: Binding(
                get: { configuration.providerID.rawValue },
                set: { switchProvider(to: $0) })) {
                ForEach(adapters, id: \.descriptor.id) { adapter in
                    Text(adapter.descriptor.displayName).tag(adapter.descriptor.id.rawValue)
                }
            }
            .fixedSize()

            HStack(spacing: 8) {
                Picker("Model", selection: Binding(
                    get: { configuration.modelID.rawValue },
                    set: { switchModel(to: $0) })) {
                    if configuration.modelID.rawValue.isEmpty { Text("Choose a model").tag("") }
                    ForEach(entries, id: \.descriptor.id) { entry in
                        Text(entry.available ? entry.descriptor.displayName
                             : "\(entry.descriptor.displayName) (unavailable)")
                            .tag(entry.descriptor.id.rawValue)
                    }
                }
                .fixedSize()
                Button("Refresh Models") { Task { await refresh() } }.disabled(refreshing)
                if refreshing { ProgressView().controlSize(.small) }
            }
            if let notes = selectedModel?.descriptor.notes {
                Text(notes).font(.caption).foregroundStyle(.secondary)
            }

            if selectedModel?.descriptor.configurableThinking == .supported {
                Picker("Reasoning", selection: Binding(
                    get: { configuration.thinkingLevel },
                    set: { configuration.thinkingLevel = $0 })) {
                    Text("Default").tag(HudConversationThinkingLevel?.none)
                    Text("Low").tag(HudConversationThinkingLevel?.some(.low))
                    Text("Medium").tag(HudConversationThinkingLevel?.some(.medium))
                    Text("High").tag(HudConversationThinkingLevel?.some(.high))
                }
                .fixedSize()
            }

            LabeledContent("Saved key name") {
                TextField("Saved key name", text: Binding(
                    get: { configuration.credentialReference?.identifier ?? "" },
                    set: { configuration.credentialReference = $0.isEmpty ? nil : .init(identifier: $0) }))
                    .labelsHidden()
                    .frame(maxWidth: 240)
            }
            LabeledContent("API key") {
                SecureField("API key", text: $secret, prompt: Text("Leave blank to keep the saved key"))
                    .labelsHidden()
                    .frame(maxWidth: 240)
            }

            HStack(spacing: 8) {
                Button("Save") { save() }
                Button("Import Settings…") { importing = true }
                if !status.isEmpty {
                    Text(status).font(.caption).foregroundStyle(.secondary)
                }
            }
        }
        .task { await refresh() }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.json]) { result in
            switch result {
            case .success(let url):
                Task { await importSettings(from: url) }
            case .failure:
                status = "Could not open the settings file."
            }
        }
    }

    /// Import stages a configuration only: nothing here saves, connects, or
    /// grants anything. A failed import changes the status line and nothing
    /// else — prior settings, the typed secret, and stored credentials stay
    /// untouched. Save remains the explicit path that persists.
    private func importSettings(from url: URL) async {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        // One in-flight import at a time; provider switches and newer imports
        // invalidate an older one so a stale result cannot overwrite later
        // choices.
        let ticket = UUID()
        importID = ticket
        let staged: HudConversationSettingsImport.Staged
        do {
            // Bounded read: at most the cap plus one byte ever enters memory,
            // whatever the file's actual size.
            guard let handle = try? FileHandle(forReadingFrom: url) else {
                status = "Could not read the settings file."
                return
            }
            defer { try? handle.close() }
            guard let data = try? handle.read(upToCount: HudConversationSettingsImport.maximumBytes + 1) else {
                status = "Could not read the settings file."
                return
            }
            staged = try await HudConversationSettingsImport.importDocument(data)
        } catch let error as HudConversationError {
            switch error {
            case .invalidConfiguration(let reason), .unsupported(let reason):
                status = reason
            default:
                status = "The settings file could not be imported."
            }
            return
        } catch {
            status = "The settings file could not be imported."
            return
        }
        guard importID == ticket else { return }
        configuration = staged.configuration
        // The typed secret never survives an import; stored credentials are
        // only referenced by name and remain wherever the host keeps them.
        secret = ""
        refreshID = UUID()
        // No network from import: the imported model shows as a preserved
        // saved choice until the user refreshes the list themselves, and
        // Save stays the explicit path that persists.
        if let adapter = adapters.first(where: { $0.descriptor.id == staged.configuration.providerID }) {
            let catalog = HudConversationModelCatalog(adapter: adapter)
            entries = await catalog.entries(savedID: staged.configuration.modelID)
        } else {
            entries = []
        }
        status = "Imported. Review the settings and press Save to apply them."
    }

    private func switchProvider(to raw: String) {
        configuration.providerID = .init(rawValue: raw)
        configuration.modelID = .init(rawValue: "")
        configuration.thinkingLevel = nil
        // Voices, delegation payloads and credential kinds are provider-specific.
        configuration.voice = nil
        configuration.options = [:]
        configuration.credentialKind = .apiKey
        // Credentials never cross providers.
        configuration.credentialReference = nil
        secret = ""
        entries = []
        status = ""
        refreshID = UUID()
        importID = UUID()
        if let preferred = adapter?.descriptor.preferredInputAudio {
            configuration.inputAudio = preferred
        }
    }

    private func switchModel(to raw: String) {
        configuration.modelID = .init(rawValue: raw)
        let supportsThinking = selectedModel?.descriptor.configurableThinking == .supported
        if configuration.thinkingLevel != nil, !supportsThinking {
            configuration.thinkingLevel = nil
            status = "Reasoning level cleared: the selected model does not take one."
        }
    }

    private func refresh() async {
        guard let adapter, !refreshing else { return }
        let requestID = UUID()
        refreshID = requestID
        refreshing = true
        defer { refreshing = false }
        let requestedProvider = configuration.providerID
        let catalog = HudConversationModelCatalog(adapter: adapter)
        do {
            try await catalog.refresh(configuration: configuration)
            let fresh = await catalog.entries(savedID:
                configuration.modelID.rawValue.isEmpty ? nil : configuration.modelID)
            // A refresh answered for a superseded provider or request is stale.
            guard refreshID == requestID, configuration.providerID == requestedProvider else { return }
            entries = fresh
            status = ""
        } catch {
            guard refreshID == requestID, configuration.providerID == requestedProvider else { return }
            entries = await catalog.entries(savedID:
                configuration.modelID.rawValue.isEmpty ? nil : configuration.modelID)
            status = "Could not refresh the model list. Saved choices are kept."
        }
    }

    private func save() {
        guard !configuration.modelID.rawValue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            status = "Choose a model before saving."
            return
        }
        guard configuration.credentialReference != nil else {
            status = "Name the saved key before saving."
            return
        }
        if !secret.isEmpty, let reference = configuration.credentialReference {
            store.saveCredential(reference.identifier, secret)
            secret = ""
        }
        store.saveConfiguration(configuration)
        status = "Saved."
    }
}
