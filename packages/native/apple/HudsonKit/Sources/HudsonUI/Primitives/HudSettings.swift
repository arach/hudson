import SwiftUI

/// Section container for settings screens. Uppercase tracked label sits above
/// a surface-filled card with a hairline stroke. Pairs with `HudSettingsRow`
/// for the row content and `HudSettingsQuickNav` (iOS) for jump-scrolling.
///
/// Distinct from `HudListRow` in vocabulary: settings rows are calm and static,
/// list rows are dense and interactive. Reach for `HudSettingsSection`/`Row`
/// in settings, preferences, and inspectors; `HudListRow` for inboxes, target
/// grids, and selection lists.
public struct HudSettingsSection<Content: View>: View {
    public let title: String
    public var labelTint: Color
    @ViewBuilder public var content: () -> Content
    @Environment(\.hudTheme) private var theme

    public init(
        _ title: String,
        labelTint: Color = HudPalette.dim,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.title = title
        self.labelTint = labelTint
        self.content = content
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: HudSpacing.md) {
            HudSectionLabel(title, tint: labelTint)
                .padding(.horizontal, HudSpacing.xl)

            VStack(spacing: 0) {
                content()
            }
            .background(RoundedRectangle(cornerRadius: theme.radius.standard).fill(theme.palette.surface))
            .overlay(RoundedRectangle(cornerRadius: theme.radius.standard).stroke(theme.hairline.subtle, lineWidth: HudStrokeWidth.thin))
        }
        .id(title)
    }
}

/// Calm, static settings row with leading icon, title/subtitle, optional
/// trailing badge (any view), and chevron. Tappable via `onTap`; renders as a
/// plain non-button when `onTap` is nil so the row is purely informational.
public struct HudSettingsRow<Badge: View>: View {
    public let icon: String
    public var iconColor: Color
    public let title: String
    public var subtitle: String?
    public var onTap: (() -> Void)?
    @ViewBuilder public var badge: () -> Badge
    @Environment(\.hudTheme) private var theme

    public init(
        icon: String,
        iconColor: Color = HudPalette.muted,
        title: String,
        subtitle: String? = nil,
        onTap: (() -> Void)? = nil,
        @ViewBuilder badge: @escaping () -> Badge
    ) {
        self.icon = icon
        self.iconColor = iconColor
        self.title = title
        self.subtitle = subtitle
        self.onTap = onTap
        self.badge = badge
    }

    public var body: some View {
        let content = HStack(spacing: HudSpacing.xl) {
            HudSettingsLeadingIcon(systemName: icon, color: iconColor)

            VStack(alignment: .leading, spacing: HudSpacing.xxs) {
                Text(title)
                    .font(HudFont.ui(HudTextSize.md, weight: .regular))
                    .foregroundStyle(theme.palette.ink)
                if let subtitle {
                    Text(subtitle)
                        .font(HudFont.ui(HudTextSize.xs, weight: .light))
                        .foregroundStyle(theme.palette.muted)
                }
            }

            Spacer(minLength: 0)
            badge()

            if onTap != nil {
                Image(systemName: "chevron.right")
                    .font(HudFont.ui(HudTextSize.xs, weight: .light))
                    .foregroundStyle(HudSurface.tintStrong(theme.palette.dim))
            }
        }
        .padding(.horizontal, HudSpacing.md)
        .padding(.vertical, HudSpacing.lg)

        if let onTap {
            Button(action: onTap) { content }
                .buttonStyle(.plain)
                .contentShape(Rectangle())
        } else {
            content
        }
    }
}

extension HudSettingsRow where Badge == EmptyView {
    public init(
        icon: String,
        iconColor: Color = HudPalette.muted,
        title: String,
        subtitle: String? = nil,
        onTap: (() -> Void)? = nil
    ) {
        self.init(
            icon: icon,
            iconColor: iconColor,
            title: title,
            subtitle: subtitle,
            onTap: onTap,
            badge: { EmptyView() }
        )
    }
}

public struct HudSettingsControlRow<Control: View>: View {
    public let title: String
    public var subtitle: String?
    public var value: String?
    public var icon: String?
    public var iconColor: Color
    @ViewBuilder public var control: () -> Control

    @Environment(\.hudTheme) private var theme

    public init(
        title: String,
        subtitle: String? = nil,
        value: String? = nil,
        icon: String? = nil,
        iconColor: Color = HudPalette.muted,
        @ViewBuilder control: @escaping () -> Control
    ) {
        self.title = title
        self.subtitle = subtitle
        self.value = value
        self.icon = icon
        self.iconColor = iconColor
        self.control = control
    }

    public var body: some View {
        HStack(alignment: .center, spacing: HudSpacing.xl) {
            if let icon {
                HudSettingsLeadingIcon(systemName: icon, color: iconColor)
            }

            VStack(alignment: .leading, spacing: HudSpacing.xxs) {
                Text(title)
                    .font(HudFont.ui(HudTextSize.md, weight: .regular))
                    .foregroundStyle(theme.palette.ink)
                HStack(spacing: HudSpacing.sm) {
                    if let subtitle {
                        Text(subtitle)
                    }
                    if subtitle != nil, value != nil {
                        Text("·")
                    }
                    if let value {
                        Text(value)
                    }
                }
                .font(HudFont.ui(HudTextSize.xs, weight: .light))
                .foregroundStyle(theme.palette.muted)
                .lineLimit(1)
            }

            Spacer(minLength: HudSpacing.lg)
            control()
        }
        .padding(.horizontal, HudSpacing.md)
        .padding(.vertical, HudSpacing.lg)
    }
}

public struct HudSettingsPickerRow<SelectionValue: Hashable, Options: View>: View {
    public let title: String
    public var subtitle: String?
    public var value: String?
    public var icon: String?
    public var iconColor: Color
    @Binding public var selection: SelectionValue
    @ViewBuilder public var options: () -> Options

    public init(
        title: String,
        subtitle: String? = nil,
        value: String? = nil,
        icon: String? = nil,
        iconColor: Color = HudPalette.muted,
        selection: Binding<SelectionValue>,
        @ViewBuilder options: @escaping () -> Options
    ) {
        self.title = title
        self.subtitle = subtitle
        self.value = value
        self.icon = icon
        self.iconColor = iconColor
        self._selection = selection
        self.options = options
    }

    public var body: some View {
        HudSettingsControlRow(
            title: title,
            subtitle: subtitle,
            value: value,
            icon: icon,
            iconColor: iconColor
        ) {
            Picker(title, selection: $selection) {
                options()
            }
            .labelsHidden()
            .pickerStyle(.menu)
            .frame(width: HudLayout.popoverWidthCompact / 2)
        }
    }
}

public struct HudSettingsSliderRow: View {
    public let title: String
    public var subtitle: String?
    public var value: String?
    public var icon: String?
    public var iconColor: Color
    @Binding public var number: Double
    public var bounds: ClosedRange<Double>
    public var step: Double

    public init(
        title: String,
        subtitle: String? = nil,
        value: String? = nil,
        icon: String? = nil,
        iconColor: Color = HudPalette.muted,
        number: Binding<Double>,
        in bounds: ClosedRange<Double>,
        step: Double = 1
    ) {
        self.title = title
        self.subtitle = subtitle
        self.value = value
        self.icon = icon
        self.iconColor = iconColor
        self._number = number
        self.bounds = bounds
        self.step = step
    }

    public var body: some View {
        HudSettingsControlRow(
            title: title,
            subtitle: subtitle,
            value: value,
            icon: icon,
            iconColor: iconColor
        ) {
            Slider(value: $number, in: bounds, step: step)
                .frame(width: HudLayout.popoverWidthCompact / 2)
        }
    }
}

/// Shared settings status vocabulary: a small dot plus mono label. Use this for
/// row annotations such as `ON`, `NEEDS SETUP`, `INHERIT`, or `OVERRIDE` so
/// settings screens scan consistently instead of mixing ad-hoc badges.
public enum HudSettingsStatusTone: String, CaseIterable {
    case ok
    case warning
    case error
    case info
    case neutral

    public var tint: Color {
        switch self {
        case .ok: return HudPalette.statusOk
        case .warning: return HudPalette.statusWarn
        case .error: return HudPalette.statusError
        case .info: return HudPalette.statusInfo
        case .neutral: return HudPalette.dim
        }
    }
}

public struct HudSettingsStatusChip: View {
    public let label: String
    public var tone: HudSettingsStatusTone
    public var showsDot: Bool

    public init(
        _ label: String,
        tone: HudSettingsStatusTone = .neutral,
        showsDot: Bool = true
    ) {
        self.label = label
        self.tone = tone
        self.showsDot = showsDot
    }

    public var body: some View {
        HStack(spacing: HudSpacing.xs) {
            if showsDot {
                HudStatusDot(color: tone.tint, size: HudDotSize.tiny)
            }
            Text(label.uppercased())
                .font(HudFont.mono(HudTextSize.micro, weight: .semibold))
                .tracking(0.8)
        }
        .foregroundStyle(tone.tint)
        .padding(.horizontal, HudSpacing.sm)
        .padding(.vertical, HudSpacing.xxs)
        .background(Capsule().fill(HudSurface.tintFill(tone.tint)))
        .overlay(Capsule().stroke(HudSurface.tintBorder(tone.tint), lineWidth: HudStrokeWidth.thin))
    }
}

public struct HudSettingsInlineAction: Identifiable {
    public let id: String
    public let systemName: String
    public let help: String
    public let action: () -> Void

    public init(
        id: String? = nil,
        systemName: String,
        help: String,
        action: @escaping () -> Void
    ) {
        self.id = id ?? "\(systemName).\(help)"
        self.systemName = systemName
        self.help = help
        self.action = action
    }
}

public struct HudSettingsInlineActionButton: View {
    public let systemName: String
    public let help: String
    public let action: () -> Void

    @State private var isHovering = false
    @Environment(\.hudTheme) private var theme

    public init(
        systemName: String,
        help: String,
        action: @escaping () -> Void
    ) {
        self.systemName = systemName
        self.help = help
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(HudFont.ui(HudTextSize.xs, weight: .medium))
                .foregroundStyle(isHovering ? theme.palette.ink : theme.palette.muted)
                .frame(
                    width: HudLayout.textDocumentModeButtonHeight,
                    height: HudLayout.textDocumentModeButtonHeight
                )
                .background(
                    RoundedRectangle(cornerRadius: theme.radius.tight)
                        .fill(isHovering ? HudSurface.hover : theme.palette.chrome)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: theme.radius.tight)
                        .stroke(isHovering ? theme.hairline.standard : theme.hairline.subtle, lineWidth: HudStrokeWidth.thin)
                )
        }
        .buttonStyle(.plain)
        .help(help)
        .onHover { isHovering = $0 }
    }
}

/// Labeled key/value row for calm settings metadata. Values select cleanly and
/// truncate in the middle so bundle IDs and paths remain recognizable.
public struct HudSettingsMetaRow<Accessory: View>: View {
    public let icon: String
    public var iconColor: Color
    public let label: String
    public let value: String
    public var labelWidth: CGFloat
    public var monoValue: Bool
    @ViewBuilder public var accessory: () -> Accessory

    @Environment(\.hudTheme) private var theme

    public init(
        icon: String,
        iconColor: Color = HudPalette.muted,
        label: String,
        value: String,
        labelWidth: CGFloat = 96,
        monoValue: Bool = false,
        @ViewBuilder accessory: @escaping () -> Accessory
    ) {
        self.icon = icon
        self.iconColor = iconColor
        self.label = label
        self.value = value
        self.labelWidth = labelWidth
        self.monoValue = monoValue
        self.accessory = accessory
    }

    public var body: some View {
        HStack(alignment: .center, spacing: HudSpacing.xl) {
            HudSettingsLeadingIcon(systemName: icon, color: iconColor)

            Text(label)
                .font(HudFont.ui(HudTextSize.md))
                .foregroundStyle(theme.palette.ink)
                .frame(width: labelWidth, alignment: .leading)

            Text(value)
                .font(monoValue ? HudFont.mono(HudTextSize.xs) : HudFont.ui(HudTextSize.sm))
                .foregroundStyle(theme.palette.muted)
                .textSelection(.enabled)
                .lineLimit(1)
                .truncationMode(.middle)
                .frame(maxWidth: .infinity, alignment: .leading)

            accessory()
        }
        .padding(.horizontal, HudSpacing.lg)
        .padding(.vertical, HudSpacing.md)
    }
}

extension HudSettingsMetaRow where Accessory == EmptyView {
    public init(
        icon: String,
        iconColor: Color = HudPalette.muted,
        label: String,
        value: String,
        labelWidth: CGFloat = 96,
        monoValue: Bool = false
    ) {
        self.init(
            icon: icon,
            iconColor: iconColor,
            label: label,
            value: value,
            labelWidth: labelWidth,
            monoValue: monoValue,
            accessory: { EmptyView() }
        )
    }
}

/// Path/file row for agent-manageable settings surfaces. Copy/reveal actions
/// stay on the trailing edge and become brighter on hover.
public struct HudSettingsPathRow: View {
    public let icon: String
    public var iconColor: Color
    public let label: String
    public let path: String
    public var actions: [HudSettingsInlineAction]

    @State private var isHovering = false
    @Environment(\.hudTheme) private var theme

    public init(
        icon: String,
        iconColor: Color = HudPalette.muted,
        label: String,
        path: String,
        actions: [HudSettingsInlineAction] = []
    ) {
        self.icon = icon
        self.iconColor = iconColor
        self.label = label
        self.path = path
        self.actions = actions
    }

    public var body: some View {
        HStack(alignment: .top, spacing: HudSpacing.xl) {
            HudSettingsLeadingIcon(systemName: icon, color: iconColor)

            VStack(alignment: .leading, spacing: HudSpacing.xxs) {
                Text(label)
                    .font(HudFont.ui(HudTextSize.md))
                    .foregroundStyle(theme.palette.ink)
                Text(path)
                    .font(HudFont.mono(HudTextSize.xs))
                    .foregroundStyle(theme.palette.muted)
                    .textSelection(.enabled)
                    .lineLimit(2)
                    .truncationMode(.middle)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if !actions.isEmpty {
                HStack(spacing: HudSpacing.xs) {
                    ForEach(actions) { item in
                        HudSettingsInlineActionButton(
                            systemName: item.systemName,
                            help: item.help,
                            action: item.action
                        )
                    }
                }
                .opacity(isHovering ? 1 : 0.64)
            }
        }
        .padding(.horizontal, HudSpacing.lg)
        .padding(.vertical, HudSpacing.md)
        .contentShape(Rectangle())
        .onHover { isHovering = $0 }
        .animation(.easeOut(duration: 0.12), value: isHovering)
    }
}

public struct HudSettingsQuickAction: Identifiable {
    public let id: String
    public let title: String
    public let subtitle: String?
    public let systemName: String
    public let tint: Color
    public let action: () -> Void

    public init(
        id: String? = nil,
        title: String,
        subtitle: String? = nil,
        systemName: String,
        tint: Color = HudPalette.accent,
        action: @escaping () -> Void
    ) {
        self.id = id ?? title
        self.title = title
        self.subtitle = subtitle
        self.systemName = systemName
        self.tint = tint
        self.action = action
    }
}

/// Pinned action lane for the settings operations users actually reach for:
/// copy paths, reveal files, open a paired system pane, or reset a scoped area.
public struct HudSettingsQuickActionBar: View {
    public let actions: [HudSettingsQuickAction]
    @Environment(\.hudTheme) private var theme

    public init(actions: [HudSettingsQuickAction]) {
        self.actions = actions
    }

    public var body: some View {
        HStack(spacing: 0) {
            ForEach(actions.indices, id: \.self) { index in
                HudSettingsQuickActionButton(action: actions[index])
                    .frame(maxWidth: .infinity)
                if index < actions.count - 1 {
                    Rectangle()
                        .fill(theme.hairline.subtle)
                        .frame(width: HudStrokeWidth.thin)
                }
            }
        }
    }
}

private struct HudSettingsQuickActionButton: View {
    let action: HudSettingsQuickAction
    @State private var isHovering = false
    @Environment(\.hudTheme) private var theme

    var body: some View {
        Button(action: action.action) {
            HStack(spacing: HudSpacing.md) {
                HudSettingsLeadingIcon(
                    systemName: action.systemName,
                    color: isHovering ? action.tint : theme.palette.muted,
                    fontSize: 13,
                    weight: .medium
                )

                VStack(alignment: .leading, spacing: HudSpacing.xxs) {
                    Text(action.title)
                        .font(HudFont.ui(HudTextSize.sm, weight: .medium))
                        .foregroundStyle(theme.palette.ink)
                    if let subtitle = action.subtitle {
                        Text(subtitle)
                            .font(HudFont.mono(HudTextSize.xs))
                            .foregroundStyle(theme.palette.dim)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, HudSpacing.lg)
            .padding(.vertical, HudSpacing.lg)
            .background(isHovering ? HudSurface.tintFill(action.tint) : Color.clear)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { isHovering = $0 }
        .animation(.easeOut(duration: 0.12), value: isHovering)
    }
}

/// Flat leading icon for `HudSettingsRow`. 28×28 frame, no background — calmer
/// than `HudListRow`'s tinted-background icon, matching the static-settings tone.
public struct HudSettingsLeadingIcon: View {
    public let systemName: String
    public var color: Color
    public var fontSize: CGFloat
    public var weight: Font.Weight

    public init(
        systemName: String,
        color: Color = HudPalette.muted,
        fontSize: CGFloat = 14,
        weight: Font.Weight = .light
    ) {
        self.systemName = systemName
        self.color = color
        self.fontSize = fontSize
        self.weight = weight
    }

    public var body: some View {
        Image(systemName: systemName)
            .font(.system(size: fontSize, weight: weight))
            .foregroundStyle(color)
            .frame(width: HudIconSize.medium, height: HudIconSize.medium)
    }
}
