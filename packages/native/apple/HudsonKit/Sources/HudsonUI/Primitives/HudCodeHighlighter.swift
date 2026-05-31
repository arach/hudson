import Foundation
import SwiftUI
import SwiftTreeSitter
import TreeSitterSwift

public enum HudCodeHighlighter {
    public static func highlight(_ line: String, language: String? = nil) -> AttributedString {
        switch LanguageRegistry.resolve(language) {
        case .swift:
            if let config = LanguageRegistry.swiftConfig,
               let attributed = treeSitterHighlight(line, config: config) {
                return attributed
            }
        case .unsupported:
            break
        }
        return plain(line)
    }

    private static func plain(_ line: String) -> AttributedString {
        var attributed = AttributedString(line.isEmpty ? " " : line)
        attributed.foregroundColor = HudPalette.ink
        return attributed
    }

    private static func treeSitterHighlight(
        _ source: String,
        config: LanguageConfiguration
    ) -> AttributedString? {
        guard !source.isEmpty else { return plain(source) }

        if let cached = HighlightCache.shared.get(source: source, name: config.name) {
            return cached
        }

        do {
            let parser = Parser()
            try parser.setLanguage(config.language)
            guard let tree = parser.parse(source) else { return nil }
            guard let highlightsQuery = config.queries[.highlights] else { return nil }

            let cursor = highlightsQuery.execute(in: tree)
            let context = Predicate.Context(string: source)
            let ranges = cursor.resolve(with: context).highlights()

            let attributed = build(source: source, captures: ranges)
            HighlightCache.shared.set(source: source, name: config.name, value: attributed)
            return attributed
        } catch {
            return nil
        }
    }

    private static func build(source: String, captures: [NamedRange]) -> AttributedString {
        var attributed = AttributedString(source.isEmpty ? " " : source)
        attributed.foregroundColor = HudPalette.ink

        // Captures are emitted with most-specific first; apply in reverse so
        // broader categories don't paint over narrower matches.
        let sorted = captures.sorted { $0.range.length > $1.range.length }
        for capture in sorted {
            guard let color = color(forCaptureName: capture.name) else { continue }
            guard let stringRange = Range(capture.range, in: source),
                  let attributedRange = Range(stringRange, in: attributed) else {
                continue
            }
            attributed[attributedRange].foregroundColor = color
        }

        return attributed
    }

    private static func color(forCaptureName name: String) -> Color? {
        // Most-specific captures first (e.g. `keyword.return` before `keyword`).
        switch name {
        case "keyword.return", "keyword.conditional", "keyword.repeat",
             "keyword.exception", "keyword.operator", "keyword.coroutine":
            return HudTint.blue.color
        case "keyword.function", "keyword.type":
            return HudTint.blue.color
        case "keyword.modifier", "keyword.import", "keyword.directive":
            return HudTint.cyan.color
        case "function.method":
            return HudTint.cyan.color
        case "function.call":
            return HudTint.blue.color
        case "function.macro":
            return HudTint.amber.color
        case "string.escape", "character.special":
            return HudTint.cyan.color
        case "string.regexp":
            return HudTint.teal.color
        case "constant.builtin", "constant.macro":
            return HudTint.amber.color
        case "variable.builtin":
            return HudTint.blue.color
        case "comment.documentation":
            return HudPalette.dim
        case "number.float":
            return HudTint.teal.color
        case "punctuation.bracket", "punctuation.delimiter", "punctuation.special":
            return HudPalette.dim
        default:
            break
        }

        let primary = name.split(separator: ".").first.map(String.init) ?? name
        switch primary {
        case "keyword":
            return HudTint.cyan.color
        case "string", "character":
            return HudTint.amber.color
        case "number":
            return HudTint.teal.color
        case "comment":
            return HudPalette.dim
        case "boolean":
            return HudTint.amber.color
        case "function":
            return HudTint.blue.color
        case "type", "constructor":
            return HudTint.green.color
        case "attribute", "label":
            return HudTint.amber.color
        case "operator":
            return HudPalette.muted
        case "punctuation":
            return HudPalette.dim
        case "variable", "spell":
            return nil // leave at default ink
        default:
            return nil
        }
    }
}

private enum SupportedLanguage {
    case swift
    case unsupported
}

private enum LanguageRegistry {
    static let swiftConfig: LanguageConfiguration? = makeConfig(
        language: Language(language: tree_sitter_swift()),
        name: "Swift",
        bundleName: "TreeSitterSwift_TreeSitterSwift"
    )

    static func resolve(_ language: String?) -> SupportedLanguage {
        guard let raw = language?.lowercased() else { return .unsupported }
        if raw == "swift" || raw.hasSuffix(".swift") { return .swift }
        return .unsupported
    }

    /// `LanguageConfiguration`'s default loader assumes the macOS bundle layout
    /// (`<Bundle>/Contents/Resources/queries`). SPM dev builds via `swift run`
    /// produce flat bundles where `queries/` sits at the root. Try both.
    private static func makeConfig(
        language: Language,
        name: String,
        bundleName: String
    ) -> LanguageConfiguration? {
        guard let resources = Bundle.main.resourceURL else { return nil }
        let bundleRoot = resources.appendingPathComponent("\(bundleName).bundle", isDirectory: true)
        let candidates = [
            bundleRoot.appendingPathComponent("Contents/Resources/queries", isDirectory: true),
            bundleRoot.appendingPathComponent("queries", isDirectory: true),
        ]
        for queriesURL in candidates {
            let highlightsPath = queriesURL.appendingPathComponent("highlights.scm").path
            guard FileManager.default.isReadableFile(atPath: highlightsPath) else { continue }
            if let config = try? LanguageConfiguration(language, name: name, queriesURL: queriesURL) {
                return config
            }
        }
        return nil
    }
}

private final class HighlightCache {
    static let shared = HighlightCache()

    private struct Key: Hashable {
        let source: String
        let name: String
    }

    private let cache = NSCache<NSString, NSAttributedString>()

    init() {
        cache.countLimit = 1024
    }

    func get(source: String, name: String) -> AttributedString? {
        let key = "\(name)\u{1F}\(source)" as NSString
        guard let nsAttributed = cache.object(forKey: key) else { return nil }
        return AttributedString(nsAttributed)
    }

    func set(source: String, name: String, value: AttributedString) {
        let key = "\(name)\u{1F}\(source)" as NSString
        cache.setObject(NSAttributedString(value), forKey: key)
    }
}
