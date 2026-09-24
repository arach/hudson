import CoreGraphics
import Foundation

/// How the notch's body is drawn in one state: how much of the desktop shows
/// through, how blurred it is, its rim and its shadow.
public struct HudNotchLook: Codable, Equatable, Sendable {
    /// Opacity of the black body. Below 1 the desktop shows through.
    public var fillOpacity: Double
    /// Strength of the frosted backdrop under the body, 0 for none. Only
    /// visible when `fillOpacity` is below 1.
    public var blur: Double
    /// Width of the rim. The rim fades out toward the top edge in notch
    /// style, so it never outlines the part that meets the menu bar.
    public var borderWidth: CGFloat
    public var borderOpacity: Double
    public var shadowOpacity: Double
    public var shadowRadius: CGFloat
    public var shadowY: CGFloat

    public init(
        fillOpacity: Double = 1,
        blur: Double = 0,
        borderWidth: CGFloat = 1,
        borderOpacity: Double = 0.11,
        shadowOpacity: Double = 0.3,
        shadowRadius: CGFloat = 5,
        shadowY: CGFloat = 0
    ) {
        self.fillOpacity = fillOpacity
        self.blur = blur
        self.borderWidth = borderWidth
        self.borderOpacity = borderOpacity
        self.shadowOpacity = shadowOpacity
        self.shadowRadius = shadowRadius
        self.shadowY = shadowY
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let d = HudNotchLook()
        self.init(
            fillOpacity: try c.decodeIfPresent(Double.self, forKey: .fillOpacity) ?? d.fillOpacity,
            blur: try c.decodeIfPresent(Double.self, forKey: .blur) ?? d.blur,
            borderWidth: try c.decodeIfPresent(CGFloat.self, forKey: .borderWidth) ?? d.borderWidth,
            borderOpacity: try c.decodeIfPresent(Double.self, forKey: .borderOpacity) ?? d.borderOpacity,
            shadowOpacity: try c.decodeIfPresent(Double.self, forKey: .shadowOpacity) ?? d.shadowOpacity,
            shadowRadius: try c.decodeIfPresent(CGFloat.self, forKey: .shadowRadius) ?? d.shadowRadius,
            shadowY: try c.decodeIfPresent(CGFloat.self, forKey: .shadowY) ?? d.shadowY
        )
    }

    public func normalized() -> HudNotchLook {
        var copy = self
        copy.fillOpacity = copy.fillOpacity.clamped(to: 0...1)
        copy.blur = copy.blur.clamped(to: 0...1)
        copy.borderWidth = copy.borderWidth.clamped(to: 0...3)
        copy.borderOpacity = copy.borderOpacity.clamped(to: 0...1)
        copy.shadowOpacity = copy.shadowOpacity.clamped(to: 0...1)
        copy.shadowRadius = copy.shadowRadius.clamped(to: 0...40)
        copy.shadowY = copy.shadowY.clamped(to: 0...24)
        return copy
    }
}

/// The notch's look in its two visible states. The tucked state has no look
/// of its own: it is the pill, hidden in the housing.
public struct HudNotchAppearance: Codable, Equatable, Sendable {
    public var pill: HudNotchLook
    public var card: HudNotchLook

    public init(pill: HudNotchLook = Self.solid.pill, card: HudNotchLook = Self.solid.card) {
        self.pill = pill
        self.card = card
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            pill: try c.decodeIfPresent(HudNotchLook.self, forKey: .pill) ?? Self.solid.pill,
            card: try c.decodeIfPresent(HudNotchLook.self, forKey: .card) ?? Self.solid.card
        )
    }

    public func normalized() -> HudNotchAppearance {
        HudNotchAppearance(pill: pill.normalized(), card: card.normalized())
    }

    /// Opaque black, like the camera housing.
    public static let solid = HudNotchAppearance(
        pill: HudNotchLook(),
        card: HudNotchLook(shadowOpacity: 0.36, shadowRadius: 14, shadowY: 2)
    )

    /// Dark, with some of the desktop coming through blurred.
    public static let smoked = HudNotchAppearance(
        pill: HudNotchLook(fillOpacity: 0.78, blur: 0.8, borderOpacity: 0.14),
        card: HudNotchLook(fillOpacity: 0.62, blur: 1, borderOpacity: 0.16, shadowOpacity: 0.4, shadowRadius: 18, shadowY: 4)
    )

    /// Mostly backdrop, with a brighter rim.
    public static let glass = HudNotchAppearance(
        pill: HudNotchLook(fillOpacity: 0.5, blur: 1, borderOpacity: 0.22),
        card: HudNotchLook(fillOpacity: 0.32, blur: 1, borderOpacity: 0.26, shadowOpacity: 0.32, shadowRadius: 24, shadowY: 6)
    )

    public static let presets: [(name: String, appearance: HudNotchAppearance)] = [
        ("Solid", .solid),
        ("Smoked", .smoked),
        ("Glass", .glass),
    ]
}
