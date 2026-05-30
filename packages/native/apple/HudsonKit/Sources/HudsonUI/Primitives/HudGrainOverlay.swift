import SwiftUI

/// Subtle film-grain overlay for status bars and inset surfaces.
public struct HudGrainOverlay: View {
    public var opacity: Double

    public init(opacity: Double = 0.045) {
        self.opacity = opacity
    }

    public var body: some View {
        Canvas { context, size in
            let columns = Int(size.width / 2)
            let rows = Int(size.height / 2)
            guard columns > 0, rows > 0 else { return }

            for row in 0..<rows {
                for column in 0..<columns {
                    let hash = (column &* 73_856_093) ^ (row &* 19_349_663)
                    let strength = Double(hash % 100) / 100
                    guard strength > 0.62 else { continue }

                    let rect = CGRect(
                        x: CGFloat(column) * 2,
                        y: CGFloat(row) * 2,
                        width: 1,
                        height: 1
                    )
                    context.fill(
                        Path(rect),
                        with: .color(Color.white.opacity(opacity * strength))
                    )
                }
            }
        }
        .allowsHitTesting(false)
        .blendMode(.overlay)
    }
}
