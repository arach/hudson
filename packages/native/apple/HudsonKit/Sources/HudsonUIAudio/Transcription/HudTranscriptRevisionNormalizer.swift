import Foundation

/// Normalizes range revisions and implicit finalization into the public
/// committed-prefix/current-pending contract. Contains no provider SDK types.
struct HudTranscriptRevisionNormalizer: Sendable {
    private var pending: [HudTranscriptUpdate] = []

    mutating func receive(
        _ update: HudTranscriptUpdate,
        finalizedThrough: TimeInterval?
    ) throws -> [HudTranscriptUpdate] {
        var candidates: [HudTranscriptUpdate] = []
        for previous in pending {
            let overlaps = previous.range.start < update.range.end && update.range.start < previous.range.end
            let sameStart = previous.range.start == update.range.start
            if overlaps || sameStart {
                // The same-origin result is a full hypothesis revision even if
                // its audio range shrinks. Its old suffix may have been revoked.
                if sameStart { continue }
                // A provider may finalize a shorter prefix of a volatile range.
                // Preserve residual text only at original attributed-run boundaries.
                // A coarse volatile run crossing the replacement boundary is
                // superseded in full, rather than split or treated as an error.
                if previous.range.start < update.range.start,
                   let prefix = try slice(previous, before: update.range.start) {
                    candidates.append(prefix)
                }
                if previous.range.end > update.range.end,
                   let suffix = try slice(previous, after: update.range.end) {
                    candidates.append(suffix)
                }
            } else {
                candidates.append(previous)
            }
        }
        candidates.append(update)
        candidates.sort { $0.range.start < $1.range.start }
        pending = []
        var emitted: [HudTranscriptUpdate] = []
        for candidate in candidates {
            if candidate.isFinal || finalizedThrough.map({ $0.isFinite && candidate.range.end <= $0 }) == true {
                emitted.append(final(candidate))
            } else {
                pending.append(candidate)
            }
        }
        if let aggregate = try aggregatePending() { emitted.append(aggregate) }
        return emitted
    }

    /// Called only after successful input finalization AND result-stream completion.
    mutating func finish() -> [HudTranscriptUpdate] {
        defer { pending = [] }
        return pending.map(final)
    }

    private func final(_ update: HudTranscriptUpdate) -> HudTranscriptUpdate {
        .init(range: update.range, text: update.text, spans: update.spans, isFinal: true)
    }

    private func aggregatePending() throws -> HudTranscriptUpdate? {
        guard let first = pending.first, let last = pending.last else { return nil }
        return .init(
            range: try .init(start: first.range.start, duration: last.range.end - first.range.start),
            text: pending.map(\.text).joined(),
            spans: pending.flatMap(\.spans),
            isFinal: false
        )
    }

    private func slice(_ update: HudTranscriptUpdate, before boundary: TimeInterval) throws -> HudTranscriptUpdate? {
        let stop = update.spans.firstIndex { $0.range.map { $0.end > boundary } == true } ?? update.spans.endIndex
        let spans = Array(update.spans[..<stop])
        guard spans.contains(where: { $0.range != nil }) else { return nil }
        return .init(
            range: try .init(start: update.range.start, duration: boundary - update.range.start),
            text: spans.map(\.text).joined(), spans: spans, isFinal: false
        )
    }

    private func slice(_ update: HudTranscriptUpdate, after boundary: TimeInterval) throws -> HudTranscriptUpdate? {
        guard let start = update.spans.firstIndex(where: { $0.range.map { $0.start >= boundary } == true }) else { return nil }
        let spans = Array(update.spans[start...])
        return .init(
            range: try .init(start: boundary, duration: update.range.end - boundary),
            text: spans.map(\.text).joined(), spans: spans, isFinal: false
        )
    }

}
