import CoreGraphics
import Foundation

/// How the collapsed notch is drawn.
public enum HudNotchRenderStyle: String, Equatable, Sendable {
    /// Wings on either side of a physical (or virtual) notch, joined by concave shoulders.
    case notch
    /// A floating pill below the menu bar, for screens without a notch.
    case island
}

public enum HudNotchDisplayMode: String, CaseIterable, Codable, Equatable, Hashable, Sendable {
    case automatic
    case notch
    case island

    public var label: String {
        switch self {
        case .automatic: return "Auto"
        case .notch: return "Notch"
        case .island: return "Island"
        }
    }

    public func resolvedStyle(isVirtual: Bool) -> HudNotchRenderStyle {
        switch self {
        case .automatic: return isVirtual ? .island : .notch
        case .notch: return .notch
        case .island: return .island
        }
    }
}

/// Everything a host can tune about the notch's shape, timing and look.
/// `normalized()` keeps values in ranges the shapes can draw.
public struct HudNotchConfiguration: Codable, Equatable, Sendable {
    public var displayMode: HudNotchDisplayMode
    /// How far each wing reaches past the notch, per state.
    public var restPokeOut: CGFloat
    public var hoverPokeOut: CGFloat
    public var activePokeOut: CGFloat
    public var shellHeight: CGFloat
    /// Positive flares the outer shoulder into a concave ear against the top
    /// of the screen; negative rounds it convexly.
    public var topOuterRadius: CGFloat
    public var topInnerRadius: CGFloat
    public var bottomRadius: CGFloat
    public var notchOverlap: CGFloat
    public var minimumNotchOverlap: CGFloat
    /// Height of the open card for a notice.
    public var expandedContentHeight: CGFloat
    /// Height of the open card when the activity asks for a choice or reply.
    public var inputContentHeight: CGFloat
    public var panelSidePadding: CGFloat
    public var hoverActivationDelaySeconds: Double
    public var collapseDelaySeconds: Double
    /// Fill, backdrop, rim and shadow for the pill and the open card.
    public var appearance: HudNotchAppearance

    public init(
        displayMode: HudNotchDisplayMode = .automatic,
        restPokeOut: CGFloat = 10,
        hoverPokeOut: CGFloat = 58,
        activePokeOut: CGFloat = 132,
        shellHeight: CGFloat = 34,
        topOuterRadius: CGFloat = 10,
        topInnerRadius: CGFloat = 7,
        bottomRadius: CGFloat = 14,
        notchOverlap: CGFloat = 12,
        minimumNotchOverlap: CGFloat = 10,
        expandedContentHeight: CGFloat = 104,
        inputContentHeight: CGFloat = 150,
        panelSidePadding: CGFloat = 42,
        hoverActivationDelaySeconds: Double = 0.18,
        collapseDelaySeconds: Double = 0.24,
        appearance: HudNotchAppearance = .solid
    ) {
        self.displayMode = displayMode
        self.restPokeOut = restPokeOut
        self.hoverPokeOut = hoverPokeOut
        self.activePokeOut = activePokeOut
        self.shellHeight = shellHeight
        self.topOuterRadius = topOuterRadius
        self.topInnerRadius = topInnerRadius
        self.bottomRadius = bottomRadius
        self.notchOverlap = notchOverlap
        self.minimumNotchOverlap = minimumNotchOverlap
        self.expandedContentHeight = expandedContentHeight
        self.inputContentHeight = inputContentHeight
        self.panelSidePadding = panelSidePadding
        self.hoverActivationDelaySeconds = hoverActivationDelaySeconds
        self.collapseDelaySeconds = collapseDelaySeconds
        self.appearance = appearance
    }

    public static let `default` = HudNotchConfiguration()

    // Tolerates configurations saved before a field existed.
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let d = HudNotchConfiguration.default
        self.init(
            displayMode: try c.decodeIfPresent(HudNotchDisplayMode.self, forKey: .displayMode) ?? d.displayMode,
            restPokeOut: try c.decodeIfPresent(CGFloat.self, forKey: .restPokeOut) ?? d.restPokeOut,
            hoverPokeOut: try c.decodeIfPresent(CGFloat.self, forKey: .hoverPokeOut) ?? d.hoverPokeOut,
            activePokeOut: try c.decodeIfPresent(CGFloat.self, forKey: .activePokeOut) ?? d.activePokeOut,
            shellHeight: try c.decodeIfPresent(CGFloat.self, forKey: .shellHeight) ?? d.shellHeight,
            topOuterRadius: try c.decodeIfPresent(CGFloat.self, forKey: .topOuterRadius) ?? d.topOuterRadius,
            topInnerRadius: try c.decodeIfPresent(CGFloat.self, forKey: .topInnerRadius) ?? d.topInnerRadius,
            bottomRadius: try c.decodeIfPresent(CGFloat.self, forKey: .bottomRadius) ?? d.bottomRadius,
            notchOverlap: try c.decodeIfPresent(CGFloat.self, forKey: .notchOverlap) ?? d.notchOverlap,
            minimumNotchOverlap: try c.decodeIfPresent(CGFloat.self, forKey: .minimumNotchOverlap) ?? d.minimumNotchOverlap,
            expandedContentHeight: try c.decodeIfPresent(CGFloat.self, forKey: .expandedContentHeight) ?? d.expandedContentHeight,
            inputContentHeight: try c.decodeIfPresent(CGFloat.self, forKey: .inputContentHeight) ?? d.inputContentHeight,
            panelSidePadding: try c.decodeIfPresent(CGFloat.self, forKey: .panelSidePadding) ?? d.panelSidePadding,
            hoverActivationDelaySeconds: try c.decodeIfPresent(Double.self, forKey: .hoverActivationDelaySeconds) ?? d.hoverActivationDelaySeconds,
            collapseDelaySeconds: try c.decodeIfPresent(Double.self, forKey: .collapseDelaySeconds) ?? d.collapseDelaySeconds,
            appearance: try c.decodeIfPresent(HudNotchAppearance.self, forKey: .appearance) ?? d.appearance
        )
    }

    public func normalized() -> HudNotchConfiguration {
        var copy = self
        copy.restPokeOut = copy.restPokeOut.clamped(to: 0...120)
        copy.hoverPokeOut = copy.hoverPokeOut.clamped(to: copy.restPokeOut...180)
        copy.activePokeOut = copy.activePokeOut.clamped(to: copy.hoverPokeOut...240)
        copy.shellHeight = copy.shellHeight.clamped(to: 22...64)
        copy.topOuterRadius = copy.topOuterRadius.clamped(to: -18...24)
        copy.topInnerRadius = copy.topInnerRadius.clamped(to: 0...24)
        copy.bottomRadius = copy.bottomRadius.clamped(to: 0...28)
        copy.notchOverlap = copy.notchOverlap.clamped(to: 0...18)
        copy.minimumNotchOverlap = copy.minimumNotchOverlap.clamped(to: 0...18)
        copy.expandedContentHeight = copy.expandedContentHeight.clamped(to: 84...180)
        copy.inputContentHeight = copy.inputContentHeight.clamped(to: copy.expandedContentHeight...240)
        copy.panelSidePadding = copy.panelSidePadding.clamped(to: 20...96)
        copy.hoverActivationDelaySeconds = copy.hoverActivationDelaySeconds.clamped(to: 0...0.8)
        copy.collapseDelaySeconds = copy.collapseDelaySeconds.clamped(to: 0...1.2)
        copy.appearance = copy.appearance.normalized()
        return copy
    }

    public func contentHeight(asksForInput: Bool) -> CGFloat {
        asksForInput ? inputContentHeight : expandedContentHeight
    }
}

extension Comparable {
    func clamped(to range: ClosedRange<Self>) -> Self {
        min(max(self, range.lowerBound), range.upperBound)
    }
}

/// Sizes derived from a configuration and the screen's notch.
public enum HudNotchMetrics {
    /// Width of the notch drawn on screens that have none.
    public static let virtualNotchWidth: CGFloat = 180
    public static let virtualNotchHeight: CGFloat = 34
    public static let menuBarHeight: CGFloat = 24

    public static func shellWidth(
        notchWidth: CGFloat,
        expanded: Bool,
        configuration: HudNotchConfiguration = .default
    ) -> CGFloat {
        let pokeOut = expanded ? configuration.activePokeOut : configuration.restPokeOut
        return notchGap(notchWidth: notchWidth) + (pokeOut * 2) + 24
    }

    /// The panel is sized once for the largest state so opening never moves the window.
    public static func panelSize(
        notchWidth: CGFloat,
        notchHeight: CGFloat,
        configuration: HudNotchConfiguration = .default
    ) -> CGSize {
        let maxShellWidth = notchGap(notchWidth: notchWidth) + (configuration.activePokeOut * 2) + 24
        let content = max(configuration.expandedContentHeight, configuration.inputContentHeight)
        return CGSize(
            width: maxShellWidth + (configuration.panelSidePadding * 2),
            height: max(notchHeight, configuration.shellHeight) + content + 36
        )
    }

    /// The gap the wings leave for the hardware (or virtual) notch.
    public static func notchGap(notchWidth: CGFloat) -> CGFloat {
        max(notchWidth - 4, virtualNotchWidth - 8)
    }
}
