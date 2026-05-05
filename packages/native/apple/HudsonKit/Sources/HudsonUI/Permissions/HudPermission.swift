import Foundation

/// The permissions HudPermissions can request and check. iOS-first; macOS/web
/// return `.unavailable` until per-platform plumbing lands.
public enum HudPermission: String, Sendable, CaseIterable, Identifiable {
    case microphone
    case camera
    case photos
    case notifications

    public var id: String { rawValue }

    /// The Info.plist `NS*UsageDescription` key the OS expects to be present
    /// before iOS will surface the permission prompt. Apps must declare these
    /// in their Info.plist or `INFOPLIST_KEY_*` build settings.
    public var infoPlistKey: String {
        switch self {
        case .microphone:    return "NSMicrophoneUsageDescription"
        case .camera:        return "NSCameraUsageDescription"
        case .photos:        return "NSPhotoLibraryUsageDescription"
        case .notifications: return ""  // Notifications don't require an Info.plist string
        }
    }

    /// SF Symbol name suitable for icons + chips.
    public var symbolName: String {
        switch self {
        case .microphone:    return "mic.fill"
        case .camera:        return "camera.fill"
        case .photos:        return "photo.on.rectangle.angled"
        case .notifications: return "bell.fill"
        }
    }

    /// Human-readable label.
    public var displayName: String {
        switch self {
        case .microphone:    return "Microphone"
        case .camera:        return "Camera"
        case .photos:        return "Photos"
        case .notifications: return "Notifications"
        }
    }
}

/// Unified status across every permission HudPermissions covers. Replaces the
/// per-framework auth-status enums (`AVAudioSession.RecordPermission`,
/// `AVAuthorizationStatus`, `PHAuthorizationStatus`, `UNAuthorizationStatus`)
/// so app code branches on one type.
public enum HudPermissionStatus: String, Sendable {
    /// User hasn't been asked yet. Calling `request` will surface the system
    /// prompt.
    case notDetermined
    /// User granted full access.
    case granted
    /// User granted partial access (Photos `.limited`, Notifications
    /// `.provisional`). Treat as success but note the constraint.
    case limited
    /// User denied. Calling `request` again won't re-prompt — the only way
    /// out is the Settings deep-link.
    case denied
    /// Parental controls / MDM blocked the prompt entirely.
    case restricted
    /// Permission isn't supported on the current platform / OS version.
    case unavailable

    /// True when access is granted in any form (full or limited).
    public var isAuthorized: Bool {
        self == .granted || self == .limited
    }

    /// True when the user has made a final choice — calling `request` again
    /// won't prompt. Use this to decide between "show request button" and
    /// "show open-Settings button".
    public var isTerminal: Bool {
        self == .denied || self == .restricted
    }
}
