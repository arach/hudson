import SwiftUI

/// Drop-in gate for permission-protected content. Shows the appropriate UI
/// for each `HudPermissionStatus` state without each call site reimplementing
/// the same three branches.
///
/// ```swift
/// HudPermissionGate(.microphone, rationale: "Talkie listens to your dictation.") {
///     RecordingView()
/// }
/// ```
public struct HudPermissionGate<Content: View>: View {
    private let permission: HudPermission
    private let rationale: String
    private let content: () -> Content

    @State private var status: HudPermissionStatus = .notDetermined

    public init(
        _ permission: HudPermission,
        rationale: String,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.permission = permission
        self.rationale = rationale
        self.content = content
    }

    public var body: some View {
        Group {
            switch status {
            case .granted, .limited:
                content()
            case .notDetermined:
                requestCard
            case .denied, .restricted:
                deniedCard
            case .unavailable:
                unavailableCard
            }
        }
        .task { status = HudPermissions.status(of: permission) }
    }

    private var requestCard: some View {
        HudCard {
            VStack(alignment: .leading, spacing: HudSpacing.lg) {
                header
                Text(rationale)
                    .font(HudFont.ui(HudTextSize.sm))
                    .foregroundStyle(HudPalette.muted)
                    .frame(maxWidth: .infinity, alignment: .leading)
                HudButton(
                    "Allow \(permission.displayName)",
                    icon: permission.symbolName,
                    style: .primary(.green)
                ) {
                    Task { status = await HudPermissions.request(permission) }
                }
            }
        }
    }

    private var deniedCard: some View {
        HudCard {
            VStack(alignment: .leading, spacing: HudSpacing.lg) {
                header
                Text("\(permission.displayName) access is off. Open Settings to change it.")
                    .font(HudFont.ui(HudTextSize.sm))
                    .foregroundStyle(HudPalette.muted)
                    .frame(maxWidth: .infinity, alignment: .leading)
                HudButton(
                    "Open Settings",
                    icon: "gearshape",
                    style: .secondary
                ) {
                    HudPermissions.openSettings()
                }
            }
        }
    }

    private var unavailableCard: some View {
        HudCard {
            VStack(alignment: .leading, spacing: HudSpacing.lg) {
                header
                Text("\(permission.displayName) isn't available on this device or platform.")
                    .font(HudFont.ui(HudTextSize.sm))
                    .foregroundStyle(HudPalette.muted)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private var header: some View {
        HStack(spacing: HudSpacing.md) {
            Image(systemName: permission.symbolName)
                .font(HudFont.ui(HudTextSize.base, weight: .medium))
                .foregroundStyle(HudPalette.accent)
            Text(permission.displayName)
                .font(HudFont.ui(HudTextSize.base, weight: .semibold))
                .foregroundStyle(HudPalette.ink)
            Spacer()
            HudBadge(statusBadgeText, tint: statusBadgeTint, dot: status.isAuthorized)
        }
    }

    private var statusBadgeText: String {
        switch status {
        case .notDetermined: return "ASK"
        case .granted:       return "ON"
        case .limited:       return "LIMITED"
        case .denied:        return "OFF"
        case .restricted:    return "RESTRICTED"
        case .unavailable:   return "N/A"
        }
    }

    private var statusBadgeTint: Color {
        switch status {
        case .notDetermined: return HudPalette.muted
        case .granted:       return HudPalette.statusOk
        case .limited:       return HudPalette.statusWarn
        case .denied:        return HudPalette.statusError
        case .restricted:    return HudPalette.statusError
        case .unavailable:   return HudPalette.dim
        }
    }
}
