import SwiftUI
import HudsonUI

/// Standard settings entry for a primary navigation sidebar footer.
///
/// Shows a gear icon and optional label. Talkie hosts wire this to present
/// `HudSettingsWorkspace` in the content slot.
public struct HudSettingsFooterButton: View {
    public var title: String
    public var showsLabel: Bool
    public let action: () -> Void

    @Environment(\.hudTheme) private var theme
    @State private var isHovered = false

    public init(
        title: String = "Settings",
        showsLabel: Bool = true,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.showsLabel = showsLabel
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            HStack(spacing: showsLabel ? HudSpacing.md : 0) {
                Image(systemName: "gearshape")
                    .font(HudFont.ui(HudTextSize.sm, weight: .medium))
                    .foregroundStyle(isHovered ? theme.palette.ink : theme.palette.muted)
                    .frame(width: HudIconSize.medium, height: HudIconSize.medium)

                if showsLabel {
                    Text(title)
                        .font(HudFont.ui(HudTextSize.sm, weight: .medium))
                        .foregroundStyle(isHovered ? theme.palette.ink : theme.palette.muted)
                        .lineLimit(1)
                }
            }
            .padding(.horizontal, showsLabel ? HudSpacing.md : HudSpacing.xs)
            .padding(.vertical, HudSpacing.sm)
            .frame(maxWidth: .infinity, alignment: showsLabel ? .leading : .center)
            .background(
                RoundedRectangle(cornerRadius: HudRadius.standard)
                    .fill(isHovered ? HudSurface.hover : .clear)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .help(title)
        .onHover { isHovered = $0 }
    }
}