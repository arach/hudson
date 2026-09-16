import Foundation

/// Process-owned local model storage. Share one instance across local adapters.
/// A prepared value is evicted only when no lease is active. Native work must
/// stay inside `withResource`, or retain a lease for its entire session lifetime.
public actor HudTranscriptionLocalResources {
    private var resident: (key: String, value: any Sendable)?
    private var activity: UUID?
    private var preparingKey: String?

    public init() {}

    public func isPrepared(key: String) -> Bool { resident?.key == key }

    public func prepare<Resource: Sendable>(
        key: String,
        load: @Sendable () async throws -> Resource
    ) async throws -> HudTranscriptionReadiness {
        try Task.checkCancellation()
        if resident?.key == key { return .ready }
        guard activity == nil else { return Self.busy }
        let token = UUID()
        activity = token
        preparingKey = key
        // Release idle ownership before loading the next model. An active lease
        // prevents this path, including while cancelled native work drains.
        resident = nil
        defer {
            if activity == token { activity = nil; preparingKey = nil }
        }
        let value = try await load()
        try Task.checkCancellation()
        resident = (key, value)
        return .ready
    }

    public func preparationStatus(key: String) -> HudTranscriptionReadiness? {
        if resident?.key == key { return .ready }
        if preparingKey == key { return .init(status: .preparing) }
        if activity != nil { return Self.busy }
        return nil
    }

    public func withResource<Resource: Sendable, Result: Sendable>(
        key: String, as type: Resource.Type,
        body: @Sendable (Resource) async throws -> Result
    ) async throws -> Result {
        let (token, resource): (UUID, Resource) = try reserve(key: key)
        defer { release(token) }
        // Do not race cancellation against this await: an SDK can ignore
        // cancellation temporarily and still own GPU/model resources.
        let result = try await body(resource)
        try Task.checkCancellation()
        return result
    }

    /// For caller-fed sessions, retain the lease in every native inference
    /// closure. Dropping the last reference releases ownership asynchronously.
    public func lease<Resource: Sendable>(key: String, as type: Resource.Type) throws -> Lease<Resource> {
        let (token, resource): (UUID, Resource) = try reserve(key: key)
        return Lease(value: resource, owner: self, token: token)
    }

    /// Evicts only idle memory. It never deletes model files.
    @discardableResult
    public func unloadIfIdle() -> Bool {
        guard activity == nil else { return false }
        resident = nil
        return true
    }

    private func reserve<Resource: Sendable>(key: String) throws -> (UUID, Resource) {
        try Task.checkCancellation()
        guard activity == nil else { throw HudTranscriptionError.notReady(Self.busy) }
        guard let resident, resident.key == key, let value = resident.value as? Resource else {
            throw HudTranscriptionError.notReady(.init(status: .unconfigured, reason: "Prepare the selected local model before transcribing."))
        }
        let token = UUID()
        activity = token
        return (token, value)
    }

    private func release(_ token: UUID) {
        if activity == token { activity = nil }
    }

    private static var busy: HudTranscriptionReadiness {
        .init(status: .preparing, reason: "Another local model is loading or in use. Finish that operation before switching models.")
    }

    public final class Lease<Resource: Sendable>: Sendable {
        private let value: Resource
        private let owner: HudTranscriptionLocalResources
        private let token: UUID

        fileprivate init(value: Resource, owner: HudTranscriptionLocalResources, token: UUID) {
            self.value = value
            self.owner = owner
            self.token = token
        }

        public func withValue<Result: Sendable>(
            _ body: @Sendable (Resource) async throws -> Result
        ) async rethrows -> Result {
            defer { withExtendedLifetime(self) {} }
            return try await body(value)
        }

        deinit {
            let owner = owner
            let token = token
            Task { await owner.release(token) }
        }
    }
}
