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
                    .font(HudFont.mono(HudTextSize.xs, weight: .bold))
                    .tracking(1.5)
                    .foregroundStyle(HudPalette.ink)
                Text("·").foregroundStyle(HudPalette.dim)
                Text("home")
                    .font(HudFont.mono(HudTextSize.xs))
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
                .font(HudFont.ui(HudTextSize.xs, weight: .semibold))
                .foregroundStyle(HudPalette.muted)
            Image(systemName: "gearshape")
                .font(HudFont.ui(HudTextSize.md))
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
            Circle().fill(target.statusColor).frame(width: HudDotSize.tiny, height: HudDotSize.tiny)
            Text(target.name)
                .font(HudFont.mono(HudTextSize.xxs, weight: .semibold))
                .foregroundStyle(target.statusLabel == "OFFLINE" ? HudPalette.dim : HudPalette.ink)
        }
        .padding(.horizontal, HudSpacing.md)
        .padding(.vertical, HudSpacing.xs)
        .background(RoundedRectangle(cornerRadius: HudRadius.tight).fill(HudSurface.tintFill(target.statusColor)))
        .overlay(RoundedRectangle(cornerRadius: HudRadius.tight).stroke(HudSurface.tintBorder(target.statusColor), lineWidth: HudStrokeWidth.standard))
    }
}

// MARK: - Target card

struct TargetCard: View {
    let target: TargetMock
    var onTap: (() -> Void)?

    @State private var isHovering = false

    var body: some View {
        Button(action: { onTap?() }) {
            HudCard(stroke: isHovering ? HudSurface.tintMuted(target.iconTint.color) : HudHairline.standard) {
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
                .font(HudFont.ui(HudTextSize.lg, weight: .medium))
                .foregroundStyle(target.iconTint.color)
                // Header icon chip — non-square aspect tuned for the target card.
                // hudlint:disable next-line geometry
                .frame(width: 40, height: 32)
                .background(RoundedRectangle(cornerRadius: HudRadius.standard).fill(HudSurface.tintFill(target.iconTint.color)))
                .overlay(RoundedRectangle(cornerRadius: HudRadius.standard).stroke(HudSurface.tintBorder(target.iconTint.color), lineWidth: 1))
            VStack(alignment: .leading, spacing: 2) {
                Text(target.name)
                    .font(HudFont.mono(HudTextSize.base, weight: .semibold))
                    .foregroundStyle(HudPalette.ink)
                Text(target.host)
                    .font(HudFont.mono(HudTextSize.xxs))
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
                        .font(HudFont.mono(HudTextSize.micro))
                        .foregroundStyle(HudPalette.dim)
                }
            }
        }
    }

    private func sceneRow(_ scene: String) -> some View {
        HStack(spacing: HudSpacing.md) {
            Image(systemName: "rectangle.grid.2x2")
                .font(HudFont.ui(HudTextSize.xxs))
                .foregroundStyle(HudPalette.muted)
            Text(scene)
                .font(HudFont.ui(HudTextSize.sm))
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
                .font(HudFont.mono(HudTextSize.micro))
                .tracking(0.8)
                .foregroundStyle(HudPalette.dim)
                // Key-label gutter — fixed width for column alignment.
                // hudlint:disable next-line geometry
                .frame(width: 36, alignment: .leading)
            Text(primary)
                .font(HudFont.mono(HudTextSize.xs, weight: .semibold))
                .foregroundStyle(HudPalette.ink)
            if let secondary {
                Text("·").foregroundStyle(HudPalette.dim)
                Text(secondary)
                    .font(HudFont.mono(HudTextSize.xs))
                    .foregroundStyle(HudPalette.muted)
            }
            Spacer(minLength: 0)
        }
    }

    private var agentRow: some View {
        HStack(spacing: HudSpacing.md) {
            Text("AGENT")
                .font(HudFont.mono(HudTextSize.micro))
                .tracking(0.8)
                .foregroundStyle(HudPalette.dim)
                // Agent label gutter — fixed width for column alignment.
                // hudlint:disable next-line geometry
                .frame(width: 36, alignment: .leading)
            HudStatusDot(color: target.agentTint.color, size: 6, pulses: target.agentStatus == "running")
            Text(target.agentStatus)
                .font(HudFont.mono(HudTextSize.xs, weight: .semibold))
                .foregroundStyle(HudPalette.ink)
            if let activity = target.agentActivity {
                Text("·").foregroundStyle(HudPalette.dim)
                Text(activity)
                    .font(HudFont.mono(HudTextSize.xs))
                    .foregroundStyle(HudPalette.muted)
            }
            Spacer(minLength: 0)
            Image(systemName: "arrow.up.right")
                .font(HudFont.ui(HudTextSize.xxs, weight: .semibold))
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
                .font(HudFont.ui(HudTextSize.micro, weight: .semibold))
                .foregroundStyle(tint)
                // Compact glyph column.
                // hudlint:disable next-line geometry
                .frame(width: 14)
            Text(text)
                .font(HudFont.mono(HudTextSize.xs))
                .foregroundStyle(HudPalette.ink)
        }
    }
}

struct TerminalPanel: View {
    var body: some View {
        OverflowPanel(label: "Terminal · iTerm", trailing: "laptop.local") {
            VStack(alignment: .leading, spacing: 2) {
                line("~", DemoManifest.workspacePath, primaryDim: false)
                line("$", "swift build -c release", primaryDim: false)
                Text("Compiling DeckKit…")
                    .font(HudFont.mono(HudTextSize.xxs))
                    .foregroundStyle(HudPalette.muted)
                Text("Compiling Sources…")
                    .font(HudFont.mono(HudTextSize.xxs))
                    .foregroundStyle(HudPalette.muted)
                HStack(spacing: HudSpacing.xs) {
                    Text("$")
                        .font(HudFont.mono(HudTextSize.xs, weight: .semibold))
                        .foregroundStyle(HudPalette.statusOk)
                    Rectangle()
                        .fill(HudPalette.statusOk)
                        // Mono character cell preview — tied to monospace font metrics.
                        // hudlint:disable next-line geometry
                        .frame(width: 7, height: 13)
                }
            }
        }
    }

    private func line(_ glyph: String, _ text: String, primaryDim: Bool) -> some View {
        HStack(spacing: HudSpacing.xs) {
            Text(glyph)
                .font(HudFont.mono(HudTextSize.xs))
                .foregroundStyle(HudPalette.muted)
            Text(text)
                .font(HudFont.mono(HudTextSize.xs))
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
                .font(HudFont.mono(HudTextSize.xxs))
                .foregroundStyle(HudPalette.dim)
                // Timestamp gutter — fixed width for column alignment.
                // hudlint:disable next-line geometry
                .frame(width: 56, alignment: .leading)
            Text(title)
                .font(HudFont.mono(HudTextSize.xs))
                .foregroundStyle(HudPalette.ink)
            Spacer(minLength: 0)
            if dot {
                Circle()
                    .fill(HudPalette.statusInfo)
                    .frame(width: HudDotSize.tiny, height: HudDotSize.tiny)
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
                        .font(HudFont.mono(HudTextSize.micro))
                        .tracking(0.8)
                        .foregroundStyle(HudPalette.dim)
                }
                .padding(.horizontal, HudSpacing.xl)
                .frame(height: HudLayout.buttonHeight)
                .background(HudSurface.inset)

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
            statusRow
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(HudPalette.chrome)
    }

    private var statusRow: some View {
        HStack(spacing: HudSpacing.md) {
            HudStatusDot(color: HudPalette.statusOk, size: 6, pulses: true)
            Text("READY")
                .font(HudFont.mono(HudTextSize.micro, weight: .bold))
                .tracking(1.0)
                .foregroundStyle(HudPalette.statusOk)
            sep
            Text("hold-space")
                .font(HudFont.mono(HudTextSize.xxs))
                .foregroundStyle(HudPalette.muted)
            sep
            Text("air ← home")
                .font(HudFont.mono(HudTextSize.xxs))
                .foregroundStyle(HudPalette.ink)
            sep
            Text("19w · 1/7 · cpu 51% · mem 98% · 45°")
                .font(HudFont.mono(HudTextSize.xxs))
                .foregroundStyle(HudPalette.muted)
            Spacer()
            HudStatusDot(color: HudPalette.statusOk, size: 5)
            Text("agent ready")
                .font(HudFont.mono(HudTextSize.xxs))
                .foregroundStyle(HudPalette.ink)
            sep
            Text("claude · \(manifest.name) · v\(manifest.version)")
                .font(HudFont.mono(HudTextSize.xxs))
                .foregroundStyle(HudPalette.muted)
        }
        .padding(.horizontal, HudSpacing.xl)
        .frame(height: HudIconSize.medium)
    }

    private var sep: some View {
        Text("·")
            .font(HudFont.mono(HudTextSize.xxs))
            .foregroundStyle(HudPalette.dim)
    }
}
