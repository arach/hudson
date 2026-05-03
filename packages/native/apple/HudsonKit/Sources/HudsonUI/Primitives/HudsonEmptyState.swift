import SwiftUI

/// Empty-state placeholder — icon, title, optional subtitle. Centered, fills
/// available width, hairline border. Use as the empty branch of any list,
/// table, or section that can be empty.
public struct HudsonEmptyState: View {
    public let title: String
    public var subtitle: String?
    public var icon: String

    public init(title: String, subtitle: String? = nil, icon: String = "tray") {
        self.title = title
        self.subtitle = subtitle
        self.icon = icon
    }

    public var body: some View {
        VStack(spacing: HudsonSpacing.lg) {
            Image(systemName: icon)
                .font(.system(size: 22, weight: .light))
                .foregroundStyle(HudsonPalette.dim)
                .accessibilityHidden(true)
            Text(title)
                .font(HudsonFont.mono(11, weight: .semibold))
                .tracking(0.5)
                .foregroundStyle(HudsonPalette.muted)
            if let subtitle {
                Text(subtitle)
                    .font(HudsonFont.mono(10))
                    .foregroundStyle(HudsonPalette.dim)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 280)
            }
        }
        .padding(HudsonSpacing.huge)
        .frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: HudsonRadius.card).fill(HSurface.inset))
        .overlay(RoundedRectangle(cornerRadius: HudsonRadius.card).stroke(HudsonHairline.subtle, lineWidth: 1))
        .accessibilityElement(children: .combine)
    }
}
