import SwiftUI

// MARK: - HSidebarSurfaceStyle

/// Background treatment for the sidebar surface.
/// `base` is the default (Hudson chrome + subtle gradient).
/// `glass` applies translucent material; `editorial` is a flat slightly-lighter fill.
public enum HSidebarSurfaceStyle: String, CaseIterable, Identifiable, Sendable {
    case base
    case glass
    case editorial

    public var id: String { rawValue }

    public var label: String {
        switch self {
        case .base:      return "Base"
        case .glass:     return "Glass"
        case .editorial: return "Print"
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

// MARK: - HSidebarStyle

/// All four style axes bundled together.
/// Propagated via `\.hudsonSidebarStyle` so the entire sidebar subtree
/// can be restyled with a single `.environment(\.hudsonSidebarStyle, ...)`.
public struct HSidebarStyle: Equatable, Sendable {
    public var surface: HSidebarSurfaceStyle
    public var indicator: HSidebarIndicatorStyle
    public var icon: HSidebarIconStyle
    public var motion: HSidebarMotionStyle

    public init(
        surface: HSidebarSurfaceStyle = .base,
        indicator: HSidebarIndicatorStyle = .base,
        icon: HSidebarIconStyle = .base,
        motion: HSidebarMotionStyle = .base
    ) {
        self.surface = surface
        self.indicator = indicator
        self.icon = icon
        self.motion = motion
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
