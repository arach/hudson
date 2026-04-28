import SwiftUI
import HudsonUI

// MARK: - Item

/// One row in the navigation rail. `id` is the selection key, `icon` is an
/// SF Symbol name, `label` shows in the expanded rail and as accessibility text.
public struct HudsonNavRailItem: Identifiable, Equatable, Sendable {
    public let id: String
    public let label: String
    public let icon: String

    public init(id: String, label: String, icon: String) {
        self.id = id
        self.label = label
        self.icon = icon
    }
}

// MARK: - Rail

/// Vertical navigation rail for the leading slot of `HudsonAppShell`.
///
/// Two widths: 64pt collapsed (icons only) or 240pt expanded (icons + labels).
/// The hamburger button at the top toggles between them; the rail seeds its
/// initial state from `horizontalSizeClass` (compact → collapsed) but the
/// caller owns the binding so persistence is up to the consumer.
///
/// Brand identity in the header (status dot + app name) is read from
/// `@Environment(\.hudsonAppManifest)` so apps can rebrand without touching
/// the rail call site.
public struct HudsonNavigationRail<Footer: View>: View {
    @Binding public var selection: String
    public let items: [HudsonNavRailItem]
    @Binding public var isExpanded: Bool
    public let footer: Footer

    @Environment(\.hudsonAppManifest) private var manifest

    public init(
        selection: Binding<String>,
        items: [HudsonNavRailItem],
        isExpanded: Binding<Bool>,
        @ViewBuilder footer: () -> Footer
    ) {
        self._selection = selection
        self.items = items
        self._isExpanded = isExpanded
        self.footer = footer()
    }

    public var body: some View {
        VStack(spacing: 0) {
            header
            HudsonDivider(color: HudsonHairline.standard)

            VStack(spacing: HudsonSpacing.xs) {
                ForEach(items) { item in
                    HudsonNavRailRow(
                        item: item,
                        isSelected: selection == item.id,
                        isExpanded: isExpanded,
                        accent: manifest.accent,
                        onTap: { selection = item.id }
                    )
                }
            }
            .padding(.horizontal, HudsonSpacing.md)
            .padding(.vertical, HudsonSpacing.lg)

            Spacer(minLength: 0)

            if isExpanded && Footer.self != EmptyView.self {
                HudsonDivider(color: HudsonHairline.subtle)
                footer
                    .padding(HudsonSpacing.xl)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .frame(width: isExpanded ? 240 : 64)
        .frame(maxHeight: .infinity)
        .background(Color.black.opacity(0.18))
        .animation(.spring(response: 0.32, dampingFraction: 0.86), value: isExpanded)
    }

    private var header: some View {
        HStack(spacing: HudsonSpacing.lg) {
            Button(action: { isExpanded.toggle() }) {
                Image(systemName: isExpanded ? "sidebar.left" : "line.3.horizontal")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(HudsonPalette.muted)
                    .frame(width: 32, height: 32)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(isExpanded ? "Collapse navigation" : "Expand navigation")

            if isExpanded {
                HudsonStatusDot(color: manifest.accent, pulses: true)
                Text(manifest.name.uppercased())
                    .font(HudsonFont.mono(11, weight: .bold))
                    .tracking(1.5)
                    .foregroundStyle(HudsonPalette.ink)
                    .lineLimit(1)
                Spacer(minLength: 0)
            } else {
                Spacer(minLength: 0)
            }
        }
        .padding(.horizontal, isExpanded ? HudsonSpacing.lg : 0)
        .frame(height: HudsonLayout.navHeight)
        .frame(maxWidth: .infinity, alignment: isExpanded ? .leading : .center)
    }
}

// MARK: - Convenience init (no footer)

extension HudsonNavigationRail where Footer == EmptyView {
    public init(
        selection: Binding<String>,
        items: [HudsonNavRailItem],
        isExpanded: Binding<Bool>
    ) {
        self.init(
            selection: selection,
            items: items,
            isExpanded: isExpanded,
            footer: { EmptyView() }
        )
    }
}

// MARK: - Row

private struct HudsonNavRailRow: View {
    let item: HudsonNavRailItem
    let isSelected: Bool
    let isExpanded: Bool
    let accent: Color
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: HudsonSpacing.lg) {
                Image(systemName: item.icon)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(isSelected ? accent : HudsonPalette.muted)
                    .frame(width: 40, height: 40)

                if isExpanded {
                    Text(item.label)
                        .font(HudsonFont.ui(13, weight: .medium))
                        .foregroundStyle(isSelected ? HudsonPalette.ink : HudsonPalette.muted)
                        .lineLimit(1)
                    Spacer(minLength: 0)
                }
            }
            .padding(.horizontal, isExpanded ? HudsonSpacing.sm : 0)
            .frame(maxWidth: .infinity, alignment: isExpanded ? .leading : .center)
            .frame(height: 40)
            .background(
                RoundedRectangle(cornerRadius: HudsonRadius.standard)
                    .fill(isSelected ? accent.opacity(0.10) : Color.clear)
            )
            .overlay(
                RoundedRectangle(cornerRadius: HudsonRadius.standard)
                    .stroke(isSelected ? accent.opacity(0.3) : Color.clear, lineWidth: 1)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(item.label)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}
