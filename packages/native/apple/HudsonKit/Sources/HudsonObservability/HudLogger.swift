import OSLog

public enum HudLogLevel: String, Sendable {
    case debug
    case info
    case notice
    case warning
    case error
    case fault

    var osLogType: OSLogType {
        switch self {
        case .debug:
            return .debug
        case .info:
            return .info
        case .notice:
            return .default
        case .warning:
            return .error
        case .error:
            return .error
        case .fault:
            return .fault
        }
    }
}

public struct HudLogger: Sendable {
    public static let defaultSubsystem = "dev.hudson.kit"

    public let subsystem: String
    public let category: String

    private let logger: Logger

    public init(subsystem: String = Self.defaultSubsystem, category: String) {
        self.subsystem = subsystem
        self.category = category
        self.logger = Logger(subsystem: subsystem, category: category)
    }

    public static let observability = HudLogger(category: "observability")
    public static let ui = HudLogger(category: "ui")

    public func log(
        _ level: HudLogLevel,
        _ message: @autoclosure () -> String,
        metadata: @autoclosure () -> [String: String] = [:],
        file: StaticString = #fileID,
        line: UInt = #line
    ) {
        let renderedMessage = message()
        let renderedMetadata = Self.render(metadata())
        if renderedMetadata.isEmpty {
            logger.log(level: level.osLogType, "\(renderedMessage, privacy: .public)")
        } else if renderedMetadata.privateText.isEmpty {
            logger.log(level: level.osLogType, "\(renderedMessage, privacy: .public) \(renderedMetadata.publicText, privacy: .public)")
        } else if renderedMetadata.publicText.isEmpty {
            logger.log(level: level.osLogType, "\(renderedMessage, privacy: .public) \(renderedMetadata.privateText, privacy: .private)")
        } else {
            logger.log(level: level.osLogType, "\(renderedMessage, privacy: .public) \(renderedMetadata.publicText, privacy: .public) \(renderedMetadata.privateText, privacy: .private)")
        }
    }

    public func debug(_ message: @autoclosure () -> String, metadata: @autoclosure () -> [String: String] = [:], file: StaticString = #fileID, line: UInt = #line) {
        log(.debug, message(), metadata: metadata(), file: file, line: line)
    }

    public func info(_ message: @autoclosure () -> String, metadata: @autoclosure () -> [String: String] = [:], file: StaticString = #fileID, line: UInt = #line) {
        log(.info, message(), metadata: metadata(), file: file, line: line)
    }

    public func notice(_ message: @autoclosure () -> String, metadata: @autoclosure () -> [String: String] = [:], file: StaticString = #fileID, line: UInt = #line) {
        log(.notice, message(), metadata: metadata(), file: file, line: line)
    }

    public func warning(_ message: @autoclosure () -> String, metadata: @autoclosure () -> [String: String] = [:], file: StaticString = #fileID, line: UInt = #line) {
        log(.warning, message(), metadata: metadata(), file: file, line: line)
    }

    public func error(_ message: @autoclosure () -> String, metadata: @autoclosure () -> [String: String] = [:], file: StaticString = #fileID, line: UInt = #line) {
        log(.error, message(), metadata: metadata(), file: file, line: line)
    }

    public func fault(_ message: @autoclosure () -> String, metadata: @autoclosure () -> [String: String] = [:], file: StaticString = #fileID, line: UInt = #line) {
        log(.fault, message(), metadata: metadata(), file: file, line: line)
    }

    private static func render(_ metadata: [String: String]) -> RenderedMetadata {
        let sortedMetadata = metadata.sorted { $0.key < $1.key }
        let publicText = sortedMetadata
            .filter { publicMetadataKeys.contains($0.key) }
            .map { "\($0.key)=\($0.value)" }
            .joined(separator: " ")
        let privateText = sortedMetadata
            .filter { !publicMetadataKeys.contains($0.key) }
            .map { "\($0.key)=\($0.value)" }
            .joined(separator: " ")
        return RenderedMetadata(publicText: publicText, privateText: privateText)
    }

    private static let publicMetadataKeys: Set<String> = [
        "changed",
        "commandCount",
        "expanded",
        "expandedHeight",
        "filteredCount",
        "fromCollapsed",
        "fromExpanded",
        "fromOpen",
        "fromPresented",
        "hasCheckedHealth",
        "hasCommands",
        "hasHealth",
        "hasSession",
        "isCheckingHealth",
        "itemCount",
        "name",
        "outcome",
        "presented",
        "queryActive",
        "reason",
        "state",
        "status",
        "toCollapsed",
        "toExpanded",
        "toOpen",
        "toPresented",
        "unit",
        "value",
    ]
}

private struct RenderedMetadata {
    let publicText: String
    let privateText: String

    var isEmpty: Bool {
        publicText.isEmpty && privateText.isEmpty
    }
}
