import Foundation

/// A completed assistant reply that may be prepared for speech.
///
/// Hudson keeps this transport-agnostic: hosts decide how to identify turns,
/// which text should be spoken, and what to do with the returned audio.
public struct HudAgentReplySpeechReply: Equatable, Sendable {
    public var id: String
    public var conversationID: String?
    public var revision: String?
    public var text: String
    public var isComplete: Bool
    public var metadata: [String: String]

    public init(
        id: String,
        conversationID: String? = nil,
        revision: String? = nil,
        text: String,
        isComplete: Bool = true,
        metadata: [String: String] = [:]
    ) {
        self.id = id
        self.conversationID = conversationID
        self.revision = revision
        self.text = text
        self.isComplete = isComplete
        self.metadata = metadata
    }

    fileprivate var marker: HudAgentReplySpeechMarker {
        HudAgentReplySpeechMarker(id: id, conversationID: conversationID, revision: revision)
    }
}

public struct HudAgentReplySpeechRequest: Equatable, Sendable {
    public var replyID: String
    public var conversationID: String?
    public var revision: String?
    public var text: String
    public var metadata: [String: String]

    public init(
        replyID: String,
        conversationID: String? = nil,
        revision: String? = nil,
        text: String,
        metadata: [String: String] = [:]
    ) {
        self.replyID = replyID
        self.conversationID = conversationID
        self.revision = revision
        self.text = text
        self.metadata = metadata
    }
}

public enum HudAgentReplySpeechAudioFormat: String, Codable, Equatable, Sendable {
    case mp3
    case wav
    case caf
    case m4a
    case aac
    case unknown
}

public struct HudAgentReplySpeechAudio: Equatable, Sendable {
    public var data: Data
    public var format: HudAgentReplySpeechAudioFormat
    public var mimeType: String?
    public var provider: String?
    public var voice: String?
    public var model: String?

    public init(
        data: Data,
        format: HudAgentReplySpeechAudioFormat,
        mimeType: String? = nil,
        provider: String? = nil,
        voice: String? = nil,
        model: String? = nil
    ) {
        self.data = data
        self.format = format
        self.mimeType = mimeType
        self.provider = provider
        self.voice = voice
        self.model = model
    }
}

public struct HudAgentReplySpeechOutput: Equatable, Sendable {
    public var request: HudAgentReplySpeechRequest
    public var audio: HudAgentReplySpeechAudio

    public init(request: HudAgentReplySpeechRequest, audio: HudAgentReplySpeechAudio) {
        self.request = request
        self.audio = audio
    }
}

public struct HudAgentReplySpeechSynthesizer: Sendable {
    public var synthesize: @Sendable (HudAgentReplySpeechRequest) async throws -> HudAgentReplySpeechAudio?

    public init(
        synthesize: @escaping @Sendable (HudAgentReplySpeechRequest) async throws -> HudAgentReplySpeechAudio?
    ) {
        self.synthesize = synthesize
    }
}

@MainActor
public final class HudAgentReplySpeechController {
    public var synthesizer: HudAgentReplySpeechSynthesizer?

    private var preparedMarker: HudAgentReplySpeechMarker?

    public init(synthesizer: HudAgentReplySpeechSynthesizer? = nil) {
        self.synthesizer = synthesizer
    }

    public func register(_ synthesizer: HudAgentReplySpeechSynthesizer?) {
        self.synthesizer = synthesizer
    }

    /// Marks the current reply as already handled. Use this when a conversation
    /// opens or a user enables speech so old history is not read aloud.
    public func prime(with reply: HudAgentReplySpeechReply?) {
        preparedMarker = reply?.marker
    }

    public func reset() {
        preparedMarker = nil
    }

    /// Returns synthesized audio for the next eligible reply, at most once per
    /// `(conversationID, replyID, revision)` marker. Hudson never plays the
    /// audio; the host UX decides whether, where, and how to present it.
    public func audioIfNeeded(
        for reply: HudAgentReplySpeechReply?,
        enabled: Bool = true
    ) async throws -> HudAgentReplySpeechOutput? {
        guard enabled,
              let reply,
              reply.isComplete,
              let synthesizer
        else {
            return nil
        }

        let text = reply.text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else {
            prime(with: reply)
            return nil
        }

        let marker = reply.marker
        guard marker != preparedMarker else { return nil }
        preparedMarker = marker

        let request = HudAgentReplySpeechRequest(
            replyID: reply.id,
            conversationID: reply.conversationID,
            revision: reply.revision,
            text: text,
            metadata: reply.metadata
        )

        guard let audio = try await synthesizer.synthesize(request) else {
            return nil
        }
        return HudAgentReplySpeechOutput(request: request, audio: audio)
    }
}

private struct HudAgentReplySpeechMarker: Equatable, Sendable {
    var id: String
    var conversationID: String?
    var revision: String?
}
