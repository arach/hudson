public struct HudInstrumentation: Sendable {
    public let trace: HudTrace
    public let logger: HudLogger

    public init(trace: HudTrace, logger: HudLogger) {
        self.trace = trace
        self.logger = logger
    }

    public init(subsystem: String = HudLogger.defaultSubsystem, category: String) {
        self.trace = HudTrace(subsystem: subsystem, category: category)
        self.logger = HudLogger(subsystem: subsystem, category: category)
    }

    public static let observability = HudInstrumentation(category: "observability")
    public static let ui = HudInstrumentation(category: "ui")

    public func event(_ name: StaticString, metadata: [String: String] = [:]) {
        trace.event(name, metadata: metadata)
    }

    @discardableResult
    public func span<T>(
        _ name: StaticString,
        metadata: [String: String] = [:],
        _ operation: () throws -> T
    ) rethrows -> T {
        let span = trace.beginSpan(name, metadata: metadata)
        do {
            let result = try operation()
            span.end()
            return result
        } catch {
            span.end("error")
            logger.error("span.error", metadata: spanErrorMetadata(name, metadata: metadata))
            throw error
        }
    }

    @discardableResult
    public func span<T>(
        _ name: StaticString,
        metadata: [String: String] = [:],
        _ operation: () async throws -> T
    ) async rethrows -> T {
        let span = trace.beginSpan(name, metadata: metadata)
        do {
            let result = try await operation()
            span.end()
            return result
        } catch {
            span.end("error")
            logger.error("span.error", metadata: spanErrorMetadata(name, metadata: metadata))
            throw error
        }
    }

    public func beginSpan(_ name: StaticString, metadata: [String: String] = [:]) -> HudSpan {
        trace.beginSpan(name, metadata: metadata)
    }

    public func metric(
        _ name: String,
        _ value: Double = 1,
        unit: HudMetricUnit = .count,
        metadata: [String: String] = [:]
    ) {
        HudMetric(name, unit: unit).record(value, logger: logger, metadata: metadata)
    }

    public func count(_ name: String, _ value: Double = 1, metadata: [String: String] = [:]) {
        metric(name, value, unit: .count, metadata: metadata)
    }

    public func duration(_ name: String, milliseconds: Double, metadata: [String: String] = [:]) {
        metric(name, milliseconds, unit: .milliseconds, metadata: metadata)
    }

    public func memory(_ name: String, bytes: Double, metadata: [String: String] = [:]) {
        metric(name, bytes, unit: .bytes, metadata: metadata)
    }

    private func spanErrorMetadata(_ name: StaticString, metadata: [String: String]) -> [String: String] {
        metadata.merging(["name": "\(name)", "outcome": "error"], uniquingKeysWith: { current, _ in current })
    }
}
