import Foundation

public enum HudUnifiedDiffParser {
    public static func parse(
        _ diff: String,
        title: String? = nil,
        language: String? = nil
    ) -> HudDiffDocument {
        var builder = FileBuilder(language: language)
        var files: [HudDiffFile] = []
        var rowCounter = 0
        var hunkCounter = 0

        func finishFile() {
            if let file = builder.finish() {
                files.append(file)
            }
            builder = FileBuilder(language: language)
        }

        for line in splitLines(diff) {
            if line.hasPrefix("diff --git ") {
                finishFile()
                let paths = parseGitPaths(line)
                builder.oldPath = paths.old
                builder.newPath = paths.new
                builder.metadata.append(line)
                continue
            }

            if line.hasPrefix("--- ") {
                builder.oldPath = parseFileHeaderPath(line)
                builder.metadata.append(line)
                continue
            }

            if line.hasPrefix("+++ ") {
                builder.newPath = parseFileHeaderPath(line)
                builder.metadata.append(line)
                continue
            }

            if line.hasPrefix("@@") {
                hunkCounter += 1
                builder.startHunk(
                    header: line,
                    range: parseHunkRange(line),
                    id: "hunk-\(hunkCounter)"
                )
                continue
            }

            guard builder.hasActiveHunk else {
                if !line.isEmpty {
                    builder.metadata.append(line)
                }
                continue
            }

            rowCounter += 1
            builder.appendRow(diffLine: line, id: "row-\(rowCounter)")
        }

        finishFile()

        if files.isEmpty, !diff.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            files = [
                HudDiffFile(
                    language: language,
                    hunks: [
                        HudDiffHunk(
                            id: "hunk-1",
                            oldStart: 0,
                            oldLineCount: 0,
                            newStart: 0,
                            newLineCount: 0,
                            header: nil,
                            rows: splitLines(diff).enumerated().map { index, line in
                                HudDiffRow(
                                    id: "row-\(index + 1)",
                                    kind: .metadata,
                                    text: line,
                                    rawText: line
                                )
                            }
                        )
                    ]
                )
            ]
        }

        return HudDiffDocument(title: title, files: files)
    }
}

private struct FileBuilder {
    var oldPath: String?
    var newPath: String?
    var language: String?
    var metadata: [String] = []
    var hunks: [HudDiffHunk] = []

    private var activeHeader: String?
    private var activeRows: [HudDiffRow] = []
    private var activeID: String?
    private var oldStart = 0
    private var newStart = 0
    private var oldLine = 0
    private var newLine = 0

    init(language: String? = nil) {
        self.language = language
    }

    var hasActiveHunk: Bool {
        activeID != nil
    }

    mutating func startHunk(header: String, range: HunkRange, id: String) {
        finishActiveHunk()
        activeHeader = header
        activeRows = []
        activeID = id
        oldStart = range.oldStart
        newStart = range.newStart
        oldLine = range.oldStart
        newLine = range.newStart
    }

    mutating func appendRow(diffLine line: String, id: String) {
        if line.hasPrefix(#"\ "#) {
            activeRows.append(
                HudDiffRow(id: id, kind: .metadata, text: line, rawText: line)
            )
            return
        }

        if line.hasPrefix("+"), !line.hasPrefix("+++") {
            activeRows.append(
                HudDiffRow(
                    id: id,
                    kind: .addition,
                    newLine: newLine,
                    text: String(line.dropFirst()),
                    rawText: line
                )
            )
            newLine += 1
            return
        }

        if line.hasPrefix("-"), !line.hasPrefix("---") {
            activeRows.append(
                HudDiffRow(
                    id: id,
                    kind: .deletion,
                    oldLine: oldLine,
                    text: String(line.dropFirst()),
                    rawText: line
                )
            )
            oldLine += 1
            return
        }

        if line.hasPrefix(" ") {
            activeRows.append(
                HudDiffRow(
                    id: id,
                    kind: .context,
                    oldLine: oldLine,
                    newLine: newLine,
                    text: String(line.dropFirst()),
                    rawText: line
                )
            )
            oldLine += 1
            newLine += 1
            return
        }

        activeRows.append(
            HudDiffRow(id: id, kind: .metadata, text: line, rawText: line)
        )
    }

    mutating func finish() -> HudDiffFile? {
        finishActiveHunk()
        guard oldPath != nil || newPath != nil || !metadata.isEmpty || !hunks.isEmpty else {
            return nil
        }
        return HudDiffFile(
            oldPath: oldPath,
            newPath: newPath,
            language: language,
            metadata: metadata,
            hunks: hunks
        )
    }

    private mutating func finishActiveHunk() {
        guard let activeID else { return }
        let oldCount = activeRows.filter { $0.oldLine != nil }.count
        let newCount = activeRows.filter { $0.newLine != nil }.count
        hunks.append(
            HudDiffHunk(
                id: activeID,
                oldStart: oldStart,
                oldLineCount: oldCount,
                newStart: newStart,
                newLineCount: newCount,
                header: activeHeader,
                rows: activeRows
            )
        )
        self.activeID = nil
        self.activeHeader = nil
        self.activeRows = []
    }
}

private struct HunkRange {
    var oldStart: Int
    var oldCount: Int
    var newStart: Int
    var newCount: Int
}

private func parseHunkRange(_ line: String) -> HunkRange {
    let parts = line.split(separator: " ")
    let oldToken = parts.first(where: { $0.hasPrefix("-") }).map(String.init) ?? "-0"
    let newToken = parts.first(where: { $0.hasPrefix("+") }).map(String.init) ?? "+0"
    let old = parseRangeToken(oldToken)
    let new = parseRangeToken(newToken)
    return HunkRange(
        oldStart: old.start,
        oldCount: old.count,
        newStart: new.start,
        newCount: new.count
    )
}

private func parseRangeToken(_ token: String) -> (start: Int, count: Int) {
    let pieces = token.dropFirst().split(separator: ",", maxSplits: 1)
    let start = pieces.first.flatMap { Int($0) } ?? 0
    let count = pieces.dropFirst().first.flatMap { Int($0) } ?? 1
    return (start, count)
}

private func parseGitPaths(_ line: String) -> (old: String?, new: String?) {
    let pieces = line.split(separator: " ")
    guard pieces.count >= 4 else { return (nil, nil) }
    return (String(pieces[2]), String(pieces[3]))
}

private func parseFileHeaderPath(_ line: String) -> String? {
    let trimmed = line.dropFirst(4)
    guard let first = trimmed.split(separator: "\t", maxSplits: 1).first else {
        return nil
    }
    return String(first)
}

private func splitLines(_ value: String) -> [String] {
    value
        .split(separator: "\n", omittingEmptySubsequences: false)
        .map(String.init)
}
