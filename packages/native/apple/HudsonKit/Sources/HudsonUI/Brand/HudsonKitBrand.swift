import SwiftUI

/// HudsonKit's four-panel mark. The transparent seams and stepped notches form
/// an H in negative space. The shape inherits its foreground style so one
/// geometry works on both light and dark surfaces.
public struct HudsonKitMark: Shape {
    public init() {}

    public func path(in rect: CGRect) -> Path {
        let side = min(rect.width, rect.height)
        let scale = side / 64
        let origin = CGPoint(
            x: rect.midX - side / 2,
            y: rect.midY - side / 2
        )
        let panels: [[CGPoint]] = [
            [
                CGPoint(x: 0, y: 0), CGPoint(x: 30, y: 0),
                CGPoint(x: 30, y: 30), CGPoint(x: 24, y: 30),
                CGPoint(x: 24, y: 22), CGPoint(x: 18, y: 22),
                CGPoint(x: 18, y: 30), CGPoint(x: 0, y: 30),
            ],
            [
                CGPoint(x: 34, y: 0), CGPoint(x: 64, y: 0),
                CGPoint(x: 64, y: 30), CGPoint(x: 46, y: 30),
                CGPoint(x: 46, y: 22), CGPoint(x: 40, y: 22),
                CGPoint(x: 40, y: 30), CGPoint(x: 34, y: 30),
            ],
            [
                CGPoint(x: 0, y: 34), CGPoint(x: 18, y: 34),
                CGPoint(x: 18, y: 42), CGPoint(x: 24, y: 42),
                CGPoint(x: 24, y: 34), CGPoint(x: 30, y: 34),
                CGPoint(x: 30, y: 64), CGPoint(x: 0, y: 64),
            ],
            [
                CGPoint(x: 34, y: 34), CGPoint(x: 40, y: 34),
                CGPoint(x: 40, y: 42), CGPoint(x: 46, y: 42),
                CGPoint(x: 46, y: 34), CGPoint(x: 64, y: 34),
                CGPoint(x: 64, y: 64), CGPoint(x: 34, y: 64),
            ],
        ]

        func project(_ point: CGPoint) -> CGPoint {
            CGPoint(
                x: origin.x + point.x * scale,
                y: origin.y + point.y * scale
            )
        }

        var path = Path()
        for panel in panels {
            guard let first = panel.first else { continue }
            path.move(to: project(first))
            for point in panel.dropFirst() {
                path.addLine(to: project(point))
            }
            path.closeSubpath()
        }
        return path
    }
}

/// Theme-aware horizontal HudsonKit lockup for native app chrome.
public struct HudsonKitLockup: View {
    private let wordmark: String
    private let markSize: CGFloat
    private let wordmarkSize: CGFloat
    private let spacing: CGFloat

    public init(
        wordmark: String = "HUDSONKIT",
        markSize: CGFloat = 18,
        wordmarkSize: CGFloat = 11,
        spacing: CGFloat = 7
    ) {
        self.wordmark = wordmark
        self.markSize = markSize
        self.wordmarkSize = wordmarkSize
        self.spacing = spacing
    }

    public var body: some View {
        HStack(spacing: spacing) {
            HudsonKitMark()
                .frame(width: markSize, height: markSize)
            Text(wordmark.uppercased())
                .font(.system(size: wordmarkSize, weight: .bold, design: .monospaced))
                .tracking(wordmarkSize * 0.16)
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(wordmark)
    }
}
