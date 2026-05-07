import SwiftUI
import HudsonLive

public enum HudLiveIndicatorDisplayMode: Sendable {
    case dot
    case compact
    case expanded
}

/// Chrome treatment for the compact display mode. The default `auto` keeps
/// healthy receiving states quiet (dot + muted label) and reserves the filled
/// pill for statuses that require attention. Callers can pin to `pill` or
/// `ghost` when they need an explicit treatment regardless of status.
public enum HudLiveIndicatorChrome: Sendable, Equatable {
    /// Pill when the source needs attention (stale/error/offline); otherwise
    /// a chrome-less ghost so live status stops shouting in title bars.
    case auto
    /// Always render the filled pill - useful in detail panels or when the
    /// indicator is the only signal in its container.
    case pill
    /// Always render the chrome-less ghost - useful when the surrounding card
    /// already supplies the visual frame.
    case ghost
}

/// Consistent live-source indicator for Hudson surfaces. The source of truth can
/// be a file watcher, tRPC stream, WebSocket, JSONL feed, or app-specific bus;
/// this view only renders the normalized live state.
public struct HudLiveIndicator: View {
    public var source: HudLiveSourceDescriptor
    public var displayMode: HudLiveIndicatorDisplayMode
    public var chrome: HudLiveIndicatorChrome

    @Environment(\.hudTheme) private var theme

    public init(
        source: HudLiveSourceDescriptor,
        displayMode: HudLiveIndicatorDisplayMode = .compact,
        chrome: HudLiveIndicatorChrome = .auto
    ) {
        self.source = source
        self.displayMode = displayMode
        self.chrome = chrome
    }

    public var body: some View {
        switch displayMode {
        case .dot:
            dotView
        case .compact:
            if showsCompactPill {
                pillView
            } else {
                ghostView
            }
        case .expanded:
            expandedView
        }
    }

    // MARK: - Variants

    private var dotView: some View {
        HudStatusDot(
            color: tint,
            size: HudDotSize.small,
            pulses: source.status.isReceiving,
            label: accessibilityLabel
        )
    }

    private var pillView: some View {
        HStack(spacing: HudSpacing.xs) {
            HudStatusDot(
                color: tint,
                size: HudDotSize.tiny,
                pulses: source.status.isReceiving,
                label: nil
            )
            Text(source.status.label)
                .font(HudFont.mono(HudTextSize.micro, weight: .semibold))
                .tracking(0.7)
                .textCase(.uppercase)
                .lineLimit(1)
        }
        .foregroundStyle(tint)
        .padding(.horizontal, HudSpacing.sm)
        .padding(.vertical, HudSpacing.xxs)
        .background(
            RoundedRectangle(cornerRadius: HudRadius.tight)
                .fill(HudSurface.tintGhost(tint))
        )
        .overlay(
            RoundedRectangle(cornerRadius: HudRadius.tight)
                .stroke(HudSurface.tintBorder(tint), lineWidth: HudStrokeWidth.standard)
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel)
    }

    /// Chrome-less variant. The source-color dot stays as the live signal so
    /// the badge still reads at a glance; the label drops to the muted theme
    /// color so it recedes into the title bar instead of stacking accent
    /// against accent.
    private var ghostView: some View {
        HStack(spacing: HudSpacing.xs) {
            HudStatusDot(
                color: tint,
                size: HudDotSize.tiny,
                pulses: source.status.isReceiving,
                label: nil
            )
            Text(source.status.label)
                .font(HudFont.mono(HudTextSize.micro, weight: .semibold))
                .tracking(0.7)
                .textCase(.uppercase)
                .lineLimit(1)
                .foregroundStyle(theme.palette.muted)
        }
        .padding(.vertical, HudSpacing.xxs)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel)
    }

    private var expandedView: some View {
        VStack(alignment: .leading, spacing: HudSpacing.xs) {
            HStack(spacing: HudSpacing.sm) {
                HudStatusDot(
                    color: tint,
                    size: HudDotSize.small,
                    pulses: source.status.isReceiving,
                    label: nil
                )
                Text(source.status.label.uppercased())
                    .font(HudFont.mono(HudTextSize.xs, weight: .semibold))
                    .foregroundStyle(tint)
                Spacer(minLength: 0)
                if let cursor = source.cursor {
                    Text(String(cursor.suffix(10)))
                        .font(HudFont.mono(HudTextSize.micro, weight: .semibold))
                        .foregroundStyle(theme.palette.dim)
                        .lineLimit(1)
                }
            }
            Text(source.detail ?? source.label)
                .font(HudFont.mono(HudTextSize.xxs))
                .foregroundStyle(theme.palette.muted)
                .lineLimit(2)
            if let summary = source.lastEventSummary {
                Text(summary)
                    .font(HudFont.mono(HudTextSize.xxs))
                    .foregroundStyle(theme.palette.dim)
                    .lineLimit(2)
            }
        }
        .padding(HudSpacing.lg)
        .background(RoundedRectangle(cornerRadius: HudRadius.standard).fill(theme.palette.surface))
        .overlay(RoundedRectangle(cornerRadius: HudRadius.standard).stroke(theme.hairline.standard))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
    }

    // MARK: - Resolution

    private var showsCompactPill: Bool {
        Self.resolvedShowsPill(chrome: chrome, status: source.status)
    }

    /// Pure logic for compact-chrome resolution - exposed for testability.
    /// Returns `true` when the compact view should render the filled pill,
    /// `false` when it should render the chrome-less ghost.
    public static func resolvedShowsPill(
        chrome: HudLiveIndicatorChrome,
        status: HudLiveStatus
    ) -> Bool {
        switch chrome {
        case .pill:  return true
        case .ghost: return false
        case .auto:  return status.requiresAttention
        }
    }

    private var accessibilityLabel: String {
        "\(source.label), \(source.status.label)"
    }

    private var tint: Color {
        switch source.status {
        case .connecting, .replaying:
            theme.palette.statusInfo
        case .live:
            theme.palette.statusOk
        case .stale, .paused:
            theme.palette.statusWarn
        case .error, .offline:
            theme.palette.statusError
        }
    }
}
