import Foundation

public enum HudPairingEndpointKind: String, Codable, Equatable, Sendable {
    case loopback
    case localNetwork
    case tailscale
    case remote
    case manual
}

public struct HudPairingEndpoint: Codable, Equatable, Identifiable, Sendable {
    public var id: String { "\(kind.rawValue):\(url.absoluteString)" }

    public var url: URL
    public var kind: HudPairingEndpointKind

    public init(url: URL, kind: HudPairingEndpointKind? = nil) {
        self.url = url
        self.kind = kind ?? HudPairingEndpoint.classify(url)
    }

    public static func classify(_ url: URL) -> HudPairingEndpointKind {
        guard let host = url.host, !host.isEmpty else {
            return .manual
        }
        return classify(host: host)
    }

    /// Classify a host without requiring providers to manufacture a URL. Shared
    /// consumers such as OpenScout use this to keep one LAN/Tailscale boundary.
    public static func classify(host rawHost: String) -> HudPairingEndpointKind {
        let host = rawHost.lowercased()
        guard !host.isEmpty else { return .manual }

        if host == "localhost" || host == "::1" {
            return .loopback
        }

        if host.hasSuffix(".ts.net") || host.hasSuffix(".tailscale.net") {
            return .tailscale
        }

        if host.hasSuffix(".local") {
            return .localNetwork
        }

        // Only classify an address-shaped host when the entire value is a
        // canonical dotted quad. Dropping malformed or trailing labels here
        // could promote an attacker-controlled hostname to a preferred route.
        if let pieces = strictIPv4Octets(host) {
            if pieces[0] == 127 { return .loopback }
            if pieces[0] == 169 && pieces[1] == 254 { return .localNetwork }
            if pieces[0] == 10 { return .localNetwork }
            if pieces[0] == 192 && pieces[1] == 168 { return .localNetwork }
            if pieces[0] == 172 && (16...31).contains(pieces[1]) { return .localNetwork }
            // Tailscale IPv4 addresses are allocated from CGNAT 100.64.0.0/10.
            if pieces[0] == 100 && (64...127).contains(pieces[1]) { return .tailscale }
        }

        return .remote
    }

    private static func strictIPv4Octets(_ host: String) -> [UInt8]? {
        let labels = host.split(separator: ".", omittingEmptySubsequences: false)
        guard labels.count == 4 else { return nil }

        var octets: [UInt8] = []
        octets.reserveCapacity(4)
        for label in labels {
            guard !label.isEmpty,
                  (label.count == 1 || label.first != "0"),
                  label.allSatisfy({ $0 >= "0" && $0 <= "9" }),
                  let octet = UInt8(label) else {
                return nil
            }
            octets.append(octet)
        }
        return octets
    }
}

public struct HudPairingPayload: Codable, Equatable, Sendable {
    public static let currentVersion = 1

    public var version: Int
    public var hostID: String
    public var hostName: String?
    public var displayName: String?
    public var baseURL: URL?
    public var localURL: URL?
    public var tailscaleURL: URL?
    public var publicKey: String?
    public var pairingCode: String?
    public var capabilities: [String]
    public var issuedAt: Date?
    public var expiresAt: Date?

    public init(
        version: Int = HudPairingPayload.currentVersion,
        hostID: String,
        hostName: String? = nil,
        displayName: String? = nil,
        baseURL: URL? = nil,
        localURL: URL? = nil,
        tailscaleURL: URL? = nil,
        publicKey: String? = nil,
        pairingCode: String? = nil,
        capabilities: [String] = [],
        issuedAt: Date? = nil,
        expiresAt: Date? = nil
    ) {
        self.version = version
        self.hostID = hostID
        self.hostName = hostName
        self.displayName = displayName
        self.baseURL = baseURL
        self.localURL = localURL
        self.tailscaleURL = tailscaleURL
        self.publicKey = publicKey
        self.pairingCode = pairingCode
        self.capabilities = capabilities
        self.issuedAt = issuedAt
        self.expiresAt = expiresAt
    }

    public var endpoints: [HudPairingEndpoint] {
        [
            baseURL.map { HudPairingEndpoint(url: $0) },
            localURL.map { HudPairingEndpoint(url: $0, kind: .localNetwork) },
            tailscaleURL.map { HudPairingEndpoint(url: $0, kind: .tailscale) },
        ]
        .compactMap { $0 }
        .deduplicatedByURL()
    }

    public func encodedPayload() throws -> String {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.sortedKeys]
        return try encoder.encode(self).base64URLEncodedString()
    }

    public func deepLinkURL(scheme: String = "hudson") throws -> URL {
        let payload = try encodedPayload()
        var components = URLComponents()
        components.scheme = scheme
        components.host = "pair"
        components.queryItems = [
            URLQueryItem(name: "payload", value: payload)
        ]
        guard let url = components.url else {
            throw HudPairingParseError.invalidPayload("Could not build pairing URL.")
        }
        return url
    }
}

public enum HudPairingSource: String, Codable, Equatable, Sendable {
    case deepLink
    case qr
    case payload
    case manual
}

public struct HudPairingCandidate: Equatable, Sendable {
    public var payload: HudPairingPayload?
    public var hostID: String?
    public var hostName: String?
    public var displayName: String?
    public var endpoints: [HudPairingEndpoint]
    public var publicKey: String?
    public var pairingCode: String?
    public var capabilities: [String]
    public var source: HudPairingSource
    public var rawValue: String?

    public init(
        payload: HudPairingPayload? = nil,
        hostID: String? = nil,
        hostName: String? = nil,
        displayName: String? = nil,
        endpoints: [HudPairingEndpoint] = [],
        publicKey: String? = nil,
        pairingCode: String? = nil,
        capabilities: [String] = [],
        source: HudPairingSource,
        rawValue: String? = nil
    ) {
        self.payload = payload
        self.hostID = hostID ?? payload?.hostID
        self.hostName = hostName ?? payload?.hostName
        self.displayName = displayName ?? payload?.displayName
        self.endpoints = ((payload?.endpoints ?? []) + endpoints).deduplicatedByURL()
        self.publicKey = publicKey ?? payload?.publicKey
        self.pairingCode = pairingCode ?? payload?.pairingCode
        self.capabilities = capabilities.isEmpty ? (payload?.capabilities ?? []) : capabilities
        self.source = source
        self.rawValue = rawValue
    }

    public var name: String {
        displayName ?? hostName ?? hostID ?? "Hudson Host"
    }

    public var primaryEndpoint: HudPairingEndpoint? {
        endpoints.first { $0.kind == .tailscale }
            ?? endpoints.first { $0.kind == .localNetwork }
            ?? endpoints.first
    }

    public static func from(_ deepLink: HudDeepLink) throws -> HudPairingCandidate? {
        guard case .pair(let routePayload) = deepLink.route else { return nil }

        let parameters = deepLink.parameters
        let payloadValue = firstValue(["payload"], in: parameters) ?? routePayload
        let payload = try payloadValue.flatMap(HudPairingPayload.decodeFlexiblePayload)

        let endpoints = [
            endpointValue(["url", "href", "baseUrl", "baseURL"], parameters, kind: nil),
            endpointValue(["localUrl", "localURL", "lanUrl", "lanURL"], parameters, kind: .localNetwork),
            endpointValue(["tailscaleUrl", "tailscaleURL", "tailnetUrl", "tailnetURL"], parameters, kind: .tailscale),
        ]
        .compactMap { $0 }

        let candidate = HudPairingCandidate(
            payload: payload,
            hostID: firstValue(["hostId", "hostID", "host_id", "id"], in: parameters),
            hostName: firstValue(["hostName", "host_name", "name"], in: parameters),
            displayName: firstValue(["displayName", "display_name"], in: parameters),
            endpoints: endpoints,
            publicKey: firstValue(["publicKey", "public_key", "key"], in: parameters),
            pairingCode: firstValue(["pairingCode", "pairing_code", "code", "token"], in: parameters),
            capabilities: capabilityValues(from: parameters),
            source: .deepLink,
            rawValue: deepLink.url.absoluteString
        )

        if candidate.hostID == nil,
           candidate.endpoints.isEmpty,
           candidate.publicKey == nil,
           candidate.pairingCode == nil,
           candidate.payload == nil {
            return nil
        }

        return candidate
    }

    public static func fromQRCode(_ content: String) throws -> HudPairingCandidate {
        let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw HudPairingParseError.emptyContent }

        if let url = URL(string: trimmed),
           let scheme = url.scheme?.lowercased(),
           HudDeepLink.acceptedSchemes.contains(scheme) {
            let link = try HudDeepLink.parse(url)
            guard let candidate = try HudPairingCandidate.from(link) else {
                throw HudPairingParseError.missingHost
            }
            return candidate
        }

        if let url = URL(string: trimmed),
           let scheme = url.scheme?.lowercased(),
           ["http", "https"].contains(scheme) {
            return HudPairingCandidate(
                hostID: url.host,
                endpoints: [HudPairingEndpoint(url: url)],
                source: .qr,
                rawValue: trimmed
            )
        }

        let payload = try HudPairingPayload.decodeFlexiblePayload(trimmed)
        return HudPairingCandidate(payload: payload, source: .payload, rawValue: trimmed)
    }

    public func trustedHost(pairedAt: Date = Date()) throws -> HudPairedHost {
        guard let hostID, !hostID.isEmpty else {
            throw HudPairingParseError.missingHost
        }

        return HudPairedHost(
            hostID: hostID,
            name: name,
            endpoints: endpoints,
            publicKey: publicKey,
            capabilities: capabilities,
            pairedAt: pairedAt
        )
    }
}

public struct HudPairedHost: Codable, Equatable, Identifiable, Sendable {
    public var id: String { hostID }

    public var hostID: String
    public var name: String
    public var endpoints: [HudPairingEndpoint]
    public var publicKey: String?
    public var capabilities: [String]
    public var pairedAt: Date
    public var lastSeenAt: Date?
    public var metadata: [String: String]

    public init(
        hostID: String,
        name: String,
        endpoints: [HudPairingEndpoint] = [],
        publicKey: String? = nil,
        capabilities: [String] = [],
        pairedAt: Date = Date(),
        lastSeenAt: Date? = nil,
        metadata: [String: String] = [:]
    ) {
        self.hostID = hostID
        self.name = name
        self.endpoints = endpoints.deduplicatedByURL()
        self.publicKey = publicKey
        self.capabilities = capabilities
        self.pairedAt = pairedAt
        self.lastSeenAt = lastSeenAt
        self.metadata = metadata
    }
}

public protocol HudPairingTrustStore: Sendable {
    func hosts() async throws -> [HudPairedHost]
    func host(id: String) async throws -> HudPairedHost?
    func trust(_ host: HudPairedHost) async throws
    func removeHost(id: String) async throws
    func removeAllHosts() async throws
}

public actor HudInMemoryPairingTrustStore: HudPairingTrustStore {
    private var hostsByID: [String: HudPairedHost]

    public init(hosts: [HudPairedHost] = []) {
        self.hostsByID = Dictionary(uniqueKeysWithValues: hosts.map { ($0.hostID, $0) })
    }

    public func hosts() async throws -> [HudPairedHost] {
        hostsByID.values.sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
    }

    public func host(id: String) async throws -> HudPairedHost? {
        hostsByID[id]
    }

    public func trust(_ host: HudPairedHost) async throws {
        hostsByID[host.hostID] = host
    }

    public func removeHost(id: String) async throws {
        hostsByID[id] = nil
    }

    public func removeAllHosts() async throws {
        hostsByID.removeAll()
    }
}

public enum HudPairingParseError: Error, Equatable, LocalizedError, Sendable {
    case emptyContent
    case invalidPayload(String)
    case invalidURL(String)
    case missingHost

    public var errorDescription: String? {
        switch self {
        case .emptyContent:
            return "The pairing payload is empty."
        case .invalidPayload(let value):
            return "The pairing payload could not be decoded: \(value)"
        case .invalidURL(let value):
            return "The pairing URL is invalid: \(value)"
        case .missingHost:
            return "The pairing payload does not include a host."
        }
    }
}

private extension HudPairingPayload {
    static func decodeFlexiblePayload(_ value: String) throws -> HudPairingPayload {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw HudPairingParseError.emptyContent }

        let data: Data
        if trimmed.hasPrefix("{") {
            guard let json = trimmed.data(using: .utf8) else {
                throw HudPairingParseError.invalidPayload(trimmed)
            }
            data = json
        } else if let decoded = Data(base64URLEncoded: trimmed) ?? Data(base64Encoded: trimmed) {
            data = decoded
        } else {
            throw HudPairingParseError.invalidPayload(trimmed)
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        do {
            return try decoder.decode(HudPairingPayload.self, from: data)
        } catch {
            throw HudPairingParseError.invalidPayload(error.localizedDescription)
        }
    }
}

private func firstValue(_ names: [String], in parameters: [String: String]) -> String? {
    for name in names {
        if let value = parameters[name], !value.isEmpty {
            return value
        }
    }
    return nil
}

private func endpointValue(
    _ names: [String],
    _ parameters: [String: String],
    kind: HudPairingEndpointKind?
) -> HudPairingEndpoint? {
    guard let value = firstValue(names, in: parameters) else { return nil }
    guard let url = URL(string: value) else { return nil }
    return HudPairingEndpoint(url: url, kind: kind)
}

private func capabilityValues(from parameters: [String: String]) -> [String] {
    guard let raw = firstValue(["capabilities", "caps"], in: parameters) else { return [] }
    return raw
        .split(separator: ",")
        .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        .filter { !$0.isEmpty }
}

private extension Array where Element == HudPairingEndpoint {
    func deduplicatedByURL() -> [HudPairingEndpoint] {
        var seen = Set<String>()
        var result: [HudPairingEndpoint] = []

        for endpoint in self {
            let key = endpoint.url.absoluteString
            guard !seen.contains(key) else { continue }
            seen.insert(key)
            result.append(endpoint)
        }

        return result
    }
}

private extension Data {
    init?(base64URLEncoded value: String) {
        var base64 = value
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        let remainder = base64.count % 4
        if remainder > 0 {
            base64 += String(repeating: "=", count: 4 - remainder)
        }
        self.init(base64Encoded: base64)
    }

    func base64URLEncodedString() -> String {
        base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}
