import Foundation
import Observation

/// Aggregates a fixed set of permissions into a single readiness signal so
/// landing pages can render "all systems go" / "fix these" UI without each app
/// rebuilding the same status fan-in. Generalizes Talkie's
/// `DictationReadinessChecker` permission slice.
///
/// ```swift
/// @State private var readiness = HudPermissionReadiness([.microphone, .speech])
///
/// var body: some View {
///     if readiness.isReady {
///         RecordingView()
///     } else {
///         ReadinessCard(readiness: readiness)
///     }
/// }
/// .task { readiness.evaluate() }
/// ```
@Observable
public final class HudPermissionReadiness {

    /// Permissions tracked by this readiness instance, in the order supplied.
    public let permissions: [HudPermission]

    /// Latest known status per permission. Always contains an entry for every
    /// tracked permission; defaults to `.notDetermined` until `evaluate()` is
    /// called for the first time.
    public private(set) var statuses: [HudPermission: HudPermissionStatus]

    public init(_ permissions: [HudPermission]) {
        self.permissions = permissions
        self.statuses = Dictionary(
            uniqueKeysWithValues: permissions.map { ($0, .notDetermined) }
        )
    }

    /// Test / preview seam. Lets callers preload an arbitrary status map
    /// without going through the system permission queries.
    public init(permissions: [HudPermission], statuses: [HudPermission: HudPermissionStatus]) {
        self.permissions = permissions
        var merged = Dictionary(
            uniqueKeysWithValues: permissions.map { ($0, HudPermissionStatus.notDetermined) }
        )
        for (permission, status) in statuses where merged.keys.contains(permission) {
            merged[permission] = status
        }
        self.statuses = merged
    }

    /// Refresh every tracked permission's status from the system without
    /// prompting. Cheap to call from `.task` / `.onAppear` / on scene
    /// activation.
    public func evaluate() {
        for permission in permissions {
            statuses[permission] = HudPermissions.status(of: permission)
        }
    }

    /// Surface the OS prompt for any permission that hasn't been answered yet.
    /// Permissions in a terminal state (`.denied` / `.restricted`) are left
    /// alone — the only escape from those is `HudPermissions.openSettings()`.
    @discardableResult
    public func requestPending() async -> Bool {
        for permission in permissions where statuses[permission] == .notDetermined {
            statuses[permission] = await HudPermissions.request(permission)
        }
        return isReady
    }

    /// True when every tracked permission is granted (full or limited).
    public var isReady: Bool {
        permissions.allSatisfy { statuses[$0]?.isAuthorized == true }
    }

    /// Permissions the user has terminally refused — denied or restricted.
    /// Surfacing the open-Settings deep link is the only recovery.
    public var blockers: [HudPermission] {
        permissions.filter { statuses[$0]?.isTerminal == true }
    }

    /// Permissions not yet answered. These can still be requested in-app.
    public var pending: [HudPermission] {
        permissions.filter { statuses[$0] == .notDetermined }
    }

    /// Permissions reporting `.unavailable` on this platform / OS version.
    public var unavailable: [HudPermission] {
        permissions.filter { statuses[$0] == .unavailable }
    }

    /// First blocker, useful for "show one CTA" UI.
    public var firstBlocker: HudPermission? { blockers.first }

    /// Convenience for the common "if pending exist, show request button"
    /// branch.
    public var hasPending: Bool { !pending.isEmpty }

    /// Convenience for the common "if any blocker exists, show open-Settings
    /// button" branch.
    public var hasBlockers: Bool { !blockers.isEmpty }
}
