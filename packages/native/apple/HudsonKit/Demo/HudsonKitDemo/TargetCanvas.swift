import SwiftUI
import HudsonUI
import HudsonShell

/// Detail surface mounted in `HCanvas` when a target is selected from the
/// dashboard. Shows a hero target identity, telemetry strip, and a few panels
/// (focus, agent timeline, telemetry KVs) on the canvas grid.
struct TargetCanvas: View {
    let target: TargetMock
    var onClose: () -> Void
    var onConnect: () -> Void

    @Environment(\.hudsonAppManifest) private var manifest

    var body: some View {
        HCanvas {
            canvasHeader
        } content: {
            VStack(alignment: .leading, spacing: HSpacing.huge) {
                hero
                telemetryStrip

                LazyVGrid(
                    columns: [GridItem(.adaptive(minimum: 280), spacing: HSpacing.xl)],
                    alignment: .leading,
                    spacing: HSpacing.xl
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
        HStack(spacing: HSpacing.lg) {
            Button(action: onClose) {
                Image(systemName: "chevron.left")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(HPalette.muted)
                    .frame(width: 28, height: 28)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back to fleet")

            HSectionLabel("Fleet", tint: HPalette.muted)
            Text("/")
                .font(HFont.mono(10))
                .foregroundStyle(HPalette.dim)
            Text(target.name)
                .font(HFont.mono(11, weight: .semibold))
                .foregroundStyle(HPalette.ink)

            Spacer()

            HBadge(target.statusLabel, tint: target.statusColor, dot: true)
            if let latency = target.latency {
                Text(latency)
                    .font(HFont.mono(10))
                    .foregroundStyle(HPalette.dim)
            }
        }
    }

    // MARK: Hero

    private var hero: some View {
        HStack(alignment: .top, spacing: HSpacing.xxl) {
            Image(systemName: target.icon)
                .font(.system(size: 32, weight: .medium))
                .foregroundStyle(target.iconTint.color)
                .frame(width: 72, height: 72)
                .background(RoundedRectangle(cornerRadius: HRadius.card).fill(target.iconTint.color.opacity(0.14)))
                .overlay(RoundedRectangle(cornerRadius: HRadius.card).stroke(target.iconTint.color.opacity(0.32), lineWidth: 1))

            VStack(alignment: .leading, spacing: HSpacing.sm) {
                Text(target.name)
                    .font(HFont.mono(22, weight: .bold))
                    .foregroundStyle(HPalette.ink)
                Text(target.host)
                    .font(HFont.mono(12))
                    .foregroundStyle(HPalette.muted)
                if let scene = target.scene {
                    HStack(spacing: HSpacing.md) {
                        Image(systemName: "rectangle.grid.2x2")
                            .font(.system(size: 10))
                            .foregroundStyle(manifest.accent)
                        Text(scene)
                            .font(HFont.ui(13, weight: .medium))
                            .foregroundStyle(HPalette.ink)
                    }
                    .padding(.top, HSpacing.xs)
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: HSpacing.sm) {
                HButton("CONNECT", icon: "bolt", style: .primary(target.iconTint), action: onConnect)
                HButton("RECONFIGURE", style: .secondary) {}
            }
        }
    }

    // MARK: Telemetry strip

    private var telemetryStrip: some View {
        HCard(padding: 0) {
            HStack(spacing: 0) {
                telemetryCell(label: "Status",  value: target.statusLabel.capitalized, valueTint: target.statusColor)
                divider
                telemetryCell(label: "Latency", value: target.latency ?? "—",          valueTint: HPalette.ink)
                divider
                telemetryCell(label: "Agent",   value: target.agentStatus,             valueTint: target.agentTint.color)
                divider
                telemetryCell(label: "Last",    value: target.lastTime ?? "—",         valueTint: HPalette.muted)
            }
        }
    }

    private func telemetryCell(label: String, value: String, valueTint: Color) -> some View {
        VStack(alignment: .leading, spacing: HSpacing.xs) {
            Text(label.uppercased())
                .font(HFont.mono(9))
                .tracking(1.0)
                .foregroundStyle(HPalette.dim)
            Text(value)
                .font(HFont.mono(14, weight: .semibold))
                .foregroundStyle(valueTint)
        }
        .padding(HSpacing.xl)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var divider: some View {
        Rectangle()
            .fill(HHairline.standard)
            .frame(width: 1)
            .frame(maxHeight: .infinity)
    }

    // MARK: Panels

    private var focusPanel: some View {
        HCard {
            VStack(alignment: .leading, spacing: HSpacing.md) {
                HSectionLabel("Focus")
                if let app = target.focusApp {
                    HKVRow("app", value: app)
                }
                if let file = target.focusFile {
                    HKVRow("file", value: file)
                }
                if let action = target.lastAction, let time = target.lastTime {
                    HKVRow("last", value: "\(action) · \(time)")
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .frame(maxHeight: .infinity, alignment: .top)
    }

    private var agentPanel: some View {
        HCard {
            VStack(alignment: .leading, spacing: HSpacing.md) {
                HStack {
                    HSectionLabel("Agent")
                    Spacer()
                    HStatusDot(
                        color: target.agentTint.color,
                        size: 6,
                        pulses: target.agentStatus == "running"
                    )
                }
                HKVRow("status", value: target.agentStatus)
                if let activity = target.agentActivity {
                    HKVRow("activity", value: activity)
                }
                HKVRow("tint", value: target.agentTint.rawValue)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .frame(maxHeight: .infinity, alignment: .top)
    }

    private var telemetryPanel: some View {
        HCard {
            VStack(alignment: .leading, spacing: HSpacing.md) {
                HSectionLabel("Telemetry")
                HKVRow("cpu",      value: "51%")
                HKVRow("mem",      value: "98%")
                HKVRow("uptime",   value: "19w")
                HKVRow("temp",     value: "45°C", valueColor: HTint.amber.color)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .frame(maxHeight: .infinity, alignment: .top)
    }
}
