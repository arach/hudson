import Foundation
import SwiftUI

#if os(macOS)
import AppKit
#endif

public enum HudAgentTurnRole: Equatable, Sendable {
    case user
    case assistant
    case system
}

public struct HudAgentTurnAttachment: Identifiable, Equatable, Sendable {
    public let id: UUID
    public var name: String
    public var mediaType: String
    public var systemImage: String

    public init(id: UUID = UUID(), name: String, mediaType: String, systemImage: String = "paperclip") {
        self.id = id
        self.name = name
        self.mediaType = mediaType
        self.systemImage = systemImage
    }
}

/// A transport-agnostic turn in an agent conversation. Hosts map their own
/// session/message model onto this value and keep runtime behavior outside
/// HudsonUI.
public struct HudAgentTurn: Identifiable, Equatable, Sendable {
    public let id: UUID
    public var role: HudAgentTurnRole
    public var author: String
    public var timestamp: Date
    public var text: String
    public var attachments: [HudAgentTurnAttachment]
    public var isStreaming: Bool
    public var toolActivity: String?

    public init(
        id: UUID = UUID(),
        role: HudAgentTurnRole,
        author: String,
        timestamp: Date = Date(),
        text: String,
        attachments: [HudAgentTurnAttachment] = [],
        isStreaming: Bool = false,
        toolActivity: String? = nil
    ) {
        self.id = id
        self.role = role
        self.author = author
        self.timestamp = timestamp
        self.text = text
        self.attachments = attachments
        self.isStreaming = isStreaming
        self.toolActivity = toolActivity
    }
}

public typealias HudAgentAvatarProvider = (_ active: Bool, _ size: CGFloat, _ tint: Color) -> AnyView

public struct HudAgentTurnStyle: Sendable {
    public var bodySize: CGFloat
    public var headerSize: CGFloat
    public var timestampSize: CGFloat
    public var horizontalPadding: CGFloat
    public var verticalPadding: CGFloat
    public var bodyIndent: CGFloat
    public var cardCornerRadius: CGFloat
    public var avatarSize: CGFloat
    public var markdownStyle: HudMarkdownStyle

    public init(
        bodySize: CGFloat = HudTextSize.base,
        headerSize: CGFloat = HudTextSize.xxs,
        timestampSize: CGFloat = HudTextSize.micro,
        horizontalPadding: CGFloat = HudSpacing.xxl,
        verticalPadding: CGFloat = HudSpacing.xl,
        bodyIndent: CGFloat = 23,
        cardCornerRadius: CGFloat = 11,
        avatarSize: CGFloat = 16,
        markdownStyle: HudMarkdownStyle = .agent
    ) {
        self.bodySize = bodySize
        self.headerSize = headerSize
        self.timestampSize = timestampSize
        self.horizontalPadding = horizontalPadding
        self.verticalPadding = verticalPadding
        self.bodyIndent = bodyIndent
        self.cardCornerRadius = cardCornerRadius
        self.avatarSize = avatarSize
        self.markdownStyle = markdownStyle
    }

    public static var `default`: HudAgentTurnStyle { HudAgentTurnStyle() }
}

/// Shared agent-turn renderer for assistant/chat surfaces. It owns the transcript
/// row mechanics: speaker header, copy affordance, streaming treatment, tool
/// activity chips, attachments, and markdown body rendering.
public struct HudAgentTurnView: View {
    public let turn: HudAgentTurn
    public var style: HudAgentTurnStyle

    private let assistantAvatar: HudAgentAvatarProvider

    @Environment(\.hudTheme) private var theme
    @State private var copied = false

    public init(
        turn: HudAgentTurn,
        style: HudAgentTurnStyle = .default,
        assistantAvatar: HudAgentAvatarProvider? = nil
    ) {
        self.turn = turn
        self.style = style
        self.assistantAvatar = assistantAvatar ?? { active, size, tint in
            AnyView(HudAgentDefaultAvatar(size: size, tint: tint, isActive: active))
        }
    }

    public var body: some View {
        switch turn.role {
        case .system:
            systemRow
        case .user:
            speakerRow(isAssistant: false)
        case .assistant:
            speakerRow(isAssistant: true)
        }
    }

    private var systemRow: some View {
        HStack(spacing: HudSpacing.sm) {
            Spacer(minLength: 0)
            Text(turn.text)
                .font(HudFont.ui(HudTextSize.xs))
                .foregroundStyle(theme.palette.dim)
                .multilineTextAlignment(.center)
                .textSelection(.enabled)
                .padding(.horizontal, HudSpacing.xxxl)
                .padding(.vertical, HudSpacing.lg)
                .background(
                    Capsule(style: .continuous)
                        .fill(theme.palette.ink.opacity(0.03))
                        .overlay(
                            Capsule(style: .continuous)
                                .strokeBorder(theme.hairline.subtle, lineWidth: HudStrokeWidth.thin)
                        )
                )
            copyButton(size: 22, iconSize: 9)
            Spacer(minLength: 0)
        }
        .padding(.vertical, HudSpacing.xxs)
    }

    @ViewBuilder
    private func speakerRow(isAssistant: Bool) -> some View {
        VStack(alignment: .leading, spacing: isAssistant ? HudSpacing.sm : HudSpacing.xs) {
            header(isAssistant: isAssistant)

            if isAssistant, turn.isStreaming, let tool = turn.toolActivity {
                HudAgentToolChip(name: tool, compact: true)
                    .padding(.leading, style.bodyIndent)
            }

            bodyContent(isAssistant: isAssistant)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.leading, style.bodyIndent)

            if !turn.attachments.isEmpty {
                attachmentChips
                    .padding(.leading, style.bodyIndent)
            }
        }
        .padding(.horizontal, style.horizontalPadding)
        .padding(.vertical, style.verticalPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(threadCard(streaming: isAssistant && turn.isStreaming))
    }

    @ViewBuilder
    private func header(isAssistant: Bool) -> some View {
        HStack(alignment: .center, spacing: 7) {
            if isAssistant {
                assistantAvatar(turn.isStreaming, style.avatarSize, theme.palette.accent)
            } else {
                Image(systemName: "person.fill")
                    .font(.system(size: 8, weight: .semibold))
                    .foregroundStyle(theme.palette.bg)
                    .frame(width: style.avatarSize, height: style.avatarSize)
                    .background(Circle().fill(theme.palette.ink.opacity(0.55)))
            }

            Text(turn.author)
                .font(HudFont.mono(style.headerSize, weight: .bold))
                .tracking(HudTracking.wide)
                .foregroundStyle(authorColor(isAssistant: isAssistant))

            if isAssistant {
                if turn.isStreaming {
                    HudAgentStreamingBadge()
                } else if let tool = turn.toolActivity {
                    HudAgentToolChip(name: tool)
                }
            }

            Spacer(minLength: HudSpacing.md)

            Text(timeString(turn.timestamp))
                .font(HudFont.mono(style.timestampSize))
                .foregroundStyle(theme.palette.dim.opacity(isAssistant ? 0.75 : 0.8))

            copyButton(size: 23, iconSize: 10)
        }
    }

    private var attachmentChips: some View {
        HudAgentFlowLayout(spacing: HudSpacing.sm, lineSpacing: HudSpacing.sm) {
            ForEach(turn.attachments) { attachment in
                HStack(spacing: HudSpacing.xs) {
                    Image(systemName: attachment.systemImage)
                        .font(HudFont.ui(HudTextSize.micro, weight: .semibold))
                        .foregroundStyle(theme.palette.accent)

                    Text(attachment.name)
                        .font(HudFont.mono(HudTextSize.xxs))
                        .foregroundStyle(theme.palette.muted)
                        .lineLimit(1)
                        .truncationMode(.middle)

                    Text(attachment.mediaType)
                        .font(HudFont.mono(8))
                        .foregroundStyle(theme.palette.dim)
                        .lineLimit(1)
                }
                .padding(.horizontal, HudSpacing.md)
                .padding(.vertical, HudSpacing.xs)
                .background(
                    Capsule(style: .continuous)
                        .fill(theme.palette.accent.opacity(0.09))
                        .overlay(
                            Capsule(style: .continuous)
                                .strokeBorder(theme.palette.accent.opacity(0.24), lineWidth: HudStrokeWidth.thin)
                        )
                )
            }
        }
    }

    @ViewBuilder
    private func bodyContent(isAssistant: Bool) -> some View {
        if isAssistant {
            if turn.text.isEmpty, turn.isStreaming {
                HudAgentWorkingIndicator(label: "Composing")
            } else {
                HudAgentFormattedText(
                    text: turn.text,
                    contentSize: style.bodySize,
                    markdownStyle: style.markdownStyle,
                    isStreaming: turn.isStreaming
                )
            }
        } else {
            Text(turn.text)
                .font(HudFont.ui(style.bodySize))
                .foregroundStyle(theme.palette.ink)
                .textSelection(.enabled)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func authorColor(isAssistant: Bool) -> Color {
        guard isAssistant else { return theme.palette.ink }
        return turn.isStreaming ? theme.palette.accent.opacity(0.95) : theme.palette.muted
    }

    private func threadCard(streaming: Bool) -> some View {
        RoundedRectangle(cornerRadius: style.cardCornerRadius, style: .continuous)
            .fill(theme.palette.ink.opacity(streaming ? 0.032 : 0.020))
            .overlay(
                RoundedRectangle(cornerRadius: style.cardCornerRadius, style: .continuous)
                    .strokeBorder(
                        streaming ? theme.palette.accent.opacity(0.22) : theme.hairline.subtle,
                        lineWidth: HudStrokeWidth.thin
                    )
            )
    }

    private var copyableText: String {
        turn.text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func copyButton(size: CGFloat, iconSize: CGFloat) -> some View {
        Button {
            copyTurnText()
        } label: {
            Image(systemName: copied ? "checkmark" : "doc.on.doc")
                .font(.system(size: iconSize, weight: .semibold))
                .foregroundStyle(copied ? theme.palette.accent : theme.palette.dim)
                .frame(width: size, height: size)
                .background(
                    Circle()
                        .fill(theme.palette.ink.opacity(copied ? 0.055 : 0.025))
                        .overlay(
                            Circle()
                                .strokeBorder(
                                    copied ? theme.palette.accent.opacity(0.32) : theme.hairline.subtle,
                                    lineWidth: HudStrokeWidth.thin
                                )
                        )
                )
        }
        .buttonStyle(.plain)
        .help(copied ? "Copied" : "Copy message")
        .disabled(copyableText.isEmpty)
        .opacity(copyableText.isEmpty ? 0.4 : 1)
    }

    private func copyTurnText() {
        let text = copyableText
        guard !text.isEmpty else { return }
        #if os(macOS)
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
        #endif
        withAnimation(.easeOut(duration: 0.12)) { copied = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.1) {
            withAnimation(.easeOut(duration: 0.16)) { copied = false }
        }
    }

    private func timeString(_ date: Date) -> String {
        let components = Calendar.current.dateComponents([.hour, .minute], from: date)
        return String(format: "%02d:%02d", components.hour ?? 0, components.minute ?? 0)
    }
}

private struct HudAgentDefaultAvatar: View {
    var size: CGFloat
    var tint: Color
    var isActive: Bool

    var body: some View {
        Image(systemName: "sparkles")
            .font(.system(size: max(8, size * 0.54), weight: .semibold))
            .foregroundStyle(tint)
            .frame(width: size, height: size)
            .background(
                RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
                    .fill(tint.opacity(isActive ? 0.16 : 0.10))
                    .overlay(
                        RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
                            .strokeBorder(tint.opacity(isActive ? 0.40 : 0.25), lineWidth: HudStrokeWidth.thin)
                    )
            )
            .overlay {
                if isActive {
                    RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
                        .strokeBorder(tint.opacity(0.35), lineWidth: HudStrokeWidth.standard)
                        .scaleEffect(1.18)
                        .opacity(0.5)
                        .modifier(HudAgentPulseModifier(minOpacity: 0.0, maxOpacity: 0.55, duration: 1.4))
                }
            }
    }
}

enum HudAgentToolPresentation {
    static func displayName(for name: String) -> String {
        switch name.lowercased() {
        case "read", "read_file", "readfile": return "read"
        case "write", "write_file", "writefile": return "write"
        case "edit", "edit_file", "editfile": return "edit"
        case "bash", "shell", "exec": return "shell"
        case "search", "grep", "find": return "search"
        case "list", "list_dir", "listdir": return "list"
        case "web", "fetch", "webfetch": return "fetch"
        default: return name.prefix(12).description
        }
    }

    static func symbol(for name: String) -> String {
        switch name.lowercased() {
        case "read", "read_file", "readfile": return "doc.text"
        case "write", "write_file", "writefile": return "square.and.pencil"
        case "edit", "edit_file", "editfile": return "pencil"
        case "bash", "shell", "exec": return "terminal"
        case "search", "grep", "find": return "magnifyingglass"
        case "list", "list_dir", "listdir": return "list.bullet"
        case "web", "fetch", "webfetch": return "globe"
        default: return "sparkles"
        }
    }
}

private struct HudAgentToolChip: View {
    let name: String
    var compact = false

    @Environment(\.hudTheme) private var theme

    var body: some View {
        HStack(spacing: HudSpacing.xs) {
            Image(systemName: HudAgentToolPresentation.symbol(for: name))
                .font(.system(size: compact ? 8 : 9, weight: .semibold))

            Text(HudAgentToolPresentation.displayName(for: name))
                .font(HudFont.mono(compact ? 8 : 9, weight: .bold))
                .tracking(HudTracking.wide)
        }
        .foregroundStyle(theme.palette.statusWarn.opacity(0.95))
        .padding(.horizontal, compact ? HudSpacing.sm : 7)
        .padding(.vertical, compact ? HudSpacing.xxs : 3)
        .background(
            Capsule(style: .continuous)
                .fill(theme.palette.statusWarn.opacity(0.12))
                .overlay(
                    Capsule(style: .continuous)
                        .strokeBorder(theme.palette.statusWarn.opacity(0.28), lineWidth: HudStrokeWidth.thin)
                )
        )
        .modifier(HudAgentPulseModifier(minOpacity: 0.65, maxOpacity: 1.0, duration: 1.4))
    }
}

private struct HudAgentFormattedText: View {
    let text: String
    let contentSize: CGFloat
    let markdownStyle: HudMarkdownStyle
    let isStreaming: Bool

    @Environment(\.hudTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        if isStreaming {
            streamingText
        } else {
            HudMarkdownView(text: text, contentSize: contentSize, style: markdownStyle)
        }
    }

    private var streamingText: some View {
        let stanzas = text.components(separatedBy: "\n\n")
        return VStack(alignment: .leading, spacing: HudSpacing.md) {
            ForEach(Array(stanzas.enumerated()), id: \.offset) { index, stanza in
                Group {
                    if index == stanzas.count - 1 {
                        HudAgentRevealParagraph(text: stanza, size: contentSize)
                    } else {
                        Text(stanza)
                            .font(HudFont.ui(contentSize))
                            .foregroundStyle(theme.palette.ink)
                            .textSelection(.enabled)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .transition(
                    reduceMotion
                        ? .opacity
                        : .asymmetric(
                            insertion: .opacity
                                .combined(with: .move(edge: .bottom))
                                .combined(with: .scale(scale: 0.97, anchor: .leading)),
                            removal: .opacity
                        )
                )
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .animation(
            reduceMotion ? nil : .spring(response: 0.32, dampingFraction: 0.82),
            value: stanzas.count
        )
    }
}

private struct HudAgentWorkingIndicator: View {
    var label: String

    @Environment(\.hudTheme) private var theme

    var body: some View {
        HStack(spacing: HudSpacing.lg) {
            HudAgentWaveDots()

            Text(label)
                .font(HudFont.ui(HudTextSize.xs))
                .foregroundStyle(theme.palette.muted)
        }
        .padding(.vertical, HudSpacing.xxs)
        .accessibilityLabel(label)
    }
}

private struct HudAgentWaveDots: View {
    var dotSize: CGFloat = 6
    var spacing: CGFloat = 5

    @Environment(\.hudTheme) private var theme

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { timeline in
            let time = timeline.date.timeIntervalSinceReferenceDate
            HStack(spacing: spacing) {
                ForEach(0..<3, id: \.self) { index in
                    let wave = sin(time * 2.6 - Double(index) * 0.9)
                    let opacity = 0.30 + 0.45 * (wave + 1) / 2

                    Circle()
                        .fill(theme.palette.accent.opacity(opacity))
                        .frame(width: dotSize, height: dotSize)
                }
            }
            .frame(height: dotSize, alignment: .center)
        }
    }
}

private struct HudAgentStreamCursor: View {
    var size: CGFloat

    @Environment(\.hudTheme) private var theme

    var body: some View {
        let lineHeight = (size * 1.34).rounded()
        let barHeight = (size * 1.04).rounded()
        let seat = (size * 0.20).rounded()
        return ZStack(alignment: .bottom) {
            Color.clear.frame(width: 3, height: lineHeight)
            RoundedRectangle(cornerRadius: 1, style: .continuous)
                .fill(theme.palette.accent.opacity(0.95))
                .frame(width: 2, height: barHeight)
                .shadow(color: theme.palette.accent.opacity(0.55), radius: 5)
                .padding(.bottom, seat)
                .modifier(HudAgentPulseModifier(minOpacity: 0.45, maxOpacity: 1.0, duration: 0.85))
        }
    }
}

private struct HudAgentRevealParagraph: View {
    let text: String
    let size: CGFloat

    @Environment(\.hudTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private struct Token: Identifiable {
        let id: Int
        let text: String
    }

    private var tokens: [Token] {
        let words = text.components(separatedBy: " ")
        return words.enumerated().map { index, word in
            Token(id: index, text: index < words.count - 1 ? word + " " : word)
        }
    }

    var body: some View {
        if reduceMotion || text.contains("\n") {
            HStack(alignment: .bottom, spacing: 0) {
                Text(text)
                    .font(HudFont.ui(size))
                    .foregroundStyle(theme.palette.ink)
                HudAgentStreamCursor(size: size)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            HudAgentFlowLayout(spacing: 0, lineSpacing: (size * 0.42).rounded()) {
                ForEach(tokens) { token in
                    Text(token.text)
                        .font(HudFont.ui(size))
                        .foregroundStyle(theme.palette.ink)
                        .transition(.hudAgentMaterialize(theme.palette.accent))
                }
                HudAgentStreamCursor(size: size)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .animation(.easeOut(duration: 0.3), value: tokens.count)
        }
    }
}

private struct HudAgentStreamingBadge: View {
    @Environment(\.hudTheme) private var theme

    var body: some View {
        HStack(spacing: HudSpacing.xs) {
            Circle()
                .fill(theme.palette.accent)
                .frame(width: 5, height: 5)
                .modifier(HudAgentPulseModifier(minOpacity: 0.45, maxOpacity: 1.0, duration: 1.1))

            Text("LIVE")
                .font(HudFont.mono(HudTextSize.micro, weight: .bold))
                .tracking(HudTracking.wider)
                .foregroundStyle(theme.palette.accent)
        }
        .padding(.horizontal, 7)
        .padding(.vertical, 3)
        .background(
            Capsule(style: .continuous)
                .fill(theme.palette.accent.opacity(0.12))
                .overlay(
                    Capsule(style: .continuous)
                        .strokeBorder(theme.palette.accent.opacity(0.28), lineWidth: HudStrokeWidth.thin)
                )
        )
    }
}

private struct HudAgentRevealModifier: ViewModifier {
    var blur: CGFloat
    var opacity: Double
    var dy: CGFloat
    var glow: CGFloat
    var tint: Color

    func body(content: Content) -> some View {
        content
            .blur(radius: blur)
            .opacity(opacity)
            .offset(y: dy)
            .shadow(color: tint.opacity(glow > 0.1 ? 0.55 : 0), radius: glow)
    }
}

private extension AnyTransition {
    static func hudAgentMaterialize(_ tint: Color) -> AnyTransition {
        .modifier(
            active: HudAgentRevealModifier(blur: 5, opacity: 0, dy: 3, glow: 7, tint: tint),
            identity: HudAgentRevealModifier(blur: 0, opacity: 1, dy: 0, glow: 0, tint: tint)
        )
    }
}

private struct HudAgentPulseModifier: ViewModifier {
    var minOpacity: Double = 0.25
    var maxOpacity: Double = 0.9
    var duration: Double = 1.0

    func body(content: Content) -> some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { timeline in
            let phase = sin(timeline.date.timeIntervalSinceReferenceDate * (.pi * 2 / duration))
            let opacity = minOpacity + (maxOpacity - minOpacity) * ((phase + 1) / 2)
            content.opacity(opacity)
        }
    }
}

private struct HudAgentFlowLayout: Layout {
    var spacing: CGFloat = 0
    var lineSpacing: CGFloat = 0

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        let rows = rows(for: subviews, maxWidth: maxWidth)
        let width = maxWidth.isFinite ? maxWidth : rows.map(\.width).max() ?? 0
        let height = rows.reduce(CGFloat.zero) { total, row in
            total + row.height + (row.index == rows.count - 1 ? 0 : lineSpacing)
        }
        return CGSize(width: width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let rows = rows(for: subviews, maxWidth: bounds.width)
        var y = bounds.minY
        for row in rows {
            var x = bounds.minX
            for item in row.items {
                subviews[item.index].place(
                    at: CGPoint(x: x, y: y),
                    proposal: ProposedViewSize(width: item.size.width, height: item.size.height)
                )
                x += item.size.width + spacing
            }
            y += row.height + lineSpacing
        }
    }

    private func rows(for subviews: Subviews, maxWidth: CGFloat) -> [Row] {
        var rows: [Row] = []
        var current = Row(index: 0, items: [], width: 0, height: 0)

        for index in subviews.indices {
            let size = subviews[index].sizeThatFits(.unspecified)
            let proposedWidth = current.items.isEmpty ? size.width : current.width + spacing + size.width
            if !current.items.isEmpty, proposedWidth > maxWidth {
                rows.append(current)
                current = Row(index: rows.count, items: [], width: 0, height: 0)
            }

            current.items.append(Item(index: index, size: size))
            current.width = current.items.count == 1 ? size.width : current.width + spacing + size.width
            current.height = max(current.height, size.height)
        }

        if !current.items.isEmpty {
            rows.append(current)
        }
        return rows
    }

    private struct Row {
        var index: Int
        var items: [Item]
        var width: CGFloat
        var height: CGFloat
    }

    private struct Item {
        var index: Int
        var size: CGSize
    }
}
