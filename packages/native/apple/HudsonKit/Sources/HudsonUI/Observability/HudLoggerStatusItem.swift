import SwiftUI
import HudsonObservability

/// Compact status-bar affordance for the live log inspector. Mirrors the web
/// `HudLoggerStatusItem`: dot tone reflects error/warning presence, label stays
/// monospace, and optional counts surface total/error pressure without opening
/// the panel.
@MainActor
public struct HudLoggerStatusItem: View {
    @ObservedObject private var store: HudLogStore
    public let label: String
    public var showCounts: Bool

    public init(
        store: HudLogStore = .shared,
        label: String = "Logs",
        showCounts: Bool = false
    ) {
        self._store = ObservedObject(wrappedValue: store)
        self.label = label
        self.showCounts = showCounts
    }

    public var body: some View {
        let summary = store.summary
        HStack(spacing: HudSpacing.sm) {
            HudStatusDot(color: toneColor(summary.tone))
            Text(label)
                .font(HudFont.mono(HudTextSize.xxs, weight: .bold))
                .tracking(1.2)
                .foregroundStyle(HudPalette.muted)

            if showCounts {
                Text("\(summary.total)")
                    .font(HudFont.mono(HudTextSize.xxs))
                    .foregroundStyle(HudPalette.dim)
                    .monospacedDigit()
                if summary.errors > 0 {
                    Text("/\(summary.errors)")
                        .font(HudFont.mono(HudTextSize.xxs, weight: .bold))
                        .foregroundStyle(HudPalette.statusError)
                        .monospacedDigit()
                }
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel(summary))
        .accessibilityAddTraits(.isButton)
    }

    private func toneColor(_ tone: HudLogSummaryTone) -> Color {
        switch tone {
        case .ok:
            return HudPalette.statusOk
        case .warning:
            return HudPalette.statusWarn
        case .error:
            return HudPalette.statusError
        }
    }

    private func accessibilityLabel(_ summary: HudLogSummary) -> String {
        "\(label), \(summary.total) events, \(summary.errors) errors, \(summary.warnings) warnings"
    }
}