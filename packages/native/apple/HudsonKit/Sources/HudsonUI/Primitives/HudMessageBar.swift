import SwiftUI

#if os(macOS)
import AppKit
#endif

private struct HudMessageBarWidthKey: PreferenceKey {
    static let defaultValue: CGFloat = 0

    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = max(value, nextValue())
    }
}

public enum HudMessageBarSize: Sendable {
    case compact
    case medium
    case large

    public static func from(width: CGFloat) -> HudMessageBarSize {
        if width >= 880 { return .large }
        if width >= 640 { return .medium }
        return .compact
    }

    public var horizontalPadding: CGFloat {
        switch self {
        case .compact: return 12
        case .medium:  return 16
        case .large:   return 20
        }
    }
}

enum HudMessageBarCompactLayout: Equatable, Sendable {
    case inline
    case stacked
}

enum HudMessageBarExpandedLayout: Equatable, Sendable {
    case inline
    case stacked
}

enum HudMessageBarLayoutPolicy {
    static func compactLayout(for dynamicTypeSize: DynamicTypeSize) -> HudMessageBarCompactLayout {
        dynamicTypeSize.isAccessibilitySize ? .stacked : .inline
    }

    static func expandedLayout(for dynamicTypeSize: DynamicTypeSize) -> HudMessageBarExpandedLayout {
        dynamicTypeSize.isAccessibilitySize ? .stacked : .inline
    }
}

public struct HudMessageBarTarget: Equatable, Sendable {
    public var label: String
    public var contextLabel: String?

    public init(label: String, contextLabel: String? = nil) {
        self.label = label
        self.contextLabel = contextLabel
    }
}

public struct HudMessageBarSuggestion: Identifiable, Equatable, Sendable {
    public var id: String
    public var title: String
    public var subtitle: String?
    public var completion: String?
    public var badge: String?

    public init(
        id: String,
        title: String,
        subtitle: String? = nil,
        completion: String? = nil,
        badge: String? = nil
    ) {
        self.id = id
        self.title = title
        self.subtitle = subtitle
        self.completion = completion
        self.badge = badge
    }
}

public enum HudMessageBarVoiceState: Equatable, Sendable {
    case idle
    case starting
    case recording
    case processing
    case unavailable(String)

    public var isCaptureActive: Bool {
        switch self {
        case .starting, .recording:
            return true
        case .idle, .processing, .unavailable:
            return false
        }
    }

    public var isProcessing: Bool {
        if case .processing = self { return true }
        return false
    }

    public var isUnavailable: Bool {
        if case .unavailable = self { return true }
        return false
    }
}

public struct HudMessageBarVoiceConfiguration {
    public var state: HudMessageBarVoiceState
    public var partialText: String
    public var tooltip: String?
    public var onToggle: @MainActor () -> Void

    public init(
        state: HudMessageBarVoiceState,
        partialText: String = "",
        tooltip: String? = nil,
        onToggle: @escaping @MainActor () -> Void
    ) {
        self.state = state
        self.partialText = partialText
        self.tooltip = tooltip
        self.onToggle = onToggle
    }
}

struct HudMessageBarSuggestionSelectionState: Equatable, Sendable {
    private(set) var index: Int = 0
    private(set) var isActive: Bool = false

    var displayedIndex: Int {
        isActive ? index : -1
    }

    mutating func reset() {
        index = 0
        isActive = false
    }

    @discardableResult
    mutating func activate(at nextIndex: Int, count: Int) -> Bool {
        guard nextIndex >= 0, nextIndex < count else { return false }
        index = nextIndex
        isActive = true
        return true
    }

    @discardableResult
    mutating func move(_ delta: Int, count: Int) -> Bool {
        guard count > 0 else {
            reset()
            return false
        }

        if isActive {
            index = (index + delta + count) % count
        } else {
            index = delta < 0 ? count - 1 : 0
            isActive = true
        }

        return true
    }

    func acceptedIndex(count: Int) -> Int? {
        guard isActive, count > 0 else { return nil }
        return min(max(index, 0), count - 1)
    }
}

public struct HudMessageBar: View {
    @Binding private var text: String
    public var target: HudMessageBarTarget?
    public var isSending: Bool
    public var voice: HudMessageBarVoiceConfiguration?
    public var focusSignal: Int
    public var blurSignal: Int
    public var compactPlaceholder: String
    public var expandedPlaceholder: String
    public var inputAccessibilityLabel: String?
    public var inputAccessibilityIdentifier: String?
    public var sendLabel: String
    public var escapeHint: String?
    public var hotkeyHint: String?
    public var suggestions: [HudMessageBarSuggestion]
    public var onAcceptSuggestion: ((HudMessageBarSuggestion) -> Void)?
    public var onSubmit: () -> Void

    @FocusState private var focused: Bool
    @State private var width: CGFloat = 0
    @State private var suggestionSelection = HudMessageBarSuggestionSelectionState()

    /// Original initializer retained as an explicit overload for binary and
    /// source clients. It delegates to the accessibility-aware initializer
    /// without changing the pre-existing message-field semantics.
    public init(
        text: Binding<String>,
        target: HudMessageBarTarget? = nil,
        isSending: Bool = false,
        voice: HudMessageBarVoiceConfiguration? = nil,
        focusSignal: Int = 0,
        blurSignal: Int = 0,
        compactPlaceholder: String = "talk - / commands",
        expandedPlaceholder: String = "talk to the assistant - / for commands",
        sendLabel: String = "SEND",
        escapeHint: String? = "ESC",
        hotkeyHint: String? = "⌃⌥⇧⌘H",
        suggestions: [HudMessageBarSuggestion] = [],
        onAcceptSuggestion: ((HudMessageBarSuggestion) -> Void)? = nil,
        onSubmit: @escaping () -> Void
    ) {
        self.init(
            text: text,
            target: target,
            isSending: isSending,
            voice: voice,
            focusSignal: focusSignal,
            blurSignal: blurSignal,
            compactPlaceholder: compactPlaceholder,
            expandedPlaceholder: expandedPlaceholder,
            inputAccessibilityLabel: nil,
            inputAccessibilityIdentifier: nil,
            sendLabel: sendLabel,
            escapeHint: escapeHint,
            hotkeyHint: hotkeyHint,
            suggestions: suggestions,
            onAcceptSuggestion: onAcceptSuggestion,
            onSubmit: onSubmit
        )
    }

    /// Creates a message bar with product-supplied assistive semantics.
    ///
    /// `inputAccessibilityLabel` is intentionally required so calls using the
    /// original signature resolve unambiguously to the compatibility overload.
    public init(
        text: Binding<String>,
        target: HudMessageBarTarget? = nil,
        isSending: Bool = false,
        voice: HudMessageBarVoiceConfiguration? = nil,
        focusSignal: Int = 0,
        blurSignal: Int = 0,
        compactPlaceholder: String = "talk - / commands",
        expandedPlaceholder: String = "talk to the assistant - / for commands",
        inputAccessibilityLabel: String?,
        inputAccessibilityIdentifier: String? = nil,
        sendLabel: String = "SEND",
        escapeHint: String? = "ESC",
        hotkeyHint: String? = "⌃⌥⇧⌘H",
        suggestions: [HudMessageBarSuggestion] = [],
        onAcceptSuggestion: ((HudMessageBarSuggestion) -> Void)? = nil,
        onSubmit: @escaping () -> Void
    ) {
        self._text = text
        self.target = target
        self.isSending = isSending
        self.voice = voice
        self.focusSignal = focusSignal
        self.blurSignal = blurSignal
        self.compactPlaceholder = compactPlaceholder
        self.expandedPlaceholder = expandedPlaceholder
        self.inputAccessibilityLabel = inputAccessibilityLabel
        self.inputAccessibilityIdentifier = inputAccessibilityIdentifier
        self.sendLabel = sendLabel
        self.escapeHint = escapeHint
        self.hotkeyHint = hotkeyHint
        self.suggestions = suggestions
        self.onAcceptSuggestion = onAcceptSuggestion
        self.onSubmit = onSubmit
    }

    public var body: some View {
        let size = HudMessageBarSize.from(width: width)
        let visibleSuggestions = visibleSuggestions
        Group {
            switch size {
            case .compact:
                HudMessageBarCompact(
                    pad: size.horizontalPadding,
                    text: $text,
                    target: target,
                    isSending: isSending,
                    voice: voice,
                    focused: $focused,
                    placeholder: compactPlaceholder,
                    inputAccessibilityLabel: inputAccessibilityLabel,
                    inputAccessibilityIdentifier: inputAccessibilityIdentifier,
                    sendLabel: sendLabel,
                    escapeHint: escapeHint,
                    hotkeyHint: hotkeyHint,
                    suggestions: visibleSuggestions,
                    selectedSuggestionIndex: suggestionSelection.displayedIndex,
                    onSuggestionHover: setSuggestionSelection,
                    onSuggestionSelect: accept,
                    onMoveSuggestion: moveSuggestion,
                    onAcceptSuggestion: acceptSelectedSuggestion,
                    onFieldSubmit: submitFromField,
                    onSend: send
                )
            case .medium, .large:
                HudMessageBarExpanded(
                    size: size,
                    text: $text,
                    target: target,
                    isSending: isSending,
                    voice: voice,
                    focused: $focused,
                    placeholder: expandedPlaceholder,
                    inputAccessibilityLabel: inputAccessibilityLabel,
                    inputAccessibilityIdentifier: inputAccessibilityIdentifier,
                    sendLabel: sendLabel,
                    escapeHint: escapeHint,
                    hotkeyHint: hotkeyHint,
                    suggestions: visibleSuggestions,
                    selectedSuggestionIndex: suggestionSelection.displayedIndex,
                    onSuggestionHover: setSuggestionSelection,
                    onSuggestionSelect: accept,
                    onMoveSuggestion: moveSuggestion,
                    onAcceptSuggestion: acceptSelectedSuggestion,
                    onFieldSubmit: submitFromField,
                    onSend: send
                )
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            GeometryReader { proxy in
                Color.clear.preference(key: HudMessageBarWidthKey.self, value: proxy.size.width)
            }
        )
        .onPreferenceChange(HudMessageBarWidthKey.self) { width = $0 }
        .onChange(of: focusSignal) { _, _ in
            focused = true
            HudMessageBarFieldSelection.moveCaretToEndSoon()
        }
        .onChange(of: blurSignal) { _, _ in focused = false }
        .onChange(of: text) { _, _ in suggestionSelection.reset() }
        .onChange(of: suggestions.map(\.id)) { _, _ in suggestionSelection.reset() }
        .onChange(of: focused) { _, isFocused in
            if !isFocused { suggestionSelection.reset() }
        }
    }

    static func resolvedInputAccessibilityLabel(
        _ preferredLabel: String?,
        placeholder: String
    ) -> String {
        guard let preferredLabel,
              !preferredLabel.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return placeholder
        }
        return preferredLabel
    }

    private var visibleSuggestions: [HudMessageBarSuggestion] {
        guard focused else { return [] }
        return Array(suggestions.prefix(6))
    }

    private func setSuggestionSelection(_ index: Int) {
        suggestionSelection.activate(at: index, count: visibleSuggestions.count)
    }

    @discardableResult
    private func moveSuggestion(_ delta: Int) -> Bool {
        suggestionSelection.move(delta, count: visibleSuggestions.count)
    }

    @discardableResult
    private func acceptSelectedSuggestion() -> Bool {
        let visible = visibleSuggestions
        guard let index = suggestionSelection.acceptedIndex(count: visible.count) else {
            return false
        }
        accept(visible[index])
        return true
    }

    private func accept(_ suggestion: HudMessageBarSuggestion) {
        if let onAcceptSuggestion {
            onAcceptSuggestion(suggestion)
        } else if let completion = suggestion.completion {
            text = completion
        }
        focused = true
        suggestionSelection.reset()
        HudMessageBarFieldSelection.moveCaretToEndSoon()
    }

    private func submitFromField() {
        if acceptSelectedSuggestion() {
            return
        }
        send()
    }

    private func send() {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        guard !isSending else { return }
        onSubmit()
    }
}

private struct HudMessageBarCompact: View {
    let pad: CGFloat
    @Binding var text: String
    let target: HudMessageBarTarget?
    let isSending: Bool
    let voice: HudMessageBarVoiceConfiguration?
    @FocusState.Binding var focused: Bool
    let placeholder: String
    let inputAccessibilityLabel: String?
    let inputAccessibilityIdentifier: String?
    let sendLabel: String
    let escapeHint: String?
    let hotkeyHint: String?
    let suggestions: [HudMessageBarSuggestion]
    let selectedSuggestionIndex: Int
    let onSuggestionHover: (Int) -> Void
    let onSuggestionSelect: (HudMessageBarSuggestion) -> Void
    let onMoveSuggestion: (Int) -> Bool
    let onAcceptSuggestion: () -> Bool
    let onFieldSubmit: () -> Void
    let onSend: () -> Void

    @Environment(\.hudTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    private var showVoicePreview: Bool {
        guard let voice else { return false }
        return text.isEmpty && (voice.state.isCaptureActive || voice.state.isProcessing)
    }

    var body: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 0)
            if !suggestions.isEmpty {
                HudMessageSuggestionList(
                    suggestions: suggestions,
                    selectedIndex: selectedSuggestionIndex,
                    onHover: onSuggestionHover,
                    onSelect: onSuggestionSelect
                )
                .padding(.horizontal, pad)
                .padding(.bottom, 5)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
            Group {
                switch HudMessageBarLayoutPolicy.compactLayout(for: dynamicTypeSize) {
                case .inline:
                    inlineBar
                case .stacked:
                    stackedBar
                }
            }
            .frame(maxWidth: .infinity)
            .background(theme.palette.bg)
            .overlay(alignment: .top) {
                Rectangle()
                    .fill(theme.hairline.standard.opacity(0.75))
                    .frame(height: 0.5)
            }
        }
    }

    private var inlineBar: some View {
        HStack(spacing: 8) {
            if let voice {
                HudMessageMicButton(box: 20, glyph: 12, voice: voice)
            }

            targetContext
            inlineMessageField

            HudMessageSendChip(
                small: true,
                label: sendLabel,
                dimmed: text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSending,
                onTap: onSend
            )
            keyboardHints
        }
        .padding(.horizontal, pad)
        .frame(height: 32)
    }

    private var stackedBar: some View {
        VStack(alignment: .leading, spacing: HudSpacing.sm) {
            if voice != nil || target != nil {
                HStack(spacing: HudSpacing.sm) {
                    if let voice {
                        HudMessageMicButton(box: 44, glyph: 18, voice: voice)
                    }
                    targetContext
                    Spacer(minLength: 0)
                }
            }

            stackedMessageField

            HStack(spacing: HudSpacing.sm) {
                keyboardHints
                Spacer(minLength: 0)
                HudMessageSendChip(
                    small: false,
                    label: sendLabel,
                    dimmed: text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSending,
                    onTap: onSend
                )
                .frame(minHeight: 44)
            }
        }
        .padding(.horizontal, pad)
        .padding(.vertical, HudSpacing.sm)
    }

    @ViewBuilder
    private var targetContext: some View {
        if let target {
            HudMessageTargetChip(label: target.label)
            if let contextLabel = target.contextLabel {
                HudMessageContextPill(name: contextLabel)
            }
        }
    }

    @ViewBuilder
    private var keyboardHints: some View {
        if let escapeHint {
            HudMessageKeyChip(escapeHint)
        }
        if let hotkeyHint {
            HudMessageKeyChip(hotkeyHint, accentLastCharacter: true)
        }
    }

    private var inlineMessageField: some View {
        ZStack(alignment: .leading) {
            TextField(showVoicePreview ? "" : placeholder, text: $text)
                .textFieldStyle(.plain)
                .hudFont(.xxs, face: .mono)
                .foregroundStyle(theme.palette.ink)
                .focused($focused)
                .accessibilityLabel(resolvedInputAccessibilityLabel)
                .accessibilityIdentifier(inputAccessibilityIdentifier ?? placeholder)
                .onSubmit(onFieldSubmit)
                .hudMessageBarSuggestionKeys(
                    moveSelection: onMoveSuggestion,
                    acceptSelection: onAcceptSuggestion
                )
            if showVoicePreview {
                HudMessageDictationPreview(text: voice?.partialText ?? "")
                    .allowsHitTesting(false)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var stackedMessageField: some View {
        ZStack(alignment: .topLeading) {
            TextField(showVoicePreview ? "" : placeholder, text: $text)
                .textFieldStyle(.plain)
                .hudFont(.xxs, face: .mono)
                .foregroundStyle(theme.palette.ink)
                .focused($focused)
                .accessibilityLabel(resolvedInputAccessibilityLabel)
                .accessibilityIdentifier(inputAccessibilityIdentifier ?? placeholder)
                .onSubmit(onFieldSubmit)
                .hudMessageBarSuggestionKeys(
                    moveSelection: onMoveSuggestion,
                    acceptSelection: onAcceptSuggestion
                )
            if showVoicePreview {
                HudMessageDictationPreview(text: voice?.partialText ?? "")
                    .allowsHitTesting(false)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 44, alignment: .topLeading)
    }

    private var resolvedInputAccessibilityLabel: String {
        HudMessageBar.resolvedInputAccessibilityLabel(
            inputAccessibilityLabel,
            placeholder: placeholder
        )
    }
}

private struct HudMessageBarExpanded: View {
    let size: HudMessageBarSize
    @Binding var text: String
    let target: HudMessageBarTarget?
    let isSending: Bool
    let voice: HudMessageBarVoiceConfiguration?
    @FocusState.Binding var focused: Bool
    let placeholder: String
    let inputAccessibilityLabel: String?
    let inputAccessibilityIdentifier: String?
    let sendLabel: String
    let escapeHint: String?
    let hotkeyHint: String?
    let suggestions: [HudMessageBarSuggestion]
    let selectedSuggestionIndex: Int
    let onSuggestionHover: (Int) -> Void
    let onSuggestionSelect: (HudMessageBarSuggestion) -> Void
    let onMoveSuggestion: (Int) -> Bool
    let onAcceptSuggestion: () -> Bool
    let onFieldSubmit: () -> Void
    let onSend: () -> Void

    @Environment(\.hudTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    private var isLarge: Bool { size == .large }
    private var minInputHeight: CGFloat { isLarge ? 46 : 36 }
    private var micBox: CGFloat { isLarge ? 28 : 24 }
    private var micGlyph: CGFloat { isLarge ? 16 : 14 }
    private var inputTextRole: HudTextRole { isLarge ? .xs : .xxs }

    private var showVoicePreview: Bool {
        guard let voice else { return false }
        return text.isEmpty && (voice.state.isCaptureActive || voice.state.isProcessing)
    }

    var body: some View {
        VStack(spacing: 0) {
            if !suggestions.isEmpty {
                HudMessageSuggestionList(
                    suggestions: suggestions,
                    selectedIndex: selectedSuggestionIndex,
                    onHover: onSuggestionHover,
                    onSelect: onSuggestionSelect
                )
                .padding(.horizontal, size.horizontalPadding)
                .padding(.bottom, 5)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }

            Group {
                switch HudMessageBarLayoutPolicy.expandedLayout(for: dynamicTypeSize) {
                case .inline:
                    inlineBar
                case .stacked:
                    stackedBar
                }
            }
        }
        .background(theme.palette.bg)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(theme.hairline.standard.opacity(0.75))
                .frame(height: 0.5)
        }
    }

    private var inlineBar: some View {
        HStack(alignment: .top, spacing: 10) {
            if let voice {
                HudMessageMicButton(box: micBox, glyph: micGlyph, voice: voice)
            }

            if let target {
                HudMessageTargetChip(label: target.label)
                    .padding(.top, isLarge ? 6 : 4)
                if let contextLabel = target.contextLabel {
                    HudMessageContextPill(name: contextLabel)
                        .padding(.top, isLarge ? 6 : 4)
                }
            }

            messageField
                .padding(.top, isLarge ? 4 : 3)

            sendChip
                .padding(.top, isLarge ? 6 : 4)

            HStack(spacing: 8) {
                keyboardHints
            }
            .padding(.leading, 4)
            .padding(.top, isLarge ? 6 : 4)
        }
        .padding(.horizontal, size.horizontalPadding)
        .padding(.vertical, isLarge ? 6 : 4)
        .frame(maxWidth: .infinity, minHeight: minInputHeight, alignment: .top)
    }

    private var stackedBar: some View {
        VStack(alignment: .leading, spacing: HudSpacing.sm) {
            if voice != nil || target != nil {
                HStack(alignment: .top, spacing: HudSpacing.sm) {
                    if let voice {
                        HudMessageMicButton(box: 44, glyph: 18, voice: voice)
                    }

                    if let target {
                        VStack(alignment: .leading, spacing: HudSpacing.sm) {
                            HudMessageTargetChip(label: target.label)
                            if let contextLabel = target.contextLabel {
                                HudMessageContextPill(name: contextLabel)
                            }
                        }
                    }

                    Spacer(minLength: 0)
                }
            }

            messageField
                .frame(minHeight: 44, alignment: .topLeading)

            HStack(spacing: HudSpacing.sm) {
                keyboardHints
                Spacer(minLength: 0)
                sendChip
                    .frame(minHeight: 44)
            }
        }
        .padding(.horizontal, size.horizontalPadding)
        .padding(.vertical, HudSpacing.sm)
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }

    private var messageField: some View {
        ZStack(alignment: .topLeading) {
            TextField(showVoicePreview ? "" : placeholder, text: $text, axis: .vertical)
                .textFieldStyle(.plain)
                .lineLimit(1...5)
                .hudFont(inputTextRole, face: .mono)
                .foregroundStyle(theme.palette.ink)
                .focused($focused)
                .accessibilityLabel(
                    HudMessageBar.resolvedInputAccessibilityLabel(
                        inputAccessibilityLabel,
                        placeholder: placeholder
                    )
                )
                .accessibilityIdentifier(inputAccessibilityIdentifier ?? placeholder)
                .onSubmit(onFieldSubmit)
                .hudMessageBarSuggestionKeys(
                    moveSelection: onMoveSuggestion,
                    acceptSelection: onAcceptSuggestion
                )
            if showVoicePreview {
                HudMessageDictationPreview(
                    text: voice?.partialText ?? "",
                    textRole: inputTextRole
                )
                .allowsHitTesting(false)
                .padding(.top, 1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var sendChip: some View {
        HudMessageSendChip(
            small: false,
            label: sendLabel,
            dimmed: text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSending,
            onTap: onSend
        )
    }

    @ViewBuilder
    private var keyboardHints: some View {
        if let escapeHint {
            HudMessageKeyChip(escapeHint)
        }
        if let hotkeyHint {
            HudMessageKeyChip(hotkeyHint, accentLastCharacter: true)
        }
    }
}

private struct HudMessageSuggestionList: View {
    let suggestions: [HudMessageBarSuggestion]
    let selectedIndex: Int
    let onHover: (Int) -> Void
    let onSelect: (HudMessageBarSuggestion) -> Void

    @Environment(\.hudTheme) private var theme

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(suggestions.enumerated()), id: \.element.id) { index, suggestion in
                Button {
                    onSelect(suggestion)
                } label: {
                    HudMessageSuggestionRow(
                        suggestion: suggestion,
                        selected: index == selectedIndex
                    )
                }
                .buttonStyle(.plain)
                .onHover { hovering in
                    if hovering { onHover(index) }
                }

                if index < suggestions.count - 1 {
                    Rectangle()
                        .fill(theme.hairline.subtle.opacity(0.65))
                        .frame(height: 0.5)
                        .padding(.leading, 36)
                }
            }
        }
        .background(theme.palette.surface.opacity(0.97))
        .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 5, style: .continuous)
                .stroke(theme.hairline.standard.opacity(0.9), lineWidth: 0.5)
        )
    }
}

private struct HudMessageSuggestionRow: View {
    let suggestion: HudMessageBarSuggestion
    let selected: Bool

    @Environment(\.hudTheme) private var theme

    var body: some View {
        HStack(spacing: 8) {
            Text(suggestion.badge ?? "")
                .hudFont(.micro, face: .mono, weight: .bold)
                .foregroundStyle(selected ? theme.palette.accent : theme.palette.dim)
                .frame(width: 18, alignment: .center)

            Text(suggestion.title)
                .hudFont(.xs, face: .mono, weight: .semibold)
                .foregroundStyle(selected ? theme.palette.ink : theme.palette.muted)
                .lineLimit(1)

            if let subtitle = suggestion.subtitle, !subtitle.isEmpty {
                Text(subtitle)
                    .hudFont(.xxs, face: .mono)
                    .foregroundStyle(theme.palette.dim)
                    .lineLimit(1)
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(selected ? theme.palette.accentSoft.opacity(0.55) : Color.clear)
        .contentShape(Rectangle())
    }
}

@MainActor
private enum HudMessageBarFieldSelection {
    static func moveCaretToEndSoon() {
        moveCaretToEnd()
        Task { @MainActor in
            await Task.yield()
            moveCaretToEnd()
            await Task.yield()
            moveCaretToEnd()
        }
    }

    private static func moveCaretToEnd() {
        #if os(macOS)
        guard let editor = NSApp.windows
            .compactMap({ $0.firstResponder as? NSText })
            .first(where: { $0.isEditable })
        else { return }

        let length = (editor.string as NSString).length
        editor.selectedRange = NSRange(location: length, length: 0)
        #endif
    }
}

private extension View {
    func hudMessageBarSuggestionKeys(
        moveSelection: @escaping (Int) -> Bool,
        acceptSelection: @escaping () -> Bool
    ) -> some View {
        self
            .onKeyPress(.downArrow) {
                moveSelection(1) ? .handled : .ignored
            }
            .onKeyPress(.upArrow) {
                moveSelection(-1) ? .handled : .ignored
            }
            .onKeyPress(.tab) {
                acceptSelection() ? .handled : .ignored
            }
    }
}

private struct HudMessageDictationPreview: View {
    let text: String
    var textRole: HudTextRole = .xxs

    @State private var caretLit = false
    @ScaledMetric(relativeTo: .caption2) private var caretHeight: CGFloat = 12
    @Environment(\.hudTheme) private var theme

    private var displayText: String {
        text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var body: some View {
        HStack(spacing: 4) {
            if !displayText.isEmpty {
                Text(displayText)
                    .hudFont(textRole, face: .mono)
                    .foregroundStyle(theme.palette.muted)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
            RoundedRectangle(cornerRadius: 0.5, style: .continuous)
                .fill(theme.palette.accent.opacity(caretLit ? 0.95 : 0.25))
                .frame(width: 1, height: caretHeight)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .onAppear {
            withAnimation(.easeInOut(duration: 0.48).repeatForever(autoreverses: true)) {
                caretLit = true
            }
        }
    }
}

private struct HudMessageTargetChip: View {
    let label: String
    @Environment(\.hudTheme) private var theme

    var body: some View {
        Text(label.hasPrefix("@") ? label : "@" + label)
            .hudFont(.xxs, face: .mono, weight: .semibold)
            .foregroundStyle(theme.palette.accent)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .overlay(
                RoundedRectangle(cornerRadius: 3, style: .continuous)
                    .stroke(theme.palette.accent.opacity(0.45), lineWidth: 0.5)
            )
            .fixedSize()
    }
}

private struct HudMessageContextPill: View {
    let name: String
    @Environment(\.hudTheme) private var theme

    var body: some View {
        HStack(spacing: 3) {
            Text("·")
                .hudFont(.xxs, face: .mono, weight: .semibold)
                .foregroundStyle(theme.palette.dim)
            Text(name)
                .hudFont(.xxs, face: .mono)
                .foregroundStyle(theme.palette.muted)
        }
        .fixedSize()
    }
}

private struct HudMessageSendChip: View {
    let small: Bool
    let label: String
    let dimmed: Bool
    let onTap: () -> Void

    @State private var hovered = false
    @Environment(\.hudTheme) private var theme

    private var color: Color {
        if dimmed { return theme.palette.dim }
        return hovered ? theme.palette.ink : theme.palette.accent
    }

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 4) {
                Text("↵")
                    .hudFont(small ? .micro : .xxs, face: .mono, weight: .semibold)
                    .foregroundStyle(color)
                Text(label)
                    .hudFont(small ? .micro : .xxs, face: .mono, weight: .semibold)
                    .tracking(HudTracking.widest)
                    .foregroundStyle(color)
            }
            .padding(.horizontal, 4)
            .padding(.vertical, 2)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(dimmed)
        .onHover { hovered = $0 }
        .help(dimmed ? "" : "Send (Return)")
    }
}

private struct HudMessageMicButton: View {
    let box: CGFloat
    let glyph: CGFloat
    let voice: HudMessageBarVoiceConfiguration

    @State private var pulse = false
    @Environment(\.hudTheme) private var theme

    private var strokeColor: Color {
        if voice.state == .recording { return theme.palette.accent }
        if voice.state.isProcessing { return theme.palette.muted }
        if voice.state.isUnavailable { return theme.palette.dim.opacity(0.5) }
        return theme.palette.dim
    }

    private var tooltip: String {
        if let tooltip = voice.tooltip {
            return tooltip
        }
        switch voice.state {
        case .idle:
            return "Dictate"
        case .starting:
            return "Starting recording"
        case .recording:
            return "Recording"
        case .processing:
            return "Transcribing"
        case .unavailable(let reason):
            return reason
        }
    }

    var body: some View {
        Button(action: voice.onToggle) {
            ZStack {
                if voice.state == .recording {
                    Circle()
                        .fill(theme.palette.accent.opacity(pulse ? 0.20 : 0.08))
                        .frame(width: box, height: box)
                }
                HudMessageMicGlyphShape()
                    .stroke(
                        strokeColor,
                        style: StrokeStyle(
                            lineWidth: voice.state == .recording ? 1.4 : 1,
                            lineCap: .round,
                            lineJoin: .round,
                            dash: voice.state.isUnavailable ? [1.5, 1.5] : []
                        )
                    )
                    .frame(width: glyph, height: glyph)
                    .opacity(voice.state.isProcessing && pulse ? 0.55 : 1.0)
            }
            .frame(width: box, height: box)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .help(tooltip)
        .onChange(of: voice.state) { _, newValue in
            pulse = false
            if newValue == .recording || newValue == .starting || newValue == .processing {
                withAnimation(.easeInOut(duration: 0.55).repeatForever(autoreverses: true)) {
                    pulse = true
                }
            }
        }
        .onAppear {
            if voice.state == .recording || voice.state == .starting || voice.state == .processing {
                withAnimation(.easeInOut(duration: 0.55).repeatForever(autoreverses: true)) {
                    pulse = true
                }
            }
        }
    }
}

private struct HudMessageMicGlyphShape: Shape {
    func path(in rect: CGRect) -> Path {
        let sx = rect.width / 14.0
        let sy = rect.height / 14.0
        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(x: rect.minX + x * sx, y: rect.minY + y * sy)
        }
        var path = Path()

        let bodyRect = CGRect(
            x: rect.minX + 5 * sx,
            y: rect.minY + 2 * sy,
            width: 4 * sx,
            height: 6.5 * sy
        )
        let radius = 2 * min(sx, sy)
        path.addRoundedRect(in: bodyRect, cornerSize: CGSize(width: radius, height: radius))

        path.move(to: p(4, 8.5))
        path.addQuadCurve(to: p(10, 8.5), control: p(7, 13.5))
        path.move(to: p(7, 11))
        path.addLine(to: p(7, 12.7))
        path.move(to: p(5, 12.7))
        path.addLine(to: p(9, 12.7))

        return path
    }
}

private struct HudMessageKeyChip: View {
    let label: String
    let accentLastCharacter: Bool
    @Environment(\.hudTheme) private var theme

    init(_ label: String, accentLastCharacter: Bool = false) {
        self.label = label
        self.accentLastCharacter = accentLastCharacter
    }

    var body: some View {
        HStack(spacing: 1) {
            if accentLastCharacter, let last = label.last {
                let prefix = String(label.dropLast())
                if !prefix.isEmpty {
                    Text(prefix)
                        .hudFont(.micro, face: .mono, weight: .semibold)
                        .foregroundStyle(theme.palette.dim)
                }
                Text(String(last))
                    .hudFont(.micro, face: .mono, weight: .bold)
                    .foregroundStyle(theme.palette.accent)
            } else {
                Text(label)
                    .hudFont(.micro, face: .mono, weight: .bold)
                    .tracking(0.5)
                    .foregroundStyle(theme.palette.dim)
            }
        }
        .padding(.horizontal, 5)
        .padding(.vertical, 1.5)
        .background(
            RoundedRectangle(cornerRadius: 3, style: .continuous)
                .fill(theme.palette.bg)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 3, style: .continuous)
                .stroke(theme.hairline.standard, lineWidth: 0.5)
        )
        .fixedSize()
    }
}
