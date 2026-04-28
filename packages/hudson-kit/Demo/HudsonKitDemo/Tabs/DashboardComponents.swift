import SwiftUI
import HudsonUI

// MARK: - Fleet top bar

struct FleetTopBar: View {
    @Environment(\.hudsonAppManifest) private var manifest
    let targets: [TargetMock]

    var body: some View {
        HStack(spacing: HudsonSpacing.xl) {
            HStack(spacing: HudsonSpacing.lg) {
                Text(manifest.name.uppercased())
                    .font(HudsonFont.mono(11, weight: .bold))
                    .tracking(1.5)
                    .foregroundStyle(HudsonPalette.ink)
                Text("·").foregroundStyle(HudsonPalette.dim)
                Text("home")
                    .font(HudsonFont.mono(11))
                    .tracking(1)
                    .foregroundStyle(HudsonPalette.muted)
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: HudsonSpacing.md) {
                    ForEach(targets) { FleetPill(target: $0) }
                }
            }

            Spacer(minLength: HudsonSpacing.md)

            HudsonBadge("2 \(manifest.targetLabel.uppercased())S", tint: manifest.accent, dot: true)
            Image(systemName: "chevron.down")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(HudsonPalette.muted)
            Image(systemName: "gearshape")
                .font(.system(size: 14))
                .foregroundStyle(HudsonPalette.muted)
        }
        .padding(.horizontal, HudsonSpacing.xxl)
        .frame(height: 44)
        .background(Color.black.opacity(0.25))
    }
}

private struct FleetPill: View {
    let target: TargetMock
    var body: some View {
        HStack(spacing: 5) {
            Circle().fill(target.statusColor).frame(width: 5, height: 5)
            Text(target.name)
                .font(HudsonFont.mono(10, weight: .semibold))
                .foregroundStyle(target.statusLabel == "OFFLINE" ? HudsonPalette.dim : HudsonPalette.ink)
        }
        .padding(.horizontal, HudsonSpacing.md)
        .padding(.vertical, 4)
        .background(RoundedRectangle(cornerRadius: HudsonRadius.tight).fill(target.statusColor.opacity(0.12)))
        .overlay(RoundedRectangle(cornerRadius: HudsonRadius.tight).stroke(target.statusColor.opacity(0.35), lineWidth: 1))
    }
}

// MARK: - Target card

struct TargetCard: View {
    let target: TargetMock

    var body: some View {
        HudsonCard {
            VStack(alignment: .leading, spacing: HudsonSpacing.lg) {
                header
                if let scene = target.scene { sceneRow(scene) }
                if target.focusApp != nil || target.lastAction != nil { focusBlock }
                HudsonDivider()
                agentRow
            }
        }
    }

    private var header: some View {
        HStack(spacing: HudsonSpacing.lg) {
            Image(systemName: target.icon)
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(target.iconTint.color)
                .frame(width: 40, height: 32)
                .background(RoundedRectangle(cornerRadius: HudsonRadius.standard).fill(target.iconTint.color.opacity(0.15)))
                .overlay(RoundedRectangle(cornerRadius: HudsonRadius.standard).stroke(target.iconTint.color.opacity(0.28), lineWidth: 1))
            VStack(alignment: .leading, spacing: 2) {
                Text(target.name)
                    .font(HudsonFont.mono(13, weight: .semibold))
                    .foregroundStyle(HudsonPalette.ink)
                Text(target.host)
                    .font(HudsonFont.mono(10))
                    .foregroundStyle(HudsonPalette.muted)
            }
            Spacer(minLength: 0)
            VStack(alignment: .trailing, spacing: HudsonSpacing.xs) {
                HStack(spacing: HudsonSpacing.xs) {
                    if let count = target.badgeCount {
                        HudsonBadge(String(count), tint: HudsonPalette.muted)
                    }
                    HudsonBadge(target.statusLabel, tint: target.statusColor, dot: true)
                }
                if let latency = target.latency {
                    Text(latency)
                        .font(HudsonFont.mono(9))
                        .foregroundStyle(HudsonPalette.dim)
                }
            }
        }
    }

    private func sceneRow(_ scene: String) -> some View {
        HStack(spacing: HudsonSpacing.md) {
            Image(systemName: "rectangle.grid.2x2")
                .font(.system(size: 10))
                .foregroundStyle(HudsonPalette.muted)
            Text(scene)
                .font(HudsonFont.ui(12))
                .foregroundStyle(HudsonPalette.ink)
        }
    }

    private var focusBlock: some View {
        VStack(spacing: HudsonSpacing.sm) {
            if let app = target.focusApp, let file = target.focusFile {
                kvRow("focus", primary: app, secondary: file)
            }
            if let action = target.lastAction, let time = target.lastTime {
                kvRow("last", primary: action, secondary: time)
            } else if let time = target.lastTime {
                kvRow("last", primary: time, secondary: nil)
            }
        }
    }

    private func kvRow(_ key: String, primary: String, secondary: String?) -> some View {
        HStack(spacing: HudsonSpacing.md) {
            Text(key.uppercased())
                .font(HudsonFont.mono(9))
                .tracking(0.8)
                .foregroundStyle(HudsonPalette.dim)
                .frame(width: 36, alignment: .leading)
            Text(primary)
                .font(HudsonFont.mono(11, weight: .semibold))
                .foregroundStyle(HudsonPalette.ink)
            if let secondary {
                Text("·").foregroundStyle(HudsonPalette.dim)
                Text(secondary)
                    .font(HudsonFont.mono(11))
                    .foregroundStyle(HudsonPalette.muted)
            }
            Spacer(minLength: 0)
        }
    }

    private var agentRow: some View {
        HStack(spacing: HudsonSpacing.md) {
            Text("AGENT")
                .font(HudsonFont.mono(9))
                .tracking(0.8)
                .foregroundStyle(HudsonPalette.dim)
                .frame(width: 36, alignment: .leading)
            HudsonStatusDot(color: target.agentTint.color, size: 6, pulses: target.agentStatus == "running")
            Text(target.agentStatus)
                .font(HudsonFont.mono(11, weight: .semibold))
                .foregroundStyle(HudsonPalette.ink)
            if let activity = target.agentActivity {
                Text("·").foregroundStyle(HudsonPalette.dim)
                Text(activity)
                    .font(HudsonFont.mono(11))
                    .foregroundStyle(HudsonPalette.muted)
            }
            Spacer(minLength: 0)
            Image(systemName: "arrow.up.right")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(HudsonPalette.muted)
        }
    }
}

// MARK: - Overflow panels

struct AgentPanel: View {
    var body: some View {
        OverflowPanel(label: "Agent · Claude", trailing: "3 evt") {
            VStack(alignment: .leading, spacing: HudsonSpacing.md) {
                row(icon: "checkmark", tint: HudsonPalette.statusOk, text: "designed home arch")
                row(icon: "square.and.pencil", tint: HudsonTint.amber.color, text: "writing tile spec")
                row(icon: "circle.fill", tint: HudsonTint.violet.color, text: "12 tools used · 4m")
            }
        }
    }

    private func row(icon: String, tint: Color, text: String) -> some View {
        HStack(spacing: HudsonSpacing.md) {
            Image(systemName: icon)
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(tint)
                .frame(width: 14)
            Text(text)
                .font(HudsonFont.mono(11))
                .foregroundStyle(HudsonPalette.ink)
        }
    }
}

struct TerminalPanel: View {
    var body: some View {
        OverflowPanel(label: "Terminal · iTerm", trailing: "laptop.local") {
            VStack(alignment: .leading, spacing: 2) {
                line("~", "~/dev/lattices", primaryDim: false)
                line("$", "swift build -c release", primaryDim: false)
                Text("Compiling DeckKit…")
                    .font(HudsonFont.mono(10))
                    .foregroundStyle(HudsonPalette.muted)
                Text("Compiling Sources…")
                    .font(HudsonFont.mono(10))
                    .foregroundStyle(HudsonPalette.muted)
                HStack(spacing: HudsonSpacing.xs) {
                    Text("$")
                        .font(HudsonFont.mono(11, weight: .semibold))
                        .foregroundStyle(HudsonPalette.statusOk)
                    Rectangle()
                        .fill(HudsonPalette.statusOk)
                        .frame(width: 7, height: 13)
                }
            }
        }
    }

    private func line(_ glyph: String, _ text: String, primaryDim: Bool) -> some View {
        HStack(spacing: HudsonSpacing.xs) {
            Text(glyph)
                .font(HudsonFont.mono(11))
                .foregroundStyle(HudsonPalette.muted)
            Text(text)
                .font(HudsonFont.mono(11))
                .foregroundStyle(HudsonPalette.ink)
        }
    }
}

struct CalendarPanel: View {
    var body: some View {
        OverflowPanel(label: "Calendar", trailing: "today") {
            VStack(alignment: .leading, spacing: HudsonSpacing.sm) {
                event(time: "3:00pm", title: "standup",      dot: true)
                event(time: "4:30pm", title: "design review", dot: false)
                event(time: "6:00pm", title: "gym",            dot: false)
            }
        }
    }

    private func event(time: String, title: String, dot: Bool) -> some View {
        HStack(spacing: HudsonSpacing.md) {
            Text(time)
                .font(HudsonFont.mono(10))
                .foregroundStyle(HudsonPalette.dim)
                .frame(width: 56, alignment: .leading)
            Text(title)
                .font(HudsonFont.mono(11))
                .foregroundStyle(HudsonPalette.ink)
            Spacer(minLength: 0)
            if dot {
                Circle()
                    .fill(HudsonPalette.statusInfo)
                    .frame(width: 5, height: 5)
            }
        }
    }
}

private struct OverflowPanel<Content: View>: View {
    let label: String
    let trailing: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        HudsonCard(padding: 0) {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    HudsonSectionLabel(label, tint: HudsonTint.amber.color)
                    Spacer()
                    Text(trailing)
                        .font(HudsonFont.mono(9))
                        .tracking(0.8)
                        .foregroundStyle(HudsonPalette.dim)
                }
                .padding(.horizontal, HudsonSpacing.xl)
                .padding(.vertical, HudsonSpacing.md)
                .background(Color.white.opacity(0.02))

                HudsonDivider()

                content()
                    .padding(HudsonSpacing.xl)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}

// MARK: - Bottom chrome

struct DashboardBottomChrome: View {
    @Environment(\.hudsonAppManifest) private var manifest

    var body: some View {
        VStack(spacing: 0) {
            HudsonDivider(color: HudsonHairline.standard)
            cloudRow
            HudsonDivider(color: HudsonHairline.standard)
            statusRow
        }
        .background(Color.black.opacity(0.35))
    }

    private var cloudRow: some View {
        HStack(spacing: HudsonSpacing.md) {
            Image(systemName: "cloud")
                .font(.system(size: 11))
                .foregroundStyle(HudsonPalette.muted)
            Text("CLOUD").font(HudsonFont.mono(9, weight: .semibold)).tracking(0.8).foregroundStyle(HudsonPalette.muted)
            sep
            HudsonStatusDot(color: HudsonPalette.statusOk, size: 5)
            Text("2 \(manifest.targetLabel.lowercased())s")
                .font(HudsonFont.mono(10))
                .foregroundStyle(HudsonPalette.ink)
            sep
            HudsonStatusDot(color: HudsonTint.amber.color, size: 5)
            Text("1 builds queued")
                .font(HudsonFont.mono(10))
                .foregroundStyle(HudsonPalette.ink)
            sep
            Text("deploy 4m ago")
                .font(HudsonFont.mono(10))
                .foregroundStyle(HudsonPalette.muted)
            Spacer()
            Image(systemName: "chevron.up")
                .font(.system(size: 10))
                .foregroundStyle(HudsonPalette.muted)
        }
        .padding(.horizontal, HudsonSpacing.xl)
        .padding(.vertical, HudsonSpacing.md)
    }

    private var statusRow: some View {
        HStack(spacing: HudsonSpacing.md) {
            HudsonStatusDot(color: HudsonPalette.statusOk, size: 6, pulses: true)
            Text("READY")
                .font(HudsonFont.mono(9, weight: .bold))
                .tracking(1.0)
                .foregroundStyle(HudsonPalette.statusOk)
            sep
            Text("hold-space")
                .font(HudsonFont.mono(10))
                .foregroundStyle(HudsonPalette.muted)
            sep
            Text("air ← home")
                .font(HudsonFont.mono(10))
                .foregroundStyle(HudsonPalette.ink)
            sep
            Text("19w · 1/7 · cpu 51% · mem 98% · 45°")
                .font(HudsonFont.mono(10))
                .foregroundStyle(HudsonPalette.muted)
            Spacer()
            HudsonStatusDot(color: HudsonPalette.statusOk, size: 5)
            Text("agent ready")
                .font(HudsonFont.mono(10))
                .foregroundStyle(HudsonPalette.ink)
            sep
            Text("claude · \(manifest.name) · v\(manifest.version)")
                .font(HudsonFont.mono(10))
                .foregroundStyle(HudsonPalette.muted)
        }
        .padding(.horizontal, HudsonSpacing.xl)
        .frame(height: 28)
    }

    private var sep: some View {
        Text("·")
            .font(HudsonFont.mono(10))
            .foregroundStyle(HudsonPalette.dim)
    }
}
