import OSLog

public struct HudTrace: Sendable {
    public let subsystem: String
    public let category: String

    private let signposter: OSSignposter
    private let logger: HudLogger

    public init(subsystem: String = HudLogger.defaultSubsystem, category: String) {
        self.subsystem = subsystem
        self.category = category
        self.signposter = OSSignposter(subsystem: subsystem, category: category)
        self.logger = HudLogger(subsystem: subsystem, category: category)
    }

    public static let observability = HudTrace(category: "observability")
    public static let ui = HudTrace(category: "ui")

    @discardableResult
    public func span<T>(
        _ name: StaticString,
        metadata: [String: String] = [:],
        _ operation: () throws -> T
    ) rethrows -> T {
        let span = beginSpan(name, metadata: metadata)
        do {
            let result = try operation()
            span.end()
            return result
        } catch {
            span.end("error")
            logger.error("span.error", metadata: metadata.merging(["error": String(describing: error)], uniquingKeysWith: { current, _ in current }))
            throw error
        }
    }

    public func beginSpan(_ name: StaticString, metadata: [String: String] = [:]) -> HudSpan {
        let id = signposter.makeSignpostID()
        let state = signposter.beginInterval(name, id: id)
        if metadata.isEmpty {
            logger.debug("span.begin", metadata: ["name": "\(name)"])
        } else {
            logger.debug("span.begin", metadata: metadata.merging(["name": "\(name)"], uniquingKeysWith: { current, _ in current }))
        }
        return HudSpan(name: name, signposter: signposter, state: state, logger: logger, metadata: metadata)
    }

    public func event(_ name: StaticString, metadata: [String: String] = [:]) {
        let id = signposter.makeSignpostID()
        signposter.emitEvent(name, id: id)
        logger.debug("trace.event", metadata: metadata.merging(["name": "\(name)"], uniquingKeysWith: { current, _ in current }))
    }
}

public struct HudSpan: Sendable {
    public let name: StaticString

    private let signposter: OSSignposter
    private let state: OSSignpostIntervalState
    private let logger: HudLogger
    private let metadata: [String: String]

    init(
        name: StaticString,
        signposter: OSSignposter,
        state: OSSignpostIntervalState,
        logger: HudLogger,
        metadata: [String: String]
    ) {
        self.name = name
        self.signposter = signposter
        self.state = state
        self.logger = logger
        self.metadata = metadata
    }

    public func end(_ outcome: String = "ok") {
        signposter.endInterval(name, state)
        logger.debug("span.end", metadata: metadata.merging(["name": "\(name)", "outcome": outcome], uniquingKeysWith: { current, _ in current }))
    }
}
