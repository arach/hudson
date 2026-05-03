import SwiftUI

/// Empty-state placeholder — icon, title, optional subtitle. Centered, fills
/// available width, hairline border. Use as the empty branch of any list,
/// table, or section that can be empty.
public struct HEmptyState: View {
    public let title: String
    public var subtitle: String?
    public var icon: String

    public init(title: String, subtitle: String? = nil, icon: String = "tray") {
        self.title = title
        self.subtitle = subtitle
        self.icon = icon
    }

    public var body: some View {
        VStack(spacing: HSpacing.lg) {
            Image(systemName: icon)
                .font(.system(size: 22, weight: .light))
                .foregroundStyle(HPalette.dim)
                .accessibilityHidden(true)
            Text(title)
                .font(HFont.mono(11, weight: .semibold))
                .tracking(0.5)
                .foregroundStyle(HPalette.muted)
            if let subtitle {
                Text(subtitle)
                    .font(HFont.mono(10))
                    .foregroundStyle(HPalette.dim)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 280)
            }
        }
        .padding(HSpacing.huge)
        .frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: HRadius.card).fill(HSurface.inset))
        .overlay(RoundedRectangle(cornerRadius: HRadius.card).stroke(HHairline.subtle, lineWidth: 1))
        .accessibilityElement(children: .combine)
    }
}
