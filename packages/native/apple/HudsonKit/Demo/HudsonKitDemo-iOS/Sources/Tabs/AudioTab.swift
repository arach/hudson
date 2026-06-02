import SwiftUI
import HudsonUI
import HudsonUIAudio

struct AudioTab: View {
    @StateObject private var recorder = HudAudioRecorderController(
        configuration: HudAudioRecorderConfiguration(filePrefix: "hudson-demo-audio")
    )

    var body: some View {
        GeometryReader { geometry in
            ScrollView {
                VStack(alignment: .leading, spacing: HudSpacing.xxxl) {
                    intro
                    HudAudioRecorderView(controller: recorder)
                    lifecycle
                }
                .frame(width: max(0, geometry.size.width - HudSpacing.xl * 2), alignment: .leading)
                .padding(.horizontal, HudSpacing.xl)
                .padding(.top, HudSpacing.lg)
                .padding(.bottom, HudSpacing.huge)
            }
        }
    }

    private var intro: some View {
        VStack(alignment: .leading, spacing: HudSpacing.sm) {
            HudSectionLabel("Audio recording")
            Text("Reusable microphone capture for app shells that need voice notes, evidence capture, or handoff snippets without adopting a full dictation stack.")
                .font(HudFont.ui(HudTextSize.sm))
                .foregroundStyle(HudPalette.muted)
        }
    }

    private var lifecycle: some View {
        HudCard {
            VStack(alignment: .leading, spacing: HudSpacing.lg) {
                HudSectionLabel("Lifecycle")
                HudKVRow("permission", value: recorder.state.permissionStatus.rawValue)
                HudKVRow("phase", value: recorder.state.phase.rawValue)
                HudKVRow("format", value: "m4a / aac")
                HudKVRow("metering", value: "average + peak power")
                HudDivider()
                Text("The controller tears down its timer and recorder when the view is released; saved clips live in the temporary HudsonRecordings folder.")
                    .font(HudFont.ui(HudTextSize.xs))
                    .foregroundStyle(HudPalette.dim)
            }
        }
    }
}
