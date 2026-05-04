import Foundation

/// `.hudlintignore` — a gitignore-style allowlist of paths that should not be
/// scanned. Patterns are evaluated against paths *relative to the lint root*
/// (the directory passed via `--root`).
///
/// Supported syntax (intentionally narrow):
///   - `#` line comments
///   - `**` matches any number of path segments
///   - `*` matches anything within a single segment (no `/`)
///   - leading `/` anchors to the root, otherwise pattern matches anywhere
public struct Configuration: Sendable {
    public let ignorePatterns: [String]

    public init(ignorePatterns: [String] = []) {
        self.ignorePatterns = ignorePatterns
    }

    public static func load(from path: String?) -> Configuration {
        guard let path,
              let data = try? String(contentsOfFile: path, encoding: .utf8)
        else { return Configuration() }
        let patterns = data
            .split(whereSeparator: { $0.isNewline })
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty && !$0.hasPrefix("#") }
        return Configuration(ignorePatterns: patterns)
    }

    public func shouldIgnore(_ relativePath: String) -> Bool {
        ignorePatterns.contains { GlobMatcher.match(pattern: $0, path: relativePath) }
    }
}

enum GlobMatcher {
    static func match(pattern: String, path: String) -> Bool {
        let regex = compile(pattern: pattern)
        guard let r = regex else { return false }
        let range = NSRange(path.startIndex..., in: path)
        return r.firstMatch(in: path, options: [], range: range) != nil
    }

    private static func compile(pattern: String) -> NSRegularExpression? {
        var regex = ""
        var i = pattern.startIndex
        let anchored = pattern.hasPrefix("/")
        if anchored {
            regex += "^"
            i = pattern.index(after: i)
        } else {
            regex += "(^|/)"
        }
        while i < pattern.endIndex {
            let c = pattern[i]
            switch c {
            case "*":
                let next = pattern.index(after: i)
                if next < pattern.endIndex && pattern[next] == "*" {
                    // ** — any path segments
                    regex += ".*"
                    i = pattern.index(after: next)
                    // Skip a trailing /
                    if i < pattern.endIndex && pattern[i] == "/" {
                        i = pattern.index(after: i)
                    }
                } else {
                    // * — any chars except /
                    regex += "[^/]*"
                    i = pattern.index(after: i)
                }
            case ".", "(", ")", "+", "?", "|", "{", "}", "[", "]", "^", "$", "\\":
                regex += "\\\(c)"
                i = pattern.index(after: i)
            default:
                regex.append(c)
                i = pattern.index(after: i)
            }
        }
        regex += "(/|$)"
        return try? NSRegularExpression(pattern: regex, options: [])
    }
}
