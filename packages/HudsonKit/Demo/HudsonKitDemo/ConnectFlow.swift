import SwiftUI
import HudsonUI

/// Content rendered inside the `HudsonTakeover` when the user hits CONNECT on
/// a target canvas. Plays a short scripted "connecting → connected" sequence
/// to demonstrate the takeover surface; in a real app this would mount the
/// actual terminal session view.
struct ConnectFlow: View {
    let target: TargetMock

    @State private var step: Int = 0
    @State private var connected: Bool = false

    private let script: [(prompt: String, line: String, color: Color)] = [
        ("•", "Resolving \(TargetMock.fleet[0].host)…",            HudsonPalette.muted),
        ("•", "Negotiating ed25519 host key",                       HudsonPalette.muted),
        ("•", "Authenticated as arach@laptop.local",                HudsonPalette.statusOk),
        ("•", "Forwarding agent · scout-bridge attached",           HudsonPalette.muted),
        ("•", "Spawning shell · /bin/zsh",                          HudsonPalette.muted),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: HudsonSpacing.huge) {
                hero
                logCard
                if connected { readyCard }
            }
            .padding(HudsonSpacing.xxl)
            .frame(maxWidth: 720, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .center)
        }
        .background(HudsonPalette.bg)
        .task { await play() }
    }

    @MainActor
    private func play() async {
        for index in script.indices {
            try? await Task.sleep(nanoseconds: 380_000_000)
            step = index + 1
        }
        try? await Task.sleep(nanoseconds: 240_000_000)
        connected = true
    }

    private var hero: some View {
        HStack(spacing: HudsonSpacing.xxl) {
            Image(systemName: target.icon)
                .font(.system(size: 28, weight: .medium))
                .foregroundStyle(target.iconTint.color)
                .frame(width: 64, height: 64)
                .background(RoundedRectangle(cornerRadius: HudsonRadius.card).fill(target.iconTint.color.opacity(0.15)))
                .overlay(RoundedRectangle(cornerRadius: HudsonRadius.card).stroke(target.iconTint.color.opacity(0.32), lineWidth: 1))

            VStack(alignment: .leading, spacing: HudsonSpacing.sm) {
                Text(connected ? "CONNECTED" : "CONNECTING")
                    .font(HudsonFont.mono(10, weight: .bold))
                    .tracking(2.0)
                    .foregroundStyle(connected ? HudsonPalette.statusOk : target.iconTint.color)
                Text(target.name)
                    .font(HudsonFont.mono(22, weight: .bold))
                    .foregroundStyle(HudsonPalette.ink)
                Text(target.host)
                    .font(HudsonFont.mono(12))
                    .foregroundStyle(HudsonPalette.muted)
            }

            Spacer()

            HudsonStatusDot(
                color: connected ? HudsonPalette.statusOk : target.iconTint.color,
                size: 12,
                pulses: !connected
            )
        }
    }

    private var logCard: some View {
        HudsonCard(padding: 0) {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    HudsonSectionLabel("Session", tint: HudsonTint.amber.color)
                    Spacer()
                    Text("ssh · ed25519")
                        .font(HudsonFont.mono(9))
                        .tracking(0.8)
                        .foregroundStyle(HudsonPalette.dim)
                }
                .padding(.horizontal, HudsonSpacing.xl)
                .padding(.vertical, HudsonSpacing.md)
                .background(Color.white.opacity(0.02))

                HudsonDivider()

                VStack(alignment: .leading, spacing: HudsonSpacing.sm) {
                    ForEach(0..<step, id: \.self) { index in
                        let entry = script[index]
                        HStack(spacing: HudsonSpacing.md) {
                            Text(entry.prompt)
                                .font(HudsonFont.mono(11, weight: .semibold))
                                .foregroundStyle(entry.color)
                            Text(entry.line)
                                .font(HudsonFont.mono(11))
                                .foregroundStyle(HudsonPalette.ink)
                        }
                    }
                    if !connected, step < script.count {
                        HStack(spacing: HudsonSpacing.md) {
                            Text("•")
                                .font(HudsonFont.mono(11, weight: .semibold))
                                .foregroundStyle(HudsonPalette.muted)
                            HudsonStatusDot(color: HudsonPalette.muted, size: 6, pulses: true)
                            Text("…")
                                .font(HudsonFont.mono(11))
                                .foregroundStyle(HudsonPalette.muted)
                        }
                    }
                }
                .padding(HudsonSpacing.xl)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private var readyCard: some View {
        HudsonCard {
            VStack(alignment: .leading, spacing: HudsonSpacing.md) {
                HStack {
                    HudsonSectionLabel("Ready", tint: HudsonPalette.statusOk)
                    Spacer()
                    HudsonBadge("LIVE", tint: HudsonPalette.statusOk, dot: true)
                }
                Text("Session attached. The terminal would mount here once TermBridgeKit is wired into the iOS demo target.")
                    .font(HudsonFont.ui(12))
                    .foregroundStyle(HudsonPalette.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}
