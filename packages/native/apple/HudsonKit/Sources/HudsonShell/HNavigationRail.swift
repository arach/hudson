import SwiftUI
import HudsonUI
import HudsonObservability

// MARK: - Item

/// One row in the navigation rail. `id` is the selection key, `icon` is an
/// SF Symbol name, `label` shows in the expanded rail and as accessibility text.
public struct HRailItem: Identifiable, Equatable, Sendable {
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

/// Vertical navigation rail for the leading slot of `HAppShell`.
///
/// Two widths: 64pt collapsed (icons only) or 220pt expanded (icons + labels).
/// The hamburger button at the top toggles between them; the rail seeds its
/// initial state from `horizontalSizeClass` (compact → collapsed) but the
/// caller owns the binding so persistence is up to the consumer.
///
/// Brand identity in the header (status dot + app name) is read from
/// `@Environment(\.hudsonAppManifest)` so apps can rebrand without touching
/// the rail call site.
public struct HNavigationRail<Footer: View>: View {
    @Binding public var selection: String
    public let items: [HRailItem]
    @Binding public var isExpanded: Bool
    public let showHeaderToggle: Bool
    public let footer: Footer

    @Environment(\.hudsonAppManifest) private var manifest
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(
        selection: Binding<String>,
        items: [HRailItem],
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
            HDivider(color: HHairline.standard)

            if isExpanded {
                List(selection: expandedSelection) {
                    ForEach(items) { item in
                        Label(item.label, systemImage: item.icon)
                            .font(HFont.ui(13, weight: selection == item.id ? .semibold : .regular))
                            .foregroundStyle(selection == item.id ? HPalette.ink : HPalette.muted)
                            .tag(item.id)
                    }
                }
                .listStyle(.sidebar)
                .scrollContentBackground(.hidden)
                .tint(manifest.accent)
            } else {
                VStack(spacing: HSpacing.xs) {
                    ForEach(items) { item in
                        HRailIconButton(
                            item: item,
                            isSelected: selection == item.id,
                            accent: manifest.accent,
                            onTap: {
                                let metadata = selectionMetadata(for: item)
                                HInstrumentation.ui.event("NavigationRail.select", metadata: metadata)
                                HInstrumentation.ui.span("NavigationRail.select.apply", metadata: metadata) {
                                    selection = item.id
                                }
                            }
                        )
                    }
                }
                .padding(.horizontal, HSpacing.sm)
                .padding(.vertical, HSpacing.md)

                Spacer(minLength: 0)
            }

            if isExpanded && Footer.self != EmptyView.self {
                HDivider(color: HHairline.subtle)
                footer
                    .padding(HSpacing.xl)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .frame(width: isExpanded ? 220 : 64)
        .frame(maxHeight: .infinity)
        .background(HPalette.chrome)
    }

    private var expandedSelection: Binding<String?> {
        Binding(
            get: { selection },
            set: { next in
                guard let next, next != selection else { return }
                let metadata = selectionMetadata(forID: next)
                HInstrumentation.ui.event("NavigationRail.select", metadata: metadata)
                HInstrumentation.ui.span("NavigationRail.select.apply", metadata: metadata) {
                    selection = next
                }
            }
        )
    }

    private var header: some View {
        HStack(spacing: HSpacing.lg) {
            if showHeaderToggle {
                Button(action: toggleExpanded) {
                    Image(systemName: isExpanded ? "sidebar.left" : "line.3.horizontal")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(HPalette.muted)
                        .frame(width: 32, height: 32)
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
                    HStack(spacing: HSpacing.lg) {
                        HStatusDot(color: manifest.accent)
                        Text(manifest.name)
                            .font(HFont.ui(13, weight: .semibold))
                            .foregroundStyle(HPalette.ink)
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
                    HStatusDot(color: manifest.accent)
                        .frame(width: 32, height: 32)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Expand navigation")
            } else {
                Spacer(minLength: 0)
            }
        }
        .padding(.horizontal, isExpanded ? HSpacing.lg : 0)
        .frame(height: HLayout.navHeight)
        .frame(maxWidth: .infinity, alignment: isExpanded ? .leading : .center)
    }

    private func toggleExpanded() {
        let metadata = [
            "fromExpanded": hudsonBool(isExpanded),
            "itemCount": "\(items.count)",
            "toExpanded": hudsonBool(!isExpanded),
        ]

        HInstrumentation.ui.event("NavigationRail.toggle", metadata: metadata)
        HInstrumentation.ui.span("NavigationRail.toggle.apply", metadata: metadata) {
            if reduceMotion {
                isExpanded.toggle()
            } else {
                withAnimation(HMotion.chromeResize) {
                    isExpanded.toggle()
                }
            }
        }
    }

    private func selectionMetadata(for item: HRailItem) -> [String: String] {
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

extension HNavigationRail where Footer == EmptyView {
    public init(
        selection: Binding<String>,
        items: [HRailItem],
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

private struct HRailIconButton: View {
    let item: HRailItem
    let isSelected: Bool
    let accent: Color
    let onTap: () -> Void
    @FocusState private var isFocused: Bool
    @State private var isHovering = false

    var body: some View {
        Button(action: onTap) {
            Image(systemName: item.icon)
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(isSelected ? accent : HPalette.muted)
                .frame(maxWidth: .infinity, alignment: .center)
                .frame(height: 40)
            .background(
                RoundedRectangle(cornerRadius: HRadius.standard)
                    .fill(background)
            )
            .overlay(
                RoundedRectangle(cornerRadius: HRadius.standard)
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
            return accent.opacity(0.08)
        }
        if isHovering {
            return Color.white.opacity(0.045)
        }
        return .clear
    }

    private var border: Color {
        if isFocused {
            return HPalette.statusInfo.opacity(0.85)
        }
        if isSelected {
            return accent.opacity(0.3)
        }
        if isHovering {
            return HHairline.subtle
        }
        return .clear
    }
}
