import Foundation

/// An extensible route category used by Hudson's connection orchestrator.
///
/// Built-in values mirror `HudPairingEndpointKind`. Apps and integrations can
/// add provider-owned values such as `openscout-network` without forcing that
/// product vocabulary into Hudson itself.
public struct HudConnectionRouteKind: RawRepresentable, Codable, Hashable, Sendable {
    public var rawValue: String

    public init(rawValue: String) {
        self.rawValue = rawValue
    }

    public static let loopback = HudConnectionRouteKind(rawValue: "loopback")
    public static let localNetwork = HudConnectionRouteKind(rawValue: "local-network")
    public static let tailscale = HudConnectionRouteKind(rawValue: "tailscale")
    public static let remote = HudConnectionRouteKind(rawValue: "remote")
    public static let manual = HudConnectionRouteKind(rawValue: "manual")

    public init(_ endpointKind: HudPairingEndpointKind) {
        switch endpointKind {
        case .loopback: self = .loopback
        case .localNetwork: self = .localNetwork
        case .tailscale: self = .tailscale
        case .remote: self = .remote
        case .manual: self = .manual
        }
    }
}

/// One connectable route to a paired host, contributed by a route provider.
public struct HudConnectionRoute: Codable, Equatable, Identifiable, Sendable {
    public var id: String {
        "\(providerID)|\(kind.rawValue)|\(endpoint.url.absoluteString)"
    }

    public var endpoint: HudPairingEndpoint
    public var kind: HudConnectionRouteKind
    public var providerID: String
    public var metadata: [String: String]

    public init(
        endpoint: HudPairingEndpoint,
        kind: HudConnectionRouteKind? = nil,
        providerID: String,
        metadata: [String: String] = [:]
    ) {
        self.endpoint = endpoint
        self.kind = kind ?? HudConnectionRouteKind(endpoint.kind)
        self.providerID = providerID
        self.metadata = metadata
    }
}

/// Supplies routes for one paired host. Bonjour, Tailscale, OSN, and future
/// managed relays conform here while Hudson remains product-neutral.
public protocol HudConnectionRouteProvider: Sendable {
    var id: String { get }
    func routes(for host: HudPairedHost) async throws -> [HudConnectionRoute]
}

/// Exposes the endpoints already persisted on `HudPairedHost` as routes.
public struct HudPairedHostRouteProvider: HudConnectionRouteProvider {
    public let id: String

    public init(id: String = "paired-host") {
        self.id = id
    }

    public func routes(for host: HudPairedHost) async throws -> [HudConnectionRoute] {
        host.endpoints.map { endpoint in
            HudConnectionRoute(endpoint: endpoint, providerID: id)
        }
    }
}

public struct HudConnectionProviderFailure: Codable, Equatable, Sendable {
    public var providerID: String
    public var message: String

    public init(providerID: String, message: String) {
        self.providerID = providerID
        self.message = message
    }
}

/// A route inventory plus non-fatal provider failures for diagnostics.
public struct HudConnectionInventory: Codable, Equatable, Sendable {
    public var routes: [HudConnectionRoute]
    public var providerFailures: [HudConnectionProviderFailure]

    public init(
        routes: [HudConnectionRoute] = [],
        providerFailures: [HudConnectionProviderFailure] = []
    ) {
        self.routes = routes
        self.providerFailures = providerFailures
    }
}

/// Collects provider routes without allowing one unavailable provider to hide
/// viable routes from the rest of the cascade.
public struct HudConnectionRouteCatalog: Sendable {
    private let providers: [any HudConnectionRouteProvider]

    public init(providers: [any HudConnectionRouteProvider]) {
        self.providers = providers
    }

    public func inventory(for host: HudPairedHost) async -> HudConnectionInventory {
        var inventory = HudConnectionInventory()

        for provider in providers {
            do {
                let routes = try await provider.routes(for: host)
                inventory.routes.append(contentsOf: routes.map { route in
                    HudConnectionRoute(
                        endpoint: route.endpoint,
                        kind: route.kind,
                        providerID: provider.id,
                        metadata: route.metadata
                    )
                })
            } catch {
                inventory.providerFailures.append(
                    HudConnectionProviderFailure(
                        providerID: provider.id,
                        message: error.localizedDescription
                    )
                )
            }
        }

        return inventory
    }
}

/// App defaults for ordering and fallback. User choices and remembered success
/// live separately in `HudConnectionSettings`.
public struct HudConnectionPolicy: Codable, Equatable, Sendable {
    public var preferredRouteKinds: [HudConnectionRouteKind]
    public var defaultRouteEnabled: Bool
    public var promotesLastSuccessfulRoute: Bool
    public var attemptTimeout: TimeInterval?

    public init(
        preferredRouteKinds: [HudConnectionRouteKind],
        defaultRouteEnabled: Bool = true,
        promotesLastSuccessfulRoute: Bool = true,
        attemptTimeout: TimeInterval? = 5
    ) {
        self.preferredRouteKinds = preferredRouteKinds
        self.defaultRouteEnabled = defaultRouteEnabled
        self.promotesLastSuccessfulRoute = promotesLastSuccessfulRoute
        self.attemptTimeout = attemptTimeout
    }

    /// A same-network-first cascade suitable for companions such as Blink.
    public static let lanFirst = HudConnectionPolicy(
        preferredRouteKinds: [.loopback, .localNetwork, .tailscale, .remote, .manual]
    )

    /// A work-from-anywhere cascade that prefers a stable tailnet route.
    public static let tailscaleFirst = HudConnectionPolicy(
        preferredRouteKinds: [.loopback, .tailscale, .localNetwork, .remote, .manual]
    )
}

/// Persisted connection controls. Overrides are sparse: absent values inherit
/// the app's policy, allowing a provider such as OSN to remain opt-in without a
/// framework-owned OSN case.
public struct HudConnectionSettings: Codable, Equatable, Sendable {
    public var routeEnabled: [String: Bool]
    public var routeKindEnabled: [String: Bool]
    public var providerEnabled: [String: Bool]
    public var preferredRouteKinds: [HudConnectionRouteKind]
    public var lastSuccessfulRouteByHostID: [String: String]

    public init(
        routeEnabled: [String: Bool] = [:],
        routeKindEnabled: [String: Bool] = [:],
        providerEnabled: [String: Bool] = [:],
        preferredRouteKinds: [HudConnectionRouteKind] = [],
        lastSuccessfulRouteByHostID: [String: String] = [:]
    ) {
        self.routeEnabled = routeEnabled
        self.routeKindEnabled = routeKindEnabled
        self.providerEnabled = providerEnabled
        self.preferredRouteKinds = preferredRouteKinds
        self.lastSuccessfulRouteByHostID = lastSuccessfulRouteByHostID
    }

    public func allows(_ route: HudConnectionRoute, default defaultValue: Bool) -> Bool {
        if let enabled = routeEnabled[route.id] { return enabled }
        if let enabled = providerEnabled[route.providerID] { return enabled }
        if let enabled = routeKindEnabled[route.kind.rawValue] { return enabled }
        return defaultValue
    }

    public mutating func recordSuccess(_ route: HudConnectionRoute, hostID: String) {
        lastSuccessfulRouteByHostID[hostID] = route.id
    }
}

public protocol HudConnectionSettingsStore: Sendable {
    func load() async throws -> HudConnectionSettings
    func save(_ settings: HudConnectionSettings) async throws
}

public actor HudInMemoryConnectionSettingsStore: HudConnectionSettingsStore {
    private var settings: HudConnectionSettings

    public init(settings: HudConnectionSettings = HudConnectionSettings()) {
        self.settings = settings
    }

    public func load() async throws -> HudConnectionSettings {
        settings
    }

    public func save(_ settings: HudConnectionSettings) async throws {
        self.settings = settings
    }
}

/// JSON-backed connection settings scoped to one app namespace in UserDefaults.
public actor HudUserDefaultsConnectionSettingsStore: HudConnectionSettingsStore {
    private let userDefaults: UserDefaults
    private let key: String

    public init(namespace: String, userDefaults: UserDefaults = .standard) {
        self.userDefaults = userDefaults
        self.key = "hudson.connection.\(namespace).settings"
    }

    public func load() async throws -> HudConnectionSettings {
        guard let data = userDefaults.data(forKey: key) else {
            return HudConnectionSettings()
        }
        do {
            return try JSONDecoder().decode(HudConnectionSettings.self, from: data)
        } catch {
            throw HudConnectionSettingsStoreError.decodingFailed(error.localizedDescription)
        }
    }

    public func save(_ settings: HudConnectionSettings) async throws {
        do {
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.sortedKeys]
            userDefaults.set(try encoder.encode(settings), forKey: key)
        } catch {
            throw HudConnectionSettingsStoreError.encodingFailed(error.localizedDescription)
        }
    }
}

public enum HudConnectionSettingsStoreError: Error, LocalizedError, Equatable, Sendable {
    case encodingFailed(String)
    case decodingFailed(String)

    public var errorDescription: String? {
        switch self {
        case .encodingFailed(let detail):
            return "Connection settings could not be encoded: \(detail)"
        case .decodingFailed(let detail):
            return "Connection settings could not be decoded: \(detail)"
        }
    }
}

public enum HudConnectionPlanner {
    /// Filter, order, and URL-deduplicate routes using app policy, user consent,
    /// and the last route that worked for this host.
    public static func orderedRoutes(
        _ routes: [HudConnectionRoute],
        hostID: String,
        policy: HudConnectionPolicy,
        settings: HudConnectionSettings
    ) -> [HudConnectionRoute] {
        let allowed = routes.filter {
            settings.allows($0, default: policy.defaultRouteEnabled)
        }
        let preferredKinds = settings.preferredRouteKinds.isEmpty
            ? policy.preferredRouteKinds
            : settings.preferredRouteKinds
        var kindRanks: [HudConnectionRouteKind: Int] = [:]
        for (index, kind) in preferredKinds.enumerated() where kindRanks[kind] == nil {
            kindRanks[kind] = index
        }
        let rememberedRouteID = policy.promotesLastSuccessfulRoute
            ? settings.lastSuccessfulRouteByHostID[hostID]
            : nil

        let ordered = allowed.enumerated().sorted { lhs, rhs in
            let lhsRemembered = lhs.element.id == rememberedRouteID
            let rhsRemembered = rhs.element.id == rememberedRouteID
            if lhsRemembered != rhsRemembered { return lhsRemembered }

            let lhsRank = kindRanks[lhs.element.kind] ?? Int.max
            let rhsRank = kindRanks[rhs.element.kind] ?? Int.max
            if lhsRank != rhsRank { return lhsRank < rhsRank }
            return lhs.offset < rhs.offset
        }.map(\.element)

        var seenURLs = Set<String>()
        return ordered.filter { route in
            seenURLs.insert(route.endpoint.url.absoluteString).inserted
        }
    }
}

public enum HudConnectionAttemptOutcome: String, Codable, Equatable, Sendable {
    case succeeded
    case failed
    case timedOut
}

public struct HudConnectionAttempt: Codable, Equatable, Sendable {
    public var route: HudConnectionRoute
    public var outcome: HudConnectionAttemptOutcome
    public var startedAt: Date
    public var endedAt: Date
    public var message: String?

    public init(
        route: HudConnectionRoute,
        outcome: HudConnectionAttemptOutcome,
        startedAt: Date,
        endedAt: Date,
        message: String? = nil
    ) {
        self.route = route
        self.outcome = outcome
        self.startedAt = startedAt
        self.endedAt = endedAt
        self.message = message
    }
}

public struct HudConnectionResult<Connection: Sendable>: Sendable {
    public var connection: Connection
    public var route: HudConnectionRoute
    public var attempts: [HudConnectionAttempt]
    public var settingsPersistenceFailure: String?

    public init(
        connection: Connection,
        route: HudConnectionRoute,
        attempts: [HudConnectionAttempt],
        settingsPersistenceFailure: String? = nil
    ) {
        self.connection = connection
        self.route = route
        self.attempts = attempts
        self.settingsPersistenceFailure = settingsPersistenceFailure
    }
}

public enum HudConnectionCascadeError: Error, LocalizedError, Sendable {
    case noEnabledRoutes(hostID: String)
    case allRoutesFailed(hostID: String, attempts: [HudConnectionAttempt])

    public var errorDescription: String? {
        switch self {
        case .noEnabledRoutes(let hostID):
            return "No enabled connection routes are available for \(hostID)."
        case .allRoutesFailed(let hostID, let attempts):
            return "All \(attempts.count) connection routes failed for \(hostID)."
        }
    }
}

/// Runs an ordered route cascade and remembers the winner. The concrete
/// connection remains app-owned: HTTP, a Noise channel, or an OSN client can all
/// be attempted through the same orchestration layer.
public struct HudConnectionCascade: Sendable {
    public let policy: HudConnectionPolicy
    public let settingsStore: any HudConnectionSettingsStore

    public init(
        policy: HudConnectionPolicy,
        settingsStore: any HudConnectionSettingsStore
    ) {
        self.policy = policy
        self.settingsStore = settingsStore
    }

    public func connect<Connection: Sendable>(
        to host: HudPairedHost,
        routes: [HudConnectionRoute],
        attempt: @escaping @Sendable (HudConnectionRoute) async throws -> Connection
    ) async throws -> HudConnectionResult<Connection> {
        var settings = try await settingsStore.load()
        let orderedRoutes = HudConnectionPlanner.orderedRoutes(
            routes,
            hostID: host.hostID,
            policy: policy,
            settings: settings
        )
        guard !orderedRoutes.isEmpty else {
            throw HudConnectionCascadeError.noEnabledRoutes(hostID: host.hostID)
        }

        var attempts: [HudConnectionAttempt] = []
        for route in orderedRoutes {
            try Task.checkCancellation()
            let startedAt = Date()
            do {
                let connection = try await attemptRoute(route, operation: attempt)
                let endedAt = Date()
                attempts.append(
                    HudConnectionAttempt(
                        route: route,
                        outcome: .succeeded,
                        startedAt: startedAt,
                        endedAt: endedAt
                    )
                )
                settings.recordSuccess(route, hostID: host.hostID)

                var persistenceFailure: String?
                do {
                    try await settingsStore.save(settings)
                } catch {
                    persistenceFailure = error.localizedDescription
                }
                return HudConnectionResult(
                    connection: connection,
                    route: route,
                    attempts: attempts,
                    settingsPersistenceFailure: persistenceFailure
                )
            } catch {
                if error is CancellationError {
                    throw error
                }
                let outcome: HudConnectionAttemptOutcome = error is HudConnectionAttemptTimeout
                    ? .timedOut
                    : .failed
                attempts.append(
                    HudConnectionAttempt(
                        route: route,
                        outcome: outcome,
                        startedAt: startedAt,
                        endedAt: Date(),
                        message: error.localizedDescription
                    )
                )
            }
        }

        throw HudConnectionCascadeError.allRoutesFailed(
            hostID: host.hostID,
            attempts: attempts
        )
    }

    private func attemptRoute<Connection: Sendable>(
        _ route: HudConnectionRoute,
        operation: @escaping @Sendable (HudConnectionRoute) async throws -> Connection
    ) async throws -> Connection {
        guard let timeout = policy.attemptTimeout, timeout > 0 else {
            return try await operation(route)
        }

        return try await withThrowingTaskGroup(of: Connection.self) { group in
            group.addTask {
                try await operation(route)
            }
            group.addTask {
                let nanoseconds = UInt64(timeout * 1_000_000_000)
                try await Task.sleep(nanoseconds: nanoseconds)
                throw HudConnectionAttemptTimeout(routeID: route.id)
            }

            guard let first = try await group.next() else {
                throw HudConnectionAttemptTimeout(routeID: route.id)
            }
            group.cancelAll()
            return first
        }
    }
}

private struct HudConnectionAttemptTimeout: Error, LocalizedError, Sendable {
    let routeID: String

    var errorDescription: String? {
        "Connection route timed out: \(routeID)"
    }
}
