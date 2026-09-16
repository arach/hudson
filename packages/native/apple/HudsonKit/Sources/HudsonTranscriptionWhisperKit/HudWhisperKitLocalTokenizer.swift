/*
Adapted from WhisperKit 0.18.0 WhisperTokenizerWrapper; its initializer is internal.
Keep word splitting aligned with upstream while loading tokenizer files strictly locally.

MIT License

Copyright (c) 2024 argmax, inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
import Foundation
import NaturalLanguage
import Tokenizers
import Hub
import HudsonTranscription
@preconcurrency import WhisperKit

final class HudWhisperKitLocalTokenizer: WhisperTokenizer {
    /// Construct from the same validated local bytes, without any Hub loader.
    static func load(from folder: URL) async throws -> HudWhisperKitLocalTokenizer {
        try Task.checkCancellation()
        let configData = try Data(contentsOf: folder.appending(path: "tokenizer_config.json"))
        let vocabularyData = try Data(contentsOf: folder.appending(path: "tokenizer.json"))
        guard let config = try JSONSerialization.jsonObject(with: configData) as? [String: Any],
              let data = try JSONSerialization.jsonObject(with: vocabularyData) as? [String: Any],
              let model = data["model"] as? [String: Any],
              model["type"] as? String == "BPE",
              let vocabulary = model["vocab"] as? [String: Int], !vocabulary.isEmpty,
              vocabulary.values.allSatisfy({ $0 >= 0 }),
              let merges = model["merges"] as? [Any],
              merges.allSatisfy({ merge in
                  if let pair = merge as? [String] { return pair.count == 2 }
                  if let pair = merge as? String { return pair.split(separator: " ", omittingEmptySubsequences: false).count == 2 }
                  return false
              }) else {
            throw HudTranscriptionError.invalidRequest("The local Whisper tokenizer vocabulary or merge rules are invalid.")
        }
        // The SDK BPE initializer traps on missing merges or malformed pairs;
        // validate those prerequisites before invoking it.
        let tokenizer = try PreTrainedTokenizer(
            tokenizerConfig: Config(config as [NSString: Any]),
            tokenizerData: Config(data as [NSString: Any])
        )
        return HudWhisperKitLocalTokenizer(tokenizer: tokenizer, at: folder)
    }

    let tokenizer: any Tokenizer
    let tokenizerFolder: URL?
    public let specialTokens: SpecialTokens
    public let allLanguageTokens: Set<Int>

    public func encode(text: String) -> [Int] {
        tokenizer.encode(text: text)
    }

    public func decode(tokens: [Int]) -> String {
        tokenizer.decode(tokens: tokens)
    }

    public func convertTokenToId(_ token: String) -> Int? {
        tokenizer.convertTokenToId(token)
    }

    public func convertIdToToken(_ id: Int) -> String? {
        tokenizer.convertIdToToken(id)
    }

    /// Initializes a WhisperTokenizer wrapper with the provided tokenizer and optional folder location.
    ///
    /// This initializer sets up the tokenizer wrapper with special tokens and language token mappings
    /// required for Whisper decoding. The tokenizer folder parameter is stored for reference
    /// but does not affect the tokenizer's functionality.
    ///
    /// - Parameters:
    ///   - tokenizer: The underlying tokenizer implementation that handles text encoding/decoding
    ///   - tokenizerFolder: Optional URL representing the folder location where the tokenizer
    ///     files are stored. This is kept for reference purposes only and does not influence
    ///     tokenizer behavior or operations.
    ///
    /// - Note: Special tokens are automatically detected from the tokenizer vocabulary, with
    ///   fallback to default values if tokens are not found. Language tokens are identified
    ///   by matching the pattern `<|language|>` against the tokenizer's vocabulary.
    init(tokenizer: any Tokenizer, at tokenizerFolder: URL? = nil) {
        let specialTokens = SpecialTokens(
            endToken: tokenizer.convertTokenToId("<|endoftext|>") ?? Self.defaultEndToken,
            englishToken: tokenizer.convertTokenToId("<|en|>") ?? Self.defaultEnglishToken,
            noSpeechToken: tokenizer.convertTokenToId("<|nospeech|>") ?? Self.defaultNoSpeechToken,
            noTimestampsToken: tokenizer.convertTokenToId("<|notimestamps|>") ?? Self.defaultNoTimestampsToken,
            specialTokenBegin: tokenizer.convertTokenToId("<|endoftext|>") ?? Self.defaultSpecialTokenBegin,
            startOfPreviousToken: tokenizer.convertTokenToId("<|startofprev|>") ?? Self.defaultStartOfPreviousToken,
            startOfTranscriptToken: tokenizer.convertTokenToId("<|startoftranscript|>") ?? Self.defaultStartOfTranscriptToken,
            timeTokenBegin: tokenizer.convertTokenToId("<|0.00|>") ?? Self.defaultTimeTokenBegin,
            transcribeToken: tokenizer.convertTokenToId("<|transcribe|>") ?? Self.defaultTranscribeToken,
            translateToken: tokenizer.convertTokenToId("<|translate|>") ?? Self.defaultTranslateToken,
            whitespaceToken: tokenizer.convertTokenToId(" ") ?? Self.defaultWhitespaceToken
        )
        self.tokenizer = tokenizer
        self.tokenizerFolder = tokenizerFolder
        self.specialTokens = specialTokens
        self.allLanguageTokens = Set(
            Constants.languages
                .compactMap { tokenizer.convertTokenToId("<|\($0.value)|>") }
                .filter { $0 > specialTokens.specialTokenBegin }
        )
    }

    private func splitTokensOnUnicode(tokens: [Int]) -> (words: [String], wordTokens: [[Int]]) {
        let decodedFull = tokenizer.decode(tokens: tokens)
        let replacementString = "\u{fffd}"

        var words: [String] = []
        var wordTokens: [[Int]] = []
        var currentTokens: [Int] = []
        var unicodeOffset = 0

        for token in tokens {
            currentTokens.append(token)
            let decoded = tokenizer.decode(tokens: currentTokens)

            var hasUnicodeInFullString = false
            if let range = decoded.range(of: replacementString) {
                let offset = unicodeOffset + decoded.distance(from: decoded.startIndex, to: range.lowerBound)
                if let index = decodedFull.index(decodedFull.startIndex, offsetBy: offset, limitedBy: decodedFull.endIndex),
                   index < decodedFull.endIndex {
                    hasUnicodeInFullString = String(decodedFull[index]) == replacementString
                }
            }

            if !decoded.contains(replacementString) || hasUnicodeInFullString {
                words.append(decoded)
                wordTokens.append(currentTokens)
                currentTokens = []
                unicodeOffset += decoded.count
            }
        }

        return (words, wordTokens)
    }

    private func splitTokensOnSpaces(tokens: [Int]) -> (words: [String], wordTokens: [[Int]]) {
        let (subwords, subwordTokensList) = splitTokensOnUnicode(tokens: tokens)
        var words: [String] = []
        var wordTokens: [[Int]] = []

        for (subword, subwordTokens) in zip(subwords, subwordTokensList) {
            let special = subwordTokens.first.map { $0 >= specialTokens.specialTokenBegin } ?? false
            let withSpace = subword.hasPrefix(" ")
            var punctuation = false
            if let strippedSubword = UnicodeScalar(subword.trimmingCharacters(in: .whitespaces)) {
                punctuation = CharacterSet.punctuationCharacters.contains(strippedSubword)
            }
            if special || withSpace || punctuation || words.isEmpty {
                words.append(subword)
                wordTokens.append(subwordTokens)
            } else {
                words[words.count - 1] += subword
                wordTokens[words.count - 1].append(contentsOf: subwordTokens)
            }
        }

        return (words, wordTokens)
    }

    private func isPunctuation(_ text: String, tokenRange: Range<String.Index>, tag: NLTag?) -> Bool {
        let punctuationCharacters = CharacterSet.punctuationCharacters
        let token = String(text[tokenRange])
        if let tag = tag, tag == .punctuation {
            return true
        } else if token.unicodeScalars.allSatisfy({ punctuationCharacters.contains($0) }) {
            return true
        }
        return false
    }

    /// Decodes token ids into individual words and per-word subtokens
    /// - Parameter tokenIds: Array of tokens to decode and then split
    /// - Returns: Tuple containing and array of the split words and all tokens for each word
    public func splitToWordTokens(tokenIds: [Int]) -> (words: [String], wordTokens: [[Int]]) {
        let decodedWords = tokenizer.decode(tokens: tokenIds.filter { $0 < specialTokens.specialTokenBegin })

        // Detect language of input text
        let recognizer = NLLanguageRecognizer()
        recognizer.processString(decodedWords)
        let languageCode = recognizer.dominantLanguage?.rawValue

        if ["zh", "ja", "th", "lo", "my", "yue"].contains(languageCode) {
            return splitTokensOnUnicode(tokens: tokenIds)
        } else {
            return splitTokensOnSpaces(tokens: tokenIds)
        }
    }
}

extension HudWhisperKitLocalTokenizer {
    /// Default values for each token, using base vocab
    static var defaultWhitespaceToken: Int { 220 }
    static var defaultSpecialTokenBegin: Int { 50257 }
    static var defaultEndToken: Int { 50257 }
    static var defaultStartOfPreviousToken: Int { 50361 }
    static var defaultStartOfTranscriptToken: Int { 50258 }
    static var defaultEnglishToken: Int { 50259 }
    static var defaultTranscribeToken: Int { 50359 }
    static var defaultTranslateToken: Int { 50358 }
    static var defaultNoSpeechToken: Int { 50362 }
    static var defaultNoTimestampsToken: Int { 50363 }
    static var defaultTimeTokenBegin: Int { 50364 }
}
