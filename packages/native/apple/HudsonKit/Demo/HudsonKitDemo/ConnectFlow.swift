import SwiftUI
import HudsonUI

/// Content rendered inside the `HTakeover` when the user hits CONNECT on
/// a target canvas. Plays a short scripted "connecting → connected" sequence
/// to demonstrate the takeover surface; in a real app this would mount the
/// actual terminal session view.
struct ConnectFlow: View {
    let target: TargetMock

    @State private var step: Int = 0
    @State private var connected: Bool = false

    private let script: [(prompt: String, line: String, color: Color)] = [
        ("•", "Resolving \(TargetMock.fleet[0].host)…",            HPalette.muted),
        ("•", "Negotiating ed25519 host key",                       HPalette.muted),
        ("•", "Authenticated as arach@laptop.local",                HPalette.statusOk),
        ("•", "Forwarding agent · scout-bridge attached",           HPalette.muted),
        ("•", "Spawning shell · /bin/zsh",                          HPalette.muted),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: HSpacing.huge) {
                hero
                logCard
                if connected { readyCard }
            }
            .padding(HSpacing.xxl)
            .frame(maxWidth: 720, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .center)
        }
        .background(HPalette.bg)
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
        HStack(spacing: HSpacing.xxl) {
            Image(systemName: target.icon)
                .font(.system(size: 28, weight: .medium))
                .foregroundStyle(target.iconTint.color)
                .frame(width: 64, height: 64)
                .background(RoundedRectangle(cornerRadius: HRadius.card).fill(target.iconTint.color.opacity(0.15)))
                .overlay(RoundedRectangle(cornerRadius: HRadius.card).stroke(target.iconTint.color.opacity(0.32), lineWidth: 1))

            VStack(alignment: .leading, spacing: HSpacing.sm) {
                Text(connected ? "CONNECTED" : "CONNECTING")
                    .font(HFont.mono(10, weight: .bold))
                    .tracking(2.0)
                    .foregroundStyle(connected ? HPalette.statusOk : target.iconTint.color)
                Text(target.name)
                    .font(HFont.mono(22, weight: .bold))
                    .foregroundStyle(HPalette.ink)
                Text(target.host)
                    .font(HFont.mono(12))
                    .foregroundStyle(HPalette.muted)
            }

            Spacer()

            HStatusDot(
                color: connected ? HPalette.statusOk : target.iconTint.color,
                size: 12,
                pulses: !connected
            )
        }
    }

    private var logCard: some View {
        HCard(padding: 0) {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    HSectionLabel("Session", tint: HTint.amber.color)
                    Spacer()
                    Text("ssh · ed25519")
                        .font(HFont.mono(9))
                        .tracking(0.8)
                        .foregroundStyle(HPalette.dim)
                }
                .padding(.horizontal, HSpacing.xl)
                .padding(.vertical, HSpacing.md)
                .background(Color.white.opacity(0.02))

                HDivider()

                VStack(alignment: .leading, spacing: HSpacing.sm) {
                    ForEach(0..<step, id: \.self) { index in
                        let entry = script[index]
                        HStack(spacing: HSpacing.md) {
                            Text(entry.prompt)
                                .font(HFont.mono(11, weight: .semibold))
                                .foregroundStyle(entry.color)
                            Text(entry.line)
                                .font(HFont.mono(11))
                                .foregroundStyle(HPalette.ink)
                        }
                    }
                    if !connected, step < script.count {
                        HStack(spacing: HSpacing.md) {
                            Text("•")
                                .font(HFont.mono(11, weight: .semibold))
                                .foregroundStyle(HPalette.muted)
                            HStatusDot(color: HPalette.muted, size: 6, pulses: true)
                            Text("…")
                                .font(HFont.mono(11))
                                .foregroundStyle(HPalette.muted)
                        }
                    }
                }
                .padding(HSpacing.xl)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private var readyCard: some View {
        HCard {
            VStack(alignment: .leading, spacing: HSpacing.md) {
                HStack {
                    HSectionLabel("Ready", tint: HPalette.statusOk)
                    Spacer()
                    HBadge("LIVE", tint: HPalette.statusOk, dot: true)
                }
                Text("Session attached. The terminal would mount here once Termini is wired into the iOS demo target.")
                    .font(HFont.ui(12))
                    .foregroundStyle(HPalette.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}
