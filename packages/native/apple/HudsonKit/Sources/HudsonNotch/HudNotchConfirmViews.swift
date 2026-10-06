#if os(macOS)
import HudsonNotchCore
import SwiftUI

// Pieces for asks that two sides confirm: the words both sides compare, and
// who has confirmed so far.

// MARK: - Words

/// How compared words are set. `init(theme:)` derives it from a notch theme.
public struct HudNotchWordsStyle {
    public var font: Font
    public var color: Color
    /// The words once this side has confirmed them.
    public var dimmed: Color
    public var separator: String
    public var separatorColor: Color

    public init(
        font: Font = .system(size: 17, weight: .light, design: .serif),
        color: Color = Color(white: 0.93),
        dimmed: Color = Color(white: 0.45),
        separator: String = " · ",
        separatorColor: Color = Color(white: 0.36)
    ) {
        self.font = font
        self.color = color
        self.dimmed = dimmed
        self.separator = separator
        self.separatorColor = separatorColor
    }

    public init(theme: HudNotchTheme) {
        self.init(color: theme.ink, dimmed: theme.muted, separatorColor: theme.dim)
    }
}

/// Words two sides compare, set the same way everywhere: one line, light,
/// dot-separated. They dim once this side has confirmed.
public struct HudNotchWords: View {
    public var words: [String]
    public var confirmed: Bool
    public var style: HudNotchWordsStyle

    public init(words: [String], confirmed: Bool = false, style: HudNotchWordsStyle = HudNotchWordsStyle()) {
        self.words = words
        self.confirmed = confirmed
        self.style = style
    }

    public var body: some View {
        words.enumerated().reduce(Text("")) { line, item in
            let word = Text(item.element).foregroundStyle(confirmed ? style.dimmed : style.color)
            guard item.offset > 0 else { return Text("\(line)\(word)") }
            return Text("\(line)\(Text(style.separator).foregroundStyle(style.separatorColor))\(word)")
        }
        .font(style.font)
        .lineLimit(1)
        .minimumScaleFactor(0.8)
        .animation(.easeOut(duration: 0.25), value: confirmed)
        .accessibilityLabel(Text(words.joined(separator: ", ")))
    }
}

// MARK: - Parties

/// One side of a confirm-on-both ask.
public struct HudNotchParty: Hashable, Sendable {
    public var name: String
    public var confirmed: Bool

    public init(name: String, confirmed: Bool) {
        self.name = name
        self.confirmed = confirmed
    }
}

/// Colours and type for `HudNotchParties`. `init(theme:)` derives it from a notch theme.
public struct HudNotchPartiesStyle {
    public var font: Font
    public var name: Color
    /// The ✓ of a side that confirmed.
    public var confirmed: Color
    /// The … of a side still to confirm.
    public var waiting: Color
    public var spacing: CGFloat

    public init(
        font: Font = .system(size: 10.5, weight: .light, design: .monospaced),
        name: Color = Color(white: 0.55),
        confirmed: Color = Color(red: 0.88, green: 0.35, blue: 0.23),
        waiting: Color = Color(white: 0.36),
        spacing: CGFloat = 8
    ) {
        self.font = font
        self.name = name
        self.confirmed = confirmed
        self.waiting = waiting
        self.spacing = spacing
    }

    public init(theme: HudNotchTheme) {
        self.init(name: theme.muted, confirmed: theme.accent, waiting: theme.dim)
    }
}

/// Who has confirmed, for a wing: `mini ✓`, `you …`.
public struct HudNotchParties: View {
    public var parties: [HudNotchParty]
    public var style: HudNotchPartiesStyle

    public init(parties: [HudNotchParty], style: HudNotchPartiesStyle = HudNotchPartiesStyle()) {
        self.parties = parties
        self.style = style
    }

    public var body: some View {
        HStack(spacing: style.spacing) {
            ForEach(parties, id: \.name) { p in
                (Text(p.name).foregroundStyle(style.name)
                    + Text(p.confirmed ? " ✓" : " …").foregroundStyle(p.confirmed ? style.confirmed : style.waiting))
                    .accessibilityLabel(Text(p.confirmed ? "\(p.name) confirmed" : "waiting for \(p.name)"))
            }
        }
        .font(style.font)
        .lineLimit(1)
        .animation(.easeOut(duration: 0.2), value: parties)
    }
}
#endif
