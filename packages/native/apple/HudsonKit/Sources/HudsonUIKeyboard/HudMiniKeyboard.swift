import SwiftUI
import HudsonUI

#if os(iOS)
import UIKit
#endif

public enum HudMiniKeyboardOutput: Equatable, Sendable {
    case text(String)
    case sequence(String)
    case command(String)

    public var transportText: String? {
        switch self {
        case .text(let value), .sequence(let value):
            return value
        case .command:
            return nil
        }
    }
}

public enum HudMiniKeyboardPresentation: String, CaseIterable, Identifiable, Sendable {
    case compact
    case minimal

    public var id: String { rawValue }
}

public struct HudMiniKeyboardKey: Identifiable, Equatable, Sendable {
    public enum Role: Sendable {
        case text
        case control
        case accent
        case destructive
        case dictate
    }

    public enum Width: Double, Sendable {
        case compact = 0.82
        case standard = 1.0
        case wide = 1.34
        case expanded = 1.72

        var weight: CGFloat { CGFloat(rawValue) }
    }

    public let id: String
    public let label: String
    public let caption: String?
    public let systemImage: String?
    public let role: Role
    public let width: Width
    public let output: HudMiniKeyboardOutput

    public init(
        id: String,
        label: String,
        caption: String? = nil,
        systemImage: String? = nil,
        role: Role = .text,
        width: Width = .standard,
        output: HudMiniKeyboardOutput
    ) {
        self.id = id
        self.label = label
        self.caption = caption
        self.systemImage = systemImage
        self.role = role
        self.width = width
        self.output = output
    }

    public static func text(
        _ label: String,
        value: String? = nil,
        caption: String? = nil,
        width: Width = .standard
    ) -> Self {
        Self(
            id: "text.\(label)",
            label: label,
            caption: caption,
            role: .text,
            width: width,
            output: .text(value ?? label)
        )
    }

    public static func command(
        _ id: String,
        label: String,
        caption: String? = nil,
        systemImage: String? = nil,
        role: Role = .control,
        width: Width = .standard
    ) -> Self {
        Self(
            id: id,
            label: label,
            caption: caption,
            systemImage: systemImage,
            role: role,
            width: width,
            output: .command(id)
        )
    }

    public static let empty = HudMiniKeyboardKey(
        id: "keyboard.empty",
        label: "",
        role: .control,
        output: .command("keyboard.empty")
    )
}

public struct HudMiniKeyboardPreset: Identifiable, Equatable, Sendable {
    public let id: String
    public let title: String
    public let subtitle: String?
    public let icon: String
    public let rows: [[HudMiniKeyboardKey]]
    public let dictateRowKeys: [HudMiniKeyboardKey]
    public let minimalKeys: [HudMiniKeyboardKey]

    public init(
        id: String,
        title: String,
        subtitle: String? = nil,
        icon: String = "keyboard",
        rows: [[HudMiniKeyboardKey]],
        dictateRowKeys: [HudMiniKeyboardKey]? = nil,
        minimalKeys: [HudMiniKeyboardKey]? = nil
    ) {
        self.id = id
        self.title = title
        self.subtitle = subtitle
        self.icon = icon
        self.rows = rows

        let flattened = rows.flatMap { $0 }
        self.dictateRowKeys = dictateRowKeys ?? Array(flattened.prefix(2))
        self.minimalKeys = minimalKeys ?? Array(flattened.prefix(4))
    }

    public var compactKeys: [HudMiniKeyboardKey] {
        Array(rows.flatMap { $0 }.prefix(12))
    }

    public func compactKey(at index: Int) -> HudMiniKeyboardKey {
        guard index >= 0, compactKeys.indices.contains(index) else { return .empty }
        return compactKeys[index]
    }
}

public extension HudMiniKeyboardPreset {
    static let terminal = HudMiniKeyboardPreset(
        id: "terminal",
        title: "Terminal",
        subtitle: "shell slots",
        icon: "terminal",
        rows: [
            [
                .init(id: "terminal.escape", label: "ESC", role: .control, output: .sequence("\u{1B}")),
                .init(id: "terminal.tab", label: "TAB", role: .control, output: .text("\t")),
                .init(id: "terminal.ctrl-c", label: "CTRL", caption: "C", role: .destructive, output: .sequence("\u{3}")),
                .init(id: "terminal.delete", label: "DEL", systemImage: "delete.left", role: .control, output: .sequence("\u{7F}")),
            ],
            [
                .init(id: "terminal.left", label: "", systemImage: "arrow.left", role: .control, output: .sequence("\u{1B}[D")),
                .init(id: "terminal.up", label: "", systemImage: "arrow.up", role: .control, output: .sequence("\u{1B}[A")),
                .init(id: "terminal.down", label: "", systemImage: "arrow.down", role: .control, output: .sequence("\u{1B}[B")),
                .init(id: "terminal.right", label: "", systemImage: "arrow.right", role: .control, output: .sequence("\u{1B}[C")),
            ],
            [
                .init(id: "terminal.home", label: "HOME", role: .control, output: .sequence("\u{1B}[H")),
                .init(id: "terminal.slash", label: "/", output: .text("/")),
                .init(id: "terminal.pipe", label: "|", output: .text("|")),
                .init(id: "terminal.end", label: "END", role: .control, output: .sequence("\u{1B}[F")),
            ],
        ],
        dictateRowKeys: [
            .command("terminal.controlModifier", label: "CTRL", caption: "mod", systemImage: "control", role: .accent),
            .init(id: "terminal.return", label: "RET", systemImage: "return", role: .accent, output: .text("\r")),
        ],
        minimalKeys: [
            .command("terminal.shiftModifier", label: "SHIFT", systemImage: "shift", role: .control),
            .text("C", value: "c"),
            .text("V", value: "v"),
            .init(id: "terminal.space", label: "SPACE", systemImage: "space", role: .control, width: .expanded, output: .text(" ")),
            .text("Q", value: "q"),
            .text("*", value: "*"),
            .init(id: "terminal.minimal-return", label: "RET", systemImage: "return", role: .accent, output: .text("\r")),
        ]
    )

    static let canvas = HudMiniKeyboardPreset(
        id: "canvas",
        title: "Canvas",
        subtitle: "spatial slots",
        icon: "square.grid.3x3",
        rows: [
            [
                .command("canvas.select", label: "SEL", systemImage: "cursorarrow", role: .accent),
                .command("canvas.pan", label: "PAN", systemImage: "hand.draw"),
                .command("canvas.add", label: "ADD", systemImage: "plus"),
                .command("canvas.focus", label: "FOCUS", systemImage: "scope"),
            ],
            [
                .command("canvas.zoomOut", label: "ZOOM", caption: "out", systemImage: "minus.magnifyingglass"),
                .command("canvas.fit", label: "FIT", systemImage: "arrow.up.left.and.arrow.down.right", role: .accent),
                .command("canvas.reset", label: "RESET", systemImage: "arrow.counterclockwise"),
                .command("canvas.zoomIn", label: "ZOOM", caption: "in", systemImage: "plus.magnifyingglass"),
            ],
            [
                .command("edit.undo", label: "UNDO", systemImage: "arrow.uturn.backward"),
                .command("edit.redo", label: "REDO", systemImage: "arrow.uturn.forward"),
                .command("canvas.snap", label: "SNAP", systemImage: "circle.grid.cross"),
                .command("canvas.inspect", label: "INFO", systemImage: "info.circle"),
            ],
        ],
        dictateRowKeys: [
            .command("shell.commandPalette", label: "CMD", caption: "K", systemImage: "command", role: .accent),
            .command("canvas.fit", label: "FIT", systemImage: "arrow.up.left.and.arrow.down.right", role: .accent),
        ],
        minimalKeys: [
            .command("canvas.select", label: "SEL", systemImage: "cursorarrow", role: .accent),
            .command("canvas.pan", label: "PAN", systemImage: "hand.draw"),
            .command("canvas.fit", label: "FIT", systemImage: "arrow.up.left.and.arrow.down.right", role: .accent),
            .command("shell.commandPalette", label: "CMD", caption: "K", systemImage: "command", role: .accent),
        ]
    )

    static let code = HudMiniKeyboardPreset(
        id: "code",
        title: "Code",
        subtitle: "editor slots",
        icon: "curlybraces",
        rows: [
            [
                .init(id: "code.tab", label: "TAB", role: .control, output: .text("\t")),
                .command("code.outdent", label: "OUT", caption: "dent"),
                .command("code.toggleComment", label: "//"),
                .command("code.find", label: "FIND", systemImage: "magnifyingglass"),
            ],
            [
                .text("{"),
                .text("}"),
                .text("["),
                .text("]"),
            ],
            [
                .text("("),
                .text(")"),
                .init(id: "code.arrow", label: "->", output: .text("->")),
                .command("code.save", label: "SAVE", systemImage: "tray.and.arrow.down", role: .accent),
            ],
        ],
        dictateRowKeys: [
            .init(id: "code.space", label: "SPACE", systemImage: "space", role: .control, output: .text(" ")),
            .init(id: "code.return", label: "RET", systemImage: "return", role: .accent, output: .text("\r")),
        ],
        minimalKeys: [
            .init(id: "code.minimal-tab", label: "TAB", role: .control, output: .text("\t")),
            .command("code.toggleComment", label: "//"),
            .init(id: "code.minimal-space", label: "SPACE", systemImage: "space", role: .control, output: .text(" ")),
            .init(id: "code.minimal-return", label: "RET", systemImage: "return", role: .accent, output: .text("\r")),
            .command("code.save", label: "SAVE", systemImage: "tray.and.arrow.down", role: .accent),
        ]
    )

    static let defaultPresets: [HudMiniKeyboardPreset] = [
        .terminal,
        .canvas,
        .code,
    ]
}

public enum HudMiniKeyboardMetrics {
    public static let minimalKeyHeight: CGFloat = HudLayout.fieldHeight
    public static let compactKeyHeight: CGFloat = 40
    public static let modeBarHeight: CGFloat = 30
    public static let rowSpacing: CGFloat = HudSpacing.sm
    public static let keySpacing: CGFloat = HudSpacing.sm
    public static let cornerRadius: CGFloat = HudRadius.standard
    public static let trayCornerRadius: CGFloat = HudRadius.card
    public static let trayPadding: CGFloat = HudSpacing.md
    public static let modeBarToKeysGap: CGFloat = HudSpacing.lg
}

public struct HudMiniKeyboard: View {
    public let presets: [HudMiniKeyboardPreset]
    public var showsPresetPicker: Bool
    public var showsDictateButton: Bool
    public var onPress: (HudMiniKeyboardOutput, HudMiniKeyboardKey) -> Void

    @Binding private var selectedPresetID: String
    @State private var presentation: HudMiniKeyboardPresentation
    @Environment(\.hudTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Namespace private var modePillNS

    public init(
        presets: [HudMiniKeyboardPreset] = HudMiniKeyboardPreset.defaultPresets,
        selectedPresetID: Binding<String>,
        presentation: HudMiniKeyboardPresentation = .compact,
        showsPresetPicker: Bool = true,
        showsDictateButton: Bool = true,
        onPress: @escaping (HudMiniKeyboardOutput, HudMiniKeyboardKey) -> Void
    ) {
        self.presets = presets.isEmpty ? HudMiniKeyboardPreset.defaultPresets : presets
        self._selectedPresetID = selectedPresetID
        self._presentation = State(initialValue: presentation)
        self.showsPresetPicker = showsPresetPicker
        self.showsDictateButton = showsDictateButton
        self.onPress = onPress
    }

    public var body: some View {
        VStack(spacing: HudMiniKeyboardMetrics.modeBarToKeysGap) {
            if showsPresetPicker {
                modeSelector
            }

            switch presentation {
            case .compact:
                compactKeyboard
            case .minimal:
                minimalKeyboard
            }
        }
        .padding(.horizontal, HudMiniKeyboardMetrics.trayPadding)
        .padding(.top, showsPresetPicker ? HudSpacing.sm : HudMiniKeyboardMetrics.trayPadding)
        .padding(.bottom, HudMiniKeyboardMetrics.trayPadding)
        .background(trayBackground)
        .gesture(presentationGesture)
        .onAppear(perform: normalizeSelection)
        .onChange(of: presets.map(\.id)) { _, _ in
            normalizeSelection()
        }
    }

    // MARK: - Tray

    private var trayBackground: some View {
        // The keyboard reads as a hosted surface (lifted from the page like an iOS
        // system keyboard) — surface fill, subtle hairline, top-edge highlight
        // gradient, no heavy card border.
        ZStack {
            RoundedRectangle(cornerRadius: HudMiniKeyboardMetrics.trayCornerRadius)
                .fill(theme.palette.surface)
            RoundedRectangle(cornerRadius: HudMiniKeyboardMetrics.trayCornerRadius)
                .fill(
                    LinearGradient(
                        colors: [
                            HudSurface.hover,
                            .clear
                        ],
                        startPoint: .top,
                        endPoint: .center
                    )
                )
                .allowsHitTesting(false)
            RoundedRectangle(cornerRadius: HudMiniKeyboardMetrics.trayCornerRadius)
                .stroke(theme.hairline.subtle, lineWidth: HudStrokeWidth.thin)
        }
    }

    // MARK: - Selection

    private var selectedPreset: HudMiniKeyboardPreset {
        presets.first(where: { $0.id == selectedPresetID }) ?? presets[0]
    }

    // MARK: - Mode selector

    private var modeSelector: some View {
        HStack(spacing: HudSpacing.sm) {
            HStack(spacing: HudSpacing.xxs) {
                ForEach(presets) { preset in
                    modeButton(preset)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(HudSpacing.xxs)
            .background(
                RoundedRectangle(cornerRadius: HudRadius.standard + 2)
                    .fill(HudSurface.inset)
            )
            .overlay(
                RoundedRectangle(cornerRadius: HudRadius.standard + 2)
                    .stroke(theme.hairline.subtle, lineWidth: HudStrokeWidth.thin)
            )

            densityToggle
        }
        .frame(height: HudMiniKeyboardMetrics.modeBarHeight + HudSpacing.xs)
    }

    private func modeButton(_ preset: HudMiniKeyboardPreset) -> some View {
        let isSelected = preset.id == selectedPreset.id
        return Button {
            selectPreset(preset)
        } label: {
            HStack(spacing: HudSpacing.xs) {
                Circle()
                    .fill(isSelected ? theme.palette.accent : theme.palette.dim.opacity(HudOpacity.soft))
                    .frame(width: HudDotSize.small, height: HudDotSize.small)
                    .overlay(
                        Circle()
                            .stroke(
                                isSelected
                                    ? HudSurface.tintBorder(theme.palette.accent)
                                    : Color.clear,
                                lineWidth: HudStrokeWidth.thin
                            )
                    )

                Text(preset.shortLabel)
                    .font(HudFont.mono(HudTextSize.xxs, weight: isSelected ? .bold : .semibold))
                    .foregroundStyle(isSelected ? theme.palette.ink : theme.palette.muted)
                    .lineLimit(1)
                    .minimumScaleFactor(0.80)
            }
            .padding(.horizontal, HudSpacing.md)
            .frame(height: HudMiniKeyboardMetrics.modeBarHeight)
            .background {
                if isSelected {
                    modeSelectionPill
                        .matchedGeometryEffect(id: "modePill", in: modePillNS)
                }
            }
            .contentShape(RoundedRectangle(cornerRadius: HudRadius.standard))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(preset.title)
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
    }

    private var modeSelectionPill: some View {
        ZStack {
            RoundedRectangle(cornerRadius: HudRadius.standard)
                .fill(HudSurface.tintGhost(theme.palette.accent))
            RoundedRectangle(cornerRadius: HudRadius.standard)
                .stroke(HudSurface.tintBorder(theme.palette.accent), lineWidth: HudStrokeWidth.thin)
        }
    }

    private func selectPreset(_ preset: HudMiniKeyboardPreset) {
        guard preset.id != selectedPresetID else { return }
        if reduceMotion {
            selectedPresetID = preset.id
        } else {
            withAnimation(HudMotion.chromeSpring) {
                selectedPresetID = preset.id
            }
        }
    }

    private var densityToggle: some View {
        Button {
            toggleDensity()
        } label: {
            Image(systemName: presentation == .compact ? "rectangle.compress.vertical" : "rectangle.expand.vertical")
                .font(HudFont.ui(HudTextSize.xs, weight: .semibold))
                .foregroundStyle(theme.palette.muted)
                .frame(width: HudMiniKeyboardMetrics.modeBarHeight + HudSpacing.xs,
                       height: HudMiniKeyboardMetrics.modeBarHeight + HudSpacing.xs)
                .background(
                    RoundedRectangle(cornerRadius: HudRadius.standard)
                        .fill(HudSurface.inset)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: HudRadius.standard)
                        .stroke(theme.hairline.subtle, lineWidth: HudStrokeWidth.thin)
                )
        }
        .buttonStyle(HudKeyPressStyle())
        .accessibilityLabel(presentation == .compact ? "Use minimal keyboard" : "Use compact keyboard")
    }

    private func toggleDensity() {
        let next: HudMiniKeyboardPresentation = presentation == .compact ? .minimal : .compact
        if reduceMotion {
            presentation = next
        } else {
            withAnimation(HudMotion.chromeSpring) {
                presentation = next
            }
        }
    }

    // MARK: - Compact keyboard

    private var compactKeyboard: some View {
        VStack(spacing: HudMiniKeyboardMetrics.rowSpacing) {
            ForEach(Array(compactRows.enumerated()), id: \.offset) { _, row in
                HStack(spacing: HudMiniKeyboardMetrics.keySpacing) {
                    ForEach(row) { key in
                        keyButton(key, density: .compact)
                    }
                }
                .frame(height: HudMiniKeyboardMetrics.compactKeyHeight)
            }

            if showsDictateButton {
                dictateRow
            }
        }
    }

    private var compactRows: [[HudMiniKeyboardKey]] {
        [
            (0..<4).map { selectedPreset.compactKey(at: $0) },
            (4..<8).map { selectedPreset.compactKey(at: $0) },
            (8..<12).map { selectedPreset.compactKey(at: $0) },
        ]
    }

    private var dictateRow: some View {
        HStack(spacing: HudMiniKeyboardMetrics.keySpacing) {
            keyButton(dictateSideKey(at: 0), density: .compact)
            keyButton(dictateKey(labelVisible: true), density: .dictate)
            keyButton(dictateSideKey(at: 1), density: .compact)
        }
        .frame(height: HudMiniKeyboardMetrics.compactKeyHeight)
    }

    // MARK: - Minimal keyboard

    private var minimalKeyboard: some View {
        HStack(spacing: HudMiniKeyboardMetrics.keySpacing) {
            if showsDictateButton {
                ForEach(minimalLeadingKeys) { key in
                    keyButton(key, density: .minimal)
                }
                keyButton(dictateKey(labelVisible: false), density: .dictate)
                ForEach(minimalTrailingKeys) { key in
                    keyButton(key, density: .minimal)
                }
            } else {
                ForEach(selectedPreset.minimalKeys) { key in
                    keyButton(key, density: .minimal)
                }
            }
        }
        .frame(height: HudMiniKeyboardMetrics.minimalKeyHeight)
    }

    private var minimalLeadingKeys: [HudMiniKeyboardKey] {
        Array(selectedPreset.minimalKeys.prefix(2))
    }

    private var minimalTrailingKeys: [HudMiniKeyboardKey] {
        Array(selectedPreset.minimalKeys.dropFirst(2).prefix(2))
    }

    private func dictateSideKey(at index: Int) -> HudMiniKeyboardKey {
        guard selectedPreset.dictateRowKeys.indices.contains(index) else { return .empty }
        return selectedPreset.dictateRowKeys[index]
    }

    private func dictateKey(labelVisible: Bool) -> HudMiniKeyboardKey {
        HudMiniKeyboardKey(
            id: "keyboard.dictate",
            label: labelVisible ? "DICTATE" : "",
            systemImage: "mic.fill",
            role: .dictate,
            width: .expanded,
            output: .command("keyboard.dictate")
        )
    }

    // MARK: - Key button

    private func keyButton(_ key: HudMiniKeyboardKey, density: HudMiniKeyboardDensity) -> some View {
        let isEmpty = key.id == HudMiniKeyboardKey.empty.id
        return Button {
            press(key)
        } label: {
            keyLabel(key, density: density)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .foregroundStyle(key.role.foregroundColor(theme))
                .background(keyBackground(role: key.role))
                .overlay(keyTopHighlight)
                .overlay(keyStroke(role: key.role))
                .clipShape(RoundedRectangle(cornerRadius: HudMiniKeyboardMetrics.cornerRadius))
                .contentShape(RoundedRectangle(cornerRadius: HudMiniKeyboardMetrics.cornerRadius))
        }
        .buttonStyle(HudKeyPressStyle())
        .accessibilityLabel(key.accessibilityLabel)
        .disabled(isEmpty)
        .opacity(isEmpty ? 0 : 1)
        .shadow(
            color: key.role == .dictate ? theme.palette.accent.opacity(HudOpacity.soft) : .clear,
            radius: key.role == .dictate ? 6 : 0,
            x: 0,
            y: 0
        )
    }

    @ViewBuilder
    private func keyLabel(_ key: HudMiniKeyboardKey, density: HudMiniKeyboardDensity) -> some View {
        VStack(spacing: density.labelSpacing) {
            if let systemImage = key.systemImage, density.usesIconOnlyKeys {
                Image(systemName: systemImage)
                    .font(HudFont.ui(density.iconSize, weight: key.role.iconWeight))
            } else if let systemImage = key.systemImage {
                Image(systemName: systemImage)
                    .font(HudFont.ui(density.iconSize, weight: key.role.iconWeight))
                if !key.label.isEmpty {
                    Text(key.label)
                        .font(HudFont.mono(density.labelSize, weight: key.role.labelWeight))
                        .lineLimit(1)
                        .minimumScaleFactor(0.65)
                }
            } else if !key.label.isEmpty {
                Text(key.label)
                    .font(HudFont.mono(density.labelSize, weight: key.role.labelWeight))
                    .lineLimit(1)
                    .minimumScaleFactor(0.65)
            }
            if density.showsCaption, let caption = key.caption {
                Text(caption)
                    .font(HudFont.ui(HudTextSize.micro, weight: .medium))
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                    .foregroundStyle(key.role.captionColor(theme))
            }
        }
        .padding(.horizontal, density.horizontalPadding)
    }

    private func keyBackground(role: HudMiniKeyboardKey.Role) -> some View {
        RoundedRectangle(cornerRadius: HudMiniKeyboardMetrics.cornerRadius)
            .fill(role.fillColor(theme))
    }

    private var keyTopHighlight: some View {
        // 1pt inner top highlight — implies a beveled key cap without going skeumorphic.
        RoundedRectangle(cornerRadius: HudMiniKeyboardMetrics.cornerRadius)
            .fill(
                LinearGradient(
                    colors: [
                        HudSurface.hover,
                        .clear
                    ],
                    startPoint: .top,
                    endPoint: UnitPoint(x: 0.5, y: 0.45)
                )
            )
            .allowsHitTesting(false)
    }

    private func keyStroke(role: HudMiniKeyboardKey.Role) -> some View {
        RoundedRectangle(cornerRadius: HudMiniKeyboardMetrics.cornerRadius)
            .stroke(role.strokeColor(theme), lineWidth: role.strokeWidth)
    }

    // MARK: - Gesture

    private var presentationGesture: some Gesture {
        DragGesture(minimumDistance: HudSpacing.huge)
            .onEnded { value in
                let next: HudMiniKeyboardPresentation?
                if value.translation.height < -HudSpacing.huge {
                    next = .compact
                } else if value.translation.height > HudSpacing.huge {
                    next = .minimal
                } else {
                    next = nil
                }
                guard let next, next != presentation else { return }
                if reduceMotion {
                    presentation = next
                } else {
                    withAnimation(HudMotion.chromeSpring) {
                        presentation = next
                    }
                }
            }
    }

    private func press(_ key: HudMiniKeyboardKey) {
        guard key.id != HudMiniKeyboardKey.empty.id else { return }

        #if os(iOS)
        let style: UIImpactFeedbackGenerator.FeedbackStyle
        switch key.role {
        case .destructive: style = .rigid
        case .dictate:     style = .medium
        case .accent:      style = .light
        case .text, .control: style = .light
        }
        UIImpactFeedbackGenerator(style: style).impactOccurred()
        #endif

        onPress(key.output, key)
    }

    private func normalizeSelection() {
        guard !presets.contains(where: { $0.id == selectedPresetID }) else { return }
        selectedPresetID = presets[0].id
    }
}

// MARK: - Key press button style

private struct HudKeyPressStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.965 : 1.0)
            .opacity(configuration.isPressed ? 0.88 : 1)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.10), value: configuration.isPressed)
    }
}

// MARK: - Density

private enum HudMiniKeyboardDensity {
    case compact
    case minimal
    case dictate

    var labelSize: CGFloat {
        switch self {
        case .compact, .dictate:
            return HudTextSize.xxs
        case .minimal:
            return HudTextSize.micro
        }
    }

    var iconSize: CGFloat {
        switch self {
        case .compact, .dictate:
            return HudTextSize.sm
        case .minimal:
            return HudTextSize.xs
        }
    }

    var labelSpacing: CGFloat {
        switch self {
        case .compact, .dictate:
            return HudSpacing.xxs
        case .minimal:
            return 0
        }
    }

    var horizontalPadding: CGFloat {
        switch self {
        case .compact, .dictate:
            return HudSpacing.xs
        case .minimal:
            return HudSpacing.xxs
        }
    }

    var showsCaption: Bool {
        switch self {
        case .compact, .dictate:
            return true
        case .minimal:
            return false
        }
    }

    var usesIconOnlyKeys: Bool {
        switch self {
        case .minimal, .dictate:
            return true
        case .compact:
            return false
        }
    }
}

private extension HudMiniKeyboardPreset {
    var shortLabel: String {
        switch id {
        case "terminal":
            return "TERM"
        case "canvas":
            return "CAN"
        case "code":
            return "CODE"
        default:
            return String(title.prefix(4)).uppercased()
        }
    }
}

private extension HudMiniKeyboardKey {
    var accessibilityLabel: String {
        if !label.isEmpty { return label }
        if let systemImage { return systemImage }
        return id
    }
}

private extension HudMiniKeyboardKey.Role {
    func foregroundColor(_ theme: HudTheme) -> Color {
        switch self {
        case .text:
            return theme.palette.ink
        case .control:
            return theme.palette.muted
        case .accent:
            return theme.palette.accent
        case .destructive:
            return HudPalette.statusError
        case .dictate:
            return theme.palette.accent
        }
    }

    func captionColor(_ theme: HudTheme) -> Color {
        switch self {
        case .accent, .dictate:
            return HudSurface.tintStrong(theme.palette.accent)
        case .destructive:
            return HudSurface.tintStrong(HudPalette.statusError)
        case .text, .control:
            return theme.palette.dim
        }
    }

    func fillColor(_ theme: HudTheme) -> Color {
        switch self {
        case .text:
            return HudSurface.control
        case .control:
            return HudSurface.inset
        case .accent:
            return HudSurface.tintGhost(theme.palette.accent)
        case .destructive:
            return HudSurface.tintGhost(HudPalette.statusError)
        case .dictate:
            return HudSurface.tintFill(theme.palette.accent)
        }
    }

    func strokeColor(_ theme: HudTheme) -> Color {
        switch self {
        case .text:
            return theme.hairline.subtle
        case .control:
            return theme.hairline.subtle
        case .accent:
            return HudSurface.tintBorder(theme.palette.accent)
        case .destructive:
            return HudSurface.tintBorder(HudPalette.statusError)
        case .dictate:
            return HudSurface.tintStrong(theme.palette.accent)
        }
    }

    var strokeWidth: CGFloat {
        switch self {
        case .dictate: return HudStrokeWidth.standard
        default:       return HudStrokeWidth.thin
        }
    }

    var labelWeight: Font.Weight {
        switch self {
        case .dictate: return .heavy
        case .accent, .destructive: return .bold
        case .text, .control: return .bold
        }
    }

    var iconWeight: Font.Weight {
        switch self {
        case .dictate: return .bold
        default:       return .semibold
        }
    }
}
