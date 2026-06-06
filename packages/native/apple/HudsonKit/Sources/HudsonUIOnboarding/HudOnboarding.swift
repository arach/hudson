import Foundation
import SwiftUI
import HudsonUI

public struct HudOnboardingStep: Equatable, Identifiable, Sendable {
    public var id: String
    public var title: String
    public var detail: String
    public var icon: String
    public var isRequired: Bool

    public init(
        id: String,
        title: String,
        detail: String,
        icon: String = "sparkles",
        isRequired: Bool = true
    ) {
        self.id = id
        self.title = title
        self.detail = detail
        self.icon = icon
        self.isRequired = isRequired
    }
}

public struct HudOnboardingProgress: Equatable, Sendable {
    public var currentStepID: String?
    public var completedStepIDs: Set<String>
    public var skippedStepIDs: Set<String>

    public init(
        currentStepID: String? = nil,
        completedStepIDs: Set<String> = [],
        skippedStepIDs: Set<String> = []
    ) {
        self.currentStepID = currentStepID
        self.completedStepIDs = completedStepIDs
        self.skippedStepIDs = skippedStepIDs
    }

    public func currentIndex(in steps: [HudOnboardingStep]) -> Int {
        if let currentStepID, let index = steps.firstIndex(where: { $0.id == currentStepID }) {
            return index
        }
        return nextOpenIndex(in: steps) ?? 0
    }

    public func completedCount(in steps: [HudOnboardingStep]) -> Int {
        steps.filter { completedStepIDs.contains($0.id) }.count
    }

    public func isComplete(in steps: [HudOnboardingStep]) -> Bool {
        !steps.isEmpty && steps.allSatisfy { step in
            completedStepIDs.contains(step.id) || (!step.isRequired && skippedStepIDs.contains(step.id))
        }
    }

    public mutating func normalize(for steps: [HudOnboardingStep]) {
        let validIDs = Set(steps.map(\.id))
        completedStepIDs = completedStepIDs.intersection(validIDs)
        skippedStepIDs = skippedStepIDs.intersection(validIDs)

        if let currentStepID, validIDs.contains(currentStepID), !isClosed(currentStepID, in: steps) {
            return
        }
        currentStepID = nextOpenIndex(in: steps).map { steps[$0].id }
    }

    public mutating func completeCurrent(in steps: [HudOnboardingStep]) {
        normalize(for: steps)
        guard let id = currentStepID else { return }
        completedStepIDs.insert(id)
        skippedStepIDs.remove(id)
        currentStepID = nextOpenIndex(in: steps).map { steps[$0].id }
    }

    public mutating func skipCurrent(in steps: [HudOnboardingStep]) {
        normalize(for: steps)
        guard let id = currentStepID,
              let step = steps.first(where: { $0.id == id }),
              !step.isRequired else {
            return
        }
        skippedStepIDs.insert(id)
        completedStepIDs.remove(id)
        currentStepID = nextOpenIndex(in: steps).map { steps[$0].id }
    }

    public mutating func move(_ delta: Int, in steps: [HudOnboardingStep]) {
        guard !steps.isEmpty else {
            currentStepID = nil
            return
        }
        let nextIndex = min(max(currentIndex(in: steps) + delta, 0), steps.count - 1)
        currentStepID = steps[nextIndex].id
    }

    public mutating func reset(to stepID: String? = nil) {
        currentStepID = stepID
        completedStepIDs = []
        skippedStepIDs = []
    }

    private func isClosed(_ id: String, in steps: [HudOnboardingStep]) -> Bool {
        guard let step = steps.first(where: { $0.id == id }) else { return true }
        return completedStepIDs.contains(id) || (!step.isRequired && skippedStepIDs.contains(id))
    }

    private func nextOpenIndex(in steps: [HudOnboardingStep]) -> Int? {
        steps.firstIndex { step in
            !completedStepIDs.contains(step.id)
                && (step.isRequired || !skippedStepIDs.contains(step.id))
        }
    }
}

public struct HudOnboardingFlow: View {
    public var title: String
    public var subtitle: String
    public var steps: [HudOnboardingStep]
    @Binding public var progress: HudOnboardingProgress
    public var onFinish: (() -> Void)?

    public init(
        title: String,
        subtitle: String,
        steps: [HudOnboardingStep],
        progress: Binding<HudOnboardingProgress>,
        onFinish: (() -> Void)? = nil
    ) {
        self.title = title
        self.subtitle = subtitle
        self.steps = steps
        self._progress = progress
        self.onFinish = onFinish
    }

    public var body: some View {
        HudCard {
            VStack(alignment: .leading, spacing: HudSpacing.xxl) {
                header
                progressTrack
                currentStepCard
                checklist
                controls
            }
        }
        .onAppear {
            progress.normalize(for: steps)
        }
        .onChange(of: steps.map(\.id)) { _, _ in
            progress.normalize(for: steps)
        }
    }

    private var header: some View {
        HStack(spacing: HudSpacing.md) {
            Image(systemName: "sparkles")
                .font(HudFont.ui(HudTextSize.xl, weight: .semibold))
                .foregroundStyle(HudPalette.accent)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: HudSpacing.xs) {
                Text(title)
                    .font(HudFont.ui(HudTextSize.lg, weight: .semibold))
                    .foregroundStyle(HudPalette.ink)
                Text(subtitle)
                    .font(HudFont.ui(HudTextSize.xs))
                    .foregroundStyle(HudPalette.muted)
            }

            Spacer(minLength: HudSpacing.md)
            HudBadge(progressBadge, tint: progress.isComplete(in: steps) ? HudPalette.statusOk : HudPalette.accent)
        }
    }

    private var progressTrack: some View {
        HStack(spacing: HudSpacing.xs) {
            ForEach(steps.indices, id: \.self) { index in
                RoundedRectangle(cornerRadius: HudRadius.tight)
                    .fill(trackFill(for: steps[index], index: index))
                    .frame(maxWidth: .infinity)
                    .frame(height: HudSpacing.xs)
                    .accessibilityHidden(true)
            }
        }
        .accessibilityLabel(progressBadge)
    }

    @ViewBuilder
    private var currentStepCard: some View {
        if let step = currentStep {
            HudInset {
                HStack(alignment: .top, spacing: HudSpacing.xl) {
                    Image(systemName: step.icon)
                        .font(HudFont.ui(HudTextSize.xxl, weight: .semibold))
                        .foregroundStyle(HudPalette.accent)
                        .frame(width: HudSpacing.huge, alignment: .center)
                        .accessibilityHidden(true)

                    VStack(alignment: .leading, spacing: HudSpacing.sm) {
                        HStack(spacing: HudSpacing.sm) {
                            HudBadge(step.isRequired ? "Required" : "Optional", tint: step.isRequired ? HudPalette.statusInfo : HudPalette.muted)
                            Text(stepPositionLabel)
                                .font(HudFont.mono(HudTextSize.xxs, weight: .medium))
                                .foregroundStyle(HudPalette.dim)
                        }
                        Text(step.title)
                            .font(HudFont.ui(HudTextSize.lg, weight: .semibold))
                            .foregroundStyle(HudPalette.ink)
                        Text(step.detail)
                            .font(HudFont.ui(HudTextSize.sm))
                            .foregroundStyle(HudPalette.muted)
                    }
                }
            }
        } else {
            HudEmptyState(
                title: "ONBOARDING COMPLETE",
                subtitle: "All configured setup steps are closed.",
                icon: "checkmark.seal"
            )
        }
    }

    private var checklist: some View {
        VStack(spacing: HudSpacing.sm) {
            ForEach(steps) { step in
                onboardingRow(step)
            }
        }
    }

    private var controls: some View {
        HStack(spacing: HudSpacing.md) {
            HudButton("Back", icon: "chevron.left", style: .ghost) {
                progress.move(-1, in: steps)
            }
            .disabled(progress.currentIndex(in: steps) == 0)

            Spacer(minLength: HudSpacing.md)

            if currentStep?.isRequired == false {
                HudButton("Skip", icon: "forward", style: .ghost) {
                    progress.skipCurrent(in: steps)
                    maybeFinish()
                }
            }

            HudButton(primaryActionTitle, icon: primaryActionIcon, style: .primary(.green)) {
                progress.completeCurrent(in: steps)
                maybeFinish()
            }
            .disabled(steps.isEmpty || progress.isComplete(in: steps))
        }
    }

    private func onboardingRow(_ step: HudOnboardingStep) -> some View {
        let status = rowStatus(for: step)
        let isCurrent = currentStep?.id == step.id

        return Button {
            progress.currentStepID = step.id
        } label: {
            HStack(spacing: HudSpacing.md) {
                Image(systemName: status.icon)
                    .font(HudFont.ui(HudTextSize.sm, weight: .semibold))
                    .foregroundStyle(status.tint)
                    .frame(width: HudIconSize.medium, height: HudIconSize.medium)
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: HudSpacing.xxs) {
                    Text(step.title)
                        .font(HudFont.ui(HudTextSize.sm, weight: .medium))
                        .foregroundStyle(HudPalette.ink)
                    Text(step.isRequired ? "Required" : "Optional")
                        .font(HudFont.mono(HudTextSize.micro, weight: .medium))
                        .foregroundStyle(HudPalette.dim)
                }

                Spacer(minLength: HudSpacing.md)
                HudBadge(status.label, tint: status.tint)
            }
            .padding(.horizontal, HudSpacing.md)
            .padding(.vertical, HudSpacing.sm)
            .background(RoundedRectangle(cornerRadius: HudRadius.standard).fill(isCurrent ? HudSurface.tintGhost(HudPalette.accent) : .clear))
            .overlay(RoundedRectangle(cornerRadius: HudRadius.standard).stroke(isCurrent ? HudSurface.tintBorder(HudPalette.accent) : HudHairline.subtle, lineWidth: HudStrokeWidth.thin))
        }
        .buttonStyle(.plain)
    }

    private var currentStep: HudOnboardingStep? {
        guard !steps.isEmpty else { return nil }
        guard !progress.isComplete(in: steps) else { return nil }
        return steps[progress.currentIndex(in: steps)]
    }

    private var progressBadge: String {
        "\(progress.completedCount(in: steps))/\(steps.count)"
    }

    private var stepPositionLabel: String {
        guard !steps.isEmpty else { return "0 of 0" }
        return "\(progress.currentIndex(in: steps) + 1) of \(steps.count)"
    }

    private var primaryActionTitle: String {
        progress.currentIndex(in: steps) == steps.count - 1 ? "Finish" : "Complete"
    }

    private var primaryActionIcon: String {
        progress.currentIndex(in: steps) == steps.count - 1 ? "checkmark.seal" : "checkmark"
    }

    private func trackFill(for step: HudOnboardingStep, index: Int) -> Color {
        if progress.completedStepIDs.contains(step.id) { return HudPalette.statusOk }
        if progress.skippedStepIDs.contains(step.id) { return HudPalette.dim }
        if index == progress.currentIndex(in: steps) { return HudPalette.accent }
        return HudSurface.control
    }

    private func rowStatus(for step: HudOnboardingStep) -> (label: String, icon: String, tint: Color) {
        if progress.completedStepIDs.contains(step.id) {
            return ("Done", "checkmark.circle.fill", HudPalette.statusOk)
        }
        if progress.skippedStepIDs.contains(step.id) {
            return ("Skipped", "forward.circle", HudPalette.dim)
        }
        if currentStep?.id == step.id {
            return ("Current", "circle.circle.fill", HudPalette.accent)
        }
        return ("Open", "circle", HudPalette.muted)
    }

    private func maybeFinish() {
        if progress.isComplete(in: steps) {
            onFinish?()
        }
    }
}
