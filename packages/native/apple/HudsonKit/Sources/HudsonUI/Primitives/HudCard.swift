import SwiftUI

/// Surface card with hairline border. Default container for any grouped content
/// in a Hudson view.
public struct HudCard<Content: View>: View {
    public var padding: CGFloat
    public var radius: CGFloat
    public var fill: Color
    public var stroke: Color
    @ViewBuilder public var content: () -> Content

    public init(
        padding: CGFloat = HudSpacing.xxl,
        radius: CGFloat = HudRadius.card,
        fill: Color = HudPalette.surface,
        stroke: Color = HudHairline.standard,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.padding = padding
        self.radius = radius
        self.fill = fill
        self.stroke = stroke
        self.content = content
    }

    public var body: some View {
        content()
            .padding(padding)
            .background(RoundedRectangle(cornerRadius: radius).fill(fill))
            .overlay(RoundedRectangle(cornerRadius: radius).stroke(stroke, lineWidth: 1))
    }
}

/// Inset row inside a HudCard — slightly darker, hairline border. Used for
/// nested content blocks (telemetry rows, key/value groups).
public struct HudInset<Content: View>: View {
    public var padding: CGFloat
    public var radius: CGFloat
    @ViewBuilder public var content: () -> Content

    public init(
        padding: CGFloat = HudSpacing.xl,
        radius: CGFloat = HudRadius.standard,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.padding = padding
        self.radius = radius
        self.content = content
    }

    public var body: some View {
        content()
            .padding(padding)
            .background(RoundedRectangle(cornerRadius: radius).fill(HudSurface.inset))
            .overlay(RoundedRectangle(cornerRadius: radius).stroke(HudHairline.subtle, lineWidth: 1))
    }
}
