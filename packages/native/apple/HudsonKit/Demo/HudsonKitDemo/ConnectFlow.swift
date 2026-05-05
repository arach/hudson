import SwiftUI
import HudsonUI

/// Content rendered inside the `HudTakeover` when the user hits CONNECT on
/// a target canvas. Plays a short scripted "connecting → connected" sequence
/// to demonstrate the takeover surface; in a real app this would mount the
/// actual terminal session view.
struct ConnectFlow: View {
    let target: TargetMock

    @State private var step: Int = 0
    @State private var connected: Bool = false

    private let script: [(prompt: String, line: String, color: Color)] = [
        ("•", "Resolving \(TargetMock.fleet[0].host)…",            HudPalette.muted),
        ("•", "Negotiating ed25519 host key",                       HudPalette.muted),
        ("•", "Authenticated as arach@laptop.local",                HudPalette.statusOk),
        ("•", "Forwarding agent · scout-bridge attached",           HudPalette.muted),
        ("•", "Spawning shell · /bin/zsh",                          HudPalette.muted),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: HudSpacing.huge) {
                hero
                logCard
                if connected { readyCard }
            }
            .padding(HudSpacing.xxl)
            .frame(maxWidth: HudLayout.readableWidth, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .center)
        }
        .background(HudPalette.bg)
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
        HStack(spacing: HudSpacing.xxl) {
            Image(systemName: target.icon)
                .font(HudFont.ui(HudTextSize.xxxl, weight: .medium))
                .foregroundStyle(target.iconTint.color)
                .frame(width: HudIconSize.hero, height: HudIconSize.hero)
                .background(RoundedRectangle(cornerRadius: HudRadius.card).fill(HudSurface.tintFill(target.iconTint.color)))
                .overlay(RoundedRectangle(cornerRadius: HudRadius.card).stroke(HudSurface.tintBorder(target.iconTint.color), lineWidth: 1))

            VStack(alignment: .leading, spacing: HudSpacing.sm) {
                Text(connected ? "CONNECTED" : "CONNECTING")
                    .font(HudFont.mono(HudTextSize.xxs, weight: .bold))
                    .tracking(2.0)
                    .foregroundStyle(connected ? HudPalette.statusOk : target.iconTint.color)
                Text(target.name)
                    .font(HudFont.mono(22, weight: .bold))
                    .foregroundStyle(HudPalette.ink)
                Text(target.host)
                    .font(HudFont.mono(HudTextSize.sm))
                    .foregroundStyle(HudPalette.muted)
            }

            Spacer()

            HudStatusDot(
                color: connected ? HudPalette.statusOk : target.iconTint.color,
                size: 12,
                pulses: !connected
            )
        }
    }

    private var logCard: some View {
        HudCard(padding: 0) {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    HudSectionLabel("Session", tint: HudTint.amber.color)
                    Spacer()
                    Text("ssh · ed25519")
                        .font(HudFont.mono(HudTextSize.micro))
                        .tracking(0.8)
                        .foregroundStyle(HudPalette.dim)
                }
                .padding(.horizontal, HudSpacing.xl)
                .padding(.vertical, HudSpacing.md)
                .background(HudSurface.inset)

                HudDivider()

                VStack(alignment: .leading, spacing: HudSpacing.sm) {
                    ForEach(0..<step, id: \.self) { index in
                        let entry = script[index]
                        HStack(spacing: HudSpacing.md) {
                            Text(entry.prompt)
                                .font(HudFont.mono(HudTextSize.xs, weight: .semibold))
                                .foregroundStyle(entry.color)
                            Text(entry.line)
                                .font(HudFont.mono(HudTextSize.xs))
                                .foregroundStyle(HudPalette.ink)
                        }
                    }
                    if !connected, step < script.count {
                        HStack(spacing: HudSpacing.md) {
                            Text("•")
                                .font(HudFont.mono(HudTextSize.xs, weight: .semibold))
                                .foregroundStyle(HudPalette.muted)
                            HudStatusDot(color: HudPalette.muted, size: 6, pulses: true)
                            Text("…")
                                .font(HudFont.mono(HudTextSize.xs))
                                .foregroundStyle(HudPalette.muted)
                        }
                    }
                }
                .padding(HudSpacing.xl)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private var readyCard: some View {
        HudCard {
            VStack(alignment: .leading, spacing: HudSpacing.md) {
                HStack {
                    HudSectionLabel("Ready", tint: HudPalette.statusOk)
                    Spacer()
                    HudBadge("LIVE", tint: HudPalette.statusOk, dot: true)
                }
                Text("Session attached. The terminal would mount here once Termini is wired into the iOS demo target.")
                    .font(HudFont.ui(HudTextSize.sm))
                    .foregroundStyle(HudPalette.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}
