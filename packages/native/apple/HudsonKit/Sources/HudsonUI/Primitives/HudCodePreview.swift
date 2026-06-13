import SwiftUI

/// Line-by-line syntax preview safe for large files (no nested `Text` chains).
public struct HudCodePreview: View {
    public let source: String
    public let language: String?

    public init(source: String, language: String? = nil) {
        self.source = source
        self.language = language
    }

    private var lines: [String] {
        source.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
                Text(HudCodeHighlighter.highlight(line, language: language))
                    .font(HudFont.mono(HudTextSize.sm))
                    .lineSpacing(2)
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}