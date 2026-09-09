import Foundation
import Network

/// A Bonjour service advertised and discovered by ``HudNearbyListener`` and
/// ``HudNearbyBrowser``.
///
/// Hudson keeps this descriptor product-neutral. Apps choose their own
/// `_service._tcp` type and put only non-sensitive routing hints in metadata;
/// Bonjour TXT records are visible to every device on the local network.
@available(macOS 26.0, iOS 26.0, *)
public struct HudNearbyService: Equatable, Sendable {
    public var name: String?
    public var type: String
    /// Bonjour domain used for registration. Nearby transport is deliberately
    /// limited to the multicast-DNS `local.` domain; `nil`, blank, and local
    /// spelling variants are canonicalized to `local.`.
    public var domain: String?
    public var metadata: [String: String]

    public init(
        name: String? = nil,
        type: String,
        domain: String? = "local.",
        metadata: [String: String] = [:]
    ) {
        self.name = name
        self.type = type
        self.domain = normalized(domain) ?? "local."
        self.metadata = metadata
    }
}

/// One connectable Bonjour result. The underlying endpoint remains private so
/// callers cannot accidentally bypass Hudson's local-path policy and bounds.
@available(macOS 26.0, iOS 26.0, *)
public struct HudNearbyPeer: Equatable, Hashable, Identifiable, Sendable {
    public let id: String
    public let name: String
    public let type: String
    public let domain: String
    public let metadata: [String: String]

    fileprivate let endpoint: Bonjour.Endpoint

    fileprivate init(endpoint: Bonjour.Endpoint) {
        self.id = endpoint.id
        self.name = endpoint.name
        self.type = endpoint.type
        self.domain = endpoint.domain
        self.metadata = endpoint.txtRecord.dictionary
        self.endpoint = endpoint
    }

    public static func == (lhs: HudNearbyPeer, rhs: HudNearbyPeer) -> Bool {
        lhs.id == rhs.id
            && lhs.name == rhs.name
            && lhs.type == rhs.type
            && lhs.domain == rhs.domain
            && lhs.metadata == rhs.metadata
    }

    public func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
}

/// One framed application message. On the wire Hudson uses a one-byte type,
/// a two-byte unsigned length, then the payload bytes.
@available(macOS 26.0, iOS 26.0, *)
public struct HudNearbyMessage: Equatable, Sendable {
    public var type: UInt8
    public var payload: Data

    public init(type: UInt8, payload: Data) {
        self.type = type
        self.payload = payload
    }
}

/// Resource and routing policy shared by discovery, listeners, and
/// connections.
@available(macOS 26.0, iOS 26.0, *)
public struct HudNearbyTransportConfiguration: Equatable, Sendable {
    /// A UInt16 length field prevents a peer from declaring a frame larger
    /// than 65,535 bytes before the application can inspect it.
    public static let wireMaximumMessageBytes = Int(UInt16.max)

    /// Maximum TLV payload Hudson will emit or deliver to application code.
    /// The wire field can represent up to `UInt16.max`; a smaller application
    /// bound rejects unexpectedly large messages at the transport boundary.
    public var maximumMessageBytes: Int

    /// Deadline applied independently to every send and receive. `nil` opts
    /// into the task's surrounding lifetime only.
    public var operationTimeout: Duration?

    /// Optional budget of incoming connections to deliver before Network
    /// framework pauses the listener. `nil` keeps its default unlimited
    /// budget. This is a rate-control budget, not a concurrency count.
    public var newConnectionLimit: Int?

    /// Include peer-to-peer Wi-Fi interfaces in addition to infrastructure
    /// Wi-Fi. This does not replace application-level trust or approval.
    public var includesPeerToPeer: Bool

    public init(
        maximumMessageBytes: Int = HudNearbyTransportConfiguration.wireMaximumMessageBytes,
        operationTimeout: Duration? = .seconds(30),
        newConnectionLimit: Int? = nil,
        includesPeerToPeer: Bool = true
    ) {
        self.maximumMessageBytes = maximumMessageBytes
        self.operationTimeout = operationTimeout
        self.newConnectionLimit = newConnectionLimit
        self.includesPeerToPeer = includesPeerToPeer
    }
}

@available(macOS 26.0, iOS 26.0, *)
public enum HudNearbyTransportError: Error, Equatable, LocalizedError, Sendable {
    case invalidServiceType(String)
    case invalidServiceDomain(String)
    case invalidConfiguration(String)
    case messageTooLarge(actual: Int, maximum: Int)
    case malformedMessage(String)
    case timedOut(operation: String)

    public var errorDescription: String? {
        switch self {
        case .invalidServiceType(let type):
            return "Nearby service type \(type) must use the _service._tcp Bonjour form."
        case .invalidServiceDomain(let domain):
            return "Nearby service domain \(domain) must be the local. Bonjour domain."
        case .invalidConfiguration(let detail):
            return "Nearby transport configuration is invalid: \(detail)"
        case .messageTooLarge(let actual, let maximum):
            return "Nearby message is \(actual) bytes; the configured maximum is \(maximum) bytes."
        case .malformedMessage(let detail):
            return "Nearby message is malformed: \(detail)"
        case .timedOut(let operation):
            return "Nearby \(operation) timed out."
        }
    }
}

@available(macOS 26.0, iOS 26.0, *)
public enum HudNearbyBrowseAction: Equatable, Sendable {
    case continueBrowsing
    case finish
}

/// Structured Bonjour discovery. `run` remains active until its handler asks
/// to finish, throws, or its surrounding task is cancelled.
@available(macOS 26.0, iOS 26.0, *)
public struct HudNearbyBrowser: Sendable {
    public let serviceType: String
    /// Bonjour domain used for discovery. Nearby transport rejects any
    /// non-local domain before browsing begins.
    public let domain: String?
    public let includesPeerToPeer: Bool

    public init(
        serviceType: String,
        domain: String? = "local.",
        includesPeerToPeer: Bool = true
    ) {
        self.serviceType = serviceType
        self.domain = normalized(domain) ?? "local."
        self.includesPeerToPeer = includesPeerToPeer
    }

    public func run(
        _ handler: @escaping @Sendable ([HudNearbyPeer]) async throws -> HudNearbyBrowseAction
    ) async throws {
        try validateServiceType(serviceType)
        let localDomain = try validatedLocalBonjourDomain(domain)
        let browser = NetworkBrowser(
            for: .bonjour(serviceType, domain: localDomain, includeTxtRecord: true),
            using: nearbyNetworkParameters(includesPeerToPeer: includesPeerToPeer)
        )

        let _: Void = try await browser.run { endpoints in
            let peers = endpoints
                .map(HudNearbyPeer.init(endpoint:))
                .sorted(by: HudNearbyPeer.stableOrder)
            switch try await handler(peers) {
            case .continueBrowsing:
                return .continue
            case .finish:
                return .finish(())
            }
        }
    }

    /// Return the first discovered peer or throw a timeout error. Selection is
    /// deterministic when a browse update contains more than one peer.
    public func firstPeer(timeout: Duration = .seconds(5)) async throws -> HudNearbyPeer {
        try await firstPeer(timeout: timeout, matching: { _ in true })
    }

    /// Return the first peer accepted by `predicate`. Filtering happens before
    /// deterministic ordering, so an incompatible, earlier-sorting Bonjour
    /// result cannot mask a compatible device in the same browse update.
    public func firstPeer(
        timeout: Duration = .seconds(5),
        matching predicate: @escaping @Sendable (HudNearbyPeer) -> Bool
    ) async throws -> HudNearbyPeer {
        try validateServiceType(serviceType)
        let localDomain = try validatedLocalBonjourDomain(domain)
        return try await withNearbyTimeout(timeout, operation: "discovery") {
            let browser = NetworkBrowser(
                for: .bonjour(serviceType, domain: localDomain, includeTxtRecord: true),
                using: nearbyNetworkParameters(includesPeerToPeer: includesPeerToPeer)
            )
            return try await browser.run { endpoints in
                let peers = endpoints
                    .map(HudNearbyPeer.init(endpoint:))
                    .filter(predicate)
                    .sorted(by: HudNearbyPeer.stableOrder)
                guard let peer = peers.first else { return .continue }
                return .finish(peer)
            }
        }
    }
}

/// Advertises a Bonjour service and delivers every accepted TCP/TLV
/// connection in a child task managed by Network framework.
@available(macOS 26.0, iOS 26.0, *)
public struct HudNearbyListener: Sendable {
    public let service: HudNearbyService
    public let configuration: HudNearbyTransportConfiguration

    public init(
        service: HudNearbyService,
        configuration: HudNearbyTransportConfiguration = .init()
    ) {
        self.service = service
        self.configuration = configuration
    }

    public func run(
        _ handler: @escaping @Sendable (HudNearbyConnection) async throws -> Void
    ) async throws {
        try validateServiceType(service.type)
        let localDomain = try validatedLocalBonjourDomain(service.domain)
        try validate(configuration)

        let provider = BonjourListenerProvider(
            name: normalized(service.name),
            type: service.type,
            domain: localDomain,
            txtRecord: NWTXTRecord(service.metadata)
        )
        let listener = try NetworkListener(
            for: provider,
            using: nearbyProtocolParameters(configuration, limitsInboundToLocalLink: true)
        )
        if let limit = configuration.newConnectionLimit {
            listener.newConnectionLimit = limit
        }

        try await listener.run { connection in
            try await handler(
                HudNearbyConnection(connection: connection, configuration: configuration)
            )
        }
    }
}

/// Opens an outgoing connection to a discovered peer for the duration of the
/// handler. Leaving or cancelling the handler closes the underlying transport.
@available(macOS 26.0, iOS 26.0, *)
public struct HudNearbyConnector: Sendable {
    public let configuration: HudNearbyTransportConfiguration

    public init(configuration: HudNearbyTransportConfiguration = .init()) {
        self.configuration = configuration
    }

    public func run(
        to peer: HudNearbyPeer,
        _ handler: @escaping @Sendable (HudNearbyConnection) async throws -> Void
    ) async throws {
        try validate(configuration)
        let connection = NetworkConnection(
            to: peer.endpoint,
            using: nearbyProtocolParameters(configuration, limitsInboundToLocalLink: false)
        )
        try await handler(
            HudNearbyConnection(connection: connection, configuration: configuration)
        )
    }
}

/// A bounded Type-Length-Value message channel over TCP.
@available(macOS 26.0, iOS 26.0, *)
public final class HudNearbyConnection: @unchecked Sendable {
    public let remoteEndpointDescription: String?

    private let connection: NetworkConnection<TLV>
    private let maximumMessageBytes: Int
    private let operationTimeout: Duration?

    fileprivate init(
        connection: NetworkConnection<TLV>,
        configuration: HudNearbyTransportConfiguration
    ) {
        self.connection = connection
        self.maximumMessageBytes = configuration.maximumMessageBytes
        self.operationTimeout = configuration.operationTimeout
        self.remoteEndpointDescription = connection.remoteEndpoint?.debugDescription
    }

    public func send(_ message: HudNearbyMessage) async throws {
        try checkMessageSize(message.payload.count)
        try await withNearbyTimeout(operationTimeout, operation: "send") { [connection] in
            try await connection.send(
                message.payload,
                type: Int(message.type)
            )
        }
    }

    public func receive() async throws -> HudNearbyMessage {
        let received = try await withNearbyTimeout(
            operationTimeout,
            operation: "receive"
        ) { [connection] in
            try await connection.receive()
        }

        guard received.metadata.isComplete else {
            throw HudNearbyTransportError.malformedMessage("TLV frame was incomplete")
        }
        guard let type = UInt8(exactly: received.metadata.type) else {
            throw HudNearbyTransportError.malformedMessage(
                "type \(received.metadata.type) does not fit UInt8"
            )
        }
        // `TLV` has already consumed and validated its UInt16 frame length.
        // The metadata length is not the payload count on every supported 26.x
        // runtime, so enforce Hudson's bound against the delivered bytes.
        try checkMessageSize(received.content.count)

        return HudNearbyMessage(
            type: type,
            payload: received.content
        )
    }

    private func checkMessageSize(_ count: Int) throws {
        guard count <= maximumMessageBytes else {
            throw HudNearbyTransportError.messageTooLarge(
                actual: count,
                maximum: maximumMessageBytes
            )
        }
    }
}

@available(macOS 26.0, iOS 26.0, *)
private extension HudNearbyPeer {
    static func stableOrder(_ lhs: HudNearbyPeer, _ rhs: HudNearbyPeer) -> Bool {
        let nameOrder = lhs.name.localizedStandardCompare(rhs.name)
        if nameOrder != .orderedSame { return nameOrder == .orderedAscending }
        return lhs.id < rhs.id
    }
}

@available(macOS 26.0, iOS 26.0, *)
private func nearbyNetworkParameters(includesPeerToPeer: Bool) -> NWParameters {
    NWParameters()
        .peerToPeerIncluded(includesPeerToPeer)
        .noProxiesPreferred(true)
}

@available(macOS 26.0, iOS 26.0, *)
private func nearbyProtocolParameters(
    _ configuration: HudNearbyTransportConfiguration,
    limitsInboundToLocalLink: Bool
) -> NWParametersBuilder<TLV> {
    let parameters = NWParametersBuilder.parameters {
        TLV(type: UInt8.self, length: UInt16.self) {
            TCP().noDelay(true)
        }
    }
    .peerToPeerIncluded(configuration.includesPeerToPeer)
    .noProxiesPreferred(true)

    // `localOnly` is a listener policy: applying it to a browser or outgoing
    // connection is invalid on some Network.framework paths.
    return limitsInboundToLocalLink ? parameters.localOnly(true) : parameters
}

@available(macOS 26.0, iOS 26.0, *)
private func validate(_ configuration: HudNearbyTransportConfiguration) throws {
    guard configuration.maximumMessageBytes >= 0,
          configuration.maximumMessageBytes
            <= HudNearbyTransportConfiguration.wireMaximumMessageBytes else {
        throw HudNearbyTransportError.invalidConfiguration(
            "maximumMessageBytes must be between 0 and "
                + "\(HudNearbyTransportConfiguration.wireMaximumMessageBytes)"
        )
    }
    if let limit = configuration.newConnectionLimit {
        guard limit > 0, limit <= Int(UInt32.max) else {
            throw HudNearbyTransportError.invalidConfiguration(
                "newConnectionLimit must be between 1 and \(UInt32.max) when provided"
            )
        }
    }
    if let timeout = configuration.operationTimeout, timeout < .zero {
        throw HudNearbyTransportError.invalidConfiguration(
            "operationTimeout cannot be negative"
        )
    }
}

@available(macOS 26.0, iOS 26.0, *)
private func validateServiceType(_ type: String) throws {
    let labels = type.split(separator: ".", omittingEmptySubsequences: false)
    guard labels.count == 2,
          labels[0].first == "_",
          labels[0].utf8.count > 1,
          labels[0].utf8.count <= 15,
          labels[1] == "_tcp",
          labels[0].dropFirst().allSatisfy({
              $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "-")
          }) else {
        throw HudNearbyTransportError.invalidServiceType(type)
    }
}

private func normalized(_ value: String?) -> String? {
    guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines),
          !value.isEmpty else {
        return nil
    }
    return value
}

/// Resolve harmless spelling variants to the one domain allowed by Nearby.
/// Supplying `nil` must not fall through to the system's configured Bonjour
/// domains because those can include wide-area DNS-SD search domains.
private func validatedLocalBonjourDomain(_ value: String?) throws -> String {
    let candidate = normalized(value) ?? "local."
    let withoutTrailingDot = candidate.last == "."
        ? String(candidate.dropLast())
        : candidate
    guard withoutTrailingDot.caseInsensitiveCompare("local") == .orderedSame else {
        throw HudNearbyTransportError.invalidServiceDomain(candidate)
    }
    return "local."
}

private enum NearbyTimeoutResult<Value: Sendable>: Sendable {
    case value(Value)
    case timedOut
}

@available(macOS 26.0, iOS 26.0, *)
private func withNearbyTimeout<Value: Sendable>(
    _ timeout: Duration?,
    operation operationName: String,
    _ operation: @escaping @Sendable () async throws -> Value
) async throws -> Value {
    guard let timeout else { return try await operation() }
    guard timeout > .zero else {
        throw HudNearbyTransportError.timedOut(operation: operationName)
    }

    return try await withThrowingTaskGroup(of: NearbyTimeoutResult<Value>.self) { group in
        group.addTask {
            .value(try await operation())
        }
        group.addTask {
            try await ContinuousClock().sleep(for: timeout)
            return .timedOut
        }

        defer { group.cancelAll() }
        guard let first = try await group.next() else {
            throw CancellationError()
        }
        switch first {
        case .value(let value):
            return value
        case .timedOut:
            throw HudNearbyTransportError.timedOut(operation: operationName)
        }
    }
}
