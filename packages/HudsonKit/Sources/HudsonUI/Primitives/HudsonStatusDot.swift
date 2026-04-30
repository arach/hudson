import SwiftUI

/// Small colored circle, optionally pulsing — for live status indication
/// (online, recording, listening). Pulse animation is GPU-cheap (opacity + scale)
/// and respects Reduce Motion.
public struct HudsonStatusDot: View {
    public var color: Color
    public var size: CGFloat
    public var pulses: Bool
    public var label: String?

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var animating = false

    public init(
        color: Color = HudsonPalette.statusOk,
        size: CGFloat = 8,
        pulses: Bool = false,
        label: String? = nil
    ) {
        self.color = color
        self.size = size
        self.pulses = pulses
        self.label = label
    }

    public var body: some View {
        ZStack {
            if pulses && !reduceMotion {
                Circle()
                    .fill(color.opacity(0.35))
                    .frame(width: size, height: size)
                    .scaleEffect(animating ? 2.0 : 1.0)
                    .opacity(animating ? 0 : 1)
                    .animation(.easeOut(duration: 1.4).repeatForever(autoreverses: false), value: animating)
            }
            Circle().fill(color).frame(width: size, height: size)
        }
        .onAppear {
            guard pulses && !reduceMotion else { return }
            animating = true
        }
        .accessibilityLabel(label ?? "")
        .accessibilityHidden(label == nil)
    }
}
