import SwiftUI
#if os(macOS)
import AppKit
#elseif canImport(UIKit)
import UIKit
#endif

// A transcript laid out like a document, not a chat: no bubbles, no cards, no
// avatars. Every turn's text starts on one left edge; a user turn is marked by
// a two-pixel bar hung in the margin beside it, and exchanges are separated by
// one-pixel rules. Time and copy sit under a turn and show on hover. Nothing
// here is translucent or scaled, so it holds a hard edge at 1x.
//
// `HudAgentTurnView` is the card-style sibling: avatars, chips and a streaming
// reveal. This one draws layout only; the host supplies the turn's content
// (plain `Text`, `HudMarkdownView`, or `HudSelectableText` on macOS).

public enum HudTranscriptRole: Sendable, Equatable {
    case user
    case assistant
    case system
}

public struct HudTranscriptStyle: Equatable, Sendable {
    /// Width of the user turn's margin bar.
    public var barWidth: CGFloat
    /// Gap between the bar and the text it marks. The bar hangs this far left
    /// of the text edge, so the host's horizontal padding must be at least
    /// `barWidth + barGap`.
    public var barGap: CGFloat
    /// Space above and below a rule.
    public var ruleSpacing: CGFloat
    /// Space between a turn's content and its meta row.
    public var metaSpacing: CGFloat
    public var metaHeight: CGFloat

    public init(
        barWidth: CGFloat = 2,
        barGap: CGFloat = 12,
        ruleSpacing: CGFloat = 18,
        metaSpacing: CGFloat = 6,
        metaHeight: CGFloat = 18
    ) {
        self.barWidth = barWidth
        self.barGap = barGap
        self.ruleSpacing = ruleSpacing
        self.metaSpacing = metaSpacing
        self.metaHeight = metaHeight
    }

    public static var `default`: HudTranscriptStyle { HudTranscriptStyle() }

    /// Slimmer spacing for docked or narrow transcripts.
    public static var compact: HudTranscriptStyle {
        HudTranscriptStyle(barGap: 8, ruleSpacing: 10, metaSpacing: 4, metaHeight: 16)
    }
}

/// One turn of a document-style transcript.
///
/// - `ruled` draws a one-pixel rule above the turn (the host decides where
///   exchanges begin, usually at each user turn after the first).
/// - `copyText` enables the copy button; `timestamp` shows the time.
/// - While `status` is non-nil the meta row shows it (typically a
///   `HudActivityIndicator`) instead of time and copy, and stays visible.
public struct HudTranscriptTurn<Content: View, Status: View>: View {
    private let role: HudTranscriptRole
    private let ruled: Bool
    private let timestamp: Date?
    private let copyText: String?
    private let style: HudTranscriptStyle
    private let content: () -> Content
    private let status: (() -> Status)?

    @Environment(\.hudTheme) private var theme
    @State private var hovering = false

    public init(
        role: HudTranscriptRole,
        ruled: Bool = false,
        timestamp: Date? = nil,
        copyText: String? = nil,
        style: HudTranscriptStyle = .default,
        @ViewBuilder content: @escaping () -> Content,
        @ViewBuilder status: @escaping () -> Status
    ) {
        self.role = role
        self.ruled = ruled
        self.timestamp = timestamp
        self.copyText = copyText
        self.style = style
        self.content = content
        self.status = status
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if ruled {
                HudRule(color: theme.hairline.subtle)
                    .padding(.bottom, style.ruleSpacing)
            }

            content()
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .leading) {
                    if role == .user { marginBar }
                }

            if role != .system {
                meta
                    .padding(.top, style.metaSpacing)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        #if os(macOS)
        .onHover { hovering = $0 }
        #endif
    }

    private var marginBar: some View {
        Rectangle()
            .fill(theme.palette.muted)
            .frame(width: style.barWidth)
            .offset(x: -(style.barGap + style.barWidth))
            .accessibilityHidden(true)
    }

    @ViewBuilder
    private var meta: some View {
        if let status {
            status()
                .frame(height: style.metaHeight, alignment: .leading)
        } else {
            HudTranscriptMeta(timestamp: timestamp, copyText: copyText, revealed: hovering)
                .frame(height: style.metaHeight, alignment: .leading)
        }
    }
}

extension HudTranscriptTurn where Status == EmptyView {
    public init(
        role: HudTranscriptRole,
        ruled: Bool = false,
        timestamp: Date? = nil,
        copyText: String? = nil,
        style: HudTranscriptStyle = .default,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.role = role
        self.ruled = ruled
        self.timestamp = timestamp
        self.copyText = copyText
        self.style = style
        self.content = content
        self.status = nil
    }
}

/// Time and copy under a turn. Keeps its height when hidden, so revealing it
/// never moves the transcript.
private struct HudTranscriptMeta: View {
    let timestamp: Date?
    let copyText: String?
    let revealed: Bool

    @Environment(\.hudTheme) private var theme
    @State private var copied = false

    var body: some View {
        HStack(spacing: HudSpacing.sm) {
            if let timestamp {
                Text(Self.time(timestamp))
                    .font(HudFont.mono(HudTextSize.xxs))
                    .foregroundStyle(theme.palette.dim)
                    .monospacedDigit()
            }
            if let copyText, !copyText.isEmpty {
                HudSquareIconButton(
                    symbol: copied ? "checkmark" : "doc.on.doc",
                    help: copied ? "Copied" : "Copy",
                    size: 18,
                    iconSize: 10
                ) {
                    copy(copyText)
                }
            }
        }
        .opacity(revealed || copied ? 1 : 0)
        .animation(.easeOut(duration: 0.12), value: revealed)
    }

    private func copy(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        #if os(macOS)
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(trimmed, forType: .string)
        #elseif canImport(UIKit)
        UIPasteboard.general.string = trimmed
        #endif
        copied = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.1) { copied = false }
    }

    static func time(_ date: Date) -> String {
        let c = Calendar.current.dateComponents([.hour, .minute], from: date)
        return String(format: "%02d:%02d", c.hour ?? 0, c.minute ?? 0)
    }
}

/// A borderless glyph button with a square hover plate (radius 3). The
/// transcript's copy button, a crisp header's actions, and the hairline
/// composer's controls. `tint` fixes the glyph's colour (a live state such as
/// recording); without it the glyph is `muted` and brightens to `ink` on hover.
public struct HudSquareIconButton: View {
    let symbol: String
    let help: String
    var size: CGFloat
    var iconSize: CGFloat
    var tint: Color?
    let action: () -> Void

    @Environment(\.hudTheme) private var theme
    @State private var hovering = false

    public init(
        symbol: String,
        help: String,
        size: CGFloat = 26,
        iconSize: CGFloat = 12,
        tint: Color? = nil,
        action: @escaping () -> Void
    ) {
        self.symbol = symbol
        self.help = help
        self.size = size
        self.iconSize = iconSize
        self.tint = tint
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: iconSize, weight: .regular))
                .foregroundStyle(tint ?? (hovering ? theme.palette.ink : theme.palette.muted))
                .frame(width: size, height: size)
                .background(
                    RoundedRectangle(cornerRadius: HudRadius.tight, style: .continuous)
                        .fill(hovering ? HudSurface.hover : Color.clear)
                )
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .help(help)
        .accessibilityLabel(help)
        #if os(macOS)
        .onHover { hovering = $0 }
        #endif
    }
}
