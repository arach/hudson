import Foundation

public enum HudTranscriptionAudioInput: Codable, Hashable, Sendable {
    case file(URL)
    case pcm(HudTranscriptionPCMFormat)
}
