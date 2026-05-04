import SwiftUI
import HudsonUI

// MARK: - Fleet top bar

struct FleetTopBar: View {
    @Environment(\.hudsonAppManifest) private var manifest
    let targets: [TargetMock]

    var body: some View {
        HStack(spacing: HudSpacing.xl) {
            HStack(spacing: HudSpacing.lg) {
                Text(manifest.name.uppercased())
                    .font(HudFont.mono(11, weight: .bold))
                    .tracking(1.5)
                    .foregroundStyle(HudPalette.ink)
                Text("·").foregroundStyle(HudPalette.dim)
                Text("home")
                    .font(HudFont.mono(11))
                    .tracking(1)
                    .foregroundStyle(HudPalette.muted)
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: HudSpacing.md) {
                    ForEach(targets) { FleetPill(target: $0) }
                }
            }

            Spacer(minLength: HudSpacing.md)

            HudBadge("2 \(manifest.targetLabel.uppercased())S", tint: manifest.accent, dot: true)
            Image(systemName: "chevron.down")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(HudPalette.muted)
            Image(systemName: "gearshape")
                .font(.system(size: 14))
                .foregroundStyle(HudPalette.muted)
        }
        .padding(.horizontal, HudSpacing.xxl)
        .frame(height: HudLayout.navHeight)
        .background(HudPalette.chrome)
    }
}

private struct FleetPill: View {
    let target: TargetMock
    var body: some View {
        HStack(spacing: 5) {
            Circle().fill(target.statusColor).frame(width: 5, height: 5)
            Text(target.name)
                .font(HudFont.mono(10, weight: .semibold))
                .foregroundStyle(target.statusLabel == "OFFLINE" ? HudPalette.dim : HudPalette.ink)
        }
        .padding(.horizontal, HudSpacing.md)
        .padding(.vertical, 4)
        .background(RoundedRectangle(cornerRadius: HudRadius.tight).fill(target.statusColor.opacity(0.12)))
        .overlay(RoundedRectangle(cornerRadius: HudRadius.tight).stroke(target.statusColor.opacity(0.35), lineWidth: 1))
    }
}

// MARK: - Target card

struct TargetCard: View {
    let target: TargetMock
    var onTap: (() -> Void)?

    @State private var isHovering = false

    var body: some View {
        Button(action: { onTap?() }) {
            HudCard(stroke: isHovering ? target.iconTint.color.opacity(0.45) : HudHairline.standard) {
                VStack(alignment: .leading, spacing: HudSpacing.lg) {
                    header
                    if let scene = target.scene { sceneRow(scene) }
                    if target.focusApp != nil || target.lastAction != nil { focusBlock }
                    Spacer(minLength: HudSpacing.md)
                    HudDivider()
                    agentRow
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(onTap == nil)
        .frame(maxHeight: .infinity, alignment: .top)
        #if os(macOS)
        .onHover { isHovering = $0 }
        #endif
    }

    private var header: some View {
        HStack(spacing: HudSpacing.lg) {
            Image(systemName: target.icon)
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(target.iconTint.color)
                .frame(width: 40, height: 32)
                .background(RoundedRectangle(cornerRadius: HudRadius.standard).fill(target.iconTint.color.opacity(0.15)))
                .overlay(RoundedRectangle(cornerRadius: HudRadius.standard).stroke(target.iconTint.color.opacity(0.28), lineWidth: 1))
            VStack(alignment: .leading, spacing: 2) {
                Text(target.name)
                    .font(HudFont.mono(13, weight: .semibold))
                    .foregroundStyle(HudPalette.ink)
                Text(target.host)
                    .font(HudFont.mono(10))
                    .foregroundStyle(HudPalette.muted)
            }
            Spacer(minLength: 0)
            VStack(alignment: .trailing, spacing: HudSpacing.xs) {
                HStack(spacing: HudSpacing.xs) {
                    if let count = target.badgeCount {
                        HudBadge(String(count), tint: HudPalette.muted)
                    }
                    HudBadge(target.statusLabel, tint: target.statusColor, dot: true)
                }
                if let latency = target.latency {
                    Text(latency)
                        .font(HudFont.mono(9))
                        .foregroundStyle(HudPalette.dim)
                }
            }
        }
    }

    private func sceneRow(_ scene: String) -> some View {
        HStack(spacing: HudSpacing.md) {
            Image(systemName: "rectangle.grid.2x2")
                .font(.system(size: 10))
                .foregroundStyle(HudPalette.muted)
            Text(scene)
                .font(HudFont.ui(12))
                .foregroundStyle(HudPalette.ink)
        }
    }

    private var focusBlock: some View {
        VStack(spacing: HudSpacing.sm) {
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
        HStack(spacing: HudSpacing.md) {
            Text(key.uppercased())
                .font(HudFont.mono(9))
                .tracking(0.8)
                .foregroundStyle(HudPalette.dim)
                .frame(width: 36, alignment: .leading)
            Text(primary)
                .font(HudFont.mono(11, weight: .semibold))
                .foregroundStyle(HudPalette.ink)
            if let secondary {
                Text("·").foregroundStyle(HudPalette.dim)
                Text(secondary)
                    .font(HudFont.mono(11))
                    .foregroundStyle(HudPalette.muted)
            }
            Spacer(minLength: 0)
        }
    }

    private var agentRow: some View {
        HStack(spacing: HudSpacing.md) {
            Text("AGENT")
                .font(HudFont.mono(9))
                .tracking(0.8)
                .foregroundStyle(HudPalette.dim)
                .frame(width: 36, alignment: .leading)
            HudStatusDot(color: target.agentTint.color, size: 6, pulses: target.agentStatus == "running")
            Text(target.agentStatus)
                .font(HudFont.mono(11, weight: .semibold))
                .foregroundStyle(HudPalette.ink)
            if let activity = target.agentActivity {
                Text("·").foregroundStyle(HudPalette.dim)
                Text(activity)
                    .font(HudFont.mono(11))
                    .foregroundStyle(HudPalette.muted)
            }
            Spacer(minLength: 0)
            Image(systemName: "arrow.up.right")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(HudPalette.muted)
        }
    }
}

// MARK: - Overflow panels

struct AgentPanel: View {
    var body: some View {
        OverflowPanel(label: "Agent · Claude", trailing: "3 evt") {
            VStack(alignment: .leading, spacing: HudSpacing.md) {
                row(icon: "checkmark", tint: HudPalette.statusOk, text: "designed home arch")
                row(icon: "square.and.pencil", tint: HudTint.amber.color, text: "writing tile spec")
                row(icon: "circle.fill", tint: HudTint.violet.color, text: "12 tools used · 4m")
            }
        }
    }

    private func row(icon: String, tint: Color, text: String) -> some View {
        HStack(spacing: HudSpacing.md) {
            Image(systemName: icon)
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(tint)
                .frame(width: 14)
            Text(text)
                .font(HudFont.mono(11))
                .foregroundStyle(HudPalette.ink)
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
                    .font(HudFont.mono(10))
                    .foregroundStyle(HudPalette.muted)
                Text("Compiling Sources…")
                    .font(HudFont.mono(10))
                    .foregroundStyle(HudPalette.muted)
                HStack(spacing: HudSpacing.xs) {
                    Text("$")
                        .font(HudFont.mono(11, weight: .semibold))
                        .foregroundStyle(HudPalette.statusOk)
                    Rectangle()
                        .fill(HudPalette.statusOk)
                        .frame(width: 7, height: 13)
                }
            }
        }
    }

    private func line(_ glyph: String, _ text: String, primaryDim: Bool) -> some View {
        HStack(spacing: HudSpacing.xs) {
            Text(glyph)
                .font(HudFont.mono(11))
                .foregroundStyle(HudPalette.muted)
            Text(text)
                .font(HudFont.mono(11))
                .foregroundStyle(HudPalette.ink)
        }
    }
}

struct CalendarPanel: View {
    var body: some View {
        OverflowPanel(label: "Calendar", trailing: "today") {
            VStack(alignment: .leading, spacing: HudSpacing.sm) {
                event(time: "3:00pm", title: "standup",      dot: true)
                event(time: "4:30pm", title: "design review", dot: false)
                event(time: "6:00pm", title: "gym",            dot: false)
            }
        }
    }

    private func event(time: String, title: String, dot: Bool) -> some View {
        HStack(spacing: HudSpacing.md) {
            Text(time)
                .font(HudFont.mono(10))
                .foregroundStyle(HudPalette.dim)
                .frame(width: 56, alignment: .leading)
            Text(title)
                .font(HudFont.mono(11))
                .foregroundStyle(HudPalette.ink)
            Spacer(minLength: 0)
            if dot {
                Circle()
                    .fill(HudPalette.statusInfo)
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
        HudCard(padding: 0) {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    HudSectionLabel(label, tint: HudTint.amber.color)
                    Spacer()
                    Text(trailing)
                        .font(HudFont.mono(9))
                        .tracking(0.8)
                        .foregroundStyle(HudPalette.dim)
                }
                .padding(.horizontal, HudSpacing.xl)
                .frame(height: 32)
                .background(Color.white.opacity(0.02))

                HudDivider()

                content()
                    .padding(HudSpacing.xl)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
        }
        .frame(maxHeight: .infinity, alignment: .top)
    }
}

// MARK: - Bottom chrome

struct DashboardBottomChrome: View {
    @Environment(\.hudsonAppManifest) private var manifest

    var body: some View {
        VStack(spacing: 0) {
            HudDivider(color: HudHairline.standard)
            cloudRow
            HudDivider(color: HudHairline.standard)
            statusRow
        }
        .background(HudPalette.chrome)
    }

    private var cloudRow: some View {
        HStack(spacing: HudSpacing.md) {
            Image(systemName: "cloud")
                .font(.system(size: 11))
                .foregroundStyle(HudPalette.muted)
            Text("CLOUD").font(HudFont.mono(9, weight: .semibold)).tracking(0.8).foregroundStyle(HudPalette.muted)
            sep
            HudStatusDot(color: HudPalette.statusOk, size: 5)
            Text("2 \(manifest.targetLabel.lowercased())s")
                .font(HudFont.mono(10))
                .foregroundStyle(HudPalette.ink)
            sep
            HudStatusDot(color: HudTint.amber.color, size: 5)
            Text("1 builds queued")
                .font(HudFont.mono(10))
                .foregroundStyle(HudPalette.ink)
            sep
            Text("deploy 4m ago")
                .font(HudFont.mono(10))
                .foregroundStyle(HudPalette.muted)
            Spacer()
            Image(systemName: "chevron.up")
                .font(.system(size: 10))
                .foregroundStyle(HudPalette.muted)
        }
        .padding(.horizontal, HudSpacing.xl)
        .frame(height: HudLayout.statusBarHeight)
    }

    private var statusRow: some View {
        HStack(spacing: HudSpacing.md) {
            HudStatusDot(color: HudPalette.statusOk, size: 6, pulses: true)
            Text("READY")
                .font(HudFont.mono(9, weight: .bold))
                .tracking(1.0)
                .foregroundStyle(HudPalette.statusOk)
            sep
            Text("hold-space")
                .font(HudFont.mono(10))
                .foregroundStyle(HudPalette.muted)
            sep
            Text("air ← home")
                .font(HudFont.mono(10))
                .foregroundStyle(HudPalette.ink)
            sep
            Text("19w · 1/7 · cpu 51% · mem 98% · 45°")
                .font(HudFont.mono(10))
                .foregroundStyle(HudPalette.muted)
            Spacer()
            HudStatusDot(color: HudPalette.statusOk, size: 5)
            Text("agent ready")
                .font(HudFont.mono(10))
                .foregroundStyle(HudPalette.ink)
            sep
            Text("claude · \(manifest.name) · v\(manifest.version)")
                .font(HudFont.mono(10))
                .foregroundStyle(HudPalette.muted)
        }
        .padding(.horizontal, HudSpacing.xl)
        .frame(height: 28)
    }

    private var sep: some View {
        Text("·")
            .font(HudFont.mono(10))
            .foregroundStyle(HudPalette.dim)
    }
}
