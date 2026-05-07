import Foundation

/// Shared Hudson vocabulary for views backed by live, replayable, or watched
/// sources. Producers own transport and event generation; Hudson consumes this
/// normalized state to render consistent live-view chrome.
public enum HudLiveStatus: String, Codable, CaseIterable, Sendable {
    case connecting
    case replaying
    case live
    case stale
    case paused
    case error
    case offline

    public var label: String {
        switch self {
        case .connecting: "Connecting"
        case .replaying: "Replaying"
        case .live: "Live"
        case .stale: "Stale"
        case .paused: "Paused"
        case .error: "Error"
        case .offline: "Offline"
        }
    }

    public var isReceiving: Bool {
        switch self {
        case .connecting, .replaying, .live:
            true
        case .stale, .paused, .error, .offline:
            false
        }
    }

    public var requiresAttention: Bool {
        switch self {
        case .stale, .error, .offline:
            true
        case .connecting, .replaying, .live, .paused:
            false
        }
    }
}

public struct HudLiveCapabilities: Codable, Hashable, Sendable {
    public var snapshot: Bool
    public var replay: Bool
    public var pause: Bool
    public var resume: Bool

    public init(
        snapshot: Bool = true,
        replay: Bool = false,
        pause: Bool = false,
        resume: Bool = false
    ) {
        self.snapshot = snapshot
        self.replay = replay
        self.pause = pause
        self.resume = resume
    }

    public static let snapshotOnly = HudLiveCapabilities(snapshot: true)

    public static let replayable = HudLiveCapabilities(
        snapshot: true,
        replay: true,
        pause: false,
        resume: false
    )

    public static let controllable = HudLiveCapabilities(
        snapshot: true,
        replay: true,
        pause: true,
        resume: true
    )
}

public struct HudLiveEvent: Identifiable, Codable, Hashable, Sendable {
    public var id: String
    public var sourceID: String
    public var cursor: String
    public var timestamp: Date
    public var kind: String
    public var summary: String?
    public var metadata: [String: String]

    public init(
        id: String,
        sourceID: String,
        cursor: String? = nil,
        timestamp: Date = Date(),
        kind: String,
        summary: String? = nil,
        metadata: [String: String] = [:]
    ) {
        self.id = id
        self.sourceID = sourceID
        self.cursor = cursor ?? id
        self.timestamp = timestamp
        self.kind = kind
        self.summary = summary
        self.metadata = metadata
    }
}

public struct HudLiveSourceDescriptor: Identifiable, Codable, Hashable, Sendable {
    public var id: String
    public var label: String
    public var kind: String
    public var status: HudLiveStatus
    public var detail: String?
    public var cursor: String?
    public var lastEventAt: Date?
    public var lastEventSummary: String?
    public var capabilities: HudLiveCapabilities
    public var metadata: [String: String]

    public init(
        id: String,
        label: String,
        kind: String,
        status: HudLiveStatus = .connecting,
        detail: String? = nil,
        cursor: String? = nil,
        lastEventAt: Date? = nil,
        lastEventSummary: String? = nil,
        capabilities: HudLiveCapabilities = .snapshotOnly,
        metadata: [String: String] = [:]
    ) {
        self.id = id
        self.label = label
        self.kind = kind
        self.status = status
        self.detail = detail
        self.cursor = cursor
        self.lastEventAt = lastEventAt
        self.lastEventSummary = lastEventSummary
        self.capabilities = capabilities
        self.metadata = metadata
    }

    public func receiving(_ event: HudLiveEvent, status: HudLiveStatus = .live) -> HudLiveSourceDescriptor {
        var copy = self
        copy.status = status
        copy.cursor = event.cursor
        copy.lastEventAt = event.timestamp
        copy.lastEventSummary = event.summary
        return copy
    }

    public func updatingStatus(
        _ status: HudLiveStatus,
        detail: String? = nil,
        at date: Date? = nil
    ) -> HudLiveSourceDescriptor {
        var copy = self
        copy.status = status
        if let detail {
            copy.detail = detail
        }
        if let date {
            copy.lastEventAt = date
        }
        return copy
    }
}

public struct HudLiveSnapshot: Codable, Hashable, Sendable {
    public var source: HudLiveSourceDescriptor
    public var generatedAt: Date
    public var cursor: String?
    public var eventCount: Int
    public var summary: String?
    public var metadata: [String: String]

    public init(
        source: HudLiveSourceDescriptor,
        generatedAt: Date = Date(),
        cursor: String? = nil,
        eventCount: Int = 0,
        summary: String? = nil,
        metadata: [String: String] = [:]
    ) {
        self.source = source
        self.generatedAt = generatedAt
        self.cursor = cursor ?? source.cursor
        self.eventCount = eventCount
        self.summary = summary
        self.metadata = metadata
    }
}

public protocol HudLiveSource: Sendable {
    var descriptor: HudLiveSourceDescriptor { get }

    func snapshot() async throws -> HudLiveSnapshot
    func events(since cursor: String?) -> AsyncThrowingStream<HudLiveEvent, Error>
}
