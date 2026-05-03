import SwiftUI
import HudsonUI

// MARK: - Fleet top bar

struct FleetTopBar: View {
    @Environment(\.hudsonAppManifest) private var manifest
    let targets: [TargetMock]

    var body: some View {
        HStack(spacing: HSpacing.xl) {
            HStack(spacing: HSpacing.lg) {
                Text(manifest.name.uppercased())
                    .font(HFont.mono(11, weight: .bold))
                    .tracking(1.5)
                    .foregroundStyle(HPalette.ink)
                Text("·").foregroundStyle(HPalette.dim)
                Text("home")
                    .font(HFont.mono(11))
                    .tracking(1)
                    .foregroundStyle(HPalette.muted)
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: HSpacing.md) {
                    ForEach(targets) { FleetPill(target: $0) }
                }
            }

            Spacer(minLength: HSpacing.md)

            HBadge("2 \(manifest.targetLabel.uppercased())S", tint: manifest.accent, dot: true)
            Image(systemName: "chevron.down")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(HPalette.muted)
            Image(systemName: "gearshape")
                .font(.system(size: 14))
                .foregroundStyle(HPalette.muted)
        }
        .padding(.horizontal, HSpacing.xxl)
        .frame(height: HLayout.navHeight)
        .background(HPalette.chrome)
    }
}

private struct FleetPill: View {
    let target: TargetMock
    var body: some View {
        HStack(spacing: 5) {
            Circle().fill(target.statusColor).frame(width: 5, height: 5)
            Text(target.name)
                .font(HFont.mono(10, weight: .semibold))
                .foregroundStyle(target.statusLabel == "OFFLINE" ? HPalette.dim : HPalette.ink)
        }
        .padding(.horizontal, HSpacing.md)
        .padding(.vertical, 4)
        .background(RoundedRectangle(cornerRadius: HRadius.tight).fill(target.statusColor.opacity(0.12)))
        .overlay(RoundedRectangle(cornerRadius: HRadius.tight).stroke(target.statusColor.opacity(0.35), lineWidth: 1))
    }
}

// MARK: - Target card

struct TargetCard: View {
    let target: TargetMock
    var onTap: (() -> Void)?

    @State private var isHovering = false

    var body: some View {
        Button(action: { onTap?() }) {
            HCard(stroke: isHovering ? target.iconTint.color.opacity(0.45) : HHairline.standard) {
                VStack(alignment: .leading, spacing: HSpacing.lg) {
                    header
                    if let scene = target.scene { sceneRow(scene) }
                    if target.focusApp != nil || target.lastAction != nil { focusBlock }
                    Spacer(minLength: HSpacing.md)
                    HDivider()
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
        HStack(spacing: HSpacing.lg) {
            Image(systemName: target.icon)
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(target.iconTint.color)
                .frame(width: 40, height: 32)
                .background(RoundedRectangle(cornerRadius: HRadius.standard).fill(target.iconTint.color.opacity(0.15)))
                .overlay(RoundedRectangle(cornerRadius: HRadius.standard).stroke(target.iconTint.color.opacity(0.28), lineWidth: 1))
            VStack(alignment: .leading, spacing: 2) {
                Text(target.name)
                    .font(HFont.mono(13, weight: .semibold))
                    .foregroundStyle(HPalette.ink)
                Text(target.host)
                    .font(HFont.mono(10))
                    .foregroundStyle(HPalette.muted)
            }
            Spacer(minLength: 0)
            VStack(alignment: .trailing, spacing: HSpacing.xs) {
                HStack(spacing: HSpacing.xs) {
                    if let count = target.badgeCount {
                        HBadge(String(count), tint: HPalette.muted)
                    }
                    HBadge(target.statusLabel, tint: target.statusColor, dot: true)
                }
                if let latency = target.latency {
                    Text(latency)
                        .font(HFont.mono(9))
                        .foregroundStyle(HPalette.dim)
                }
            }
        }
    }

    private func sceneRow(_ scene: String) -> some View {
        HStack(spacing: HSpacing.md) {
            Image(systemName: "rectangle.grid.2x2")
                .font(.system(size: 10))
                .foregroundStyle(HPalette.muted)
            Text(scene)
                .font(HFont.ui(12))
                .foregroundStyle(HPalette.ink)
        }
    }

    private var focusBlock: some View {
        VStack(spacing: HSpacing.sm) {
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
        HStack(spacing: HSpacing.md) {
            Text(key.uppercased())
                .font(HFont.mono(9))
                .tracking(0.8)
                .foregroundStyle(HPalette.dim)
                .frame(width: 36, alignment: .leading)
            Text(primary)
                .font(HFont.mono(11, weight: .semibold))
                .foregroundStyle(HPalette.ink)
            if let secondary {
                Text("·").foregroundStyle(HPalette.dim)
                Text(secondary)
                    .font(HFont.mono(11))
                    .foregroundStyle(HPalette.muted)
            }
            Spacer(minLength: 0)
        }
    }

    private var agentRow: some View {
        HStack(spacing: HSpacing.md) {
            Text("AGENT")
                .font(HFont.mono(9))
                .tracking(0.8)
                .foregroundStyle(HPalette.dim)
                .frame(width: 36, alignment: .leading)
            HStatusDot(color: target.agentTint.color, size: 6, pulses: target.agentStatus == "running")
            Text(target.agentStatus)
                .font(HFont.mono(11, weight: .semibold))
                .foregroundStyle(HPalette.ink)
            if let activity = target.agentActivity {
                Text("·").foregroundStyle(HPalette.dim)
                Text(activity)
                    .font(HFont.mono(11))
                    .foregroundStyle(HPalette.muted)
            }
            Spacer(minLength: 0)
            Image(systemName: "arrow.up.right")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(HPalette.muted)
        }
    }
}

// MARK: - Overflow panels

struct AgentPanel: View {
    var body: some View {
        OverflowPanel(label: "Agent · Claude", trailing: "3 evt") {
            VStack(alignment: .leading, spacing: HSpacing.md) {
                row(icon: "checkmark", tint: HPalette.statusOk, text: "designed home arch")
                row(icon: "square.and.pencil", tint: HTint.amber.color, text: "writing tile spec")
                row(icon: "circle.fill", tint: HTint.violet.color, text: "12 tools used · 4m")
            }
        }
    }

    private func row(icon: String, tint: Color, text: String) -> some View {
        HStack(spacing: HSpacing.md) {
            Image(systemName: icon)
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(tint)
                .frame(width: 14)
            Text(text)
                .font(HFont.mono(11))
                .foregroundStyle(HPalette.ink)
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
                    .font(HFont.mono(10))
                    .foregroundStyle(HPalette.muted)
                Text("Compiling Sources…")
                    .font(HFont.mono(10))
                    .foregroundStyle(HPalette.muted)
                HStack(spacing: HSpacing.xs) {
                    Text("$")
                        .font(HFont.mono(11, weight: .semibold))
                        .foregroundStyle(HPalette.statusOk)
                    Rectangle()
                        .fill(HPalette.statusOk)
                        .frame(width: 7, height: 13)
                }
            }
        }
    }

    private func line(_ glyph: String, _ text: String, primaryDim: Bool) -> some View {
        HStack(spacing: HSpacing.xs) {
            Text(glyph)
                .font(HFont.mono(11))
                .foregroundStyle(HPalette.muted)
            Text(text)
                .font(HFont.mono(11))
                .foregroundStyle(HPalette.ink)
        }
    }
}

struct CalendarPanel: View {
    var body: some View {
        OverflowPanel(label: "Calendar", trailing: "today") {
            VStack(alignment: .leading, spacing: HSpacing.sm) {
                event(time: "3:00pm", title: "standup",      dot: true)
                event(time: "4:30pm", title: "design review", dot: false)
                event(time: "6:00pm", title: "gym",            dot: false)
            }
        }
    }

    private func event(time: String, title: String, dot: Bool) -> some View {
        HStack(spacing: HSpacing.md) {
            Text(time)
                .font(HFont.mono(10))
                .foregroundStyle(HPalette.dim)
                .frame(width: 56, alignment: .leading)
            Text(title)
                .font(HFont.mono(11))
                .foregroundStyle(HPalette.ink)
            Spacer(minLength: 0)
            if dot {
                Circle()
                    .fill(HPalette.statusInfo)
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
        HCard(padding: 0) {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    HSectionLabel(label, tint: HTint.amber.color)
                    Spacer()
                    Text(trailing)
                        .font(HFont.mono(9))
                        .tracking(0.8)
                        .foregroundStyle(HPalette.dim)
                }
                .padding(.horizontal, HSpacing.xl)
                .frame(height: 32)
                .background(Color.white.opacity(0.02))

                HDivider()

                content()
                    .padding(HSpacing.xl)
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
            HDivider(color: HHairline.standard)
            cloudRow
            HDivider(color: HHairline.standard)
            statusRow
        }
        .background(HPalette.chrome)
    }

    private var cloudRow: some View {
        HStack(spacing: HSpacing.md) {
            Image(systemName: "cloud")
                .font(.system(size: 11))
                .foregroundStyle(HPalette.muted)
            Text("CLOUD").font(HFont.mono(9, weight: .semibold)).tracking(0.8).foregroundStyle(HPalette.muted)
            sep
            HStatusDot(color: HPalette.statusOk, size: 5)
            Text("2 \(manifest.targetLabel.lowercased())s")
                .font(HFont.mono(10))
                .foregroundStyle(HPalette.ink)
            sep
            HStatusDot(color: HTint.amber.color, size: 5)
            Text("1 builds queued")
                .font(HFont.mono(10))
                .foregroundStyle(HPalette.ink)
            sep
            Text("deploy 4m ago")
                .font(HFont.mono(10))
                .foregroundStyle(HPalette.muted)
            Spacer()
            Image(systemName: "chevron.up")
                .font(.system(size: 10))
                .foregroundStyle(HPalette.muted)
        }
        .padding(.horizontal, HSpacing.xl)
        .frame(height: HLayout.statusBarHeight)
    }

    private var statusRow: some View {
        HStack(spacing: HSpacing.md) {
            HStatusDot(color: HPalette.statusOk, size: 6, pulses: true)
            Text("READY")
                .font(HFont.mono(9, weight: .bold))
                .tracking(1.0)
                .foregroundStyle(HPalette.statusOk)
            sep
            Text("hold-space")
                .font(HFont.mono(10))
                .foregroundStyle(HPalette.muted)
            sep
            Text("air ← home")
                .font(HFont.mono(10))
                .foregroundStyle(HPalette.ink)
            sep
            Text("19w · 1/7 · cpu 51% · mem 98% · 45°")
                .font(HFont.mono(10))
                .foregroundStyle(HPalette.muted)
            Spacer()
            HStatusDot(color: HPalette.statusOk, size: 5)
            Text("agent ready")
                .font(HFont.mono(10))
                .foregroundStyle(HPalette.ink)
            sep
            Text("claude · \(manifest.name) · v\(manifest.version)")
                .font(HFont.mono(10))
                .foregroundStyle(HPalette.muted)
        }
        .padding(.horizontal, HSpacing.xl)
        .frame(height: 28)
    }

    private var sep: some View {
        Text("·")
            .font(HFont.mono(10))
            .foregroundStyle(HPalette.dim)
    }
}
