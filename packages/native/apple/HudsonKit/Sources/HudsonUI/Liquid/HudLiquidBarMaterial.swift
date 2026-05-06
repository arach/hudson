import SwiftUI

public struct HudLiquidBarMaterial: ViewModifier {
    let tint: HudLiquidBarTint
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    public init(tint: HudLiquidBarTint) {
        self.tint = tint
    }

    public func body(content: Content) -> some View {
        content.background {
            materialBody
        }
    }

    @ViewBuilder
    private var materialBody: some View {
        if reduceTransparency {
            Capsule()
                .fill(HudPalette.bgElevated)
                .overlay(Capsule().stroke(HudHairline.standard, lineWidth: HudStrokeWidth.thin))
        } else {
            platformMaterial
        }
    }

    @ViewBuilder
    private var platformMaterial: some View {
        #if os(iOS)
        if #available(iOS 26.0, *) {
            switch tint {
            case .regular:
                Capsule().fill(.clear).glassEffect(.regular, in: .capsule)
            case .tinted(let color):
                Capsule().fill(.clear).glassEffect(.regular.tint(color), in: .capsule)
            case .clear:
                Capsule().fill(.clear).glassEffect(.clear, in: .capsule)
            }
        } else {
            fallbackMaterial
        }
        #else
        fallbackMaterial
        #endif
    }

    @ViewBuilder
    private var fallbackMaterial: some View {
        Capsule()
            .fill(fallbackFill)
            .overlay {
                if case .tinted(let color) = tint {
                    Capsule().fill(HudSurface.tintFill(color))
                }
            }
            .overlay(
                Capsule().stroke(
                    LinearGradient(
                        colors: [HudLiquidBarColors.highlightTop, HudLiquidBarColors.highlightBottom],
                        startPoint: .top,
                        endPoint: .bottom
                    ),
                    lineWidth: HudStrokeWidth.thin
                )
            )
    }

    private var fallbackFill: Material {
        switch tint {
        case .clear: return .ultraThinMaterial
        case .regular, .tinted: return .regularMaterial
        }
    }
}

public extension View {
    func hudLiquidBarMaterial(tint: HudLiquidBarTint) -> some View {
        modifier(HudLiquidBarMaterial(tint: tint))
    }
}

enum HudLiquidBarHaptics {
    static func softImpact() {
        #if os(iOS)
        UIImpactFeedbackGenerator(style: .soft).impactOccurred()
        #endif
    }
}
