import SwiftUI

/// Surface card with hairline border. Default container for any grouped content
/// in a Hudson view. Reads from `@Environment(\.hudTheme)` so apps that swap
/// themes via `.hudTheme(_:)` see HudCard surfaces follow along; explicit
/// `fill` / `stroke` / `radius` arguments still win when passed.
public struct HudCard<Content: View>: View {
    @Environment(\.hudTheme) private var theme

    public var padding: CGFloat
    public var radius: CGFloat?
    public var fill: Color?
    public var stroke: Color?
    @ViewBuilder public var content: () -> Content

    public init(
        padding: CGFloat = HudSpacing.xxl,
        radius: CGFloat? = nil,
        fill: Color? = nil,
        stroke: Color? = nil,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.padding = padding
        self.radius = radius
        self.fill = fill
        self.stroke = stroke
        self.content = content
    }

    public var body: some View {
        let resolvedRadius = radius ?? theme.radius.card
        let resolvedFill = fill ?? theme.palette.surface
        let resolvedStroke = stroke ?? theme.hairline.standard
        return content()
            .padding(padding)
            .background(RoundedRectangle(cornerRadius: resolvedRadius).fill(resolvedFill))
            .overlay(RoundedRectangle(cornerRadius: resolvedRadius).stroke(resolvedStroke, lineWidth: 1))
    }
}

/// Inset row inside a HudCard — slightly darker, hairline border. Used for
/// nested content blocks (telemetry rows, key/value groups). Theme-aware via
/// `@Environment(\.hudTheme)`.
public struct HudInset<Content: View>: View {
    @Environment(\.hudTheme) private var theme

    public var padding: CGFloat
    public var radius: CGFloat?
    @ViewBuilder public var content: () -> Content

    public init(
        padding: CGFloat = HudSpacing.xl,
        radius: CGFloat? = nil,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.padding = padding
        self.radius = radius
        self.content = content
    }

    public var body: some View {
        let resolvedRadius = radius ?? theme.radius.standard
        return content()
            .padding(padding)
            .background(RoundedRectangle(cornerRadius: resolvedRadius).fill(HudSurface.inset))
            .overlay(RoundedRectangle(cornerRadius: resolvedRadius).stroke(theme.hairline.subtle, lineWidth: 1))
    }
}
