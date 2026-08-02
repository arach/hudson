import SwiftUI

enum HudSettingsDetailLayout: Equatable, Sendable {
    case stacked
    case columns
}

enum HudSettingsDetailLayoutPolicy {
    static func layout(for width: CGFloat, collapseBelow: CGFloat) -> HudSettingsDetailLayout {
        width < collapseBelow ? .stacked : .columns
    }
}

/// A two-column settings canvas with a fixed-width selection column and a
/// flexible detail column. Apps own the data and navigation model; Hudson owns
/// the spacing, divider, and responsive collapse behavior.
public struct HudSettingsDetail<Sidebar: View, Detail: View>: View {
    public var sidebarWidth: CGFloat
    public var collapseBelow: CGFloat
    @ViewBuilder public var sidebar: () -> Sidebar
    @ViewBuilder public var detail: () -> Detail

    public init(
        sidebarWidth: CGFloat = 236,
        collapseBelow: CGFloat = 760,
        @ViewBuilder sidebar: @escaping () -> Sidebar,
        @ViewBuilder detail: @escaping () -> Detail
    ) {
        self.sidebarWidth = sidebarWidth
        self.collapseBelow = collapseBelow
        self.sidebar = sidebar
        self.detail = detail
    }

    public var body: some View {
        GeometryReader { proxy in
            let layoutMode = HudSettingsDetailLayoutPolicy.layout(
                for: proxy.size.width,
                collapseBelow: collapseBelow
            )
            let layout = switch layoutMode {
            case .stacked:
                AnyLayout(VStackLayout(alignment: .leading, spacing: HudSpacing.xxl))
            case .columns:
                AnyLayout(HStackLayout(alignment: .top, spacing: HudSpacing.xxl))
            }

            layout {
                sidebar()
                    .frame(
                        minWidth: layoutMode == .columns ? sidebarWidth : nil,
                        idealWidth: layoutMode == .columns ? sidebarWidth : nil,
                        maxWidth: layoutMode == .columns ? sidebarWidth : .infinity,
                        alignment: .topLeading
                    )
                HudDivider(axis: layoutMode == .columns ? .vertical : .horizontal)
                detail()
                    .frame(maxWidth: .infinity, alignment: .topLeading)
            }
        }
    }
}

/// Compact master-column row for settings navigation. Unlike `HudListRow`,
/// icons stay neutral until selected so one app accent describes interaction
/// without tinting every item in the list.
public struct HudSettingsNavigationRow<Trailing: View>: View {
    public let title: String
    public var subtitle: String?
    public let icon: String
    public var isSelected: Bool
    public var accent: Color?
    public var onTap: () -> Void
    @ViewBuilder public var trailing: () -> Trailing

    @Environment(\.hudTheme) private var theme
    @State private var isHovering = false

    public init(
        title: String,
        subtitle: String? = nil,
        icon: String,
        isSelected: Bool,
        accent: Color? = nil,
        onTap: @escaping () -> Void,
        @ViewBuilder trailing: @escaping () -> Trailing
    ) {
        self.title = title
        self.subtitle = subtitle
        self.icon = icon
        self.isSelected = isSelected
        self.accent = accent
        self.onTap = onTap
        self.trailing = trailing
    }

    public var body: some View {
        let resolvedAccent = accent ?? theme.palette.accent
        Button(action: onTap) {
            HStack(spacing: HudSpacing.md) {
                Image(systemName: icon)
                    .font(HudFont.ui(HudTextSize.sm, weight: .medium))
                    .foregroundStyle(isSelected ? resolvedAccent : theme.palette.muted)
                    .frame(width: HudIconSize.medium, height: HudIconSize.medium)
                    .background(
                        RoundedRectangle(cornerRadius: HudRadius.standard)
                            .fill(isSelected ? HudSurface.tintFill(resolvedAccent) : HudSurface.inset)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: HudRadius.standard)
                            .stroke(
                                isSelected
                                    ? HudSurface.tintBorder(resolvedAccent)
                                    : theme.hairline.subtle
                            )
                    )

                VStack(alignment: .leading, spacing: HudSpacing.xxs) {
                    Text(title)
                        .hudFont(.sm, weight: isSelected ? .semibold : .medium)
                        .foregroundStyle(theme.palette.ink)
                    if let subtitle {
                        Text(subtitle)
                            .hudFont(.xs, weight: .light)
                            .foregroundStyle(theme.palette.muted)
                            .lineLimit(1)
                    }
                }

                Spacer(minLength: HudSpacing.sm)
                trailing()
            }
            .padding(.horizontal, HudSpacing.md)
            .frame(minHeight: HudLayout.rowHeightRegular + HudSpacing.md)
            .background(
                RoundedRectangle(cornerRadius: theme.radius.standard)
                    .fill(
                        isSelected
                            ? HudSurface.tintGhost(resolvedAccent)
                            : isHovering ? HudSurface.hover : HudSurface.inset
                    )
            )
            .overlay(
                RoundedRectangle(cornerRadius: theme.radius.standard)
                    .stroke(
                        isSelected
                            ? HudSurface.tintBorder(resolvedAccent)
                            : theme.hairline.subtle
                    )
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { isHovering = $0 }
        .accessibilityLabel(subtitle.map { "\(title), \($0)" } ?? title)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

extension HudSettingsNavigationRow where Trailing == EmptyView {
    public init(
        title: String,
        subtitle: String? = nil,
        icon: String,
        isSelected: Bool,
        accent: Color? = nil,
        onTap: @escaping () -> Void
    ) {
        self.init(
            title: title,
            subtitle: subtitle,
            icon: icon,
            isSelected: isSelected,
            accent: accent,
            onTap: onTap,
            trailing: { EmptyView() }
        )
    }
}

/// Status-bearing settings card for API keys, access tokens, and similar app
/// credentials. Storage remains app-owned; this composes `HudSecretField` with
/// the standard settings title, state badge, and optional enrollment link.
public struct HudCredentialSection: View {
    public let title: String
    public var subtitle: String?
    public var placeholder: String
    @Binding public var text: String
    public var destinationTitle: String?
    public var destinationURL: URL?
    public var configuredLabel: String
    public var emptyLabel: String

    @Environment(\.hudTheme) private var theme

    public init(
        _ title: String,
        subtitle: String? = nil,
        placeholder: String = "Secret",
        text: Binding<String>,
        destinationTitle: String? = nil,
        destinationURL: URL? = nil,
        configuredLabel: String = "Configured",
        emptyLabel: String = "Not configured"
    ) {
        self.title = title
        self.subtitle = subtitle
        self.placeholder = placeholder
        self._text = text
        self.destinationTitle = destinationTitle
        self.destinationURL = destinationURL
        self.configuredLabel = configuredLabel
        self.emptyLabel = emptyLabel
    }

    public var body: some View {
        HudCard {
            VStack(alignment: .leading, spacing: HudSpacing.lg) {
                HStack(spacing: HudSpacing.md) {
                    HudSettingsLeadingIcon(
                        systemName: "key.fill",
                        color: theme.palette.accent,
                        weight: .medium
                    )

                    VStack(alignment: .leading, spacing: HudSpacing.xxs) {
                        Text(title)
                            .hudFont(.md, weight: .semibold)
                            .foregroundStyle(theme.palette.ink)
                        if let subtitle {
                            Text(subtitle)
                                .hudFont(.xs, weight: .light)
                                .foregroundStyle(theme.palette.muted)
                        }
                    }

                    Spacer(minLength: 0)
                    HudBadge(
                        text.isEmpty ? emptyLabel.uppercased() : configuredLabel.uppercased(),
                        tint: text.isEmpty ? theme.palette.muted : theme.palette.statusOk,
                        dot: true
                    )
                }

                HudSecretField(placeholder, text: $text)

                if let destinationTitle, let destinationURL {
                    HStack {
                        Spacer(minLength: 0)
                        Link(destinationTitle, destination: destinationURL)
                            .hudFont(.xs, weight: .semibold)
                            .tint(theme.palette.accent)
                    }
                }
            }
        }
    }
}
