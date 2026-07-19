#if os(iOS)
import SwiftUI

// MARK: - Layout tokens

/// Size + spacing tokens for `HudPhoneComplications` renderers. DEBUG builds
/// can override at runtime via `HudPhoneComplicationsLayoutSettings.shared`
/// for live tweaking; release reads the static defaults.
public enum HudPhoneComplicationsLayout {
    public static var trayHeight: CGFloat { 76 }
    public static var trayHorizontalPadding: CGFloat { HudSpacing.xxl }
    public static var trayCornerRadius: CGFloat { 22 }

    public static var primarySize: CGFloat { 48 }
    public static var centerSize: CGFloat { 64 }
    public static var secondarySize: CGFloat { 22 }
    public static var secondaryOffset: CGFloat { 4 }

    /// Smaller variant for top corners hosted as `ToolbarItem`s — the system
    /// nav bar is 44pt, so the floating-tray sizes (48pt) feel oversized
    /// inline with the title.
    public static var toolbarPrimarySize: CGFloat { 32 }
    public static var toolbarSecondarySize: CGFloat { 18 }

    public static var cornerInset: CGFloat { HudSpacing.xl }
    public static var scatteredVerticalInset: CGFloat { HudSpacing.huge }

    public static var modePickerLift: CGFloat { 76 }
    public static var modePickerSpacing: CGFloat { HudSpacing.sm }

    /// Shell-owned summonable-deck chrome. Kept beside the complication
    /// geometry so products never need to compensate for the pivot lane.
    public static var controlDeckPivotSize: CGFloat { 56 }
    public static var controlDeckDismissSize: CGFloat { HudIconSize.xLarge }
    public static var controlDeckTopLaneHeight: CGFloat {
        primarySize + (HudSpacing.sm * 2)
    }
    public static var controlDeckLaneHeight: CGFloat {
        controlDeckPivotSize + HudSpacing.md
    }
}

#if DEBUG
@MainActor
public final class HudPhoneComplicationsLayoutSettings: ObservableObject {
    private static let sharedStorage = HudPhoneComplicationsLayoutSettings()
    public static var shared: HudPhoneComplicationsLayoutSettings { sharedStorage }
    @Published public var trayHeight: CGFloat = HudPhoneComplicationsLayout.trayHeight
    @Published public var primarySize: CGFloat = HudPhoneComplicationsLayout.primarySize
    @Published public var centerSize: CGFloat = HudPhoneComplicationsLayout.centerSize
    @Published public var secondarySize: CGFloat = HudPhoneComplicationsLayout.secondarySize
    @Published public var secondaryOffset: CGFloat = HudPhoneComplicationsLayout.secondaryOffset
    @Published public var cornerInset: CGFloat = HudPhoneComplicationsLayout.cornerInset
}
#endif

// MARK: - Slot rendering

private extension HudPhoneComplications.Role {
    var fillColor: Color {
        switch self {
        case .standard:    return HudPalette.surface
        case .accent:      return HudPalette.accent
        case .destructive: return HudPalette.statusError
        }
    }
    var iconColor: Color {
        switch self {
        case .standard:    return HudPalette.ink
        case .accent:      return HudPalette.bg
        case .destructive: return HudPalette.ink
        }
    }
    var strokeColor: Color {
        switch self {
        case .standard:    return HudHairline.standard
        case .accent:      return HudSurface.tintStrong(HudPalette.accent)
        case .destructive: return HudSurface.tintStrong(HudPalette.statusError)
        }
    }
}

private extension View {
    @ViewBuilder
    func hudExplicitAccessibilityLabel(_ label: String?) -> some View {
        if let label {
            accessibilityLabel(label)
        } else {
            self
        }
    }

    /// Gesture-backed slots must synthesize one accessibility element. When a
    /// product supplies a label it is authoritative; otherwise combine the
    /// SF Symbol child so SwiftUI can preserve its localized system meaning.
    @ViewBuilder
    func hudGestureSlotAccessibilityLabel(_ label: String?) -> some View {
        if let label {
            accessibilityElement(children: .ignore)
                .accessibilityLabel(label)
        } else {
            accessibilityElement(children: .combine)
        }
    }

    /// Installs Escape only when this control belongs to an expanded shell
    /// deck. A nil action leaves always-visible product controls untouched.
    @ViewBuilder
    func hudControlDeckDismissAccessibilityAction(_ action: (() -> Void)?) -> some View {
        if let action {
            accessibilityAction(.escape) { action() }
        } else {
            self
        }
    }
}

private struct HudComplicationSlotButton: View {
    let position: HudPhoneComplications.Position
    let slot: HudPhoneComplications.Slot
    let size: CGFloat
    var iconScale: CGFloat = HudIconSize.micro
    var onSlotActivated: ((HudPhoneComplications.Position) -> Void)?
    var onModePickerPresentationChanged: ((HudPhoneComplications.Position, Bool) -> Void)?
    var onDeckDismiss: (() -> Void)?

    @State private var modePickerVisible = false

    var body: some View {
        let core = ZStack {
            if modePickerVisible, let modes = slot.longPressModes {
                modePicker(modes)
                    .offset(y: modePickerVerticalOffset)
                    .transition(.scale(scale: 0.85).combined(with: .opacity))
            }

            Circle()
                .fill(slot.role.fillColor)
                .frame(width: size, height: size)
                .overlay(Circle().stroke(slot.role.strokeColor, lineWidth: HudStrokeWidth.standard))

            Image(systemName: slot.icon)
                .font(.system(size: iconScale, weight: .medium))
                .foregroundStyle(slot.role.iconColor)
        }
        .contentShape(Circle())

        if slot.longPressModes != nil {
            // Compose explicitly so the long-press timer can fulfill before the
            // tap fires. With separate `.onTapGesture` + `.onLongPressGesture`
            // SwiftUI resolves the tap on touch-up, which steals the gesture on
            // simulator click-and-hold.
            core.gesture(
                LongPressGesture(minimumDuration: 0.45)
                    .onEnded { _ in
                        UIImpactFeedbackGenerator(style: .rigid).impactOccurred()
                        setModePickerVisible(!modePickerVisible)
                    }
                    .exclusively(before: TapGesture().onEnded { activateSlot() })
            )
            .hudGestureSlotAccessibilityLabel(slot.label)
            .accessibilityAddTraits(.isButton)
            .accessibilityAction { activateSlot() }
            .accessibilityActions {
                ForEach(slot.longPressModes ?? []) { mode in
                    Button(mode.label) { selectMode(mode) }
                }
            }
            .hudControlDeckDismissAccessibilityAction(onDeckDismiss)
            .onDisappear {
                if modePickerVisible {
                    onModePickerPresentationChanged?(position, false)
                }
            }
        } else {
            Button(action: activateSlot) {
                core
            }
            .buttonStyle(.plain)
            .hudExplicitAccessibilityLabel(slot.label)
            .hudControlDeckDismissAccessibilityAction(onDeckDismiss)
        }
    }

    private func activateSlot() {
        setModePickerVisible(false)
        onSlotActivated?(position)
        slot.action()
    }

    private func selectMode(_ mode: HudPhoneComplications.Mode) {
        setModePickerVisible(false)
        onSlotActivated?(position)
        mode.action()
    }

    private func setModePickerVisible(_ isVisible: Bool) {
        guard modePickerVisible != isVisible else { return }
        withAnimation(.spring(response: 0.24, dampingFraction: 0.84)) {
            modePickerVisible = isVisible
        }
        onModePickerPresentationChanged?(position, isVisible)
    }

    private var modePickerVerticalOffset: CGFloat {
        switch position {
        case .topLeft, .topRight:
            HudPhoneComplicationsLayout.modePickerLift
        case .bottomLeft, .bottomRight, .center:
            -HudPhoneComplicationsLayout.modePickerLift
        }
    }

    @ViewBuilder
    private func modePicker(_ modes: [HudPhoneComplications.Mode]) -> some View {
        HStack(spacing: HudPhoneComplicationsLayout.modePickerSpacing) {
            ForEach(modes) { mode in
                Button {
                    selectMode(mode)
                } label: {
                    VStack(spacing: HudSpacing.xxs) {
                        Image(systemName: mode.icon)
                            .font(HudFont.ui(HudTextSize.md, weight: .medium))
                        Text(mode.label)
                            .font(HudFont.ui(HudTextSize.xxs, weight: .medium))
                    }
                    .foregroundStyle(HudPalette.ink)
                    .padding(.horizontal, HudSpacing.md)
                    .padding(.vertical, HudSpacing.sm)
                }
                .buttonStyle(.plain)
                .hudControlDeckDismissAccessibilityAction(onDeckDismiss)
            }
        }
        .padding(HudSpacing.sm)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: HudRadius.card))
        .overlay(RoundedRectangle(cornerRadius: HudRadius.card).stroke(HudHairline.standard, lineWidth: HudStrokeWidth.thin))
    }
}

private struct HudComplicationCornerSlot: View {
    let position: HudPhoneComplications.Position
    let slot: HudPhoneComplications.Slot
    let primarySize: CGFloat
    let secondarySize: CGFloat
    let secondaryOffset: CGFloat
    var onSlotActivated: ((HudPhoneComplications.Position) -> Void)?
    var onModePickerPresentationChanged: ((HudPhoneComplications.Position, Bool) -> Void)?
    var onDeckDismiss: (() -> Void)?

    var body: some View {
        let isLeft = (position == .topLeft || position == .bottomLeft)
        HStack(spacing: secondaryOffset) {
            if !isLeft, let secondary = slot.secondary {
                secondaryButton(secondary)
            }
            HudComplicationSlotButton(
                position: position,
                slot: slot,
                size: primarySize,
                iconScale: HudTextSize.lg,
                onSlotActivated: onSlotActivated,
                onModePickerPresentationChanged: onModePickerPresentationChanged,
                onDeckDismiss: onDeckDismiss
            )
            if isLeft, let secondary = slot.secondary {
                secondaryButton(secondary)
            }
        }
    }

    @ViewBuilder
    private func secondaryButton(_ secondary: HudPhoneComplications.Secondary) -> some View {
        Button {
            onSlotActivated?(position)
            secondary.action()
        } label: {
            Image(systemName: secondary.icon)
                .font(HudFont.ui(HudTextSize.xs, weight: .medium))
                .foregroundStyle(HudPalette.muted)
                .frame(width: secondarySize, height: secondarySize)
                .background(Circle().fill(HudPalette.surface))
                .overlay(Circle().stroke(HudHairline.subtle, lineWidth: HudStrokeWidth.thin))
        }
        .buttonStyle(.plain)
        .hudControlDeckDismissAccessibilityAction(onDeckDismiss)
    }
}

// MARK: - Summonable control-deck top lane

/// Package-only renderer for the complete expanded top zone. The phone shell
/// owns presentation and dismissal; HudsonUI owns the collision-free geometry
/// shared by every product using a summon-on-demand deck.
package struct HudPhoneControlDeckTopLane: View {
    let complications: HudPhoneComplications
    let style: HudPhoneComplicationsStyle
    let onSlotActivated: ((HudPhoneComplications.Position) -> Void)?
    let onModePickerPresentationChanged: ((HudPhoneComplications.Position, Bool) -> Void)?
    let onDeckDismiss: () -> Void

    @AccessibilityFocusState private var closeFocused: Bool

    package init(
        complications: HudPhoneComplications,
        style: HudPhoneComplicationsStyle,
        onSlotActivated: ((HudPhoneComplications.Position) -> Void)?,
        onModePickerPresentationChanged: ((HudPhoneComplications.Position, Bool) -> Void)?,
        onDeckDismiss: @escaping () -> Void
    ) {
        self.complications = complications
        self.style = style
        self.onSlotActivated = onSlotActivated
        self.onModePickerPresentationChanged = onModePickerPresentationChanged
        self.onDeckDismiss = onDeckDismiss
    }

    package var body: some View {
        HStack(spacing: HudSpacing.lg) {
            topSlotOrSpacer(.topLeft)
                .frame(maxWidth: .infinity, alignment: .leading)

            closeButton

            topSlotOrSpacer(.topRight)
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .padding(.horizontal, HudPhoneComplicationsLayout.cornerInset)
        .padding(.vertical, HudSpacing.sm)
        .frame(minHeight: HudPhoneComplicationsLayout.controlDeckTopLaneHeight)
        .onAppear { closeFocused = true }
    }

    @ViewBuilder
    private func topSlotOrSpacer(_ position: HudPhoneComplications.Position) -> some View {
        if style != .minimal, let slot = complications[position] {
            HudComplicationCornerSlot(
                position: position,
                slot: slot,
                primarySize: HudPhoneComplicationsLayout.primarySize,
                secondarySize: HudPhoneComplicationsLayout.secondarySize,
                secondaryOffset: HudPhoneComplicationsLayout.secondaryOffset,
                onSlotActivated: onSlotActivated,
                onModePickerPresentationChanged: onModePickerPresentationChanged,
                onDeckDismiss: onDeckDismiss
            )
        } else {
            Color.clear
                .frame(
                    width: HudPhoneComplicationsLayout.primarySize,
                    height: HudPhoneComplicationsLayout.primarySize
                )
                .accessibilityHidden(true)
        }
    }

    private var closeButton: some View {
        Button(action: onDeckDismiss) {
            Image(systemName: "xmark")
                .font(HudFont.ui(HudTextSize.sm, weight: .bold))
                .foregroundStyle(HudPalette.ink)
                .frame(
                    width: HudPhoneComplicationsLayout.controlDeckDismissSize,
                    height: HudPhoneComplicationsLayout.controlDeckDismissSize
                )
                .background(Circle().fill(HudPalette.surface))
                .overlay(Circle().stroke(HudHairline.standard, lineWidth: HudStrokeWidth.standard))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Hide controls")
        .accessibilityHint("Returns to the compact control pivot.")
        .accessibilityFocused($closeFocused)
        .accessibilityAction(.escape) { onDeckDismiss() }
    }
}

// MARK: - Tray renderer (default)

/// Default renderer. Bottom three slots (BL · center · BR) sit in a compact
/// floating liquid bar. Top two slots (TL · TR) are hosted as `ToolbarItem`s
/// so they sit inline with the navigation title.
public struct HudPhoneComplicationsTray: ViewModifier {
    let complications: HudPhoneComplications
    var onSlotActivated: ((HudPhoneComplications.Position) -> Void)?
    var onModePickerPresentationChanged: ((HudPhoneComplications.Position, Bool) -> Void)?
    var onDeckDismiss: (() -> Void)?
    var suppressesTopCorners = false

    public func body(content: Content) -> some View {
        content
            .toolbar { topToolbar }
            .safeAreaInset(edge: .bottom, spacing: 0) { bottomTray }
    }

    @ToolbarContentBuilder
    private var topToolbar: some ToolbarContent {
        if !suppressesTopCorners, let tl = complications[.topLeft] {
            ToolbarItem(placement: .topBarLeading) {
                HudComplicationCornerSlot(
                    position: .topLeft,
                    slot: tl,
                    primarySize: HudPhoneComplicationsLayout.toolbarPrimarySize,
                    secondarySize: HudPhoneComplicationsLayout.toolbarSecondarySize,
                    secondaryOffset: HudPhoneComplicationsLayout.secondaryOffset,
                    onSlotActivated: onSlotActivated,
                    onModePickerPresentationChanged: onModePickerPresentationChanged,
                    onDeckDismiss: onDeckDismiss
                )
            }
        }
        if !suppressesTopCorners, let tr = complications[.topRight] {
            ToolbarItem(placement: .topBarTrailing) {
                HudComplicationCornerSlot(
                    position: .topRight,
                    slot: tr,
                    primarySize: HudPhoneComplicationsLayout.toolbarPrimarySize,
                    secondarySize: HudPhoneComplicationsLayout.toolbarSecondarySize,
                    secondaryOffset: HudPhoneComplicationsLayout.secondaryOffset,
                    onSlotActivated: onSlotActivated,
                    onModePickerPresentationChanged: onModePickerPresentationChanged,
                    onDeckDismiss: onDeckDismiss
                )
            }
        }
    }

    @ViewBuilder
    private var bottomTray: some View {
        let bl = complications[.bottomLeft]
        let br = complications[.bottomRight]
        let center = complications[.center]
        if bl != nil || br != nil || center != nil {
            HStack(spacing: 0) {
                slotOrSpacer(bl, position: .bottomLeft, size: HudPhoneComplicationsLayout.primarySize)
                Spacer(minLength: 0)
                if let center {
                    HudComplicationSlotButton(
                        position: .center,
                        slot: center,
                        size: HudPhoneComplicationsLayout.centerSize,
                        iconScale: 22,
                        onSlotActivated: onSlotActivated,
                        onModePickerPresentationChanged: onModePickerPresentationChanged,
                        onDeckDismiss: onDeckDismiss
                    )
                }
                Spacer(minLength: 0)
                slotOrSpacer(br, position: .bottomRight, size: HudPhoneComplicationsLayout.primarySize)
            }
            .padding(.horizontal, HudSpacing.xxl)
            .padding(.vertical, HudSpacing.sm)
            .frame(minHeight: HudLiquidBarMetrics.minHeight)
            .frame(maxWidth: HudLiquidBarMetrics.maxWidth)
            .hudLiquidBarMaterial(tint: .regular)
            .padding(.horizontal, HudSpacing.lg)
            .padding(.bottom, HudSpacing.md)
        }
    }

    @ViewBuilder
    private func slotOrSpacer(
        _ slot: HudPhoneComplications.Slot?,
        position: HudPhoneComplications.Position,
        size: CGFloat
    ) -> some View {
        if let slot {
            HudComplicationSlotButton(
                position: position,
                slot: slot,
                size: size,
                iconScale: HudIconSize.micro,
                onSlotActivated: onSlotActivated,
                onModePickerPresentationChanged: onModePickerPresentationChanged,
                onDeckDismiss: onDeckDismiss
            )
        } else {
            Color.clear.frame(width: size, height: size)
        }
    }

}

// MARK: - Scattered renderer

/// All five slots as floating affordances at their corner positions. No
/// grouping, no tray. For shells that want a sparser, more distributed chrome.
public struct HudPhoneComplicationsScattered: ViewModifier {
    let complications: HudPhoneComplications
    var onSlotActivated: ((HudPhoneComplications.Position) -> Void)?
    var onModePickerPresentationChanged: ((HudPhoneComplications.Position, Bool) -> Void)?
    var onDeckDismiss: (() -> Void)?
    var reservesBottomLane = false
    var suppressesTopCorners = false

    public func body(content: Content) -> some View {
        content
            .overlay(alignment: .topLeading)     {
                if !suppressesTopCorners { corner(.topLeft) }
            }
            .overlay(alignment: .topTrailing)    {
                if !suppressesTopCorners { corner(.topRight) }
            }
            .overlay(alignment: .bottomLeading)  {
                if !reservesBottomLane { corner(.bottomLeft) }
            }
            .overlay(alignment: .bottomTrailing) {
                if !reservesBottomLane { corner(.bottomRight) }
            }
            .overlay(alignment: .bottom) {
                if !reservesBottomLane { centerSlot }
            }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                if reservesBottomLane { reservedBottomLane }
            }
    }

    @ViewBuilder
    private func corner(_ position: HudPhoneComplications.Position) -> some View {
        if let slot = complications[position] {
            HudComplicationCornerSlot(
                position: position,
                slot: slot,
                primarySize: HudPhoneComplicationsLayout.primarySize,
                secondarySize: HudPhoneComplicationsLayout.secondarySize,
                secondaryOffset: HudPhoneComplicationsLayout.secondaryOffset,
                onSlotActivated: onSlotActivated,
                onModePickerPresentationChanged: onModePickerPresentationChanged,
                onDeckDismiss: onDeckDismiss
            )
            .padding(HudPhoneComplicationsLayout.cornerInset)
        }
    }

    @ViewBuilder
    private var centerSlot: some View {
        if let slot = complications[.center] {
            HudComplicationSlotButton(
                position: .center,
                slot: slot,
                size: HudPhoneComplicationsLayout.centerSize,
                iconScale: HudTextSize.xxl,
                onSlotActivated: onSlotActivated,
                onModePickerPresentationChanged: onModePickerPresentationChanged,
                onDeckDismiss: onDeckDismiss
            )
            .padding(.bottom, HudPhoneComplicationsLayout.scatteredVerticalInset)
        }
    }

    private var reservedBottomLane: some View {
        HStack(spacing: 0) {
            bottomSlotOrSpacer(.bottomLeft, size: HudPhoneComplicationsLayout.primarySize)
            Spacer(minLength: 0)
            if let slot = complications[.center] {
                HudComplicationSlotButton(
                    position: .center,
                    slot: slot,
                    size: HudPhoneComplicationsLayout.centerSize,
                    iconScale: HudTextSize.xxl,
                    onSlotActivated: onSlotActivated,
                    onModePickerPresentationChanged: onModePickerPresentationChanged,
                    onDeckDismiss: onDeckDismiss
                )
            } else {
                Color.clear.frame(
                    width: HudPhoneComplicationsLayout.centerSize,
                    height: HudPhoneComplicationsLayout.centerSize
                )
            }
            Spacer(minLength: 0)
            bottomSlotOrSpacer(.bottomRight, size: HudPhoneComplicationsLayout.primarySize)
        }
        .padding(.horizontal, HudPhoneComplicationsLayout.cornerInset)
        .padding(.vertical, HudSpacing.sm)
    }

    @ViewBuilder
    private func bottomSlotOrSpacer(
        _ position: HudPhoneComplications.Position,
        size: CGFloat
    ) -> some View {
        if let slot = complications[position] {
            HudComplicationCornerSlot(
                position: position,
                slot: slot,
                primarySize: size,
                secondarySize: HudPhoneComplicationsLayout.secondarySize,
                secondaryOffset: HudPhoneComplicationsLayout.secondaryOffset,
                onSlotActivated: onSlotActivated,
                onModePickerPresentationChanged: onModePickerPresentationChanged,
                onDeckDismiss: onDeckDismiss
            )
        } else {
            Color.clear.frame(width: size, height: size)
        }
    }
}

// MARK: - Minimal renderer

/// Center slot only; other positions ignored. For focus / takeover flows
/// where the chrome should disappear except for one primary action.
public struct HudPhoneComplicationsMinimal: ViewModifier {
    let complications: HudPhoneComplications
    var onSlotActivated: ((HudPhoneComplications.Position) -> Void)?
    var onModePickerPresentationChanged: ((HudPhoneComplications.Position, Bool) -> Void)?
    var onDeckDismiss: (() -> Void)?
    var reservesBottomLane = false

    public func body(content: Content) -> some View {
        content.safeAreaInset(edge: .bottom, spacing: 0) {
            if reservesBottomLane {
                Color.clear
                    .frame(height: HudPhoneComplicationsLayout.centerSize + (HudSpacing.lg * 2))
                    .overlay { centerSlot }
            } else if complications[.center] != nil {
                centerSlot.padding(.vertical, HudSpacing.lg)
            }
        }
    }

    @ViewBuilder
    private var centerSlot: some View {
        if let center = complications[.center] {
            HudComplicationSlotButton(
                position: .center,
                slot: center,
                size: HudPhoneComplicationsLayout.centerSize,
                iconScale: 22,
                onSlotActivated: onSlotActivated,
                onModePickerPresentationChanged: onModePickerPresentationChanged,
                onDeckDismiss: onDeckDismiss
            )
        }
    }
}

// MARK: - Style dispatch

extension View {
    /// Apply a `HudPhoneComplications` value with the chosen render style.
    /// Used internally by `HudPhoneAppShell`; consumers normally don't call
    /// this — they publish via `.hudComplications(_:)` and let the shell
    /// dispatch.
    @ViewBuilder
    public func hudPhoneComplicationsRenderer(
        _ complications: HudPhoneComplications,
        style: HudPhoneComplicationsStyle
    ) -> some View {
        hudPhoneComplicationsRenderer(
            complications,
            style: style,
            onSlotActivated: nil,
            onModePickerPresentationChanged: nil,
            onDeckDismiss: nil
        )
    }

    /// Package-only action relay used by `HudPhoneAppShell`'s summonable
    /// control deck. It keeps product slot closures in `HudPhoneComplications`
    /// while allowing the shell to collapse its own chrome before forwarding
    /// the action.
    @ViewBuilder
    package func hudPhoneShellComplicationsRenderer(
        _ complications: HudPhoneComplications,
        style: HudPhoneComplicationsStyle,
        usesControlDeck: Bool,
        reservesBottomLane: Bool,
        onSlotActivated: ((HudPhoneComplications.Position) -> Void)?,
        onModePickerPresentationChanged: ((HudPhoneComplications.Position, Bool) -> Void)?,
        onDeckDismiss: (() -> Void)?
    ) -> some View {
        hudPhoneComplicationsRenderer(
            complications,
            style: style,
            onSlotActivated: onSlotActivated,
            onModePickerPresentationChanged: onModePickerPresentationChanged,
            onDeckDismiss: onDeckDismiss,
            suppressesTopCorners: usesControlDeck,
            reservesBottomLane: reservesBottomLane
        )
    }

    @ViewBuilder
    private func hudPhoneComplicationsRenderer(
        _ complications: HudPhoneComplications,
        style: HudPhoneComplicationsStyle,
        onSlotActivated: ((HudPhoneComplications.Position) -> Void)?,
        onModePickerPresentationChanged: ((HudPhoneComplications.Position, Bool) -> Void)?,
        onDeckDismiss: (() -> Void)?,
        suppressesTopCorners: Bool = false,
        reservesBottomLane: Bool = false
    ) -> some View {
        switch style {
        case .tray:
            self.modifier(HudPhoneComplicationsTray(
                complications: complications,
                onSlotActivated: onSlotActivated,
                onModePickerPresentationChanged: onModePickerPresentationChanged,
                onDeckDismiss: onDeckDismiss,
                suppressesTopCorners: suppressesTopCorners
            ))
        case .scattered:
            self.modifier(HudPhoneComplicationsScattered(
                complications: complications,
                onSlotActivated: onSlotActivated,
                onModePickerPresentationChanged: onModePickerPresentationChanged,
                onDeckDismiss: onDeckDismiss,
                reservesBottomLane: reservesBottomLane,
                suppressesTopCorners: suppressesTopCorners
            ))
        case .minimal:
            self.modifier(HudPhoneComplicationsMinimal(
                complications: complications,
                onSlotActivated: onSlotActivated,
                onModePickerPresentationChanged: onModePickerPresentationChanged,
                onDeckDismiss: onDeckDismiss,
                reservesBottomLane: reservesBottomLane
            ))
        }
    }
}

#endif
