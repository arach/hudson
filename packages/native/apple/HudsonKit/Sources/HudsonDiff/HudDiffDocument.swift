import Foundation

public struct HudDiffDocument: Codable, Equatable, Sendable {
    public static let currentSchema = "hudson.diff.v1"

    public var schema: String
    public var title: String?
    public var files: [HudDiffFile]
    public var stats: HudDiffStats

    public init(
        schema: String = Self.currentSchema,
        title: String? = nil,
        files: [HudDiffFile]
    ) {
        self.schema = schema
        self.title = title
        self.files = files
        self.stats = HudDiffStats(files: files)
    }

    public var rows: [HudDiffRow] {
        files.flatMap(\.rows)
    }
}

public struct HudDiffFile: Codable, Equatable, Sendable, Identifiable {
    public var oldPath: String?
    public var newPath: String?
    public var language: String?
    public var metadata: [String]
    public var hunks: [HudDiffHunk]
    public var stats: HudDiffStats

    public init(
        oldPath: String? = nil,
        newPath: String? = nil,
        language: String? = nil,
        metadata: [String] = [],
        hunks: [HudDiffHunk]
    ) {
        self.oldPath = normalizedPath(oldPath)
        self.newPath = normalizedPath(newPath)
        self.language = language
        self.metadata = metadata
        self.hunks = hunks
        self.stats = HudDiffStats(hunks: hunks)
    }

    public var id: String {
        newPath ?? oldPath ?? "diff-file"
    }

    public var displayPath: String {
        newPath ?? oldPath ?? "Untitled"
    }

    public var rows: [HudDiffRow] {
        hunks.flatMap(\.rows)
    }
}

public struct HudDiffHunk: Codable, Equatable, Sendable, Identifiable {
    public var id: String
    public var oldStart: Int
    public var oldLineCount: Int
    public var newStart: Int
    public var newLineCount: Int
    public var header: String?
    public var rows: [HudDiffRow]

    public init(
        id: String,
        oldStart: Int,
        oldLineCount: Int,
        newStart: Int,
        newLineCount: Int,
        header: String? = nil,
        rows: [HudDiffRow]
    ) {
        self.id = id
        self.oldStart = oldStart
        self.oldLineCount = oldLineCount
        self.newStart = newStart
        self.newLineCount = newLineCount
        self.header = header
        self.rows = rows
    }
}

public enum HudDiffRowKind: String, Codable, Sendable {
    case addition
    case deletion
    case context
    case metadata
}

public struct HudDiffRow: Codable, Equatable, Sendable, Identifiable {
    public var id: String
    public var kind: HudDiffRowKind
    public var oldLine: Int?
    public var newLine: Int?
    public var text: String
    public var rawText: String?
    public var spans: [HudDiffTextSpan]

    public init(
        id: String,
        kind: HudDiffRowKind,
        oldLine: Int? = nil,
        newLine: Int? = nil,
        text: String,
        rawText: String? = nil,
        spans: [HudDiffTextSpan] = []
    ) {
        self.id = id
        self.kind = kind
        self.oldLine = oldLine
        self.newLine = newLine
        self.text = text
        self.rawText = rawText
        self.spans = spans
    }

    public var marker: String {
        switch kind {
        case .addition: "+"
        case .deletion: "-"
        case .context: " "
        case .metadata: " "
        }
    }
}

public struct HudDiffTextSpan: Codable, Equatable, Sendable {
    public enum Kind: String, Codable, Sendable {
        case equal
        case addition
        case deletion
        case emphasis
    }

    public var range: Range<Int>
    public var kind: Kind

    public init(range: Range<Int>, kind: Kind) {
        self.range = range
        self.kind = kind
    }
}

public struct HudDiffStats: Codable, Equatable, Sendable {
    public var additions: Int
    public var deletions: Int
    public var files: Int
    public var hunks: Int

    public init(
        additions: Int = 0,
        deletions: Int = 0,
        files: Int = 0,
        hunks: Int = 0
    ) {
        self.additions = additions
        self.deletions = deletions
        self.files = files
        self.hunks = hunks
    }

    public init(hunks: [HudDiffHunk]) {
        self.additions = hunks.flatMap(\.rows).filter { $0.kind == .addition }.count
        self.deletions = hunks.flatMap(\.rows).filter { $0.kind == .deletion }.count
        self.files = 1
        self.hunks = hunks.count
    }

    public init(files: [HudDiffFile]) {
        self.additions = files.reduce(0) { $0 + $1.stats.additions }
        self.deletions = files.reduce(0) { $0 + $1.stats.deletions }
        self.files = files.count
        self.hunks = files.reduce(0) { $0 + $1.stats.hunks }
    }
}

private func normalizedPath(_ path: String?) -> String? {
    guard let path, !path.isEmpty else { return nil }
    if path == "/dev/null" { return path }
    if path.hasPrefix("a/") || path.hasPrefix("b/") {
        return String(path.dropFirst(2))
    }
    return path
}
