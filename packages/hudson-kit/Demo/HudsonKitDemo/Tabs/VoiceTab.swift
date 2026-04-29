import SwiftUI
import HudsonUI
import HudsonVoice

struct VoiceTab: View {
    @Environment(\.hudsonAppManifest) private var manifest

    var body: some View {
        VStack(alignment: .leading, spacing: HudsonSpacing.huge) {
            header

            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 360), spacing: HudsonSpacing.xl)],
                alignment: .leading,
                spacing: HudsonSpacing.xl
            ) {
                HudsonVoicePanel(options: HudsonVoxLiveSessionOptions(clientId: "hudson-kit-demo"))
                    .frame(maxWidth: 560)

                contractCard
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: HudsonSpacing.md) {
            HStack(spacing: HudsonSpacing.md) {
                HudsonSectionLabel("Voice · Vox", tint: manifest.accent)
                Spacer()
                HudsonBadge("LOCAL", tint: HudsonPalette.statusInfo, dot: true)
            }

            Text("HudsonVoice gives native HudsonKit apps the same provider boundary as the web SDK voice entry point: Hudson owns the app integration, Vox owns capture, endpointing, and transcription.")
                .font(HudsonFont.ui(12))
                .foregroundStyle(HudsonPalette.muted)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: 760, alignment: .leading)
        }
    }

    private var contractCard: some View {
        HudsonCard {
            VStack(alignment: .leading, spacing: HudsonSpacing.lg) {
                HStack(spacing: HudsonSpacing.lg) {
                    Image(systemName: "point.3.connected.trianglepath.dotted")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(manifest.accent)
                        .frame(width: 32, height: 32)
                        .background(RoundedRectangle(cornerRadius: HudsonRadius.standard).fill(manifest.accent.opacity(0.12)))
                        .overlay(RoundedRectangle(cornerRadius: HudsonRadius.standard).stroke(manifest.accent.opacity(0.28), lineWidth: 1))

                    Text("Provider contract")
                        .font(HudsonFont.mono(13, weight: .semibold))
                        .foregroundStyle(HudsonPalette.ink)

                    Spacer()
                }

                VStack(alignment: .leading, spacing: HudsonSpacing.md) {
                    ContractRow(label: "Transport", value: "Vox local WebSocket JSON-RPC")
                    ContractRow(label: "Default", value: "ws://127.0.0.1:42137")
                    ContractRow(label: "Session", value: "transcribe.startSession / stopSession")
                    ContractRow(label: "Events", value: "state, partial, final")
                }

                HudsonDivider()

                Text("The Swift package dependency stays optional. HudsonKit speaks the same stable contract as Vox's clients, so the kit does not inherit Vox's current macOS 26 / Swift 6.2 floor.")
                    .font(HudsonFont.ui(12))
                    .foregroundStyle(HudsonPalette.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

private struct ContractRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: HudsonSpacing.lg) {
            Text(label)
                .font(HudsonFont.mono(10))
                .foregroundStyle(HudsonPalette.dim)
                .frame(width: 74, alignment: .leading)
            Text(value)
                .font(HudsonFont.mono(11))
                .foregroundStyle(HudsonPalette.ink)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
    }
}
