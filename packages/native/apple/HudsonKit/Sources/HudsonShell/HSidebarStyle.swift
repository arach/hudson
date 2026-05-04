import SwiftUI

// MARK: - HSidebarSurfaceStyle

/// Background treatment for the sidebar surface.
/// - `base`: Hudson chrome + subtle gradient (the default house style).
/// - `glass`: SwiftUI `.ultraThinMaterial` approximation.
/// - `editorial`: flat slightly-lighter fill ("print" surface).
/// - `liquidGlass`: real macOS `NSVisualEffectView` with `.sidebar` material,
///   inset from the window edge with continuous-rounded corners — the
///   floating-chrome look that matches stock macOS Tahoe sidebars.
public enum HSidebarSurfaceStyle: String, CaseIterable, Identifiable, Sendable {
    case base
    case glass
    case editorial
    case liquidGlass

    public var id: String { rawValue }

    public var label: String {
        switch self {
        case .base:        return "Base"
        case .glass:       return "Glass"
        case .editorial:   return "Print"
        case .liquidGlass: return "Native"
        }
    }
}

// MARK: - HSidebarIndicatorStyle

/// Selection indicator shape for nav rows.
public enum HSidebarIndicatorStyle: String, CaseIterable, Identifiable, Sendable {
    case base
    case glass
    case editorial
    case kinetic

    public var id: String { rawValue }

    public var label: String {
        switch self {
        case .base:      return "Base"
        case .glass:     return "Glass"
        case .editorial: return "Stripe"
        case .kinetic:   return "Spring"
        }
    }
}

// MARK: - HSidebarIconStyle

/// Hover / selection micro-animation treatment for icons.
public enum HSidebarIconStyle: String, CaseIterable, Identifiable, Sendable {
    case base
    case glass
    case editorial
    case kinetic

    public var id: String { rawValue }

    public var label: String {
        switch self {
        case .base:      return "Base"
        case .glass:     return "Bloom"
        case .editorial: return "Quiet"
        case .kinetic:   return "Live"
        }
    }
}

// MARK: - HSidebarMotionStyle

/// Spring curve for the selection-underlay slide between rows.
public enum HSidebarMotionStyle: String, CaseIterable, Identifiable, Sendable {
    case base
    case editorial
    case kinetic

    public var id: String { rawValue }

    public var label: String {
        switch self {
        case .base:      return "Base"
        case .editorial: return "Slow"
        case .kinetic:   return "Spring"
        }
    }

    /// Animation used when the selection indicator slides between rows.
    public var selectionSlide: Animation {
        switch self {
        case .base:      return .spring(response: 0.32, dampingFraction: 0.82)
        case .editorial: return .spring(response: 0.50, dampingFraction: 0.95)
        case .kinetic:   return .spring(response: 0.36, dampingFraction: 0.72)
        }
    }
}

// MARK: - HLiquidGlassConfig

/// Tunable knobs for the `.liquidGlass` surface treatment.
/// Consulted only when `surface == .liquidGlass`; ignored otherwise.
///
/// - `cornerRadius`: continuous-corner radius of the floating surface.
/// - `inset`: margin between the sidebar's outer bounds and the visible glass.
///   Larger values make the chrome float more obviously off the window edges.
/// - `translucency`: opacity applied to the visual-effect material itself.
///   `1.0` (default) keeps the material at its native intensity; lower values
///   fade the glass toward the underlying window background.
/// - `accent`: when non-nil, the rounded surface stroke tints toward this color.
///   `nil` keeps the neutral white hairline (the default native look).
public struct HLiquidGlassConfig: Equatable, Sendable {
    public var cornerRadius: CGFloat
    public var inset: CGFloat
    public var translucency: Double
    public var accent: Color?

    public init(
        cornerRadius: CGFloat = HSidebarLayout.liquidGlassCornerRadius,
        inset: CGFloat = HSidebarLayout.liquidGlassInset,
        translucency: Double = 1.0,
        accent: Color? = nil
    ) {
        self.cornerRadius = cornerRadius
        self.inset = inset
        self.translucency = translucency
        self.accent = accent
    }

    public static let `default` = HLiquidGlassConfig()
}

// MARK: - HSidebarStyle

/// All four style axes bundled together.
/// Propagated via `\.hudsonSidebarStyle` so the entire sidebar subtree
/// can be restyled with a single `.environment(\.hudsonSidebarStyle, ...)`.
public struct HSidebarStyle: Equatable, Sendable {
    public var surface: HSidebarSurfaceStyle
    public var indicator: HSidebarIndicatorStyle
    public var icon: HSidebarIconStyle
    public var motion: HSidebarMotionStyle
    public var liquidGlass: HLiquidGlassConfig

    public init(
        surface: HSidebarSurfaceStyle = .base,
        indicator: HSidebarIndicatorStyle = .base,
        icon: HSidebarIconStyle = .base,
        motion: HSidebarMotionStyle = .base,
        liquidGlass: HLiquidGlassConfig = .default
    ) {
        self.surface = surface
        self.indicator = indicator
        self.icon = icon
        self.motion = motion
        self.liquidGlass = liquidGlass
    }

    public static let `default` = HSidebarStyle()
}

// MARK: - Environment

private struct HSidebarStyleKey: EnvironmentKey {
    static let defaultValue: HSidebarStyle = .default
}

public extension EnvironmentValues {
    var hudsonSidebarStyle: HSidebarStyle {
        get { self[HSidebarStyleKey.self] }
        set { self[HSidebarStyleKey.self] = newValue }
    }
}
