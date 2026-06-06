import SwiftUI
import HudsonUI
import HudsonUIOnboarding

struct OnboardingTab: View {
    @State private var progress = HudOnboardingProgress()
    @State private var completionMessage = "Ready to configure"

    private let steps: [HudOnboardingStep] = [
        .init(
            id: "pair-mac",
            title: "Pair a Mac",
            detail: "Scan a QR link or paste a local/Tailscale endpoint so the phone can hand work back to the desktop shell.",
            icon: "qrcode.viewfinder"
        ),
        .init(
            id: "terminal",
            title: "Enable terminal controls",
            detail: "Confirm the compact command keys and hosted terminal presets that make shell work usable on a phone.",
            icon: "terminal"
        ),
        .init(
            id: "voice",
            title: "Turn on microphone capture",
            detail: "Grant the microphone once so Hudson can capture short voice notes and future dictation snippets.",
            icon: "mic.circle"
        ),
        .init(
            id: "web-code",
            title: "Preview web/code surfaces",
            detail: "Check that the built-in web view is available for CodeMirror nodes and lightweight local tools.",
            icon: "safari",
            isRequired: false
        ),
    ]

    var body: some View {
        GeometryReader { geometry in
            ScrollView {
                VStack(alignment: .leading, spacing: HudSpacing.xxxl) {
                    intro
                    HudOnboardingFlow(
                        title: "Hudson setup",
                        subtitle: "Reusable first-run checklist for native shells",
                        steps: steps,
                        progress: $progress
                    ) {
                        completionMessage = "Setup complete"
                    }
                    stateCard
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
            HudSectionLabel("Onboarding")
            Text("A configurable step flow for app shells that need first-run setup without inventing a whole wizard every time.")
                .font(HudFont.ui(HudTextSize.sm))
                .foregroundStyle(HudPalette.muted)
        }
    }

    private var stateCard: some View {
        HudCard {
            VStack(alignment: .leading, spacing: HudSpacing.lg) {
                HudSectionLabel("State")
                HudKVRow("status", value: completionMessage)
                HudKVRow("completed", value: "\(progress.completedCount(in: steps)) / \(steps.count)")
                HudKVRow("current", value: progress.currentStepID ?? "none")
                HudKVRow("skipped", value: progress.skippedStepIDs.sorted().joined(separator: ", ").isEmpty ? "none" : progress.skippedStepIDs.sorted().joined(separator: ", "))
                HudDivider()
                HStack(spacing: HudSpacing.md) {
                    HudButton("Reset", icon: "arrow.counterclockwise", style: .ghost) {
                        progress.reset()
                        completionMessage = "Ready to configure"
                    }
                    HudButton("Complete all", icon: "checkmark.seal", style: .secondary) {
                        progress.completedStepIDs = Set(steps.map(\.id))
                        progress.currentStepID = nil
                        completionMessage = "Setup complete"
                    }
                }
            }
        }
    }
}
