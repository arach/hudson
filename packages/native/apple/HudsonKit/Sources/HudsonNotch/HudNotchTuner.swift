#if os(macOS)
import HudsonUI
import HudsonNotchCore
import SwiftUI

public struct HudNotchTuner: View {
    @ObservedObject private var controller: HudNotchController
    @State private var previewState: PreviewState = .rest
    @State private var lookState: LookState = .pill

    public init(controller: HudNotchController) {
        self.controller = controller
    }

    public var body: some View {
        VStack(spacing: 0) {
            header
            HudDivider(color: HudHairline.standard)

            ScrollView {
                VStack(alignment: .leading, spacing: HudSpacing.xxl) {
                    previewSection
                    shapeSection
                    appearanceSection
                    timingSection
                    panelSection
                }
                .padding(HudSpacing.xxl)
            }
        }
        .background(HudPalette.bg)
        .foregroundStyle(HudPalette.ink)
    }

    private var header: some View {
        HStack(spacing: HudSpacing.lg) {
            Image(systemName: "rectangle.topthird.inset.filled")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(HudPalette.accent)
                .frame(width: 28, height: 28)

            VStack(alignment: .leading, spacing: 2) {
                Text("Notch")
                    .font(HudFont.ui(HudTextSize.lg, weight: .semibold))
                    .foregroundStyle(HudPalette.ink)

                Text("\(controller.renderStyle.rawValue) / \(controller.displayMode.label.lowercased())")
                    .font(HudFont.mono(HudTextSize.xs))
                    .foregroundStyle(HudPalette.muted)
            }

            Spacer(minLength: HudSpacing.lg)

            HudButton("Reset", icon: "arrow.counterclockwise", style: .secondary) {
                controller.setConfiguration(.default)
            }

            HudButton("Pulse", icon: "sparkles", style: .secondary) {
                controller.pulse()
            }

            HudButton("Notice", icon: "paperplane", style: .secondary) {
                controller.post(HudNotchActivity(
                    id: "tuner.notice",
                    source: "Tuner",
                    title: "Notch tuned",
                    detail: "Live settings are active",
                    state: .done,
                    ttl: 4
                ))
            }

            HudButton("Ask", icon: "questionmark.bubble", style: .primary(.teal)) {
                controller.post(HudNotchActivity(
                    id: "tuner.ask",
                    source: "Tuner",
                    title: "Keep these settings?",
                    detail: "Answers are only shown here",
                    state: .waiting,
                    choices: [
                        HudNotchChoice(id: "keep", title: "Keep", role: .primary),
                        HudNotchChoice(id: "later", title: "Later", role: .cancel),
                    ],
                    replyPrompt: "Or say why"
                ))
            }
        }
        .padding(.horizontal, HudSpacing.xxl)
        .padding(.vertical, HudSpacing.lg)
        .background(HudSurface.chrome)
    }

    private var previewSection: some View {
        HudSettingsSection("Preview", labelTint: HudPalette.accent) {
            VStack(spacing: HudSpacing.lg) {
                previewCanvas
                    .frame(height: 184)

                HStack(spacing: HudSpacing.lg) {
                    Picker("Preview state", selection: $previewState) {
                        ForEach(PreviewState.allCases, id: \.self) { state in
                            Text(state.label).tag(state)
                        }
                    }
                    .labelsHidden()
                    .pickerStyle(.segmented)
                    .frame(width: 240)

                    Spacer(minLength: HudSpacing.lg)

                    Text(previewMetrics)
                        .font(HudFont.mono(HudTextSize.xs))
                        .foregroundStyle(HudPalette.muted)
                        .lineLimit(1)
                }
                .padding(.horizontal, HudSpacing.xl)
                .padding(.bottom, HudSpacing.xl)
            }
        }
    }

    private var previewCanvas: some View {
        GeometryReader { proxy in
            let configuration = controller.configuration
            let shellHeight = max(controller.notchInfo.notchHeight, configuration.shellHeight)
            let notchGap = min(controller.notchGap, proxy.size.width * 0.42)
            let shellWidth = notchGap + (previewPokeOut * 2) + 24
            let style = configuration.displayMode.resolvedStyle(isVirtual: controller.notchInfo.isVirtual)

            ZStack(alignment: .top) {
                LinearGradient(
                    colors: [
                        Color(red: 0.13, green: 0.14, blue: 0.16),
                        Color(red: 0.055, green: 0.058, blue: 0.066),
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )

                Rectangle()
                    .fill(Color.black.opacity(0.88))
                    .frame(height: 22)

                if style == .island {
                    RoundedRectangle(cornerRadius: shellHeight / 2, style: .continuous)
                        .fill(Color.black)
                        .overlay(
                            RoundedRectangle(cornerRadius: shellHeight / 2, style: .continuous)
                                .stroke(HudHairline.standard.opacity(0.95), lineWidth: 1)
                        )
                        .frame(width: shellWidth, height: shellHeight)
                } else {
                    ZStack(alignment: .top) {
                        HudNotchPhysicalShape(bottomRadius: configuration.bottomRadius)
                            .fill(Color.black)
                            .frame(width: notchGap, height: shellHeight)

                        HudNotchWingPairShape(
                            pokeOut: previewPokeOut,
                            notchGap: notchGap,
                            leftTopOuterRadius: configuration.topOuterRadius,
                            rightTopOuterRadius: configuration.topOuterRadius,
                            topInnerRadius: configuration.topInnerRadius,
                            bottomRadius: configuration.bottomRadius,
                            notchOverlap: configuration.notchOverlap,
                            minimumNotchOverlap: configuration.minimumNotchOverlap
                        )
                        .fill(Color.black)
                        .frame(width: shellWidth, height: shellHeight)
                    }
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: HudRadius.standard, style: .continuous))
        }
        .padding(.horizontal, HudSpacing.xl)
        .padding(.top, HudSpacing.xl)
    }

    private var shapeSection: some View {
        HudSettingsSection("Shape") {
            HudSettingsControlRow(
                title: "Mode",
                subtitle: "Auto follows the current display",
                value: controller.displayMode.label,
                icon: "rectangle.on.rectangle"
            ) {
                Picker("Mode", selection: displayModeBinding) {
                    ForEach(HudNotchDisplayMode.allCases, id: \.self) { displayMode in
                        Text(displayMode.label).tag(displayMode)
                    }
                }
                .labelsHidden()
                .pickerStyle(.segmented)
                .frame(width: 220)
            }
            rowDivider

            slider(
                "Rest reach",
                subtitle: "Collapsed wing width",
                icon: "arrow.left.and.right",
                keyPath: \.restPokeOut,
                range: 0...80,
                valueSuffix: "pt"
            )
            rowDivider

            slider(
                "Hover reach",
                subtitle: "Pointer dwell width",
                icon: "cursorarrow",
                keyPath: \.hoverPokeOut,
                range: 0...140,
                valueSuffix: "pt"
            )
            rowDivider

            slider(
                "Active reach",
                subtitle: "Open notch width",
                icon: "arrow.up.left.and.arrow.down.right",
                keyPath: \.activePokeOut,
                range: 48...220,
                valueSuffix: "pt"
            )
        }
    }

    private var appearanceSection: some View {
        HudSettingsSection("Appearance") {
            HudSettingsControlRow(
                title: "Preset",
                subtitle: "Sets both states at once",
                value: presetName ?? "Custom",
                icon: "circle.lefthalf.filled"
            ) {
                HStack(spacing: HudSpacing.sm) {
                    ForEach(HudNotchAppearance.presets, id: \.name) { preset in
                        HudButton(preset.name, style: preset.name == presetName ? .primary(.teal) : .secondary) {
                            var configuration = controller.configuration
                            configuration.appearance = preset.appearance
                            controller.setConfiguration(configuration)
                        }
                    }
                }
            }
            rowDivider

            HudSettingsControlRow(
                title: "State",
                subtitle: "Pin the notch open to see the card",
                value: lookState.label,
                icon: "square.stack"
            ) {
                Picker("State", selection: $lookState) {
                    ForEach(LookState.allCases, id: \.self) { state in
                        Text(state.label).tag(state)
                    }
                }
                .labelsHidden()
                .pickerStyle(.segmented)
                .frame(width: 160)
            }
            rowDivider

            slider(
                "Fill",
                subtitle: "Opacity of the black body",
                icon: "drop",
                keyPath: lookPath.appending(path: \.fillOpacity),
                range: 0...1,
                valueSuffix: "%"
            )
            rowDivider

            slider(
                "Backdrop blur",
                subtitle: "Frosts what shows through the fill",
                icon: "aqi.medium",
                keyPath: lookPath.appending(path: \.blur),
                range: 0...1,
                valueSuffix: "%"
            )
            rowDivider

            slider(
                "Rim width",
                subtitle: "Lights the sides and bottom",
                icon: "square.dashed",
                keyPath: lookPath.appending(path: \.borderWidth),
                range: 0...3,
                step: 0.5,
                valueSuffix: "pt"
            )
            rowDivider

            slider(
                "Rim brightness",
                subtitle: "White rim opacity",
                icon: "sun.min",
                keyPath: lookPath.appending(path: \.borderOpacity),
                range: 0...0.6,
                valueSuffix: "%"
            )
            rowDivider

            slider(
                "Shadow",
                subtitle: "Shadow opacity",
                icon: "shadow",
                keyPath: lookPath.appending(path: \.shadowOpacity),
                range: 0...1,
                valueSuffix: "%"
            )
            rowDivider

            slider(
                "Shadow radius",
                subtitle: "How far the shadow spreads",
                icon: "circle.dotted",
                keyPath: lookPath.appending(path: \.shadowRadius),
                range: 0...40,
                valueSuffix: "pt"
            )
            rowDivider

            slider(
                "Shadow drop",
                subtitle: "Downward offset",
                icon: "arrow.down",
                keyPath: lookPath.appending(path: \.shadowY),
                range: 0...24,
                valueSuffix: "pt"
            )
        }
    }

    private var lookPath: WritableKeyPath<HudNotchConfiguration, HudNotchLook> {
        switch lookState {
        case .pill: return \.appearance.pill
        case .card: return \.appearance.card
        }
    }

    private var presetName: String? {
        HudNotchAppearance.presets.first { $0.appearance == controller.configuration.appearance }?.name
    }

    private var timingSection: some View {
        HudSettingsSection("Timing") {
            HudSettingsControlRow(
                title: "Pinned",
                subtitle: "Keep the notch open while tuning",
                value: controller.isPinned ? "On" : "Off",
                icon: "pin"
            ) {
                HudButton(controller.isPinned ? "Unpin" : "Pin", icon: "pin", style: .secondary) {
                    controller.togglePinned()
                }
            }
            rowDivider

            slider(
                "Hover dwell",
                subtitle: "Delay before hover expansion",
                icon: "timer",
                keyPath: \.hoverActivationDelaySeconds,
                range: 0...0.8,
                step: 0.02,
                valueSuffix: "s"
            )
            rowDivider

            slider(
                "Collapse delay",
                subtitle: "Delay after pointer exit",
                icon: "hourglass",
                keyPath: \.collapseDelaySeconds,
                range: 0...1.2,
                step: 0.02,
                valueSuffix: "s"
            )
        }
    }

    private var panelSection: some View {
        HudSettingsSection("Geometry") {
            slider(
                "Height",
                subtitle: "Minimum shell height",
                icon: "arrow.up.and.down",
                keyPath: \.shellHeight,
                range: 24...58,
                valueSuffix: "pt"
            )
            rowDivider

            slider(
                "Outer top radius",
                subtitle: "Corner where wings meet the menu bar",
                icon: "circle",
                keyPath: \.topOuterRadius,
                range: -12...22,
                valueSuffix: "pt"
            )
            rowDivider

            slider(
                "Inner top radius",
                subtitle: "Curve near the hardware notch",
                icon: "circle.dashed",
                keyPath: \.topInnerRadius,
                range: 0...20,
                valueSuffix: "pt"
            )
            rowDivider

            slider(
                "Bottom radius",
                subtitle: "Lower wing rounding",
                icon: "capsule",
                keyPath: \.bottomRadius,
                range: 0...24,
                valueSuffix: "pt"
            )
            rowDivider

            slider(
                "Notch overlap",
                subtitle: "Wing underlap into the center gap",
                icon: "rectangle",
                keyPath: \.notchOverlap,
                range: 0...16,
                valueSuffix: "pt"
            )
            rowDivider

            slider(
                "Card height",
                subtitle: "Open notch for a notice",
                icon: "rectangle",
                keyPath: \.expandedContentHeight,
                range: 84...180,
                valueSuffix: "pt"
            )
            rowDivider

            slider(
                "Input card height",
                subtitle: "Open notch with choices or a reply field",
                icon: "rectangle.and.pencil.and.ellipsis",
                keyPath: \.inputContentHeight,
                range: 84...240,
                valueSuffix: "pt"
            )
        }
    }

    private var displayModeBinding: Binding<HudNotchDisplayMode> {
        Binding(
            get: { controller.displayMode },
            set: { controller.setDisplayMode($0) }
        )
    }

    private var previewPokeOut: CGFloat {
        switch previewState {
        case .rest:
            return controller.configuration.restPokeOut
        case .hover:
            return controller.configuration.hoverPokeOut
        case .active:
            return controller.configuration.activePokeOut
        }
    }

    private var previewMetrics: String {
        let width = Int((controller.notchGap + previewPokeOut * 2 + 24).rounded())
        let height = Int(max(controller.notchInfo.notchHeight, controller.configuration.shellHeight).rounded())
        return "\(previewState.label.lowercased()) / \(width)x\(height)"
    }

    private var rowDivider: some View {
        HudDivider(color: HudHairline.subtle.opacity(0.75))
            .padding(.leading, 52)
    }

    private func slider(
        _ title: String,
        subtitle: String,
        icon: String,
        keyPath: WritableKeyPath<HudNotchConfiguration, CGFloat>,
        range: ClosedRange<Double>,
        step: Double = 1,
        valueSuffix: String
    ) -> some View {
        HudSettingsSliderRow(
            title: title,
            subtitle: subtitle,
            value: formattedValue(Double(controller.configuration[keyPath: keyPath]), suffix: valueSuffix),
            icon: icon,
            number: Binding(
                get: { Double(controller.configuration[keyPath: keyPath]) },
                set: { setCGFloat(keyPath, value: $0) }
            ),
            in: range,
            step: step
        )
    }

    private func slider(
        _ title: String,
        subtitle: String,
        icon: String,
        keyPath: WritableKeyPath<HudNotchConfiguration, Double>,
        range: ClosedRange<Double>,
        step: Double = 0.01,
        valueSuffix: String
    ) -> some View {
        HudSettingsSliderRow(
            title: title,
            subtitle: subtitle,
            value: formattedValue(controller.configuration[keyPath: keyPath], suffix: valueSuffix),
            icon: icon,
            number: Binding(
                get: { controller.configuration[keyPath: keyPath] },
                set: { setDouble(keyPath, value: $0) }
            ),
            in: range,
            step: step
        )
    }

    private func setCGFloat(_ keyPath: WritableKeyPath<HudNotchConfiguration, CGFloat>, value: Double) {
        var configuration = controller.configuration
        configuration[keyPath: keyPath] = CGFloat(value)
        controller.setConfiguration(configuration)
    }

    private func setDouble(_ keyPath: WritableKeyPath<HudNotchConfiguration, Double>, value: Double) {
        var configuration = controller.configuration
        configuration[keyPath: keyPath] = value
        controller.setConfiguration(configuration)
    }

    private func formattedValue(_ value: Double, suffix: String) -> String {
        if suffix == "s" {
            return String(format: "%.2f%@", value, suffix)
        }
        if suffix == "%" {
            return "\(Int((value * 100).rounded()))%"
        }
        if value.rounded() != value {
            return String(format: "%.1f%@", value, suffix)
        }
        return "\(Int(value.rounded()))\(suffix)"
    }

}

private enum LookState: String, CaseIterable {
    case pill
    case card

    var label: String {
        switch self {
        case .pill: return "Pill"
        case .card: return "Card"
        }
    }
}

private enum PreviewState: String, CaseIterable {
    case rest
    case hover
    case active

    var label: String {
        switch self {
        case .rest:
            return "Rest"
        case .hover:
            return "Hover"
        case .active:
            return "Active"
        }
    }
}
#endif
