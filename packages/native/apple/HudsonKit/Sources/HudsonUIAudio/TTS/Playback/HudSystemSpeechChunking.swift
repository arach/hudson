import Foundation

/// Installed Kokoro extensions reject oversized utterances. Keep this inside
/// Hudson so every host using system speech receives bounded input.
public enum HudSystemSpeechChunking {
    public static func pieces(_ text: String, voiceIdentifier: String?, budget: Int = 300) -> [String] {
        let text = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return [] }
        guard voiceIdentifier?.lowercased().contains("kokorovoice") == true else { return [text] }
        let limit = max(1, budget)
        var remaining = text[...]
        var result: [String] = []
        while remaining.count > limit {
            let end = remaining.index(remaining.startIndex, offsetBy: limit)
            let prefix = remaining[..<end]
            let punctuation = prefix.lastIndex(where: { ".!?;\n".contains($0) })
            let split = punctuation.map { remaining.index(after: $0) }
                ?? prefix.lastIndex(where: { $0.isWhitespace }) ?? end
            let cut = split == remaining.startIndex ? end : split
            let piece = remaining[..<cut].trimmingCharacters(in: .whitespacesAndNewlines)
            if !piece.isEmpty { result.append(piece) }
            remaining = remaining[cut...]
        }
        let tail = remaining.trimmingCharacters(in: .whitespacesAndNewlines)
        if !tail.isEmpty { result.append(tail) }
        return result
    }
}
