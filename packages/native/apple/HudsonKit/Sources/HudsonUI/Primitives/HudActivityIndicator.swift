import SwiftUI

/// "Something is running" as a small square that blinks, plus a short verb.
///
/// Built to stay sharp at 1x: the mark is a whole-pixel square, and the only
/// thing that animates is its opacity, stepped between two values. A scale
/// pulse or a breathing halo resamples the shape every frame and never holds a
/// hard edge; a blink always does. Under Reduce Motion the mark holds still.
public struct HudActivityIndicator: View {
    public var label: String?
    public var color: Color?
    public var size: CGFloat
    /// Seconds for one on + off cycle.
    public var period: Double

    @Environment(\.hudTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(_ label: String? = nil, color: Color? = nil, size: CGFloat = 5, period: Double = 1.1) {
        self.label = label
        self.color = color
        self.size = size
        self.period = period
    }

    public var body: some View {
        HStack(spacing: HudSpacing.md) {
            HudBlinkMark(color: color ?? theme.palette.ink, size: size, period: period, still: reduceMotion)
            if let label, !label.isEmpty {
                Text(label)
                    .font(HudFont.ui(HudTextSize.xs))
                    .foregroundStyle(theme.palette.muted)
                    .lineLimit(1)
                    .contentTransition(.opacity)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(label ?? "Working")
    }
}

/// The square on its own, for hosts that set their own label.
public struct HudBlinkMark: View {
    public var color: Color
    public var size: CGFloat
    public var period: Double
    public var still: Bool

    public init(color: Color, size: CGFloat = 5, period: Double = 1.1, still: Bool = false) {
        self.color = color
        self.size = size
        self.period = period
        self.still = still
    }

    public var body: some View {
        if still {
            square(opacity: 1)
        } else {
            TimelineView(.periodic(from: .now, by: period / 2)) { context in
                let on = Int(context.date.timeIntervalSinceReferenceDate / (period / 2)) % 2 == 0
                square(opacity: on ? 1 : 0.28)
            }
        }
    }

    private func square(opacity: Double) -> some View {
        Rectangle()
            .fill(color)
            .frame(width: size, height: size)
            .opacity(opacity)
            .animation(.linear(duration: 0.12), value: opacity)
    }
}
