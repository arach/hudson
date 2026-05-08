import Foundation
import Testing
@testable import HudsonDiff

@Suite("HudsonDiff")
struct HudUnifiedDiffParserTests {
    @Test("unified parser produces multi-file document rows")
    func unifiedParserProducesMultiFileDocumentRows() throws {
        let document = HudUnifiedDiffParser.parse(
            """
            diff --git a/Sources/App.swift b/Sources/App.swift
            index 0000000..1111111 100644
            --- a/Sources/App.swift
            +++ b/Sources/App.swift
            @@ -1,3 +1,4 @@
             import SwiftUI
            -let title = "Old"
            +let title = "New"
            +let subtitle = "Vantage"
             App()
            diff --git a/README.md b/README.md
            --- a/README.md
            +++ b/README.md
            @@ -1 +1 @@
            -Old docs
            +New docs
            """,
            title: "Working diff",
            language: "swift"
        )

        #expect(document.schema == HudDiffDocument.currentSchema)
        #expect(document.title == "Working diff")
        #expect(document.files.count == 2)
        #expect(document.stats.files == 2)
        #expect(document.stats.additions == 3)
        #expect(document.stats.deletions == 2)
        #expect(document.files[0].displayPath == "Sources/App.swift")
        #expect(document.files[0].hunks[0].rows.map(\.kind).contains(.addition))
    }

    @Test("parsed diff document round trips as JSON")
    func parsedDiffDocumentRoundTripsAsJSON() throws {
        let document = HudUnifiedDiffParser.parse(
            """
            diff --git a/a.txt b/a.txt
            --- a/a.txt
            +++ b/a.txt
            @@ -1,2 +1,2 @@
             a
            -b
            +c
            """,
            title: "Round trip"
        )
        let data = try JSONEncoder().encode(document)
        let decoded = try JSONDecoder().decode(HudDiffDocument.self, from: data)

        #expect(decoded == document)
        #expect(decoded.stats.additions == 1)
        #expect(decoded.stats.deletions == 1)
    }

    @Test("pathless diffs use the document title as the file label")
    func pathlessDiffUsesTitleAsFileLabel() {
        let document = HudUnifiedDiffParser.parse(
            """
            @@ -1 +1 @@
            -before
            +after
            """,
            title: "running-diff.diff"
        )

        #expect(document.files.count == 1)
        #expect(document.title == "running-diff.diff")
        #expect(document.files[0].displayPath(fallback: document.title) == "running-diff.diff")
        #expect(document.files[0].displayPath == "Diff chunk")
    }

    @Test("missing diff labels fall back to a neutral chunk name")
    func missingDiffLabelUsesNeutralFallback() {
        let document = HudUnifiedDiffParser.parse(
            """
            raw diff summary
            without file metadata
            """,
            title: "undefined"
        )

        #expect(document.files.count == 1)
        #expect(document.title == "undefined")
        #expect(document.files[0].displayPath(fallback: document.title) == "Diff chunk")
    }
}
