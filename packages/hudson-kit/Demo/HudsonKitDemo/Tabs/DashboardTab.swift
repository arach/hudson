import SwiftUI
import HudsonUI

// MARK: - Mock data

struct TargetMock: Identifiable {
    let id: String
    let name: String
    let host: String
    let icon: String
    let iconTint: HudsonTint
    let latency: String?
    let statusLabel: String
    let statusColor: Color
    let scene: String?
    let focusApp: String?
    let focusFile: String?
    let lastAction: String?
    let lastTime: String?
    let agentStatus: String
    let agentActivity: String?
    let agentTint: HudsonTint
    let badgeCount: Int?

    static let fleet: [TargetMock] = [
        TargetMock(
            id: "arach-laptop", name: "arach-laptop", host: "laptop.local",
            icon: "laptopcomputer", iconTint: .green,
            latency: "14ms", statusLabel: "ACTIVE", statusColor: HudsonPalette.statusOk,
            scene: "Deep Work",
            focusApp: "VS Code", focusFile: "HomeView.swift",
            lastAction: "regrid layout", lastTime: "2m",
            agentStatus: "running", agentActivity: "writing tile spec",
            agentTint: .green, badgeCount: 3
        ),
        TargetMock(
            id: "arach-mini", name: "arach-mini", host: "mini.local",
            icon: "macmini", iconTint: .amber,
            latency: "8ms", statusLabel: "STANDBY", statusColor: HudsonTint.amber.color,
            scene: "Wind Down",
            focusApp: "Music", focusFile: "Now Playing",
            lastAction: "sync clipboard", lastTime: "12m",
            agentStatus: "idle", agentActivity: nil,
            agentTint: .blue, badgeCount: nil
        ),
        TargetMock(
            id: "arach-studio", name: "arach-studio", host: "studio.local",
            icon: "desktopcomputer", iconTint: .blue,
            latency: "22ms", statusLabel: "ONLINE", statusColor: HudsonPalette.statusInfo,
            scene: "Code Review",
            focusApp: "Cursor", focusFile: "Plan.md",
            lastAction: "scene apply", lastTime: "1m",
            agentStatus: "running", agentActivity: "review pass",
            agentTint: .cyan, badgeCount: 1
        ),
        TargetMock(
            id: "codex-cluster", name: "codex-cluster", host: "remote",
            icon: "server.rack", iconTint: .blue,
            latency: nil, statusLabel: "OFFLINE", statusColor: HudsonPalette.dim,
            scene: nil,
            focusApp: nil, focusFile: nil,
            lastAction: nil, lastTime: "yesterday",
            agentStatus: "idle", agentActivity: nil,
            agentTint: .blue, badgeCount: nil
        ),
    ]
}

// MARK: - Tab

struct DashboardTab: View {
    @Environment(\.hudsonAppManifest) private var manifest
    private let targets = TargetMock.fleet

    var body: some View {
        VStack(spacing: 0) {
            FleetTopBar(targets: targets)
            HudsonDivider(color: HudsonHairline.standard)

            ScrollView {
                VStack(alignment: .leading, spacing: HudsonSpacing.huge) {
                    targetsSection
                    overflowSection
                    attentionSection
                }
                .padding(HudsonSpacing.xxl)
            }

            DashboardBottomChrome()
        }
    }

    // MARK: Targets

    private var targetsSection: some View {
        VStack(alignment: .leading, spacing: HudsonSpacing.xl) {
            HStack {
                HudsonSectionLabel("Targets")
                Spacer()
                HudsonBadge(String(targets.count), tint: HudsonPalette.muted)
            }
            LazyVGrid(
                columns: Array(repeating: GridItem(.flexible(), spacing: HudsonSpacing.xl), count: 3),
                spacing: HudsonSpacing.xl
            ) {
                ForEach(targets) { TargetCard(target: $0) }
            }
        }
    }

    // MARK: Overflow

    private var overflowSection: some View {
        VStack(alignment: .leading, spacing: HudsonSpacing.xl) {
            HStack {
                HudsonSectionLabel("Overflow · arach-laptop")
                Spacer()
                Text("third monitor · live")
                    .font(HudsonFont.mono(9))
                    .tracking(0.8)
                    .foregroundStyle(HudsonPalette.dim)
            }
            HStack(alignment: .top, spacing: HudsonSpacing.xl) {
                AgentPanel().frame(maxWidth: .infinity)
                TerminalPanel().frame(maxWidth: .infinity)
                CalendarPanel().frame(maxWidth: .infinity)
            }
        }
    }

    // MARK: Attention

    private var attentionSection: some View {
        VStack(alignment: .leading, spacing: HudsonSpacing.xl) {
            HStack {
                HudsonSectionLabel("Attention", tint: HudsonPalette.statusError)
                Spacer()
                HudsonBadge("3", tint: HudsonPalette.statusError, dot: true)
            }
            HudsonCard {
                HStack(spacing: HudsonSpacing.xl) {
                    HudsonStatusDot(color: HudsonPalette.statusError, pulses: true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("codex-cluster unreachable")
                            .font(HudsonFont.ui(12, weight: .medium))
                            .foregroundStyle(HudsonPalette.ink)
                        Text("last reply 14h ago · check tunnel")
                            .font(HudsonFont.mono(10))
                            .foregroundStyle(HudsonPalette.dim)
                    }
                    Spacer()
                    HudsonBadge("RETRY", tint: HudsonPalette.statusError)
                }
            }
        }
    }
}
