import SwiftUI
import HudsonUI

/// Generic readiness state for a dependency that powers a Canvas surface.
/// Examples: tmux, Codex, local CLIs, credentials, or remote runtime bridges.
public enum HudCanvasPrerequisiteStatus: String, CaseIterable, Sendable {
    case ready
    case missing
    case needsPermission
    case running
    case failed

    public var label: String {
        switch self {
        case .ready: "READY"
        case .missing: "MISSING"
        case .needsPermission: "PERMISSION"
        case .running: "RUNNING"
        case .failed: "FAILED"
        }
    }

    public var pulses: Bool {
        self == .running
    }

    public func tint(in theme: HudTheme) -> Color {
        switch self {
        case .ready:
            theme.palette.statusOk
        case .missing:
            theme.palette.statusWarn
        case .needsPermission:
            theme.palette.statusInfo
        case .running:
            theme.palette.statusInfo
        case .failed:
            theme.palette.statusError
        }
    }
}

/// Reusable Canvas card for dependency checks and permission-gated setup.
public struct HudCanvasPrerequisiteCheck: View {
    public let title: String
    public var status: HudCanvasPrerequisiteStatus
    public var detail: String
    public var actionTitle: String?
    public var actionIcon: String?
    public var actionDisabled: Bool
    public var action: (() -> Void)?

    @Environment(\.hudTheme) private var theme

    public init(
        title: String,
        status: HudCanvasPrerequisiteStatus,
        detail: String,
        actionTitle: String? = nil,
        actionIcon: String? = nil,
        actionDisabled: Bool = false,
        action: (() -> Void)? = nil
    ) {
        self.title = title
        self.status = status
        self.detail = detail
        self.actionTitle = actionTitle
        self.actionIcon = actionIcon
        self.actionDisabled = actionDisabled
        self.action = action
    }

    public var body: some View {
        let tint = status.tint(in: theme)

        VStack(alignment: .leading, spacing: HudSpacing.lg) {
            HStack(alignment: .top, spacing: HudSpacing.md) {
                HudStatusDot(
                    color: tint,
                    size: HudDotSize.small,
                    pulses: status.pulses,
                    label: status.label
                )
                .padding(.top, HudSpacing.xxs)

                VStack(alignment: .leading, spacing: HudSpacing.xs) {
                    HStack(spacing: HudSpacing.md) {
                        HudSectionLabel(title, tint: tint)
                        Spacer(minLength: HudSpacing.md)
                        HudBadge(status.label, tint: tint)
                    }

                    Text(detail)
                        .font(HudFont.mono(10))
                        .foregroundStyle(theme.palette.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            if let actionTitle, let action {
                HudButton(
                    actionTitle,
                    icon: actionIcon,
                    style: .primary(.cyan),
                    action: action
                )
                .disabled(actionDisabled)
            }
        }
        .padding(HudSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: theme.radius.standard).fill(HudSurface.tintGhost(theme.palette.ink)))
        .overlay(RoundedRectangle(cornerRadius: theme.radius.standard).stroke(theme.hairline.subtle))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title), \(status.label), \(detail)")
    }
}
