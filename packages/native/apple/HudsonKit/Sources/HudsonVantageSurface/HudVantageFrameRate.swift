import Foundation
import SwiftUI

struct HudVantageFrameRateSample: Hashable, Sendable {
    var framesPerSecond: Double
    var averageFrameDurationMS: Double
    var slowestFrameDurationMS: Double
    var sampledFrames: Int
    var capturedAt: Date

    var roundedFramesPerSecond: Int {
        Int(framesPerSecond.rounded())
    }

    var roundedAverageFrameDurationMS: Int {
        Int(averageFrameDurationMS.rounded())
    }
}

struct HudVantageFrameRateMeter: Sendable {
    private var lastFrameAt: Date?
    private var lastPublishedAt: Date?
    private var frameDurations: [TimeInterval]
    private let sampleInterval: TimeInterval
    private let maximumFrameDuration: TimeInterval
    private let maximumSampleCount: Int

    init(
        sampleInterval: TimeInterval = 0.5,
        maximumFrameDuration: TimeInterval = 0.5,
        maximumSampleCount: Int = 120
    ) {
        self.sampleInterval = max(0.1, sampleInterval)
        self.maximumFrameDuration = max(0.1, maximumFrameDuration)
        self.maximumSampleCount = max(2, maximumSampleCount)
        frameDurations = []
    }

    mutating func recordFrame(at date: Date) -> HudVantageFrameRateSample? {
        guard let previousFrameAt = lastFrameAt else {
            lastFrameAt = date
            lastPublishedAt = date
            return nil
        }

        let duration = date.timeIntervalSince(previousFrameAt)
        lastFrameAt = date

        guard duration.isFinite, duration > 0 else {
            return nil
        }

        if duration > maximumFrameDuration {
            frameDurations.removeAll(keepingCapacity: true)
            lastPublishedAt = date
            return nil
        }

        frameDurations.append(duration)
        if frameDurations.count > maximumSampleCount {
            frameDurations.removeFirst(frameDurations.count - maximumSampleCount)
        }

        guard let previousPublication = lastPublishedAt else {
            lastPublishedAt = date
            return nil
        }

        guard date.timeIntervalSince(previousPublication) >= sampleInterval else {
            return nil
        }

        lastPublishedAt = date
        return sample(capturedAt: date)
    }

    mutating func reset() {
        lastFrameAt = nil
        lastPublishedAt = nil
        frameDurations.removeAll(keepingCapacity: true)
    }

    private func sample(capturedAt date: Date) -> HudVantageFrameRateSample? {
        guard !frameDurations.isEmpty else {
            return nil
        }

        let totalDuration = frameDurations.reduce(0, +)
        let averageDuration = totalDuration / Double(frameDurations.count)
        guard averageDuration > 0 else {
            return nil
        }

        return HudVantageFrameRateSample(
            framesPerSecond: 1 / averageDuration,
            averageFrameDurationMS: averageDuration * 1000,
            slowestFrameDurationMS: (frameDurations.max() ?? averageDuration) * 1000,
            sampledFrames: frameDurations.count,
            capturedAt: date
        )
    }
}

@MainActor
final class HudVantageFrameRateMonitor: ObservableObject {
    @Published private(set) var sample: HudVantageFrameRateSample?

    private var meter = HudVantageFrameRateMeter()

    @discardableResult
    func recordFrame(at date: Date) -> HudVantageFrameRateSample? {
        guard let nextSample = meter.recordFrame(at: date) else {
            return nil
        }
        sample = nextSample
        return nextSample
    }

    func reset() {
        meter.reset()
        sample = nil
    }
}
