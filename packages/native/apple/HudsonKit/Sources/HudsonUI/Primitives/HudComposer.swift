import SwiftUI

// MARK: - Public model

/// Where a chat turn is in its lifecycle. The CLIENT owns this value; the
/// composer only reads it to morph its primary action. `.idle` means no turn is
/// in flight (primary = Send); `.streaming` means a turn is generating (primary =
/// Stop when the field is empty, Queue when it has text).
public enum HudComposerPhase: Equatable, Sendable {
    case idle
    case streaming
}

/// How the composer arranges its parts.
///
/// - `inline`: one row - leading accessory, field, trailing accessory, primary
///   button - with queued items as chips above. Compact; good for slim bars.
/// - `stacked`: the field spans the top; a control row sits beneath it (leading
///   accessory on the left, trailing accessory + primary button grouped on the
///   right); queued items stack as full-width rows above the field. The tall
///   chat-composer shape.
public enum HudComposerLayout: Equatable, Sendable {
    case inline
    case stacked
}

/// One message the user queued mid-turn. `id` is stable so chips diff cleanly
/// across re-renders; `text` is the user-visible body. The composer renders these
/// as removable chips but never mutates the list - it reports edits/removes to the
/// host, which owns the queue.
public struct HudComposerQueuedItem: Identifiable, Equatable, Sendable {
    public let id: UUID
    public var text: String

    public init(id: UUID = UUID(), text: String) {
        self.id = id
        self.text = text
    }
}

/// Something attached to the next message - a file, image, snippet, etc. The
/// composer renders these as removable chips; the host owns the underlying data
/// and supplies a `systemImage` (SF Symbol) for the chip glyph.
public struct HudComposerAttachment: Identifiable, Equatable, Sendable {
    public let id: UUID
    public var name: String
    public var systemImage: String

    public init(id: UUID = UUID(), name: String, systemImage: String = "paperclip") {
        self.id = id
        self.name = name
        self.systemImage = systemImage
    }
}

/// Active model and (optional) reasoning effort, shown in the control row.
/// Providing `onTapModel` makes it tappable - the hook for a model/effort picker.
public struct HudComposerModelInfo: Equatable, Sendable {
    public var model: String
    public var effort: String?

    public init(model: String, effort: String? = nil) {
        self.model = model
        self.effort = effort
    }
}

/// The discrete intents the composer emits. The host owns the session model and
/// decides what each means concretely.
///
/// - `submit`: idle + text - start a turn now.
/// - `queue`:  streaming + text - append to the queue (runs after the current turn).
/// - `steer`:  streaming + text + cmd-return - interrupt the current turn and send now.
/// - `stop`:   streaming - halt the current turn (no send).
public enum HudComposerAction: Equatable, Sendable {
    case submit
    case queue
    case steer
    case stop
}

/// Non-color layout/identity knobs for the composer. Colors come from
/// `@Environment(\.hudTheme)` (the same split `HudButton` uses: a `style` value
/// for dimensions/identity, the theme environment for palette). Surfaces that
/// differ in size - a roomy workspace panel vs. a slim dock - vary these; they
/// are not theme tokens.
public struct HudComposerStyle: Equatable, Sendable {
    public var placeholder: String
    public var fontSize: CGFloat
    public var lineLimit: ClosedRange<Int>
    public var fieldHorizontalPadding: CGFloat
    public var fieldVerticalPadding: CGFloat
    public var fieldCornerRadius: CGFloat
    public var controlSize: CGFloat

    public init(
        placeholder: String = "Message...",
        fontSize: CGFloat = 13,
        lineLimit: ClosedRange<Int> = 1...8,
        fieldHorizontalPadding: CGFloat = 14,
        fieldVerticalPadding: CGFloat = 10,
        fieldCornerRadius: CGFloat = 12,
        controlSize: CGFloat = 30
    ) {
        self.placeholder = placeholder
        self.fontSize = fontSize
        self.lineLimit = lineLimit
        self.fieldHorizontalPadding = fieldHorizontalPadding
        self.fieldVerticalPadding = fieldVerticalPadding
        self.fieldCornerRadius = fieldCornerRadius
        self.controlSize = controlSize
    }

    public static var `default`: HudComposerStyle { HudComposerStyle() }
}

// MARK: - Action resolver (pure, testable)

/// Which primary button to draw in the current `(phase x hasText)` cell.
enum HudComposerPrimaryKind: Equatable, Sendable {
    case sendDisabled
    case send
    case stop
    case queue
}

/// Pure decision table for the morphing composer - no SwiftUI. Maps
/// `(phase x hasText)` to the primary button and to the action each key chord
/// fires. `nil` means "no-op" (swallow nothing / ignore the key). Mirrors the
/// `HudMessageBarSuggestionSelectionState` precedent: the View renders this
/// struct's output, and it is unit-tested in isolation.
enum HudComposerActionResolver {
    static func primaryKind(phase: HudComposerPhase, hasText: Bool) -> HudComposerPrimaryKind {
        switch (phase, hasText) {
        case (.idle, false):      return .sendDisabled
        case (.idle, true):       return .send
        case (.streaming, false): return .stop
        case (.streaming, true):  return .queue
        }
    }

    /// Action the primary button performs when tapped. `nil` for the disabled cell.
    static func primaryAction(phase: HudComposerPhase, hasText: Bool) -> HudComposerAction? {
        switch primaryKind(phase: phase, hasText: hasText) {
        case .sendDisabled: return nil
        case .send:         return .submit
        case .stop:         return .stop
        case .queue:        return .queue
        }
    }

    /// Plain Return.
    static func returnAction(phase: HudComposerPhase, hasText: Bool) -> HudComposerAction? {
        switch (phase, hasText) {
        case (.idle, false):      return nil
        case (.idle, true):       return .submit
        case (.streaming, false): return .stop
        case (.streaming, true):  return .queue
        }
    }

    /// Command-Return. Only meaningful streaming + text -> steer; otherwise it
    /// falls back to the plain Return action.
    static func commandReturnAction(phase: HudComposerPhase, hasText: Bool) -> HudComposerAction? {
        if phase == .streaming, hasText { return .steer }
        return returnAction(phase: phase, hasText: hasText)
    }

    /// Escape stops a streaming turn (text or not); no-op when idle.
    static func escapeAction(phase: HudComposerPhase) -> HudComposerAction? {
        phase == .streaming ? .stop : nil
    }
}

// MARK: - HudComposer

/// A chat-turn composer: a text field with a single morphing primary button
/// (Send -> Stop -> Queue), removable queued-message chips, and cmd-return steer /
/// esc-stop key chords. The turn lifecycle is driven by the host through `phase`;
/// the composer emits `HudComposerAction`s and never owns session state.
///
/// Visuals theme from `@Environment(\.hudTheme)`; layout comes from
/// `HudComposerStyle`. Leading/trailing accessory slots render inside the field
/// chrome, so a host can drop in its own mic, attachment button, etc. without
/// losing the unified field background. Surrounding chrome (dictation strips,
/// status lines) is the host's to stack around this view.
public struct HudComposer<Leading: View, Trailing: View>: View {
    @Binding private var text: String
    private let phase: HudComposerPhase
    private let queued: [HudComposerQueuedItem]
    private let style: HudComposerStyle
    private let layout: HudComposerLayout
    private let focus: FocusState<Bool>.Binding?
    private let leadingAccessory: () -> Leading
    private let trailingAccessory: () -> Trailing
    private let onAction: (HudComposerAction) -> Void
    private let onRemoveQueued: (HudComposerQueuedItem) -> Void
    private let onEditQueued: ((HudComposerQueuedItem) -> Void)?
    private let attachments: [HudComposerAttachment]
    private let model: HudComposerModelInfo?
    private let onAddAttachment: (() -> Void)?
    private let onRemoveAttachment: ((HudComposerAttachment) -> Void)?
    private let onTapModel: (() -> Void)?

    @Environment(\.hudTheme) private var theme

    public init(
        text: Binding<String>,
        phase: HudComposerPhase,
        queued: [HudComposerQueuedItem] = [],
        style: HudComposerStyle = .default,
        layout: HudComposerLayout = .inline,
        focus: FocusState<Bool>.Binding? = nil,
        @ViewBuilder leadingAccessory: @escaping () -> Leading = { EmptyView() },
        @ViewBuilder trailingAccessory: @escaping () -> Trailing = { EmptyView() },
        onAction: @escaping (HudComposerAction) -> Void,
        onRemoveQueued: @escaping (HudComposerQueuedItem) -> Void = { _ in },
        onEditQueued: ((HudComposerQueuedItem) -> Void)? = nil,
        attachments: [HudComposerAttachment] = [],
        model: HudComposerModelInfo? = nil,
        onAddAttachment: (() -> Void)? = nil,
        onRemoveAttachment: ((HudComposerAttachment) -> Void)? = nil,
        onTapModel: (() -> Void)? = nil
    ) {
        self._text = text
        self.phase = phase
        self.queued = queued
        self.style = style
        self.layout = layout
        self.focus = focus
        self.leadingAccessory = leadingAccessory
        self.trailingAccessory = trailingAccessory
        self.onAction = onAction
        self.onRemoveQueued = onRemoveQueued
        self.onEditQueued = onEditQueued
        self.attachments = attachments
        self.model = model
        self.onAddAttachment = onAddAttachment
        self.onRemoveAttachment = onRemoveAttachment
        self.onTapModel = onTapModel
    }

    private var hasText: Bool {
        !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var isFocused: Bool {
        focus?.wrappedValue ?? false
    }

    public var body: some View {
        switch layout {
        case .inline:  inlineBody
        case .stacked: stackedBody
        }
    }

    /// One row: leading, field, trailing, primary, with queued chips above.
    private var inlineBody: some View {
        VStack(alignment: .leading, spacing: HudSpacing.sm) {
            if !queued.isEmpty {
                HudComposerQueueChips(
                    items: queued,
                    onEdit: onEditQueued,
                    onRemove: onRemoveQueued
                )
                .padding(.horizontal, style.fieldHorizontalPadding)
            }

            HStack(alignment: .center, spacing: HudSpacing.lg) {
                leadingAccessory()

                applyFocus(to: field)
                    .frame(maxWidth: .infinity, alignment: .leading)

                trailingAccessory()

                primaryButton
            }
            .padding(.horizontal, style.fieldHorizontalPadding)
            .padding(.vertical, style.fieldVerticalPadding)
            .background(fieldChrome)
        }
    }

    /// Field on top, a control row beneath (leading meta on the left; trailing
    /// accessory + primary grouped on the right), queued items stacked above as
    /// full-width rows. All inside one chrome, separated by a hairline.
    private var stackedBody: some View {
        VStack(alignment: .leading, spacing: 0) {
            if !queued.isEmpty {
                VStack(alignment: .leading, spacing: HudSpacing.xs) {
                    ForEach(queued) { item in
                        HudComposerQueueRow(
                            item: item,
                            editable: onEditQueued != nil,
                            onEdit: { onEditQueued?(item) },
                            onRemove: { onRemoveQueued(item) }
                        )
                    }
                }
                .padding(.horizontal, style.fieldHorizontalPadding)
                .padding(.top, style.fieldVerticalPadding)
                .padding(.bottom, HudSpacing.md)

                hairline
            }

            applyFocus(to: field)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, style.fieldHorizontalPadding)
                .padding(.top, style.fieldVerticalPadding)
                .padding(.bottom, HudSpacing.md)

            hairline

            if !attachments.isEmpty {
                HudComposerAttachmentChips(items: attachments, onRemove: onRemoveAttachment)
                    .padding(.horizontal, style.fieldHorizontalPadding)
                    .padding(.top, HudSpacing.md)
            }

            controlRow
                .padding(.horizontal, style.fieldHorizontalPadding)
                .padding(.vertical, HudSpacing.lg)
        }
        .background(fieldChrome)
    }

    private var controlRow: some View {
        HStack(alignment: .center, spacing: HudSpacing.md) {
            if let onAddAttachment {
                HudComposerAttachButton(onTap: onAddAttachment)
            }

            leadingAccessory()

            Spacer(minLength: HudSpacing.md)

            if let model {
                HudComposerModelLabel(info: model, onTap: onTapModel)
            }

            HStack(alignment: .center, spacing: HudSpacing.sm) {
                trailingAccessory()
                primaryButton
            }
        }
    }

    private var hairline: some View {
        Rectangle()
            .fill(theme.hairline.subtle)
            .frame(height: HudStrokeWidth.thin)
    }

    private var primaryButton: some View {
        HudComposerPrimaryButton(
            kind: HudComposerActionResolver.primaryKind(phase: phase, hasText: hasText),
            size: style.controlSize,
            onTap: {
                if let action = HudComposerActionResolver.primaryAction(phase: phase, hasText: hasText) {
                    onAction(action)
                }
            }
        )
    }

    private var field: some View {
        TextField(style.placeholder, text: $text, axis: .vertical)
            .textFieldStyle(.plain)
            .lineLimit(style.lineLimit)
            .font(HudFont.mono(style.fontSize))
            .foregroundStyle(theme.palette.ink)
            .onSubmit {
                if let action = HudComposerActionResolver.returnAction(phase: phase, hasText: hasText) {
                    onAction(action)
                }
            }
            .onKeyPress(keys: [.return]) { press in
                guard press.modifiers.contains(.command) else { return .ignored }
                if let action = HudComposerActionResolver.commandReturnAction(phase: phase, hasText: hasText) {
                    onAction(action)
                    return .handled
                }
                return .ignored
            }
            .onKeyPress(.escape) {
                if let action = HudComposerActionResolver.escapeAction(phase: phase) {
                    onAction(action)
                    return .handled
                }
                return .ignored
            }
    }

    @ViewBuilder
    private func applyFocus<F: View>(to view: F) -> some View {
        if let focus {
            view.focused(focus)
        } else {
            view
        }
    }

    private var fieldChrome: some View {
        RoundedRectangle(cornerRadius: style.fieldCornerRadius, style: .continuous)
            .fill(HudSurface.inset)
            .overlay(
                RoundedRectangle(cornerRadius: style.fieldCornerRadius, style: .continuous)
                    .strokeBorder(
                        isFocused ? theme.focus.ring : theme.hairline.subtle,
                        lineWidth: HudStrokeWidth.thin
                    )
            )
    }
}

// MARK: - Primary button (morphing Send / Stop / Queue)

private struct HudComposerPrimaryButton: View {
    let kind: HudComposerPrimaryKind
    let size: CGFloat
    let onTap: () -> Void

    @Environment(\.hudTheme) private var theme

    private var enabled: Bool { kind != .sendDisabled }

    private var icon: String { kind == .stop ? "stop.fill" : "arrow.up" }

    private var iconSize: CGFloat { kind == .stop ? size * 0.37 : size * 0.42 }

    private var discFill: Color {
        switch kind {
        case .sendDisabled: return theme.palette.ink.opacity(HudOpacity.ghost)
        case .send, .queue: return theme.palette.accent
        case .stop:         return theme.palette.statusError
        }
    }

    private var iconColor: Color {
        switch kind {
        case .sendDisabled: return theme.palette.dim
        case .send, .queue: return theme.palette.bg
        case .stop:         return .white
        }
    }

    private var help: String {
        switch kind {
        case .sendDisabled: return ""
        case .send:         return "Send (Return)"
        case .queue:        return "Queue (Return) - Steer (Cmd-Return)"
        case .stop:         return "Stop (Esc)"
        }
    }

    var body: some View {
        Button(action: onTap) {
            Image(systemName: icon)
                .font(.system(size: iconSize, weight: .bold))
                .foregroundStyle(iconColor)
                .frame(width: size, height: size)
                .background(
                    Circle()
                        .fill(discFill)
                        .overlay(
                            Circle().strokeBorder(
                                kind == .sendDisabled ? theme.hairline.standard : Color.clear,
                                lineWidth: HudStrokeWidth.thin
                            )
                        )
                )
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .help(help)
        .animation(.easeInOut(duration: 0.15), value: kind)
    }
}

// MARK: - Queued chips

private struct HudComposerQueueChips: View {
    let items: [HudComposerQueuedItem]
    let onEdit: ((HudComposerQueuedItem) -> Void)?
    let onRemove: (HudComposerQueuedItem) -> Void

    var body: some View {
        HStack(spacing: HudSpacing.sm) {
            ForEach(items) { item in
                HudComposerQueueChip(
                    item: item,
                    editable: onEdit != nil,
                    onEdit: { onEdit?(item) },
                    onRemove: { onRemove(item) }
                )
            }
            Spacer(minLength: 0)
        }
    }
}

private struct HudComposerQueueChip: View {
    let item: HudComposerQueuedItem
    let editable: Bool
    let onEdit: () -> Void
    let onRemove: () -> Void

    @Environment(\.hudTheme) private var theme

    var body: some View {
        HStack(spacing: HudSpacing.xs) {
            Image(systemName: "clock")
                .font(HudFont.ui(HudTextSize.micro))
                .foregroundStyle(theme.palette.dim)

            Text(item.text)
                .font(HudFont.mono(HudTextSize.xxs))
                .foregroundStyle(theme.palette.muted)
                .lineLimit(1)
                .truncationMode(.tail)

            Button(action: onRemove) {
                Image(systemName: "xmark")
                    .font(HudFont.ui(HudTextSize.micro, weight: .bold))
                    .foregroundStyle(theme.palette.dim)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .help("Remove")
        }
        .padding(.horizontal, HudSpacing.md)
        .padding(.vertical, HudSpacing.xxs)
        .background(Capsule().fill(theme.palette.ink.opacity(HudOpacity.ghost)))
        .contentShape(Capsule())
        .onTapGesture { if editable { onEdit() } }
        .help(editable ? "Queued - tap to edit, x to remove" : "Queued")
    }
}

/// A full-width queued row for the stacked layout: glyph, text, x, aligned to
/// the field above it. Tapping the row edits; the x removes.
private struct HudComposerQueueRow: View {
    let item: HudComposerQueuedItem
    let editable: Bool
    let onEdit: () -> Void
    let onRemove: () -> Void

    @Environment(\.hudTheme) private var theme

    var body: some View {
        HStack(spacing: HudSpacing.md) {
            Image(systemName: "clock")
                .font(HudFont.ui(HudTextSize.micro))
                .foregroundStyle(theme.palette.dim)

            Text(item.text)
                .font(HudFont.mono(HudTextSize.xs))
                .foregroundStyle(theme.palette.muted)
                .lineLimit(1)
                .truncationMode(.tail)

            Spacer(minLength: HudSpacing.md)

            Button(action: onRemove) {
                Image(systemName: "xmark")
                    .font(HudFont.ui(HudTextSize.micro, weight: .bold))
                    .foregroundStyle(theme.palette.dim)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .help("Remove")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
        .onTapGesture { if editable { onEdit() } }
        .help(editable ? "Queued - tap to edit, x to remove" : "Queued")
    }
}

// MARK: - Attach button

private struct HudComposerAttachButton: View {
    let onTap: () -> Void

    @Environment(\.hudTheme) private var theme

    var body: some View {
        Button(action: onTap) {
            Image(systemName: "plus")
                .font(HudFont.ui(HudTextSize.base, weight: .semibold))
                .foregroundStyle(theme.palette.muted)
                .frame(width: HudLayout.composerAccessoryButtonSize, height: HudLayout.composerAccessoryButtonSize)
                .background(
                    Circle()
                        .fill(theme.palette.ink.opacity(HudOpacity.ghost))
                        .overlay(
                            Circle().strokeBorder(theme.hairline.standard, lineWidth: HudStrokeWidth.thin)
                        )
                )
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .help("Attach")
    }
}

// MARK: - Model / effort label

private struct HudComposerModelLabel: View {
    let info: HudComposerModelInfo
    let onTap: (() -> Void)?

    @Environment(\.hudTheme) private var theme

    private var labelContent: some View {
        HStack(spacing: HudSpacing.xs) {
            Text(info.model)
                .foregroundStyle(theme.palette.muted)
            if let effort = info.effort {
                Text("/")
                    .foregroundStyle(theme.palette.dim)
                Text(effort)
                    .foregroundStyle(theme.palette.dim)
            }
        }
        .font(HudFont.mono(HudTextSize.xxs))
        .lineLimit(1)
    }

    var body: some View {
        Group {
            if let onTap {
                Button(action: onTap) { labelContent }
                    .buttonStyle(.plain)
            } else {
                labelContent
            }
        }
        .help("Model / reasoning effort")
    }
}

// MARK: - Attachment chips

private struct HudComposerAttachmentChips: View {
    let items: [HudComposerAttachment]
    let onRemove: ((HudComposerAttachment) -> Void)?

    @Environment(\.hudTheme) private var theme

    var body: some View {
        HStack(spacing: HudSpacing.sm) {
            ForEach(items) { item in
                HStack(spacing: HudSpacing.xs) {
                    Image(systemName: item.systemImage)
                        .font(HudFont.ui(HudTextSize.micro))
                        .foregroundStyle(theme.palette.dim)

                    Text(item.name)
                        .font(HudFont.mono(HudTextSize.xxs))
                        .foregroundStyle(theme.palette.muted)
                        .lineLimit(1)
                        .truncationMode(.middle)

                    if let onRemove {
                        Button(action: { onRemove(item) }) {
                            Image(systemName: "xmark")
                                .font(HudFont.ui(HudTextSize.micro, weight: .bold))
                                .foregroundStyle(theme.palette.dim)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .help("Remove")
                    }
                }
                .padding(.horizontal, HudSpacing.md)
                .padding(.vertical, HudSpacing.xxs)
                .background(Capsule().fill(theme.palette.ink.opacity(HudOpacity.ghost)))
            }
            Spacer(minLength: 0)
        }
    }
}
