import Foundation
#if canImport(Combine)
import Combine
#endif

public struct HudLogEntry: Identifiable, Sendable {
    public let id: UUID
    public let timestamp: Date
    public let level: HudLogLevel
    public let subsystem: String
    public let category: String
    public let message: String
    public let metadata: [String: String]

    public init(
        id: UUID = UUID(),
        timestamp: Date = Date(),
        level: HudLogLevel,
        subsystem: String,
        category: String,
        message: String,
        metadata: [String: String] = [:]
    ) {
        self.id = id
        self.timestamp = timestamp
        self.level = level
        self.subsystem = subsystem
        self.category = category
        self.message = message
        self.metadata = metadata
    }

    public var formattedTime: String {
        Self.timeFormatter.string(from: timestamp)
    }

    private static let timeFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "HH:mm:ss.SSS"
        return f
    }()
}

public protocol HudLogSink: AnyObject, Sendable {
    func capture(_ entry: HudLogEntry)
}

/// Registry that bridges `HudLogger` writes into in-process sinks.
/// Production code installs no sinks (zero overhead). Demo / dev-tools install
/// `HudLogStore.shared` (or a custom sink) at app boot.
public enum HudLoggerSinks {
    private static let lock = NSLock()
    nonisolated(unsafe) private static var sinks: [HudLogSink] = []

    public static func install(_ sink: HudLogSink) {
        lock.lock(); defer { lock.unlock() }
        if !sinks.contains(where: { $0 === sink }) {
            sinks.append(sink)
        }
    }

    public static func remove(_ sink: HudLogSink) {
        lock.lock(); defer { lock.unlock() }
        sinks.removeAll { $0 === sink }
    }

    public static func removeAll() {
        lock.lock(); defer { lock.unlock() }
        sinks.removeAll()
    }

    static func emit(
        level: HudLogLevel,
        subsystem: String,
        category: String,
        message: String,
        metadata: [String: String]
    ) {
        lock.lock()
        let snapshot = sinks
        lock.unlock()
        guard !snapshot.isEmpty else { return }
        let entry = HudLogEntry(
            level: level,
            subsystem: subsystem,
            category: category,
            message: message,
            metadata: metadata
        )
        for sink in snapshot { sink.capture(entry) }
    }
}

#if canImport(Combine)

/// Bounded in-memory log buffer. Conforms to `HudLogSink` so it can subscribe
/// to `HudLogger` writes via `HudLoggerSinks.install(.shared)`. Drives the
/// settings-tab live log inspector in `HudsonKitDemo` and consumer apps.
@MainActor
public final class HudLogStore: ObservableObject, HudLogSink {
    public static let shared = HudLogStore()

    @Published public private(set) var entries: [HudLogEntry] = []

    public let capacity: Int

    public init(capacity: Int = 500) {
        self.capacity = capacity
    }

    public nonisolated func capture(_ entry: HudLogEntry) {
        Task { @MainActor in
            self.append(entry)
        }
    }

    public func append(_ entry: HudLogEntry) {
        entries.append(entry)
        if entries.count > capacity {
            entries.removeFirst(entries.count - capacity)
        }
    }

    public func clear() {
        entries.removeAll()
    }

    public var importantEntries: [HudLogEntry] {
        entries.filter { $0.level == .warning || $0.level == .error || $0.level == .fault }
    }

    public var debugEntries: [HudLogEntry] {
        entries.filter { $0.level == .debug }
    }

    public var summary: HudLogSummary {
        HudLogSummary(
            total: entries.count,
            warnings: entries.filter { $0.level == .warning }.count,
            errors: entries.filter { $0.level == .error || $0.level == .fault }.count,
            lastEntry: entries.last
        )
    }

    /// Append a log line without routing through `HudLogger` / OSLog. Useful for
    /// bridging app status surfaces (menu bar errors, restart traces) into the
    /// shared in-memory inspector.
    public func record(
        _ message: String,
        level: HudLogLevel = .notice,
        category: String = "app",
        subsystem: String = HudLogger.defaultSubsystem,
        metadata: [String: String] = [:]
    ) {
        append(
            HudLogEntry(
                level: level,
                subsystem: subsystem,
                category: category,
                message: message,
                metadata: metadata
            )
        )
    }
}

public struct HudLogSummary: Sendable {
    public let total: Int
    public let warnings: Int
    public let errors: Int
    public let lastEntry: HudLogEntry?

    public init(total: Int, warnings: Int, errors: Int, lastEntry: HudLogEntry?) {
        self.total = total
        self.warnings = warnings
        self.errors = errors
        self.lastEntry = lastEntry
    }

    public var tone: HudLogSummaryTone {
        if errors > 0 { return .error }
        if warnings > 0 { return .warning }
        return .ok
    }
}

public enum HudLogSummaryTone: Sendable {
    case ok
    case warning
    case error
}

#endif
