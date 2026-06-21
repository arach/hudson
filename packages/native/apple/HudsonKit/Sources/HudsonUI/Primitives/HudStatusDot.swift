import SwiftUI

private let hudStatusDotPulseAnimationEnabled = ProcessInfo.processInfo.environment["HUDSON_STATUS_DOT_PULSE"] == "1"

/// Small colored circle, optionally pulsing — for live status indication
/// (online, recording, listening). Pulse animation is GPU-cheap (opacity + scale)
/// and respects Reduce Motion.
public struct HudStatusDot: View {
    public var color: Color
    public var size: CGFloat
    public var pulses: Bool
    public var label: String?

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var animating = false

    public init(
        color: Color = HudPalette.statusOk,
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
                pulseHalo
            }
            Circle().fill(color).frame(width: size, height: size)
        }
        .onAppear {
            guard pulses && !reduceMotion && hudStatusDotPulseAnimationEnabled else { return }
            animating = true
        }
        .accessibilityLabel(label ?? "")
        .accessibilityHidden(label == nil)
    }

    @ViewBuilder
    private var pulseHalo: some View {
        if hudStatusDotPulseAnimationEnabled {
            Circle()
                .fill(HudSurface.tintBorder(color))
                .frame(width: size, height: size)
                .scaleEffect(animating ? 2.0 : 1.0)
                .opacity(animating ? 0 : 1)
                .animation(.easeOut(duration: 1.4).repeatForever(autoreverses: false), value: animating)
        } else {
            Circle()
                .fill(HudSurface.tintBorder(color))
                .frame(width: size * 1.75, height: size * 1.75)
                .opacity(HudOpacity.soft)
        }
    }
}
