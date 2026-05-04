import SwiftUI
import HudsonUI
import HudsonObservability

// MARK: - Item

/// One row in the navigation rail. `id` is the selection key, `icon` is an
/// SF Symbol name, `label` shows in the expanded rail and as accessibility text.
public struct HudRailItem: Identifiable, Equatable, Sendable {
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

/// Vertical navigation rail for the leading slot of `HudAppShell`.
///
/// Two widths: 64pt collapsed (icons only) or 220pt expanded (icons + labels).
/// The hamburger button at the top toggles between them; the rail seeds its
/// initial state from `horizontalSizeClass` (compact → collapsed) but the
/// caller owns the binding so persistence is up to the consumer.
///
/// Brand identity in the header (status dot + app name) is read from
/// `@Environment(\.hudsonAppManifest)` so apps can rebrand without touching
/// the rail call site.
public struct HudNavigationRail<Footer: View>: View {
    @Binding public var selection: String
    public let items: [HudRailItem]
    @Binding public var isExpanded: Bool
    public let showHeaderToggle: Bool
    public let footer: Footer

    @Environment(\.hudsonAppManifest) private var manifest
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(
        selection: Binding<String>,
        items: [HudRailItem],
        isExpanded: Binding<Bool>,
        showHeaderToggle: Bool = true,
        @ViewBuilder footer: () -> Footer
    ) {
        self._selection = selection
        self.items = items
        self._isExpanded = isExpanded
        self.showHeaderToggle = showHeaderToggle
        self.footer = footer()
    }

    public var body: some View {
        VStack(spacing: 0) {
            header
            HudDivider(color: HudHairline.standard)

            if isExpanded {
                List(selection: expandedSelection) {
                    ForEach(items) { item in
                        Label(item.label, systemImage: item.icon)
                            .font(HudFont.ui(13, weight: selection == item.id ? .semibold : .regular))
                            .foregroundStyle(selection == item.id ? HudPalette.ink : HudPalette.muted)
                            .tag(item.id)
                    }
                }
                .listStyle(.sidebar)
                .scrollContentBackground(.hidden)
                .tint(manifest.accent)
            } else {
                VStack(spacing: HudSpacing.xs) {
                    ForEach(items) { item in
                        HudRailIconButton(
                            item: item,
                            isSelected: selection == item.id,
                            accent: manifest.accent,
                            onTap: {
                                let metadata = selectionMetadata(for: item)
                                HudInstrumentation.ui.event("NavigationRail.select", metadata: metadata)
                                HudInstrumentation.ui.span("NavigationRail.select.apply", metadata: metadata) {
                                    selection = item.id
                                }
                            }
                        )
                    }
                }
                .padding(.horizontal, HudSpacing.sm)
                .padding(.vertical, HudSpacing.md)

                Spacer(minLength: 0)
            }

            if isExpanded && Footer.self != EmptyView.self {
                HudDivider(color: HudHairline.subtle)
                footer
                    .padding(HudSpacing.xl)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .frame(width: isExpanded ? 220 : 64)
        .frame(maxHeight: .infinity)
        .background(HudPalette.chrome)
    }

    private var expandedSelection: Binding<String?> {
        Binding(
            get: { selection },
            set: { next in
                guard let next, next != selection else { return }
                let metadata = selectionMetadata(forID: next)
                HudInstrumentation.ui.event("NavigationRail.select", metadata: metadata)
                HudInstrumentation.ui.span("NavigationRail.select.apply", metadata: metadata) {
                    selection = next
                }
            }
        )
    }

    private var header: some View {
        HStack(spacing: HudSpacing.lg) {
            if showHeaderToggle {
                Button(action: toggleExpanded) {
                    Image(systemName: isExpanded ? "sidebar.left" : "line.3.horizontal")
                        .font(HudFont.ui(HudTextSize.md, weight: .semibold))
                        .foregroundStyle(HudPalette.muted)
                        .frame(width: HudIconSize.large, height: HudIconSize.large)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(isExpanded ? "Collapse navigation" : "Expand navigation")
            }

            if isExpanded {
                // Brand area is tappable — gives a logo-as-toggle affordance the
                // chrome can pair with a window-toolbar button when the inline
                // hamburger is hidden.
                Button(action: toggleExpanded) {
                    HStack(spacing: HudSpacing.lg) {
                        HudStatusDot(color: manifest.accent)
                        Text(manifest.name)
                            .font(HudFont.ui(HudTextSize.base, weight: .semibold))
                            .foregroundStyle(HudPalette.ink)
                            .lineLimit(1)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Toggle navigation")
                Spacer(minLength: 0)
            } else if !showHeaderToggle {
                // Collapsed without an inline hamburger — keep an in-rail expand
                // affordance via a tappable status dot in the header slot.
                Button(action: toggleExpanded) {
                    HudStatusDot(color: manifest.accent)
                        .frame(width: HudIconSize.large, height: HudIconSize.large)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Expand navigation")
            } else {
                Spacer(minLength: 0)
            }
        }
        .padding(.horizontal, isExpanded ? HudSpacing.lg : 0)
        .frame(height: HudLayout.navHeight)
        .frame(maxWidth: .infinity, alignment: isExpanded ? .leading : .center)
    }

    private func toggleExpanded() {
        let metadata = [
            "fromExpanded": hudsonBool(isExpanded),
            "itemCount": "\(items.count)",
            "toExpanded": hudsonBool(!isExpanded),
        ]

        HudInstrumentation.ui.event("NavigationRail.toggle", metadata: metadata)
        HudInstrumentation.ui.span("NavigationRail.toggle.apply", metadata: metadata) {
            if reduceMotion {
                isExpanded.toggle()
            } else {
                withAnimation(HudMotion.chromeResize) {
                    isExpanded.toggle()
                }
            }
        }
    }

    private func selectionMetadata(for item: HudRailItem) -> [String: String] {
        selectionMetadata(forID: item.id)
    }

    private func selectionMetadata(forID itemID: String) -> [String: String] {
        [
            "changed": hudsonBool(selection != itemID),
            "expanded": hudsonBool(isExpanded),
            "itemCount": "\(items.count)",
            "itemId": itemID,
        ]
    }
}

private func hudsonBool(_ value: Bool) -> String {
    value ? "true" : "false"
}

// MARK: - Convenience init (no footer)

extension HudNavigationRail where Footer == EmptyView {
    public init(
        selection: Binding<String>,
        items: [HudRailItem],
        isExpanded: Binding<Bool>,
        showHeaderToggle: Bool = true
    ) {
        self.init(
            selection: selection,
            items: items,
            isExpanded: isExpanded,
            showHeaderToggle: showHeaderToggle,
            footer: { EmptyView() }
        )
    }
}

// MARK: - Row

private struct HudRailIconButton: View {
    let item: HudRailItem
    let isSelected: Bool
    let accent: Color
    let onTap: () -> Void
    @FocusState private var isFocused: Bool
    @State private var isHovering = false

    var body: some View {
        Button(action: onTap) {
            Image(systemName: item.icon)
                .font(HudFont.ui(HudTextSize.lgm, weight: .medium))
                .foregroundStyle(isSelected ? accent : HudPalette.muted)
                .frame(maxWidth: .infinity, alignment: .center)
                .frame(height: HudIconSize.xLarge)
            .background(
                RoundedRectangle(cornerRadius: HudRadius.standard)
                    .fill(background)
            )
            .overlay(
                RoundedRectangle(cornerRadius: HudRadius.standard)
                    .stroke(border, lineWidth: isFocused ? 1.5 : 1)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .focusable(true)
        .focused($isFocused)
        .onHover { isHovering = $0 }
        .accessibilityLabel(item.label)
        .accessibilityValue(isSelected ? "Selected" : "Not selected")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private var background: Color {
        if isSelected {
            return HudSurface.tintGhost(accent)
        }
        if isHovering {
            return HudSurface.hover
        }
        return .clear
    }

    private var border: Color {
        if isFocused {
            return HudFocus.ring
        }
        if isSelected {
            return HudSurface.tintBorder(accent)
        }
        if isHovering {
            return HudHairline.subtle
        }
        return .clear
    }
}
