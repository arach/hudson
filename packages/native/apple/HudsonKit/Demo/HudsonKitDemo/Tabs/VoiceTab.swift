#if HUDSON_VOICE
import SwiftUI
import HudsonUI
import HudsonVoice

struct VoiceTab: View {
    @Environment(\.hudsonAppManifest) private var manifest

    var body: some View {
        VStack(alignment: .leading, spacing: HudSpacing.huge) {
            header

            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 360), spacing: HudSpacing.xl)],
                alignment: .leading,
                spacing: HudSpacing.xl
            ) {
                HudVoicePanel(options: HudVoxLiveSessionOptions(clientId: "hudsonkit-demo"))
                    .frame(maxWidth: HudLayout.dialogWidth)

                HudsonVoiceSettingsView(appName: "HudsonKit Demo")
                    .frame(maxWidth: HudLayout.dialogWidth)

                contractCard
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: HudSpacing.md) {
            HStack(spacing: HudSpacing.md) {
                HudSectionLabel("Voice · Vox", tint: manifest.accent)
                Spacer()
                HudBadge("LOCAL", tint: HudPalette.statusInfo, dot: true)
            }

            Text("HudsonVoice gives native HudsonKit apps the same provider boundary as the web SDK voice entry point: Hudson owns the app integration, Vox owns capture, endpointing, and transcription.")
                .font(HudFont.ui(HudTextSize.sm))
                .foregroundStyle(HudPalette.muted)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: HudLayout.cliffWidth, alignment: .leading)
        }
    }

    private var contractCard: some View {
        HudCard {
            VStack(alignment: .leading, spacing: HudSpacing.lg) {
                HStack(spacing: HudSpacing.lg) {
                    Image(systemName: "point.3.connected.trianglepath.dotted")
                        .font(HudFont.ui(HudTextSize.md, weight: .medium))
                        .foregroundStyle(manifest.accent)
                        .frame(width: HudIconSize.large, height: HudIconSize.large)
                        .background(RoundedRectangle(cornerRadius: HudRadius.standard).fill(HudSurface.tintFill(manifest.accent)))
                        .overlay(RoundedRectangle(cornerRadius: HudRadius.standard).stroke(HudSurface.tintBorder(manifest.accent), lineWidth: 1))

                    Text("Provider contract")
                        .font(HudFont.mono(HudTextSize.base, weight: .semibold))
                        .foregroundStyle(HudPalette.ink)

                    Spacer()
                }

                VStack(alignment: .leading, spacing: HudSpacing.md) {
                    ContractRow(label: "Transport", value: "Vox local WebSocket JSON-RPC")
                    ContractRow(label: "Default", value: "ws://127.0.0.1:42137")
                    ContractRow(label: "Session", value: "transcribe.startSession / stopSession")
                    ContractRow(label: "Events", value: "state, partial, final")
                }

                HudDivider()

                Text("The Swift package dependency stays optional. HudsonKit speaks the same stable contract as Vox's clients, so the kit does not inherit Vox's current macOS 26 / Swift 6.2 floor.")
                    .font(HudFont.ui(HudTextSize.sm))
                    .foregroundStyle(HudPalette.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

private struct ContractRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: HudSpacing.lg) {
            Text(label)
                .font(HudFont.mono(HudTextSize.xxs))
                .foregroundStyle(HudPalette.dim)
                // Voice control row label gutter — fixed for column alignment.
                // hudlint:disable next-line geometry
                .frame(width: 74, alignment: .leading)
            Text(value)
                .font(HudFont.mono(HudTextSize.xs))
                .foregroundStyle(HudPalette.ink)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
    }
}
#else
import SwiftUI
import HudsonUI

/// Stub when HudsonVoice isn't built. Rebuild with HUDSONKIT_WITH_VOICE=1
/// (set in shell env or via `make voice` from the kit dir) to enable.
struct VoiceTab: View {
    var body: some View {
        VStack(alignment: .leading, spacing: HudSpacing.lg) {
            HudSectionLabel("Voice · Vox")
            HudCard {
                VStack(alignment: .leading, spacing: HudSpacing.md) {
                    Text("HudsonVoice is not built into this binary.")
                        .font(HudFont.ui(HudTextSize.sm))
                        .foregroundStyle(HudPalette.muted)
                    Text("Rebuild with HUDSONKIT_WITH_VOICE=1 swift build (or make voice in packages/native/apple/HudsonKit) to opt in.")
                        .font(HudFont.mono(HudTextSize.xxs))
                        .foregroundStyle(HudPalette.dim)
                }
            }
            .frame(maxWidth: HudLayout.dialogWidth)
        }
    }
}
#endif
