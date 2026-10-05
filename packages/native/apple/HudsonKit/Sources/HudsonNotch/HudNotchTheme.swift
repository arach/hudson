#if os(macOS)
import HudsonNotchCore
import HudsonUI
import SwiftUI

/// Colors, type and an optional mark for the notch, so a host can dress it
/// in its own brand. The default is Hudson's.
public struct HudNotchTheme {
    /// The body's color. Keep it near black so it still reads as part of
    /// the camera housing.
    public var body: Color
    public var ink: Color
    public var muted: Color
    public var dim: Color
    /// The idle dot and anything that isn't tied to an activity's tone.
    public var accent: Color
    /// Overrides for tone colors. Tones without one use Hudson's status colors.
    public var tones: [HudNotchTone: Color]

    public var eyebrowFont: Font
    public var titleFont: Font
    public var detailFont: Font

    /// Fill and label for the primary choice. Nil uses Hudson's teal button.
    public var action: Color?
    public var actionInk: Color

    /// Drawn before the eyebrow on the open card and on the left wing, in
    /// place of the status dot.
    public var mark: AnyView?
    /// The square the mark is drawn in. 11 suits a glyph; a character
    /// mark wants more room.
    public var markSize: CGFloat

    public init(
        body: Color = .black,
        ink: Color = HudPalette.ink,
        muted: Color = HudPalette.muted,
        dim: Color = HudPalette.dim,
        accent: Color = HudPalette.accent,
        tones: [HudNotchTone: Color] = [:],
        eyebrowFont: Font = HudFont.mono(HudTextSize.micro, weight: .semibold),
        titleFont: Font = HudFont.ui(HudTextSize.sm, weight: .semibold),
        detailFont: Font = HudFont.ui(HudTextSize.xs),
        action: Color? = nil,
        actionInk: Color = .black,
        mark: AnyView? = nil,
        markSize: CGFloat = 11
    ) {
        self.body = body
        self.ink = ink
        self.muted = muted
        self.dim = dim
        self.accent = accent
        self.tones = tones
        self.eyebrowFont = eyebrowFont
        self.titleFont = titleFont
        self.detailFont = detailFont
        self.action = action
        self.actionInk = actionInk
        self.mark = mark
        self.markSize = markSize
    }

    public static let hudson = HudNotchTheme()

    public func color(for tone: HudNotchTone) -> Color {
        if let color = tones[tone] { return color }
        switch tone {
        case .info: return HudPalette.statusInfo
        case .success: return HudPalette.statusOk
        case .warning: return HudPalette.statusWarn
        case .error: return HudPalette.statusError
        }
    }
}
#endif
