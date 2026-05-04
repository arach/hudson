import SwiftUI
import HudsonUI
import HudsonShell

/// Detail surface mounted in `HudCanvas` when a target is selected from the
/// dashboard. Shows a hero target identity, telemetry strip, and a few panels
/// (focus, agent timeline, telemetry KVs) on the canvas grid.
struct TargetCanvas: View {
    let target: TargetMock
    var onClose: () -> Void
    var onConnect: () -> Void

    @Environment(\.hudsonAppManifest) private var manifest

    var body: some View {
        HudCanvas {
            canvasHeader
        } content: {
            VStack(alignment: .leading, spacing: HudSpacing.huge) {
                hero
                telemetryStrip

                LazyVGrid(
                    columns: [GridItem(.adaptive(minimum: 280), spacing: HudSpacing.xl)],
                    alignment: .leading,
                    spacing: HudSpacing.xl
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
        HStack(spacing: HudSpacing.lg) {
            Button(action: onClose) {
                Image(systemName: "chevron.left")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(HudPalette.muted)
                    .frame(width: 28, height: 28)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back to fleet")

            HudSectionLabel("Fleet", tint: HudPalette.muted)
            Text("/")
                .font(HudFont.mono(10))
                .foregroundStyle(HudPalette.dim)
            Text(target.name)
                .font(HudFont.mono(11, weight: .semibold))
                .foregroundStyle(HudPalette.ink)

            Spacer()

            HudBadge(target.statusLabel, tint: target.statusColor, dot: true)
            if let latency = target.latency {
                Text(latency)
                    .font(HudFont.mono(10))
                    .foregroundStyle(HudPalette.dim)
            }
        }
    }

    // MARK: Hero

    private var hero: some View {
        HStack(alignment: .top, spacing: HudSpacing.xxl) {
            Image(systemName: target.icon)
                .font(.system(size: 32, weight: .medium))
                .foregroundStyle(target.iconTint.color)
                .frame(width: 72, height: 72)
                .background(RoundedRectangle(cornerRadius: HudRadius.card).fill(target.iconTint.color.opacity(0.14)))
                .overlay(RoundedRectangle(cornerRadius: HudRadius.card).stroke(target.iconTint.color.opacity(0.32), lineWidth: 1))

            VStack(alignment: .leading, spacing: HudSpacing.sm) {
                Text(target.name)
                    .font(HudFont.mono(22, weight: .bold))
                    .foregroundStyle(HudPalette.ink)
                Text(target.host)
                    .font(HudFont.mono(12))
                    .foregroundStyle(HudPalette.muted)
                if let scene = target.scene {
                    HStack(spacing: HudSpacing.md) {
                        Image(systemName: "rectangle.grid.2x2")
                            .font(.system(size: 10))
                            .foregroundStyle(manifest.accent)
                        Text(scene)
                            .font(HudFont.ui(13, weight: .medium))
                            .foregroundStyle(HudPalette.ink)
                    }
                    .padding(.top, HudSpacing.xs)
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: HudSpacing.sm) {
                HudButton("CONNECT", icon: "bolt", style: .primary(target.iconTint), action: onConnect)
                HudButton("RECONFIGURE", style: .secondary) {}
            }
        }
    }

    // MARK: Telemetry strip

    private var telemetryStrip: some View {
        HudCard(padding: 0) {
            HStack(spacing: 0) {
                telemetryCell(label: "Status",  value: target.statusLabel.capitalized, valueTint: target.statusColor)
                divider
                telemetryCell(label: "Latency", value: target.latency ?? "—",          valueTint: HudPalette.ink)
                divider
                telemetryCell(label: "Agent",   value: target.agentStatus,             valueTint: target.agentTint.color)
                divider
                telemetryCell(label: "Last",    value: target.lastTime ?? "—",         valueTint: HudPalette.muted)
            }
        }
    }

    private func telemetryCell(label: String, value: String, valueTint: Color) -> some View {
        VStack(alignment: .leading, spacing: HudSpacing.xs) {
            Text(label.uppercased())
                .font(HudFont.mono(9))
                .tracking(1.0)
                .foregroundStyle(HudPalette.dim)
            Text(value)
                .font(HudFont.mono(14, weight: .semibold))
                .foregroundStyle(valueTint)
        }
        .padding(HudSpacing.xl)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var divider: some View {
        Rectangle()
            .fill(HudHairline.standard)
            .frame(width: 1)
            .frame(maxHeight: .infinity)
    }

    // MARK: Panels

    private var focusPanel: some View {
        HudCard {
            VStack(alignment: .leading, spacing: HudSpacing.md) {
                HudSectionLabel("Focus")
                if let app = target.focusApp {
                    HudKVRow("app", value: app)
                }
                if let file = target.focusFile {
                    HudKVRow("file", value: file)
                }
                if let action = target.lastAction, let time = target.lastTime {
                    HudKVRow("last", value: "\(action) · \(time)")
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .frame(maxHeight: .infinity, alignment: .top)
    }

    private var agentPanel: some View {
        HudCard {
            VStack(alignment: .leading, spacing: HudSpacing.md) {
                HStack {
                    HudSectionLabel("Agent")
                    Spacer()
                    HudStatusDot(
                        color: target.agentTint.color,
                        size: 6,
                        pulses: target.agentStatus == "running"
                    )
                }
                HudKVRow("status", value: target.agentStatus)
                if let activity = target.agentActivity {
                    HudKVRow("activity", value: activity)
                }
                HudKVRow("tint", value: target.agentTint.rawValue)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .frame(maxHeight: .infinity, alignment: .top)
    }

    private var telemetryPanel: some View {
        HudCard {
            VStack(alignment: .leading, spacing: HudSpacing.md) {
                HudSectionLabel("Telemetry")
                HudKVRow("cpu",      value: "51%")
                HudKVRow("mem",      value: "98%")
                HudKVRow("uptime",   value: "19w")
                HudKVRow("temp",     value: "45°C", valueColor: HudTint.amber.color)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .frame(maxHeight: .infinity, alignment: .top)
    }
}
