import SwiftUI

/// 20pt grid background drawn with a Canvas — cheap, scales with size, faint
/// enough to read as texture rather than ornament. Use as a backdrop layer
/// for canvas/deck surfaces.
public struct HGridBackground: View {
    public var step: CGFloat
    public var lineColor: Color

    public init(step: CGFloat = 20, lineColor: Color = HSurface.inset) {
        self.step = step
        self.lineColor = lineColor
    }

    public var body: some View {
        Canvas { context, size in
            var path = Path()
            var x: CGFloat = 0
            while x < size.width {
                path.move(to: CGPoint(x: x, y: 0))
                path.addLine(to: CGPoint(x: x, y: size.height))
                x += step
            }
            var y: CGFloat = 0
            while y < size.height {
                path.move(to: CGPoint(x: 0, y: y))
                path.addLine(to: CGPoint(x: size.width, y: y))
                y += step
            }
            context.stroke(path, with: .color(lineColor), lineWidth: 1)
        }
    }
}
