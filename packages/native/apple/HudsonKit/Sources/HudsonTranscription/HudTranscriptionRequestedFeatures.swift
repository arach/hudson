import Foundation

public enum HudTranscriptionTranscriptStyle: String, Codable, Hashable, Sendable {
    case verbatim
    case clean
}

public struct HudTranscriptionRequestedFeatures: Codable, Hashable, Sendable {
    public var languageHints: [String]
    public var vocabularyHints: [String]
    public var style: HudTranscriptionTranscriptStyle?
    public var wordTiming: Bool
    public var speakerLabels: Bool
    public var smartFormatting: Bool

    public init(
        languageHints: [String] = [],
        vocabularyHints: [String] = [],
        style: HudTranscriptionTranscriptStyle? = nil,
        wordTiming: Bool = false,
        speakerLabels: Bool = false,
        smartFormatting: Bool = false
    ) {
        self.languageHints = languageHints
        self.vocabularyHints = vocabularyHints
        self.style = style
        self.wordTiming = wordTiming
        self.speakerLabels = speakerLabels
        self.smartFormatting = smartFormatting
    }
}
