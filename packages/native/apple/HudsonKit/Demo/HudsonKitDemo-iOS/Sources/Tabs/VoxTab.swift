#if HUDSON_VOICE
import SwiftUI
import HudsonUI
import HudsonVoice

/// Vox demo on iOS — renders HudVoicePanel against the same Vox local
/// WebSocket contract the macOS demo uses. On iOS the Vox server typically
/// runs on a paired Mac (HudPairing wire-up is the future-state path);
/// without a reachable server, the panel renders its connection-error
/// state, which is itself useful as a primitive showcase.
struct VoxTab: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: HudSpacing.huge) {
                header
                HudVoicePanel(options: HudVoxLiveSessionOptions(clientId: "hudsonkit-demoios"))
            }
            .padding(.horizontal, HudSpacing.xl)
            .padding(.vertical, HudSpacing.xl)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: HudSpacing.sm) {
            HudSectionLabel("Voice · Vox")
            Text("Vox runs as a local WebSocket service. On iOS, point HudVoxEndpoint at a paired host (typically a Mac running Vox) — the panel surfaces connection state automatically.")
                .font(HudFont.ui(HudTextSize.sm))
                .foregroundStyle(HudPalette.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
#else
import SwiftUI
import HudsonUI

/// Stub when HudsonVoice isn't built into this binary. Rebuild with
/// HUDSONKIT_WITH_VOICE=1 (set in shell env, then xcodegen + xcodebuild)
/// to enable.
struct VoxTab: View {
    var body: some View {
        VStack(alignment: .leading, spacing: HudSpacing.lg) {
            HudSectionLabel("Voice · Vox")
            HudCard {
                VStack(alignment: .leading, spacing: HudSpacing.md) {
                    Text("HudsonVoice is not built into this binary.")
                        .font(HudFont.ui(HudTextSize.sm))
                        .foregroundStyle(HudPalette.muted)
                    Text("Rebuild with HUDSONKIT_WITH_VOICE=1 set in shell env (then re-run xcodegen) to opt in.")
                        .font(HudFont.mono(HudTextSize.xxs))
                        .foregroundStyle(HudPalette.dim)
                }
            }
        }
        .padding(.horizontal, HudSpacing.xl)
        .padding(.top, HudSpacing.xl)
    }
}
#endif
