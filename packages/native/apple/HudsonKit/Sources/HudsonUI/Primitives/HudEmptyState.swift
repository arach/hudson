import SwiftUI

/// Empty-state placeholder — icon, title, optional subtitle. Centered, fills
/// available width, hairline border. Use as the empty branch of any list,
/// table, or section that can be empty.
public struct HudEmptyState: View {
    public let title: String
    public var subtitle: String?
    public var icon: String

    public init(title: String, subtitle: String? = nil, icon: String = "tray") {
        self.title = title
        self.subtitle = subtitle
        self.icon = icon
    }

    public var body: some View {
        VStack(spacing: HudSpacing.lg) {
            Image(systemName: icon)
                .font(.system(size: 22, weight: .light))
                .foregroundStyle(HudPalette.dim)
                .accessibilityHidden(true)
            Text(title)
                .font(HudFont.mono(11, weight: .semibold))
                .tracking(0.5)
                .foregroundStyle(HudPalette.muted)
            if let subtitle {
                Text(subtitle)
                    .font(HudFont.mono(10))
                    .foregroundStyle(HudPalette.dim)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 280)
            }
        }
        .padding(HudSpacing.huge)
        .frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: HudRadius.card).fill(HudSurface.inset))
        .overlay(RoundedRectangle(cornerRadius: HudRadius.card).stroke(HudHairline.subtle, lineWidth: 1))
        .accessibilityElement(children: .combine)
    }
}
