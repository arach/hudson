import Foundation
#if canImport(AVFoundation)
import AVFoundation
#endif

public struct HudTTSProviderID: RawRepresentable, Codable, Hashable, Sendable, ExpressibleByStringLiteral {
    public var rawValue: String

    public init(rawValue: String) {
        self.rawValue = rawValue
    }

    public init(stringLiteral value: String) {
        self.rawValue = value
    }

    public static let system = HudTTSProviderID(rawValue: "system")
    public static let openai = HudTTSProviderID(rawValue: "openai")
    public static let elevenlabs = HudTTSProviderID(rawValue: "elevenlabs")
    public static let groq = HudTTSProviderID(rawValue: "groq")
    public static let gemini = HudTTSProviderID(rawValue: "gemini")
    public static let edgeReadAloud = HudTTSProviderID(rawValue: "edge-read-aloud")
}

public enum HudTTSAudioFormat: String, Sendable {
    case mp3
    case wav
    case caf
}

/// Provider-neutral expressive controls. Adapters use the values they support
/// and ignore the rest without changing the spoken text.
public struct HudTTSVoiceSettings: Equatable, Sendable {
    public var stability: Double?
    public var similarityBoost: Double?
    public var style: Double?
    public var useSpeakerBoost: Bool?

    public init(
        stability: Double? = nil,
        similarityBoost: Double? = nil,
        style: Double? = nil,
        useSpeakerBoost: Bool? = nil
    ) {
        self.stability = stability
        self.similarityBoost = similarityBoost
        self.style = style
        self.useSpeakerBoost = useSpeakerBoost
    }
}

public struct HudTTSRequest: Equatable, Sendable {
    public var text: String
    public var voice: String?
    public var rate: Double
    /// Optional provider model override. A blank value uses the adapter default.
    public var model: String?
    /// Optional natural-language delivery guidance for adapters that support it.
    public var instructions: String?
    public var voiceSettings: HudTTSVoiceSettings?

    public init(
        text: String,
        voice: String? = nil,
        rate: Double = 1.0,
        model: String? = nil,
        instructions: String? = nil,
        voiceSettings: HudTTSVoiceSettings? = nil
    ) {
        self.text = text
        self.voice = voice
        self.rate = rate
        self.model = model
        self.instructions = instructions
        self.voiceSettings = voiceSettings
    }
}

public struct HudTTSWordTiming: Equatable, Sendable {
    public var word: String
    /// Seconds from the start of the returned audio.
    public var start: TimeInterval
    public var end: TimeInterval

    public init(word: String, start: TimeInterval, end: TimeInterval) {
        self.word = word
        self.start = start
        self.end = end
    }
}

public struct HudTTSResult: Equatable, Sendable {
    public var audioData: Data
    public var format: HudTTSAudioFormat
    public var providerID: HudTTSProviderID
    public var voice: String
    /// Word-level timings, when the provider produced them. Nil is normal:
    /// most providers return none, and callers must not require it.
    public var wordTimings: [HudTTSWordTiming]?

    public init(
        audioData: Data,
        format: HudTTSAudioFormat,
        providerID: HudTTSProviderID,
        voice: String,
        wordTimings: [HudTTSWordTiming]? = nil
    ) {
        self.audioData = audioData
        self.format = format
        self.providerID = providerID
        self.voice = voice
        self.wordTimings = wordTimings
    }
}

public struct HudTTSVoiceOption: Equatable, Sendable, Identifiable {
    public var id: String
    public var label: String
    public var providerID: HudTTSProviderID

    public init(id: String, label: String, providerID: HudTTSProviderID) {
        self.id = id
        self.label = label
        self.providerID = providerID
    }
}

public enum HudSystemSpeechDefaults {
    public static let fallbackVoiceIdentifier = "com.apple.voice.compact.en-US.Samantha"

    public static var defaultVoiceIdentifier: String {
        #if canImport(AVFoundation)
        let voices = AVSpeechSynthesisVoice.speechVoices()
            .filter { $0.language.starts(with: "en") }

        if let samantha = voices.first(where: { $0.name.contains("Samantha") && $0.quality == .enhanced }) {
            return samantha.identifier
        }
        if let enhanced = voices.first(where: { $0.quality == .enhanced }) {
            return enhanced.identifier
        }
        return voices.first?.identifier ?? fallbackVoiceIdentifier
        #else
        return fallbackVoiceIdentifier
        #endif
    }
}

public struct HudTTSProviderStatus: Equatable, Sendable, Identifiable {
    public var id: HudTTSProviderID
    public var label: String
    public var isAvailable: Bool
    public var defaultVoice: String

    public init(id: HudTTSProviderID, label: String, isAvailable: Bool, defaultVoice: String) {
        self.id = id
        self.label = label
        self.isAvailable = isAvailable
        self.defaultVoice = defaultVoice
    }
}

extension String {
    var hudTrimmedNonEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
