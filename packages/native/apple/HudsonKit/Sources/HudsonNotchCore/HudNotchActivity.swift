import Foundation

/// Where a piece of background work stands. The state decides how the notch
/// treats the activity: `working` and `waiting` stay on the stage until they
/// change, the rest peek and then settle into history.
public enum HudNotchActivityState: String, CaseIterable, Codable, Equatable, Sendable {
    /// A one-off notice with no lifecycle.
    case notice
    /// Work in progress. Updates to it do not re-open the notch.
    case working
    /// The work is blocked on the person: a choice, a reply, or both.
    case waiting
    case done
    case failed

    /// States that stay on the stage until the sender changes or dismisses them.
    public var isOngoing: Bool {
        self == .working || self == .waiting
    }

    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self).lowercased()
        self = HudNotchActivityState(rawValue: raw) ?? .notice
    }
}

/// Color family for an activity. Defaults from the state; a sender can override it.
public enum HudNotchTone: String, CaseIterable, Codable, Equatable, Sendable {
    case info
    case success
    case warning
    case error

    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self).lowercased()
        self = HudNotchTone(rawValue: raw) ?? .info
    }

    public static func `default`(for state: HudNotchActivityState) -> HudNotchTone {
        switch state {
        case .notice, .working: return .info
        case .waiting: return .warning
        case .done: return .success
        case .failed: return .error
        }
    }
}

/// One button on a waiting activity. The `id` comes back in the reply.
public struct HudNotchChoice: Codable, Equatable, Hashable, Identifiable, Sendable {
    public enum Role: String, Codable, Equatable, Sendable {
        case primary
        case normal
        /// Dismisses without choosing, for example "Later".
        case cancel

        public init(from decoder: Decoder) throws {
            let raw = try decoder.singleValueContainer().decode(String.self).lowercased()
            self = Role(rawValue: raw) ?? .normal
        }
    }

    public var id: String
    public var title: String
    public var role: Role

    public init(id: String, title: String, role: Role = .normal) {
        self.id = id
        self.title = title
        self.role = role
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let title = try container.decode(String.self, forKey: .title)
        self.init(
            id: try container.decodeIfPresent(String.self, forKey: .id) ?? title,
            title: title,
            role: try container.decodeIfPresent(Role.self, forKey: .role) ?? .normal
        )
    }
}

/// A link the person can open from the activity.
public struct HudNotchLink: Codable, Equatable, Hashable, Sendable {
    public var title: String
    public var url: String

    public init(title: String, url: String) {
        self.title = title
        self.url = url
    }
}

/// The unit the notch shows: one piece of work from one sender, keyed by `id`.
/// Posting the same `id` again updates the activity in place.
public struct HudNotchActivity: Codable, Equatable, Identifiable, Sendable {
    public static let defaultTTL: TimeInterval = 6
    public static let minimumTTL: TimeInterval = 1.2
    /// Asks get longer to be read before the notch folds back to the pill.
    public static let askTTL: TimeInterval = 12

    public var id: String
    /// Who sent it, shown as the eyebrow ("Claude Code", "fab").
    public var source: String
    public var title: String
    public var detail: String?
    public var state: HudNotchActivityState
    public var tone: HudNotchTone
    /// 0...1 for determinate work; nil for indeterminate.
    public var progress: Double?
    public var choices: [HudNotchChoice]
    /// Placeholder for a free-text reply. Nil means no text field.
    public var replyPrompt: String?
    public var link: HudNotchLink?
    /// How long the notch stays open for this activity. Nil uses the default.
    public var ttl: TimeInterval?
    public var updatedAt: Date?

    public init(
        id: String = UUID().uuidString,
        source: String = "local",
        title: String,
        detail: String? = nil,
        state: HudNotchActivityState = .notice,
        tone: HudNotchTone? = nil,
        progress: Double? = nil,
        choices: [HudNotchChoice] = [],
        replyPrompt: String? = nil,
        link: HudNotchLink? = nil,
        ttl: TimeInterval? = nil,
        updatedAt: Date? = nil
    ) {
        self.id = id.trimmed.nonEmpty ?? UUID().uuidString
        self.source = source.trimmed.nonEmpty ?? "local"
        self.title = title.trimmed.nonEmpty ?? "Update"
        self.detail = detail?.trimmed.nonEmpty
        self.state = state
        self.tone = tone ?? .default(for: state)
        self.progress = progress.map { min(max($0, 0), 1) }
        self.choices = choices
        self.replyPrompt = replyPrompt?.trimmed.nonEmpty
        self.link = link
        self.ttl = ttl
        self.updatedAt = updatedAt
    }

    /// True when the person can answer from the notch.
    public var asksForInput: Bool {
        !choices.isEmpty || replyPrompt != nil
    }

    /// How long the notch stays open after this activity arrives.
    public var peekDuration: TimeInterval {
        max(Self.minimumTTL, ttl ?? (asksForInput ? Self.askTTL : Self.defaultTTL))
    }

    // MARK: Codable

    enum CodingKeys: String, CodingKey {
        case id, source, title, detail, state, tone, progress, choices, replyPrompt, link, ttl, updatedAt
        // Accepted on input for senders written against the older event shape.
        case body, level, action, agent, kind
    }

    private struct LegacyAgent: Decodable {
        var name: String?
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let legacyLevel = try c.decodeIfPresent(HudNotchTone.self, forKey: .level)
        let explicitState = try c.decodeIfPresent(HudNotchActivityState.self, forKey: .state)
        let agentName = try c.decodeIfPresent(LegacyAgent.self, forKey: .agent)?.name?.trimmed.nonEmpty
        let choices = try c.decodeIfPresent([HudNotchChoice].self, forKey: .choices) ?? []
        let replyPrompt = try c.decodeIfPresent(String.self, forKey: .replyPrompt)

        let state = explicitState ?? Self.inferredState(
            level: legacyLevel,
            asksForInput: !choices.isEmpty || replyPrompt != nil
        )

        self.init(
            id: try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString,
            source: try agentName ?? c.decodeIfPresent(String.self, forKey: .source) ?? "local",
            title: try c.decodeIfPresent(String.self, forKey: .title) ?? "Update",
            detail: try c.decodeIfPresent(String.self, forKey: .detail)
                ?? (try c.decodeIfPresent(String.self, forKey: .body)),
            state: state,
            tone: try c.decodeIfPresent(HudNotchTone.self, forKey: .tone) ?? legacyLevel,
            progress: try c.decodeIfPresent(Double.self, forKey: .progress),
            choices: choices,
            replyPrompt: replyPrompt,
            link: try c.decodeIfPresent(HudNotchLink.self, forKey: .link)
                ?? (try c.decodeIfPresent(HudNotchLink.self, forKey: .action)),
            ttl: try c.decodeIfPresent(TimeInterval.self, forKey: .ttl),
            updatedAt: try c.decodeIfPresent(Date.self, forKey: .updatedAt)
        )
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(source, forKey: .source)
        try c.encode(title, forKey: .title)
        try c.encodeIfPresent(detail, forKey: .detail)
        try c.encode(state, forKey: .state)
        try c.encode(tone, forKey: .tone)
        try c.encodeIfPresent(progress, forKey: .progress)
        if !choices.isEmpty { try c.encode(choices, forKey: .choices) }
        try c.encodeIfPresent(replyPrompt, forKey: .replyPrompt)
        try c.encodeIfPresent(link, forKey: .link)
        try c.encodeIfPresent(ttl, forKey: .ttl)
        try c.encodeIfPresent(updatedAt, forKey: .updatedAt)
    }

    private static func inferredState(level: HudNotchTone?, asksForInput: Bool) -> HudNotchActivityState {
        if asksForInput { return .waiting }
        switch level {
        case .success: return .done
        case .error: return .failed
        default: return .notice
        }
    }
}

extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
    var nonEmpty: String? { isEmpty ? nil : self }
}
