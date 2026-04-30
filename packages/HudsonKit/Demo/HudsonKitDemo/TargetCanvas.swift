import SwiftUI
import HudsonUI
import HudsonShell

/// Detail surface mounted in `HudsonCanvas` when a target is selected from the
/// dashboard. Shows a hero target identity, telemetry strip, and a few panels
/// (focus, agent timeline, telemetry KVs) on the canvas grid.
struct TargetCanvas: View {
    let target: TargetMock
    var onClose: () -> Void
    var onConnect: () -> Void

    @Environment(\.hudsonAppManifest) private var manifest

    var body: some View {
        HudsonCanvas {
            canvasHeader
        } content: {
            VStack(alignment: .leading, spacing: HudsonSpacing.huge) {
                hero
                telemetryStrip

                LazyVGrid(
                    columns: [GridItem(.adaptive(minimum: 280), spacing: HudsonSpacing.xl)],
                    alignment: .leading,
                    spacing: HudsonSpacing.xl
                ) {
                    focusPanel
                    agentPanel
                    telemetryPanel
                }
            }
        }
    }

    // MARK: Header

    private var canvasHeader: some View {
        HStack(spacing: HudsonSpacing.lg) {
            Button(action: onClose) {
                Image(systemName: "chevron.left")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(HudsonPalette.muted)
                    .frame(width: 28, height: 28)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back to fleet")

            HudsonSectionLabel("Fleet", tint: HudsonPalette.muted)
            Text("/")
                .font(HudsonFont.mono(10))
                .foregroundStyle(HudsonPalette.dim)
            Text(target.name)
                .font(HudsonFont.mono(11, weight: .semibold))
                .foregroundStyle(HudsonPalette.ink)

            Spacer()

            HudsonBadge(target.statusLabel, tint: target.statusColor, dot: true)
            if let latency = target.latency {
                Text(latency)
                    .font(HudsonFont.mono(10))
                    .foregroundStyle(HudsonPalette.dim)
            }
        }
    }

    // MARK: Hero

    private var hero: some View {
        HStack(alignment: .top, spacing: HudsonSpacing.xxl) {
            Image(systemName: target.icon)
                .font(.system(size: 32, weight: .medium))
                .foregroundStyle(target.iconTint.color)
                .frame(width: 72, height: 72)
                .background(RoundedRectangle(cornerRadius: HudsonRadius.card).fill(target.iconTint.color.opacity(0.14)))
                .overlay(RoundedRectangle(cornerRadius: HudsonRadius.card).stroke(target.iconTint.color.opacity(0.32), lineWidth: 1))

            VStack(alignment: .leading, spacing: HudsonSpacing.sm) {
                Text(target.name)
                    .font(HudsonFont.mono(22, weight: .bold))
                    .foregroundStyle(HudsonPalette.ink)
                Text(target.host)
                    .font(HudsonFont.mono(12))
                    .foregroundStyle(HudsonPalette.muted)
                if let scene = target.scene {
                    HStack(spacing: HudsonSpacing.md) {
                        Image(systemName: "rectangle.grid.2x2")
                            .font(.system(size: 10))
                            .foregroundStyle(manifest.accent)
                        Text(scene)
                            .font(HudsonFont.ui(13, weight: .medium))
                            .foregroundStyle(HudsonPalette.ink)
                    }
                    .padding(.top, HudsonSpacing.xs)
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: HudsonSpacing.sm) {
                HudsonButton("CONNECT", icon: "bolt", style: .primary(target.iconTint), action: onConnect)
                HudsonButton("RECONFIGURE", style: .secondary) {}
            }
        }
    }

    // MARK: Telemetry strip

    private var telemetryStrip: some View {
        HudsonCard(padding: 0) {
            HStack(spacing: 0) {
                telemetryCell(label: "Status",  value: target.statusLabel.capitalized, valueTint: target.statusColor)
                divider
                telemetryCell(label: "Latency", value: target.latency ?? "—",          valueTint: HudsonPalette.ink)
                divider
                telemetryCell(label: "Agent",   value: target.agentStatus,             valueTint: target.agentTint.color)
                divider
                telemetryCell(label: "Last",    value: target.lastTime ?? "—",         valueTint: HudsonPalette.muted)
            }
        }
    }

    private func telemetryCell(label: String, value: String, valueTint: Color) -> some View {
        VStack(alignment: .leading, spacing: HudsonSpacing.xs) {
            Text(label.uppercased())
                .font(HudsonFont.mono(9))
                .tracking(1.0)
                .foregroundStyle(HudsonPalette.dim)
            Text(value)
                .font(HudsonFont.mono(14, weight: .semibold))
                .foregroundStyle(valueTint)
        }
        .padding(HudsonSpacing.xl)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var divider: some View {
        Rectangle()
            .fill(HudsonHairline.standard)
            .frame(width: 1)
            .frame(maxHeight: .infinity)
    }

    // MARK: Panels

    private var focusPanel: some View {
        HudsonCard {
            VStack(alignment: .leading, spacing: HudsonSpacing.md) {
                HudsonSectionLabel("Focus")
                if let app = target.focusApp {
                    HudsonKVRow("app", value: app)
                }
                if let file = target.focusFile {
                    HudsonKVRow("file", value: file)
                }
                if let action = target.lastAction, let time = target.lastTime {
                    HudsonKVRow("last", value: "\(action) · \(time)")
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .frame(maxHeight: .infinity, alignment: .top)
    }

    private var agentPanel: some View {
        HudsonCard {
            VStack(alignment: .leading, spacing: HudsonSpacing.md) {
                HStack {
                    HudsonSectionLabel("Agent")
                    Spacer()
                    HudsonStatusDot(
                        color: target.agentTint.color,
                        size: 6,
                        pulses: target.agentStatus == "running"
                    )
                }
                HudsonKVRow("status", value: target.agentStatus)
                if let activity = target.agentActivity {
                    HudsonKVRow("activity", value: activity)
                }
                HudsonKVRow("tint", value: target.agentTint.rawValue)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .frame(maxHeight: .infinity, alignment: .top)
    }

    private var telemetryPanel: some View {
        HudsonCard {
            VStack(alignment: .leading, spacing: HudsonSpacing.md) {
                HudsonSectionLabel("Telemetry")
                HudsonKVRow("cpu",      value: "51%")
                HudsonKVRow("mem",      value: "98%")
                HudsonKVRow("uptime",   value: "19w")
                HudsonKVRow("temp",     value: "45°C", valueColor: HudsonTint.amber.color)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .frame(maxHeight: .infinity, alignment: .top)
    }
}
