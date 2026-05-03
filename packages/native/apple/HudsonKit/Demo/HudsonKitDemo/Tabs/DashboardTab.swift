import SwiftUI
import HudsonUI

// MARK: - Mock data

struct TargetMock: Identifiable {
    let id: String
    let name: String
    let host: String
    let icon: String
    let iconTint: HTint
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
    let agentTint: HTint
    let badgeCount: Int?

    static let fleet: [TargetMock] = [
        TargetMock(
            id: "arach-laptop", name: "arach-laptop", host: "laptop.local",
            icon: "laptopcomputer", iconTint: .green,
            latency: "14ms", statusLabel: "ACTIVE", statusColor: HPalette.statusOk,
            scene: "Deep Work",
            focusApp: "VS Code", focusFile: "HomeView.swift",
            lastAction: "regrid layout", lastTime: "2m",
            agentStatus: "running", agentActivity: "writing tile spec",
            agentTint: .green, badgeCount: 3
        ),
        TargetMock(
            id: "arach-mini", name: "arach-mini", host: "mini.local",
            icon: "macmini", iconTint: .amber,
            latency: "8ms", statusLabel: "STANDBY", statusColor: HTint.amber.color,
            scene: "Wind Down",
            focusApp: "Music", focusFile: "Now Playing",
            lastAction: "sync clipboard", lastTime: "12m",
            agentStatus: "idle", agentActivity: nil,
            agentTint: .blue, badgeCount: nil
        ),
        TargetMock(
            id: "arach-studio", name: "arach-studio", host: "studio.local",
            icon: "desktopcomputer", iconTint: .blue,
            latency: "22ms", statusLabel: "ONLINE", statusColor: HPalette.statusInfo,
            scene: "Code Review",
            focusApp: "Cursor", focusFile: "Plan.md",
            lastAction: "scene apply", lastTime: "1m",
            agentStatus: "running", agentActivity: "review pass",
            agentTint: .cyan, badgeCount: 1
        ),
        TargetMock(
            id: "codex-cluster", name: "codex-cluster", host: "remote",
            icon: "server.rack", iconTint: .blue,
            latency: nil, statusLabel: "OFFLINE", statusColor: HPalette.dim,
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
    var onSelectTarget: ((TargetMock) -> Void)? = nil

    var body: some View {
        VStack(spacing: 0) {
            FleetTopBar(targets: targets)
            HDivider(color: HHairline.standard)

            ScrollView {
                VStack(alignment: .leading, spacing: HSpacing.huge) {
                    targetsSection
                    overflowSection
                    attentionSection
                }
                .padding(HSpacing.xxl)
            }

            DashboardBottomChrome()
        }
    }

    // MARK: Targets

    private var targetsSection: some View {
        VStack(alignment: .leading, spacing: HSpacing.xl) {
            HStack {
                HSectionLabel("Targets")
                Spacer()
                HBadge(String(targets.count), tint: HPalette.muted)
            }
            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 280), spacing: HSpacing.xl)],
                spacing: HSpacing.xl
            ) {
                ForEach(targets) { target in
                    TargetCard(
                        target: target,
                        onTap: onSelectTarget.map { handler in { handler(target) } }
                    )
                }
            }
        }
    }

    // MARK: Overflow

    private var overflowSection: some View {
        VStack(alignment: .leading, spacing: HSpacing.xl) {
            HStack {
                HSectionLabel("Overflow · arach-laptop")
                Spacer()
                Text("third monitor · live")
                    .font(HFont.mono(9))
                    .tracking(0.8)
                    .foregroundStyle(HPalette.dim)
            }
            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 240), spacing: HSpacing.xl)],
                alignment: .leading,
                spacing: HSpacing.xl
            ) {
                AgentPanel()
                TerminalPanel()
                CalendarPanel()
            }
        }
    }

    // MARK: Attention

    private var attentionSection: some View {
        VStack(alignment: .leading, spacing: HSpacing.xl) {
            HStack {
                HSectionLabel("Attention", tint: HPalette.statusError)
                Spacer()
                HBadge("3", tint: HPalette.statusError, dot: true)
            }
            HCard {
                HStack(spacing: HSpacing.xl) {
                    HStatusDot(color: HPalette.statusError, pulses: true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("codex-cluster unreachable")
                            .font(HFont.ui(12, weight: .medium))
                            .foregroundStyle(HPalette.ink)
                        Text("last reply 14h ago · check tunnel")
                            .font(HFont.mono(10))
                            .foregroundStyle(HPalette.dim)
                    }
                    Spacer()
                    HBadge("RETRY", tint: HPalette.statusError)
                }
            }
        }
    }
}
