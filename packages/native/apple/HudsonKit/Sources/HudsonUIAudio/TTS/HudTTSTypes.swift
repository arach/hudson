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
}

public enum HudTTSAudioFormat: String, Sendable {
    case mp3
    case wav
    case caf
}

public struct HudTTSRequest: Equatable, Sendable {
    public var text: String
    public var voice: String?
    public var rate: Double

    public init(text: String, voice: String? = nil, rate: Double = 1.0) {
        self.text = text
        self.voice = voice
        self.rate = rate
    }
}

public struct HudTTSResult: Equatable, Sendable {
    public var audioData: Data
    public var format: HudTTSAudioFormat
    public var providerID: HudTTSProviderID
    public var voice: String

    public init(
        audioData: Data,
        format: HudTTSAudioFormat,
        providerID: HudTTSProviderID,
        voice: String
    ) {
        self.audioData = audioData
        self.format = format
        self.providerID = providerID
        self.voice = voice
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
