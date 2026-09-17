import Foundation

/// Host-facing model list built from provider discovery, with refresh and
/// honest handling of saved identifiers the catalog no longer returns.
public actor HudConversationModelCatalog {
    public struct Entry: Sendable, Equatable {
        public var descriptor: HudConversationModelDescriptor
        /// False for a saved identifier that discovery did not return: it is
        /// preserved and selectable-as-saved, never silently substituted.
        public var available: Bool
    }

    private let adapter: any HudConversationAdapter
    private var cached: [HudConversationModelDescriptor] = []
    private var fetchedAt: Date?

    public init(adapter: any HudConversationAdapter) {
        self.adapter = adapter
    }

    public var lastRefreshed: Date? { fetchedAt }

    /// Fetch the provider catalog again. Failures propagate; the previous
    /// catalog is kept so a failed refresh does not erase known models.
    public func refresh(configuration: HudConversationConfiguration) async throws {
        cached = try await adapter.models(configuration: configuration)
        fetchedAt = Date()
    }

    /// Current entries plus, when `savedID` is missing from discovery, one
    /// unavailable entry that preserves the saved choice.
    public func entries(savedID: HudConversationModelID?) -> [Entry] {
        var entries = cached.map { Entry(descriptor: $0, available: true) }
        if let savedID, !cached.contains(where: { $0.id == savedID }) {
            entries.append(Entry(descriptor: .init(
                id: savedID,
                displayName: savedID.rawValue,
                notes: "Saved model not present in the current provider catalog. Compatibility is unverified.",
                discovered: false), available: false))
        }
        return entries
    }
}
