#if os(macOS)
import AppKit
import HudsonNotchCore
import HudsonUI
import SwiftUI

/// The notch's SwiftUI content: the collapsed shell (wings or island) and the
/// open card for the focused activity.
public struct HudNotchSurface: View {
    @ObservedObject private var controller: HudNotchController
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var replyText = ""
    @State private var isFlashing = false
    @State private var nudgeAmount: CGFloat = 0

    public init(controller: HudNotchController) {
        self.controller = controller
    }

    public var body: some View {
        let shape = silhouette
        ZStack(alignment: .top) {
            silhouetteBody(shape)
                .silhouetteFrame(width: shape.width, height: shape.height)
                .onTapGesture {
                    if !controller.isExpanded { controller.expand() }
                }

            // Both layers stay mounted and cross on explicit timing, so the
            // card's content is still fading while the shape shrinks over it.
            collapsedContent
                .modifier(HudNotchReveal(amount: showsPill ? 0 : 1, anchor: .center, reduceMotion: reduceMotion))
                .animation(showsPill ? HudNotchMotion.pillIn : HudNotchMotion.contentOut, value: showsPill)
                .allowsHitTesting(showsPill)
                .accessibilityHidden(!showsPill)

            expandedContent
                .mask(alignment: .top) {
                    HudNotchSilhouetteShape(shoulder: shape.shoulder, bottomRadius: shape.bottom)
                        .silhouetteFrame(width: shape.width, height: shape.height)
                }
                .modifier(HudNotchReveal(amount: showsCard ? 0 : 1, reduceMotion: reduceMotion))
                .animation(showsCard ? HudNotchMotion.contentIn : HudNotchMotion.contentOut, value: showsCard)
                .allowsHitTesting(showsCard)
                .accessibilityHidden(!showsCard)
        }
        .silhouetteFrame(width: shape.width, height: shape.height, alignment: .top)
        .opacity(shape.opacity)
        .contentShape(Rectangle())
        .onHover { controller.setHovered($0) }
        .padding(.top, shellTopInset)
        .onChange(of: controller.attentionSerial) { _, _ in flash() }
        .onChange(of: controller.nudgeSerial) { _, _ in nudge() }
        .onChange(of: controller.stage.focused?.id) { _, _ in replyText = "" }
        .onChange(of: replyText) { _, text in controller.setComposing(!text.isEmpty) }
        // The first modifier is innermost and wins when several values change
        // together: presenting beats opening, and both beat a plain resize.
        .animation(HudMotion.ifAllowed(controller.isPresented ? HudNotchMotion.open : HudNotchMotion.close, reduceMotion: reduceMotion), value: controller.isPresented)
        .animation(HudMotion.ifAllowed(controller.isExpanded ? HudNotchMotion.open : HudNotchMotion.close, reduceMotion: reduceMotion), value: controller.isExpanded)
        .animation(HudMotion.ifAllowed(HudNotchMotion.resize, reduceMotion: reduceMotion), value: controller.currentPokeOut)
        .animation(HudMotion.ifAllowed(HudNotchMotion.resize, reduceMotion: reduceMotion), value: controller.contentHeight)
        .frame(width: controller.panelSize.width, height: controller.panelSize.height, alignment: .top)
    }

    private var showsCard: Bool { controller.isPresented && controller.isExpanded }
    private var showsPill: Bool { controller.isPresented && !controller.isExpanded }

    // MARK: Silhouette

    private struct Silhouette {
        var width: CGFloat
        var height: CGFloat
        var shoulder: CGFloat
        var bottom: CGFloat
        var opacity: Double = 1
    }

    /// The outline for the current state. Every state is the same shape at
    /// different sizes, so each change animates as one continuous morph.
    private var silhouette: Silhouette {
        let island = controller.renderStyle == .island
        let config = controller.configuration
        let height = controller.shellHeight

        guard controller.isPresented else {
            if island {
                let tucked = height * 0.7
                return Silhouette(width: controller.notchGap * 0.45, height: tucked, shoulder: -tucked / 2, bottom: tucked / 2, opacity: 0)
            }
            // Tucked inside the housing, where the hardware hides it.
            return Silhouette(
                width: controller.notchGap,
                height: controller.notchInfo.notchHeight,
                shoulder: 0,
                bottom: config.bottomRadius,
                opacity: controller.notchInfo.isVirtual ? 0 : 1
            )
        }

        if controller.isExpanded {
            return Silhouette(
                width: expandedSurfaceWidth + nudgeAmount * 14,
                height: expandedSurfaceHeight + nudgeAmount * 6,
                shoulder: island ? -20 : config.topOuterRadius,
                bottom: 22
            )
        }

        if island {
            return Silhouette(width: controller.shellWidth, height: height, shoulder: -height / 2, bottom: height / 2)
        }
        return Silhouette(
            width: controller.notchGap + controller.currentPokeOut * 2,
            height: height,
            shoulder: config.topOuterRadius,
            bottom: config.bottomRadius
        )
    }

    /// The body: a shadow that stays outside the outline, an optional
    /// frosted backdrop, the black fill and a rim that fades toward the top.
    private func silhouetteBody(_ shape: Silhouette) -> some View {
        let outline = HudNotchSilhouetteShape(shoulder: shape.shoulder, bottomRadius: shape.bottom)
        let look = self.look
        return ZStack {
            // Cut out of its own shape, so a see-through body never shows
            // its shadow from inside.
            outline
                .fill(Color.black)
                .shadow(
                    color: Color.black.opacity(controller.isPresented ? look.shadowOpacity : 0),
                    radius: look.shadowRadius,
                    y: look.shadowY
                )
                .overlay(outline.fill(Color.black).blendMode(.destinationOut))
                .compositingGroup()

            HudNotchBackdrop()
                .opacity(look.fillOpacity < 1 ? look.blur : 0)
                .clipShape(outline)

            outline.fill(Color.black.opacity(look.fillOpacity))

            outline.stroke(rimStyle(look), lineWidth: look.borderWidth)
        }
    }

    /// The look for the state being shown. Tucked uses the pill's look, so
    /// the pill emerges already dressed.
    private var look: HudNotchLook {
        let appearance = controller.configuration.appearance
        return showsCard ? appearance.card : appearance.pill
    }

    private func rimStyle(_ look: HudNotchLook) -> LinearGradient {
        let color: Color
        if isFlashing, let focused = controller.stage.focused {
            color = tint(focused.tone).opacity(0.8)
        } else {
            color = Color.white.opacity(look.borderOpacity)
        }
        // In notch style the top edge meets the menu bar and the housing, so
        // the rim lights only the sides and bottom.
        let top = controller.renderStyle == .island ? color : color.opacity(0)
        return LinearGradient(
            stops: [.init(color: top, location: 0), .init(color: color, location: 0.55)],
            startPoint: .top,
            endPoint: .bottom
        )
    }

    // MARK: Collapsed

    private var collapsedContent: some View {
        collapsedForeground
            .frame(width: controller.shellWidth, height: controller.shellHeight)
            .accessibilityElement(children: .combine)
            .accessibilityLabel(accessibilitySummary)
            .accessibilityAddTraits(.isButton)
            .accessibilityAction { controller.expand() }
    }

    @ViewBuilder
    private var collapsedForeground: some View {
        if let headline = controller.stage.headline {
            if controller.renderStyle == .island {
                HStack(spacing: HudSpacing.sm) {
                    HudNotchPulseDot(color: tint(headline.tone), isPulsing: true, size: 6)
                    Text(headline.title)
                        .font(HudFont.ui(HudTextSize.xs, weight: .semibold))
                        .foregroundStyle(HudPalette.ink)
                        .lineLimit(1)
                    Spacer(minLength: 0)
                    trailingIndicator(for: headline)
                }
                .padding(.horizontal, HudSpacing.xl)
                .transition(.notchReveal(insertion: HudNotchMotion.pillIn, anchor: .center, reduceMotion: reduceMotion))
            } else {
                wings {
                    HudNotchPulseDot(color: tint(headline.tone), isPulsing: true, size: 6)
                } trailing: {
                    trailingIndicator(for: headline)
                }
                .transition(.notchReveal(insertion: HudNotchMotion.pillIn, anchor: .center, reduceMotion: reduceMotion))
            }
        } else {
            HudNotchPulseDot(color: controller.isPinned ? HudPalette.statusWarn : HudPalette.accent, isPulsing: false, size: 6)
                .opacity(controller.renderStyle == .island ? 1 : 0)
        }
    }

    @ViewBuilder
    private func trailingIndicator(for activity: HudNotchActivity) -> some View {
        let waitingCount = controller.stage.waiting.count
        if waitingCount > 1 {
            Text("\(waitingCount)")
                .font(HudFont.mono(HudTextSize.xs, weight: .semibold))
                .foregroundStyle(tint(.warning))
        } else if activity.state == .waiting {
            Image(systemName: "questionmark")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(tint(.warning))
        } else {
            HudNotchProgressRing(progress: activity.progress, color: tint(activity.tone), size: 12)
        }
    }

    // MARK: Expanded

    private var expandedContent: some View {
        VStack(spacing: 0) {
            expandedHeader
                .frame(width: controller.shellWidth, height: controller.shellHeight)

            card
                .frame(width: expandedSurfaceWidth, height: controller.contentHeight, alignment: .top)
                .clipped()
        }
        .frame(width: expandedSurfaceWidth, height: expandedSurfaceHeight, alignment: .top)
    }

    @ViewBuilder
    private var expandedHeader: some View {
        let focused = controller.stage.focused
        let eyebrow = Text(focused.map { $0.source.uppercased() } ?? controller.copy.name.uppercased())
            .font(HudFont.mono(HudTextSize.micro, weight: .semibold))
            .tracking(0.8)
            .foregroundStyle(focused.map { tint($0.tone) } ?? HudPalette.muted)
            .lineLimit(1)

        if controller.renderStyle == .island {
            HStack(spacing: HudSpacing.sm) {
                HudNotchPulseDot(color: focused.map { tint($0.tone) } ?? HudPalette.accent, isPulsing: focused?.state.isOngoing ?? false, size: 6)
                eyebrow
                Spacer(minLength: 0)
                pager
            }
            .padding(.horizontal, HudSpacing.xl)
        } else {
            wings {
                HStack(spacing: HudSpacing.sm) {
                    HudNotchPulseDot(color: focused.map { tint($0.tone) } ?? HudPalette.accent, isPulsing: focused?.state.isOngoing ?? false, size: 6)
                    eyebrow
                }
            } trailing: {
                pager
            }
        }
    }

    @ViewBuilder
    private var pager: some View {
        let count = controller.stage.activities.count
        if count > 1, let focused = controller.stage.focused,
           let index = controller.stage.activities.firstIndex(where: { $0.id == focused.id }) {
            Button {
                controller.focusNext()
            } label: {
                Text("\(index + 1)/\(count)")
                    .font(HudFont.mono(HudTextSize.micro, weight: .semibold))
                    .foregroundStyle(HudPalette.muted)
                    .contentTransition(.numericText())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Next activity, \(index + 1) of \(count)")
        } else if let focused = controller.stage.focused, let label = stateLabel(focused.state) {
            Text(label)
                .font(HudFont.mono(HudTextSize.micro, weight: .semibold))
                .foregroundStyle(tint(focused.tone))
                .lineLimit(1)
        }
    }

    @ViewBuilder
    private var card: some View {
        ZStack(alignment: .topLeading) {
            if let activity = controller.stage.focused {
                activityCard(activity)
                    .id(activity.id)
                    .transition(.notchReveal(insertion: HudNotchMotion.contentIn, reduceMotion: reduceMotion))
            } else {
                idleCard
                    .transition(.notchReveal(reduceMotion: reduceMotion))
            }
        }
        .padding(.horizontal, 24)
        .padding(.top, 12)
        .padding(.bottom, 12)
        .frame(width: expandedSurfaceWidth, alignment: .topLeading)
    }

    private func activityCard(_ activity: HudNotchActivity) -> some View {
        VStack(alignment: .leading, spacing: HudSpacing.md) {
            HStack(alignment: .firstTextBaseline, spacing: HudSpacing.md) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(activity.title)
                        .font(HudFont.ui(HudTextSize.sm, weight: .semibold))
                        .foregroundStyle(HudPalette.ink)
                        .lineLimit(1)

                    if let detail = activity.detail {
                        Text(detail)
                            .font(HudFont.ui(HudTextSize.xs))
                            .foregroundStyle(HudPalette.muted)
                            .lineLimit(2)
                            .contentTransition(.opacity)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                if let link = activity.link, !activity.asksForInput {
                    HudButton(link.title, icon: "arrow.up.right", style: .secondary) {
                        controller.open(link)
                    }
                    .fixedSize()
                }

                if !activity.state.isOngoing || activity.state == .waiting {
                    Button {
                        controller.dismiss(id: activity.id)
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(HudPalette.dim)
                            .frame(width: 18, height: 18)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Dismiss")
                }
            }

            if activity.state == .working || activity.progress != nil {
                HudNotchProgressBar(progress: activity.progress, color: tint(activity.tone))
                    .frame(height: 3)
            }

            if activity.asksForInput {
                actionRow(activity)
            }
        }
        .animation(HudMotion.ifAllowed(HudMotion.quickFade, reduceMotion: reduceMotion), value: activity.state)
        .animation(HudMotion.ifAllowed(HudMotion.quickFade, reduceMotion: reduceMotion), value: activity.progress)
    }

    private func actionRow(_ activity: HudNotchActivity) -> some View {
        HStack(spacing: HudSpacing.md) {
            if let prompt = activity.replyPrompt {
                HudField(prompt, text: $replyText, icon: "text.bubble", accessibilityLabel: prompt)
                    .onSubmit { sendReply(to: activity.id) }

                if activity.choices.isEmpty {
                    HudButton("Send", icon: "arrow.up", style: .primary(.teal)) {
                        sendReply(to: activity.id)
                    }
                    .fixedSize()
                    .disabled(replyText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            } else {
                Spacer(minLength: 0)
            }

            ForEach(activity.choices) { choice in
                HudButton(choice.title, style: buttonStyle(for: choice.role)) {
                    controller.choose(choice, for: activity.id)
                }
                .fixedSize()
            }
        }
    }

    private var idleCard: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(controller.copy.idleTitle)
                .font(HudFont.ui(HudTextSize.sm, weight: .semibold))
                .foregroundStyle(HudPalette.ink)
                .lineLimit(1)
            Text(controller.copy.idleDetail)
                .font(HudFont.ui(HudTextSize.xs))
                .foregroundStyle(HudPalette.muted)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: Pieces

    /// Lays content on either side of the notch so nothing sits under the camera housing.
    private func wings<Leading: View, Trailing: View>(
        @ViewBuilder leading: () -> Leading,
        @ViewBuilder trailing: () -> Trailing
    ) -> some View {
        let wingWidth = max(0, (controller.shellWidth - controller.notchGap) / 2)
        return HStack(spacing: 0) {
            leading()
                .frame(width: wingWidth, alignment: .center)
            Color.clear.frame(width: controller.notchGap)
            trailing()
                .frame(width: wingWidth, alignment: .center)
        }
    }

    private var expandedSurfaceWidth: CGFloat {
        min(controller.panelSize.width - 28, max(controller.shellWidth, 430))
    }

    private var expandedSurfaceHeight: CGFloat {
        controller.shellHeight + controller.contentHeight + HudSpacing.sm
    }

    private var shellTopInset: CGFloat {
        controller.renderStyle == .island ? 7 : 0
    }

    private var accessibilitySummary: String {
        guard let headline = controller.stage.headline else { return controller.copy.name }
        return "\(controller.copy.name): \(headline.source), \(headline.title)"
    }

    private func sendReply(to id: String) {
        let text = replyText
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        replyText = ""
        controller.reply(text, to: id)
    }

    private func flash() {
        guard !reduceMotion else { return }
        withAnimation(.easeOut(duration: 0.12)) { isFlashing = true }
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(0.6))
            withAnimation(.easeOut(duration: 0.5)) { isFlashing = false }
        }
    }

    /// Stretches the open card a little past its size and lets it spring back.
    private func nudge() {
        guard !reduceMotion else { return }
        withAnimation(HudNotchMotion.nudgeOut) { nudgeAmount = 1 }
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(0.11))
            withAnimation(HudNotchMotion.nudgeBack) { nudgeAmount = 0 }
        }
    }

    private func buttonStyle(for role: HudNotchChoice.Role) -> HudButtonStyle {
        switch role {
        case .primary: return .primary(.teal)
        case .normal: return .secondary
        case .cancel: return .ghost
        }
    }

    private func stateLabel(_ state: HudNotchActivityState) -> String? {
        switch state {
        case .notice: return nil
        case .working: return "WORKING"
        case .waiting: return "NEEDS INPUT"
        case .done: return "DONE"
        case .failed: return "FAILED"
        }
    }

    private func tint(_ tone: HudNotchTone) -> Color {
        switch tone {
        case .info: return HudPalette.statusInfo
        case .success: return HudPalette.statusOk
        case .warning: return HudPalette.statusWarn
        case .error: return HudPalette.statusError
        }
    }
}

// MARK: - Silhouette frame

private extension View {
    /// Frames the silhouette with width on its own springier curve: an open
    /// or a resize stretches sideways and settles, a close stays calm.
    func silhouetteFrame(width: CGFloat, height: CGFloat, alignment: Alignment = .center) -> some View {
        self
            .transaction { transaction in
                transaction.animation = HudNotchMotion.widthCurve(for: transaction.animation)
            } body: { content in
                content.frame(width: width)
            }
            .frame(height: height, alignment: alignment)
    }
}

/// A frosted view of whatever is behind the notch.
struct HudNotchBackdrop: NSViewRepresentable {
    func makeNSView(context: Context) -> NSVisualEffectView {
        let view = NSVisualEffectView()
        view.material = .hudWindow
        view.blendingMode = .behindWindow
        view.state = .active
        view.appearance = NSAppearance(named: .darkAqua)
        return view
    }

    func updateNSView(_ view: NSVisualEffectView, context: Context) {}
}

// MARK: - Indicators

/// A status dot with an expanding ring while something is ongoing.
struct HudNotchPulseDot: View {
    var color: Color
    var isPulsing: Bool
    var size: CGFloat
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var ringOut = false

    var body: some View {
        ZStack {
            if isPulsing && !reduceMotion {
                Circle()
                    .stroke(color.opacity(0.7), lineWidth: 1)
                    .scaleEffect(ringOut ? 2.6 : 1)
                    .opacity(ringOut ? 0 : 0.9)
            }
            Circle()
                .fill(color)
                .shadow(color: color.opacity(0.55), radius: 4)
        }
        .frame(width: size, height: size)
        .animation(.easeInOut(duration: 0.25), value: color)
        .onAppear(perform: restart)
        .onChange(of: isPulsing) { _, _ in restart() }
        .accessibilityHidden(true)
    }

    private func restart() {
        ringOut = false
        guard isPulsing, !reduceMotion else { return }
        withAnimation(.easeOut(duration: 1.4).repeatForever(autoreverses: false)) {
            ringOut = true
        }
    }
}

/// A small ring: determinate when `progress` is set, otherwise a turning arc.
struct HudNotchProgressRing: View {
    var progress: Double?
    var color: Color
    var size: CGFloat
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var turning = false

    var body: some View {
        ZStack {
            Circle().stroke(color.opacity(0.22), lineWidth: 2)
            Circle()
                .trim(from: 0, to: progress ?? 0.28)
                .stroke(color, style: StrokeStyle(lineWidth: 2, lineCap: .round))
                .rotationEffect(.degrees(progress == nil && turning ? 270 : -90))
                .animation(.easeOut(duration: 0.3), value: progress)
        }
        .frame(width: size, height: size)
        .onAppear {
            guard progress == nil, !reduceMotion else { return }
            withAnimation(.linear(duration: 0.9).repeatForever(autoreverses: false)) { turning = true }
        }
        .accessibilityHidden(true)
    }
}

/// A thin bar: determinate when `progress` is set, otherwise a sweeping segment.
struct HudNotchProgressBar: View {
    var progress: Double?
    var color: Color
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var sweep = false

    var body: some View {
        GeometryReader { proxy in
            let width = proxy.size.width
            ZStack(alignment: .leading) {
                Capsule().fill(color.opacity(0.16))
                if let progress {
                    Capsule()
                        .fill(color)
                        .frame(width: max(3, width * progress))
                } else {
                    Capsule()
                        .fill(color.opacity(0.85))
                        .frame(width: width * 0.28)
                        .offset(x: reduceMotion ? width * 0.36 : (sweep ? width : -width * 0.28))
                }
            }
            .clipShape(Capsule())
        }
        .onAppear {
            guard progress == nil, !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 1.3).repeatForever(autoreverses: false)) { sweep = true }
        }
        .accessibilityElement()
        .accessibilityLabel(progress.map { "\(Int(($0 * 100).rounded())) percent" } ?? "In progress")
    }
}
#endif
