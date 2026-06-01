import SwiftUI

/// Dense, inspector-style settings surface for operational app shells.
///
/// This is the compact sibling of `HudSettingsSection`/`HudSettingsRow`: use
/// the card-based settings components for calm account/preferences screens, and
/// use this inspector pattern when the user needs to scan lots of live runtime
/// state, toggles, and setup checks without leaving the current shell.
public struct HudInspectorTab<ID: Hashable>: Identifiable {
    public let id: ID
    public let label: String
    public var accessibilityLabel: String

    public init(id: ID, label: String, accessibilityLabel: String? = nil) {
        self.id = id
        self.label = label
        self.accessibilityLabel = accessibilityLabel ?? label
    }
}

public struct HudInspectorSettings<ID: Hashable, Content: View>: View {
    public let title: String
    public var subtitle: String?
    public let tabs: [HudInspectorTab<ID>]
    @Binding public var selection: ID
    @ViewBuilder public var content: (ID) -> Content

    @Environment(\.hudTheme) private var theme

    public init(
        title: String,
        subtitle: String? = nil,
        tabs: [HudInspectorTab<ID>],
        selection: Binding<ID>,
        @ViewBuilder content: @escaping (ID) -> Content
    ) {
        self.title = title
        self.subtitle = subtitle
        self.tabs = tabs
        self._selection = selection
        self.content = content
    }

    public var body: some View {
        VStack(spacing: 0) {
            header

            Rectangle()
                .fill(theme.hairline.subtle)
                .frame(height: HudStrokeWidth.thin)

            HStack(spacing: 0) {
                rail
                panel
            }
        }
        .background(theme.palette.bg)
    }

    private var header: some View {
        HStack(spacing: HudSpacing.md) {
            Text(title.uppercased())
                .font(HudFont.mono(HudTextSize.xs, weight: .semibold))
                .tracking(3.0)
                .foregroundStyle(theme.palette.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.78)

            if let subtitle {
                Text(subtitle.uppercased())
                    .font(HudFont.mono(HudTextSize.micro, weight: .medium))
                    .tracking(1.4)
                    .foregroundStyle(theme.palette.dim)
                    .lineLimit(1)
            }

            Spacer(minLength: 0)
        }
        .frame(height: HudLayout.navHeight)
        .padding(.horizontal, HudSpacing.xxl)
    }

    private var rail: some View {
        VStack(spacing: 0) {
            ForEach(tabs) { tab in
                railChip(tab)

                if tab.id != tabs.last?.id {
                    Rectangle()
                        .fill(theme.hairline.subtle)
                        .frame(height: HudStrokeWidth.thin)
                }
            }

            Spacer(minLength: 0)
        }
        .frame(width: HudInspectorMetrics.railWidth)
        .overlay(alignment: .trailing) {
            Rectangle()
                .fill(theme.hairline.subtle)
                .frame(width: HudStrokeWidth.thin)
        }
    }

    private func railChip(_ tab: HudInspectorTab<ID>) -> some View {
        let isActive = tab.id == selection

        return Button {
            withAnimation(.easeOut(duration: 0.18)) {
                selection = tab.id
            }
        } label: {
            ZStack {
                Text(tab.label.uppercased())
                    .font(HudFont.mono(HudTextSize.micro, weight: isActive ? .semibold : .medium))
                    .tracking(3.0)
                    .foregroundStyle(isActive ? theme.palette.ink : theme.palette.dim)
                    .fixedSize()
                    .rotationEffect(.degrees(-90))
            }
            .frame(width: HudInspectorMetrics.railWidth, height: HudInspectorMetrics.railChipHeight)
            .background(isActive ? HudSurface.tintGhost(theme.palette.accent) : Color.clear)
            .overlay(alignment: .leading) {
                Rectangle()
                    .fill(isActive ? theme.palette.accent : Color.clear)
                    .frame(width: HudStrokeWidth.bold)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(tab.accessibilityLabel)
    }

    private var panel: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("INSPECTOR · \(activeLabel)")
                    .font(HudFont.mono(HudTextSize.xxs, weight: .semibold))
                    .tracking(2.2)
                    .foregroundStyle(theme.palette.dim)
                    .lineLimit(1)
                    .minimumScaleFactor(0.82)

                Spacer(minLength: 0)
            }
            .frame(height: HudInspectorMetrics.panelHeaderHeight)
            .padding(.horizontal, HudSpacing.xxl)

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    content(selection)
                }
                .padding(.horizontal, HudSpacing.xxl)
                .padding(.bottom, HudSpacing.huge * 3)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var activeLabel: String {
        tabs.first { $0.id == selection }?.label.uppercased() ?? ""
    }
}

public struct HudInspectorInlineAction {
    public let label: String
    public let action: () -> Void

    public init(_ label: String, action: @escaping () -> Void) {
        self.label = label
        self.action = action
    }
}

public struct HudInspectorChoice: Identifiable, Equatable, Sendable {
    public let id: String
    public let title: String

    public init(id: String, title: String) {
        self.id = id
        self.title = title
    }
}

public struct HudInspectorSection<Content: View>: View {
    public let title: String
    @ViewBuilder public var content: () -> Content
    @Environment(\.hudTheme) private var theme

    public init(_ title: String, @ViewBuilder content: @escaping () -> Content) {
        self.title = title
        self.content = content
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                HudSectionLabel(title, tint: theme.palette.dim)
                Spacer(minLength: 0)
            }
            .frame(height: HudInspectorMetrics.sectionHeaderHeight)
            .padding(.top, HudSpacing.md)
            .overlay(alignment: .bottom) {
                HudInspectorDivider()
            }

            content()
        }
    }
}

public struct HudInspectorFieldRow: View {
    public let label: String
    public let value: String
    public var hint: String?
    public var inlineAction: HudInspectorInlineAction?
    @Environment(\.hudTheme) private var theme

    public init(
        _ label: String,
        value: String,
        hint: String? = nil,
        inlineAction: HudInspectorInlineAction? = nil
    ) {
        self.label = label
        self.value = value
        self.hint = hint
        self.inlineAction = inlineAction
    }

    public var body: some View {
        HStack(alignment: .center, spacing: HudSpacing.sm) {
            HudInspectorLabel(label, hint: hint)

            Spacer(minLength: HudSpacing.md)

            HStack(spacing: HudInspectorMetrics.trailingSpacing) {
                HudInspectorValue(value)

                if let inlineAction {
                    Button(action: inlineAction.action) {
                        Text(inlineAction.label.uppercased())
                            .font(HudFont.mono(HudTextSize.micro, weight: .semibold))
                            .tracking(0.8)
                            .foregroundStyle(theme.palette.accent)
                            .padding(.horizontal, HudSpacing.sm)
                            .padding(.vertical, HudSpacing.xxs)
                            .overlay(
                                Capsule()
                                    .strokeBorder(
                                        HudSurface.tintBorder(theme.palette.accent),
                                        lineWidth: HudStrokeWidth.thin
                                    )
                            )
                    }
                    .buttonStyle(.plain)
                } else {
                    Color.clear
                        .frame(width: HudInspectorMetrics.trailingGlyphSize,
                               height: HudInspectorMetrics.trailingGlyphSize)
                        .accessibilityHidden(true)
                }
            }
            .fixedSize(horizontal: true, vertical: false)
        }
        .hudInspectorRowChrome()
    }
}

public struct HudInspectorCycleRow: View {
    public let label: String
    @Binding public var selection: String
    public let choices: [HudInspectorChoice]
    public var hint: String?
    public var onChange: ((String) -> Void)?
    @Environment(\.hudTheme) private var theme

    public init(
        _ label: String,
        selection: Binding<String>,
        choices: [HudInspectorChoice],
        hint: String? = nil,
        onChange: ((String) -> Void)? = nil
    ) {
        self.label = label
        self._selection = selection
        self.choices = choices
        self.hint = hint
        self.onChange = onChange
    }

    public var body: some View {
        Button {
            guard !choices.isEmpty else { return }
            let currentIndex = choices.firstIndex { $0.id == selection }
            let nextIndex = currentIndex.map { choices.index(after: $0) % choices.count } ?? choices.startIndex
            let nextValue = choices[nextIndex].id
            selection = nextValue
            onChange?(nextValue)
        } label: {
            HStack(alignment: .center, spacing: HudSpacing.sm) {
                HudInspectorLabel(label, hint: hint)
                    .layoutPriority(0)

                Spacer(minLength: HudSpacing.md)

                HStack(spacing: HudInspectorMetrics.trailingSpacing) {
                    HudInspectorValue(currentChoice.title)

                    Image(systemName: "arrow.triangle.2.circlepath")
                        .font(.system(size: HudTextSize.xxs, weight: .medium))
                        .foregroundStyle(theme.palette.dim)
                        .frame(width: HudInspectorMetrics.trailingGlyphSize,
                               height: HudInspectorMetrics.trailingGlyphSize)
                        .accessibilityHidden(true)
                }
                .fixedSize(horizontal: true, vertical: false)
            }
            .hudInspectorRowChrome()
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(label): \(currentChoice.title)")
        .accessibilityHint("Cycles to the next option")
    }

    private var currentChoice: HudInspectorChoice {
        choices.first { $0.id == selection }
            ?? choices.first
            ?? HudInspectorChoice(id: selection, title: selection)
    }
}

public struct HudInspectorToggleRow: View {
    public let label: String
    @Binding public var isOn: Bool
    public let valueOn: String
    public let valueOff: String
    public var hint: String?
    @Environment(\.hudTheme) private var theme

    public init(
        _ label: String,
        isOn: Binding<Bool>,
        valueOn: String = "On",
        valueOff: String = "Off",
        hint: String? = nil
    ) {
        self.label = label
        self._isOn = isOn
        self.valueOn = valueOn
        self.valueOff = valueOff
        self.hint = hint
    }

    public var body: some View {
        HStack(alignment: .center, spacing: HudSpacing.sm) {
            HudInspectorLabel(label, hint: hint)

            Spacer(minLength: HudSpacing.md)

            HStack(spacing: HudInspectorMetrics.trailingSpacing) {
                HudInspectorValue(isOn ? valueOn : valueOff)

                Toggle(label, isOn: $isOn)
                    .labelsHidden()
                    .tint(theme.palette.accent)
                    .controlSize(.mini)
                    .fixedSize()
            }
            .fixedSize(horizontal: true, vertical: false)
        }
        .hudInspectorRowChrome()
    }
}

public struct HudInspectorActionRow: View {
    public enum Tone {
        case neutral
        case accent
        case warn
    }

    public let label: String
    public var value: String
    public var tone: Tone
    public var action: () -> Void
    @Environment(\.hudTheme) private var theme

    public init(
        _ label: String,
        value: String = "Run",
        tone: Tone = .neutral,
        action: @escaping () -> Void = {}
    ) {
        self.label = label
        self.value = value
        self.tone = tone
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            HStack(alignment: .center, spacing: HudSpacing.md) {
                Text(label)
                    .font(HudFont.ui(HudTextSize.md))
                    .foregroundStyle(theme.palette.ink)
                    .lineLimit(1)

                Spacer(minLength: HudSpacing.md)

                Text(value.uppercased())
                    .font(HudFont.mono(HudTextSize.xxs, weight: .semibold))
                    .tracking(1.0)
                    .foregroundStyle(tint)
            }
            .hudInspectorRowChrome()
        }
        .buttonStyle(.plain)
    }

    private var tint: Color {
        switch tone {
        case .neutral: return theme.palette.dim
        case .accent: return theme.palette.accent
        case .warn: return theme.palette.statusWarn
        }
    }
}

public struct HudInspectorNavRow: View {
    public let label: String
    public var action: () -> Void
    @Environment(\.hudTheme) private var theme

    public init(_ label: String, action: @escaping () -> Void = {}) {
        self.label = label
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            HStack(alignment: .center, spacing: HudSpacing.md) {
                Text(label)
                    .font(HudFont.ui(HudTextSize.md))
                    .foregroundStyle(theme.palette.ink)
                    .lineLimit(1)

                Spacer(minLength: HudSpacing.md)

                Image(systemName: "chevron.right")
                    .font(.system(size: HudTextSize.xs, weight: .medium))
                    .foregroundStyle(theme.palette.dim)
                    .frame(width: HudInspectorMetrics.trailingGlyphSize,
                           height: HudInspectorMetrics.trailingGlyphSize)
            }
            .hudInspectorRowChrome()
        }
        .buttonStyle(.plain)
    }
}

public struct HudInspectorMetricStrip: View {
    public struct Metric: Identifiable, Sendable {
        public let id: String
        public let label: String
        public let value: String

        public init(_ label: String, value: String) {
            self.id = label
            self.label = label
            self.value = value
        }
    }

    public let metrics: [Metric]
    @Environment(\.hudTheme) private var theme

    public init(_ metrics: [Metric]) {
        self.metrics = metrics
    }

    public var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(metrics.enumerated()), id: \.element.id) { index, metric in
                VStack(spacing: HudSpacing.sm) {
                    Text(metric.label.uppercased())
                        .font(HudFont.mono(HudTextSize.micro, weight: .semibold))
                        .tracking(2.0)
                        .foregroundStyle(theme.palette.dim)
                        .lineLimit(1)

                    Text(metric.value)
                        .font(HudFont.mono(HudTextSize.lg, weight: .medium))
                        .foregroundStyle(theme.palette.ink)
                        .lineLimit(2)
                        .multilineTextAlignment(.center)
                        .minimumScaleFactor(0.72)
                }
                .frame(maxWidth: .infinity, minHeight: HudInspectorMetrics.metricStripHeight)

                if index < metrics.count - 1 {
                    Rectangle()
                        .fill(theme.hairline.subtle)
                        .frame(width: HudStrokeWidth.thin,
                               height: HudInspectorMetrics.metricStripHeight - HudSpacing.xl)
                }
            }
        }
        .overlay(alignment: .bottom) {
            HudInspectorDivider()
        }
    }
}

private enum HudInspectorMetrics {
    static let railWidth: CGFloat = 28
    static let railChipHeight: CGFloat = 88
    static let panelHeaderHeight: CGFloat = 44
    static let sectionHeaderHeight: CGFloat = 32
    static let rowHeight: CGFloat = HudLayout.rowHeightRegular
    static let metricStripHeight: CGFloat = 92
    static let trailingValueMinWidth: CGFloat = 52
    static let trailingSpacing: CGFloat = 8
    static let trailingGlyphSize: CGFloat = 14
}

private struct HudInspectorLabel: View {
    let label: String
    var hint: String?
    @Environment(\.hudTheme) private var theme

    init(_ label: String, hint: String? = nil) {
        self.label = label
        self.hint = hint
    }

    var body: some View {
        HStack(alignment: .center, spacing: HudSpacing.sm) {
            Text(label)
                .font(HudFont.ui(HudTextSize.md))
                .foregroundStyle(theme.palette.ink)
                .lineLimit(1)
                .layoutPriority(2)

            if let hint {
                Text("· \(hint)")
                    .font(HudFont.ui(HudTextSize.sm, weight: .light))
                    .foregroundStyle(theme.palette.dim)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .layoutPriority(0)
            }
        }
    }
}

private struct HudInspectorValue: View {
    let value: String
    @Environment(\.hudTheme) private var theme

    init(_ value: String) {
        self.value = value
    }

    var body: some View {
        Text(value)
            .font(HudFont.mono(HudTextSize.md))
            .foregroundStyle(theme.palette.accent)
            .lineLimit(1)
            .truncationMode(.tail)
            .frame(minWidth: HudInspectorMetrics.trailingValueMinWidth, alignment: .trailing)
    }
}

private struct HudInspectorDivider: View {
    @Environment(\.hudTheme) private var theme

    var body: some View {
        Rectangle()
            .fill(theme.hairline.subtle)
            .frame(height: HudStrokeWidth.thin)
    }
}

private struct HudInspectorRowChrome: ViewModifier {
    func body(content: Content) -> some View {
        content
            .frame(height: HudInspectorMetrics.rowHeight)
            .overlay(alignment: .bottom) {
                HudInspectorDivider()
            }
    }
}

private extension View {
    func hudInspectorRowChrome() -> some View {
        modifier(HudInspectorRowChrome())
    }
}
