import SwiftUI
#if os(macOS)
import AppKit
#endif

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

/// How the composer draws its frame.
///
/// - `filled`: an inset surface with a soft rim and rounded (capsule) buttons.
/// - `hairline`: no fill, a one-device-pixel border, square buttons and a
///   plain-text runtime trigger. Built to hold a hard edge on 1x displays; set
///   `fieldCornerRadius` to 4 or less with it.
public enum HudComposerChrome: Equatable, Sendable {
    case filled
    case hairline
}

/// The runtime the next message will run on, shown in the control row as a
/// `HudRuntimeChip`. Providing `onTapModel` makes it the trigger for the
/// runtime picker (`.hudRuntimePicker(...)`); without it the chip renders as a
/// read-only identity.
///
/// `harness` and `effort` are both optional because neither is real on every
/// surface: a host with one provider has no harness to name, and a host with no
/// reasoning-effort setting leaves that segment off rather than showing a
/// control that changes nothing.
public struct HudComposerModelInfo: Equatable, Sendable {
    public var model: String
    public var effort: String?
    /// Harness id — selects the mark. Nil where the surface has only one.
    public var harness: String?
    /// Typographic stand-in when no mark is installed for `harness`.
    public var monogram: String

    public init(model: String, effort: String? = nil, harness: String? = nil, monogram: String = "") {
        self.model = model
        self.effort = effort
        self.harness = harness
        self.monogram = monogram
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
    /// Field font. `nil` keeps the default `HudFont.mono(fontSize)`.
    public var font: Font?
    public var lineLimit: ClosedRange<Int>
    public var fieldHorizontalPadding: CGFloat
    public var fieldVerticalPadding: CGFloat
    public var fieldCornerRadius: CGFloat
    public var controlSize: CGFloat
    public var chrome: HudComposerChrome
    /// Typeface for the hairline field's AppKit input, which takes a face
    /// rather than a SwiftUI `Font`.
    public var face: HudComposerFace

    public init(
        placeholder: String = "Message...",
        fontSize: CGFloat = 13,
        font: Font? = nil,
        lineLimit: ClosedRange<Int> = 1...8,
        fieldHorizontalPadding: CGFloat = 14,
        fieldVerticalPadding: CGFloat = 10,
        fieldCornerRadius: CGFloat = 12,
        controlSize: CGFloat = 30,
        chrome: HudComposerChrome = .filled,
        face: HudComposerFace = .mono
    ) {
        self.placeholder = placeholder
        self.fontSize = fontSize
        self.font = font
        self.lineLimit = lineLimit
        self.fieldHorizontalPadding = fieldHorizontalPadding
        self.fieldVerticalPadding = fieldVerticalPadding
        self.fieldCornerRadius = fieldCornerRadius
        self.controlSize = controlSize
        self.chrome = chrome
        self.face = face
    }

    /// The crisp preset: hairline chrome, 4pt corners, 26pt square controls.
    public static func hairline(
        placeholder: String = "Message...",
        fontSize: CGFloat = 13,
        font: Font? = nil,
        face: HudComposerFace = .mono,
        lineLimit: ClosedRange<Int> = 1...8
    ) -> HudComposerStyle {
        HudComposerStyle(
            placeholder: placeholder,
            fontSize: fontSize,
            font: font,
            lineLimit: lineLimit,
            fieldHorizontalPadding: 12,
            fieldVerticalPadding: 10,
            fieldCornerRadius: 4,
            controlSize: 26,
            chrome: .hairline,
            face: face
        )
    }

    public static var `default`: HudComposerStyle { HudComposerStyle() }
}

/// The hairline field's typeface.
public enum HudComposerFace: Equatable, Sendable {
    case mono
    case system
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
    @Environment(\.displayScale) private var displayScale

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

                fieldView
                    .frame(maxWidth: .infinity, alignment: .leading)

                turnActionCluster
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

            fieldView
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
                .padding(.vertical, style.chrome == .hairline ? HudSpacing.sm : HudSpacing.lg)
        }
        .background(fieldChrome)
    }

    private var controlRow: some View {
        HStack(alignment: .center, spacing: HudSpacing.md) {
            if let onAddAttachment {
                HudComposerAttachButton(chrome: style.chrome, onTap: onAddAttachment)
            }

            leadingAccessory()

            Spacer(minLength: HudSpacing.md)

            if let model {
                HudComposerModelLabel(info: model, chrome: style.chrome, onTap: onTapModel)
            }

            turnActionCluster
        }
    }

    private var hairline: some View {
        Rectangle()
            .fill(theme.hairline.subtle)
            .frame(height: style.chrome == .hairline ? HudPixel.hairline(displayScale) : HudStrokeWidth.thin)
    }

    private var primaryButton: some View {
        HudComposerPrimaryButton(
            kind: HudComposerActionResolver.primaryKind(phase: phase, hasText: hasText),
            size: style.controlSize,
            chrome: style.chrome,
            onTap: {
                if let action = HudComposerActionResolver.primaryAction(phase: phase, hasText: hasText) {
                    onAction(action)
                }
            }
        )
    }

    private var showsSteerButton: Bool {
        phase == .streaming && hasText
    }

    private var turnActionCluster: some View {
        HStack(alignment: .center, spacing: HudSpacing.sm) {
            trailingAccessory()

            if showsSteerButton {
                HudComposerSteerButton(size: style.controlSize, chrome: style.chrome) {
                    onAction(.steer)
                }
            }

            primaryButton
        }
    }

    /// The hairline chrome on macOS types into `HudOpaqueTextInput`, whose
    /// solid ground gets the glyphs full font smoothing. Everything else keeps
    /// SwiftUI's `TextField`.
    @ViewBuilder
    private var fieldView: some View {
        #if os(macOS)
        if style.chrome == .hairline {
            opaqueField
        } else {
            applyFocus(to: field)
        }
        #else
        applyFocus(to: field)
        #endif
    }

    #if os(macOS)
    private var opaqueField: some View {
        HudOpaqueTextInput(
            text: $text,
            placeholder: style.placeholder,
            font: style.face == .mono
                ? NSFont.monospacedSystemFont(ofSize: style.fontSize, weight: .regular)
                : NSFont.systemFont(ofSize: style.fontSize, weight: .regular),
            ink: NSColor(theme.palette.ink),
            placeholderInk: NSColor(theme.palette.muted),
            ground: NSColor(theme.palette.bg),
            lineLimit: style.lineLimit,
            focus: focus,
            onReturn: {
                guard let action = HudComposerActionResolver.returnAction(phase: phase, hasText: hasText) else { return true }
                onAction(action)
                return true
            },
            onCommandReturn: {
                guard let action = HudComposerActionResolver.commandReturnAction(phase: phase, hasText: hasText) else { return false }
                onAction(action)
                return true
            },
            onEscape: {
                guard let action = HudComposerActionResolver.escapeAction(phase: phase) else { return false }
                onAction(action)
                return true
            }
        )
    }
    #endif

    private var field: some View {
        TextField(style.placeholder, text: $text, axis: .vertical)
            .textFieldStyle(.plain)
            .lineLimit(style.lineLimit)
            .font(style.font ?? HudFont.mono(style.fontSize))
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

    @ViewBuilder
    private var fieldChrome: some View {
        switch style.chrome {
        case .filled: filledChrome
        case .hairline: hairlineChrome
        }
    }

    /// Filled with the page colour, the same solid ground the input paints
    /// under its glyphs. The rim is a quiet hairline that steps up one notch
    /// on focus; the caret carries the rest.
    private var hairlineChrome: some View {
        RoundedRectangle(cornerRadius: style.fieldCornerRadius, style: .continuous)
            .fill(theme.palette.bg)
            .hudPixelBorder(
                radius: style.fieldCornerRadius,
                color: isFocused ? theme.hairline.standard : theme.hairline.subtle
            )
    }

    private var filledChrome: some View {
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
    var chrome: HudComposerChrome = .filled
    let onTap: () -> Void

    @Environment(\.hudTheme) private var theme

    @State private var hovering = false

    private var enabled: Bool { kind != .sendDisabled }

    private var icon: String {
        switch kind {
        case .sendDisabled, .send: return "arrow.up"
        case .stop:                return "stop.fill"
        case .queue:               return "tray.and.arrow.down.fill"
        }
    }

    private var iconSize: CGFloat {
        switch kind {
        case .sendDisabled, .send: return size * 0.42
        case .stop:                return size * 0.37
        case .queue:               return size * 0.36
        }
    }

    private var label: String? {
        kind == .queue ? "Queue" : nil
    }

    private var discFill: Color {
        if chrome == .hairline {
            // No fill: the hairline composer's controls are bare glyphs.
            return .clear
        }
        switch kind {
        case .sendDisabled: return theme.palette.ink.opacity(HudOpacity.ghost)
        case .send, .queue: return theme.palette.accent
        case .stop:         return theme.palette.statusError
        }
    }

    private var iconColor: Color {
        if chrome == .hairline {
            // One ink, no hue: live is ink, disabled is dim.
            return kind == .sendDisabled ? theme.palette.dim : theme.palette.ink
        }
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

    private var shape: AnyShape {
        chrome == .hairline
            ? AnyShape(RoundedRectangle(cornerRadius: HudRadius.tight, style: .continuous))
            : AnyShape(Capsule(style: .continuous))
    }

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: HudSpacing.xs) {
                Image(systemName: icon)
                    .font(.system(size: iconSize, weight: chrome == .hairline ? .semibold : .bold))

                if let label {
                    Text(label)
                        .font(HudFont.mono(HudTextSize.xs, weight: .semibold))
                }
            }
            .foregroundStyle(iconColor)
            .frame(height: size)
            .frame(width: label == nil ? size : nil)
            .padding(.horizontal, label == nil ? 0 : HudSpacing.md)
            .background {
                if chrome == .hairline {
                    shape.fill(hovering && enabled ? HudSurface.hover : Color.clear)
                } else {
                    Capsule(style: .continuous)
                        .fill(discFill)
                        .overlay(
                            Capsule(style: .continuous).strokeBorder(
                                kind == .sendDisabled ? theme.hairline.standard : Color.clear,
                                lineWidth: HudStrokeWidth.thin
                            )
                        )
                }
            }
            .contentShape(shape)
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .help(help)
        .animation(.easeInOut(duration: 0.15), value: kind)
        #if os(macOS)
        .onHover { hovering = $0 }
        #endif
    }
}

private struct HudComposerSteerButton: View {
    let size: CGFloat
    var chrome: HudComposerChrome = .filled
    let onTap: () -> Void

    @Environment(\.hudTheme) private var theme
    @State private var hovering = false

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: HudSpacing.xs) {
                Image(systemName: "arrow.turn.up.right")
                    .font(.system(size: size * 0.34, weight: .bold))
                Text("Steer")
                    .font(HudFont.mono(HudTextSize.xs, weight: .semibold))
            }
            .foregroundStyle(chrome == .hairline ? theme.palette.ink : theme.palette.accent)
            .frame(height: size)
            .padding(.horizontal, HudSpacing.md)
            .background {
                if chrome == .hairline {
                    RoundedRectangle(cornerRadius: HudRadius.tight, style: .continuous)
                        .fill(hovering ? HudSurface.hover : Color.clear)
                } else {
                    Capsule(style: .continuous)
                        .fill(theme.palette.accent.opacity(HudOpacity.subtle))
                        .overlay(
                            Capsule(style: .continuous)
                                .strokeBorder(theme.palette.accent.opacity(HudOpacity.soft), lineWidth: HudStrokeWidth.thin)
                        )
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .help("Steer now (Cmd-Return)")
        #if os(macOS)
        .onHover { hovering = $0 }
        #endif
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
    var chrome: HudComposerChrome = .filled
    let onTap: () -> Void

    @Environment(\.hudTheme) private var theme

    var body: some View {
        if chrome == .hairline {
            HudSquareIconButton(symbol: "plus", help: "Attach", size: 24, iconSize: 12, action: onTap)
        } else {
            filled
        }
    }

    private var filled: some View {
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

// MARK: - Runtime readout

/// The control row's runtime readout. This was a flat `model / effort` string
/// with a bare `onTap`; it is now `HudRuntimeChip`, so the same hook opens the
/// real picker and the resting state reads as one control instead of two runs
/// of dim text. The chip's lit state is not threaded through here: it reads
/// `\.hudRuntimeIsPicking`, which the `.hudRuntimePicker` presenter sets on
/// the container the composer sits in.
private struct HudComposerModelLabel: View {
    let info: HudComposerModelInfo
    var chrome: HudComposerChrome = .filled
    let onTap: (() -> Void)?

    var body: some View {
        HudRuntimeChip(
            harness: info.harness,
            monogram: info.monogram,
            model: info.model,
            effort: info.effort,
            presentation: chrome == .hairline ? .text : .chip,
            onPick: onTap
        )
        .help("Runtime - harness, model and reasoning effort")
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
