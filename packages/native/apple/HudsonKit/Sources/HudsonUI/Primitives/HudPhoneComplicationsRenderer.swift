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

private struct HudComplicationSlotButton: View {
    let slot: HudPhoneComplications.Slot
    let size: CGFloat
    var iconScale: CGFloat = HudIconSize.micro

    @State private var modePickerVisible = false

    var body: some View {
        let core = ZStack {
            if modePickerVisible, let modes = slot.longPressModes {
                modePicker(modes)
                    .offset(y: -HudPhoneComplicationsLayout.modePickerLift)
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
                        withAnimation(.spring(response: 0.24, dampingFraction: 0.84)) {
                            modePickerVisible.toggle()
                        }
                    }
                    .exclusively(before: TapGesture().onEnded { slot.action() })
            )
        } else {
            core.onTapGesture { slot.action() }
        }
    }

    @ViewBuilder
    private func modePicker(_ modes: [HudPhoneComplications.Mode]) -> some View {
        HStack(spacing: HudPhoneComplicationsLayout.modePickerSpacing) {
            ForEach(modes) { mode in
                Button {
                    mode.action()
                    withAnimation(.spring(response: 0.22, dampingFraction: 0.86)) {
                        modePickerVisible = false
                    }
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

    var body: some View {
        let isLeft = (position == .topLeft || position == .bottomLeft)
        HStack(spacing: secondaryOffset) {
            if !isLeft, let secondary = slot.secondary {
                secondaryButton(secondary)
            }
            HudComplicationSlotButton(slot: slot, size: primarySize, iconScale: HudTextSize.lg)
            if isLeft, let secondary = slot.secondary {
                secondaryButton(secondary)
            }
        }
    }

    @ViewBuilder
    private func secondaryButton(_ secondary: HudPhoneComplications.Secondary) -> some View {
        Button(action: secondary.action) {
            Image(systemName: secondary.icon)
                .font(HudFont.ui(HudTextSize.xs, weight: .medium))
                .foregroundStyle(HudPalette.muted)
                .frame(width: secondarySize, height: secondarySize)
                .background(Circle().fill(HudPalette.surface))
                .overlay(Circle().stroke(HudHairline.subtle, lineWidth: HudStrokeWidth.thin))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Tray renderer (default)

/// Default renderer. Bottom three slots (BL · center · BR) sit in a compact
/// floating liquid bar. Top two slots (TL · TR) are hosted as `ToolbarItem`s
/// so they sit inline with the navigation title.
public struct HudPhoneComplicationsTray: ViewModifier {
    let complications: HudPhoneComplications

    public func body(content: Content) -> some View {
        content
            .toolbar { topToolbar }
            .safeAreaInset(edge: .bottom, spacing: 0) { bottomTray }
    }

    @ToolbarContentBuilder
    private var topToolbar: some ToolbarContent {
        if let tl = complications[.topLeft] {
            ToolbarItem(placement: .topBarLeading) {
                HudComplicationCornerSlot(
                    position: .topLeft,
                    slot: tl,
                    primarySize: HudPhoneComplicationsLayout.toolbarPrimarySize,
                    secondarySize: HudPhoneComplicationsLayout.toolbarSecondarySize,
                    secondaryOffset: HudPhoneComplicationsLayout.secondaryOffset
                )
            }
        }
        if let tr = complications[.topRight] {
            ToolbarItem(placement: .topBarTrailing) {
                HudComplicationCornerSlot(
                    position: .topRight,
                    slot: tr,
                    primarySize: HudPhoneComplicationsLayout.toolbarPrimarySize,
                    secondarySize: HudPhoneComplicationsLayout.toolbarSecondarySize,
                    secondaryOffset: HudPhoneComplicationsLayout.secondaryOffset
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
                slotOrSpacer(bl, size: HudPhoneComplicationsLayout.primarySize)
                Spacer(minLength: 0)
                if let center {
                    HudComplicationSlotButton(
                        slot: center,
                        size: HudPhoneComplicationsLayout.centerSize,
                        iconScale: 22
                    )
                }
                Spacer(minLength: 0)
                slotOrSpacer(br, size: HudPhoneComplicationsLayout.primarySize)
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
    private func slotOrSpacer(_ slot: HudPhoneComplications.Slot?, size: CGFloat) -> some View {
        if let slot {
            HudComplicationSlotButton(slot: slot, size: size, iconScale: HudIconSize.micro)
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

    public func body(content: Content) -> some View {
        content
            .overlay(alignment: .topLeading)     { corner(.topLeft) }
            .overlay(alignment: .topTrailing)    { corner(.topRight) }
            .overlay(alignment: .bottomLeading)  { corner(.bottomLeft) }
            .overlay(alignment: .bottomTrailing) { corner(.bottomRight) }
            .overlay(alignment: .bottom)         { centerSlot }
    }

    @ViewBuilder
    private func corner(_ position: HudPhoneComplications.Position) -> some View {
        if let slot = complications[position] {
            HudComplicationCornerSlot(
                position: position,
                slot: slot,
                primarySize: HudPhoneComplicationsLayout.primarySize,
                secondarySize: HudPhoneComplicationsLayout.secondarySize,
                secondaryOffset: HudPhoneComplicationsLayout.secondaryOffset
            )
            .padding(HudPhoneComplicationsLayout.cornerInset)
        }
    }

    @ViewBuilder
    private var centerSlot: some View {
        if let slot = complications[.center] {
            HudComplicationSlotButton(
                slot: slot,
                size: HudPhoneComplicationsLayout.centerSize,
                iconScale: HudTextSize.xxl
            )
            .padding(.bottom, HudPhoneComplicationsLayout.scatteredVerticalInset)
        }
    }
}

// MARK: - Minimal renderer

/// Center slot only; other positions ignored. For focus / takeover flows
/// where the chrome should disappear except for one primary action.
public struct HudPhoneComplicationsMinimal: ViewModifier {
    let complications: HudPhoneComplications

    public func body(content: Content) -> some View {
        content.safeAreaInset(edge: .bottom, spacing: 0) {
            if let center = complications[.center] {
                HudComplicationSlotButton(
                    slot: center,
                    size: HudPhoneComplicationsLayout.centerSize,
                    iconScale: 22
                )
                .padding(.vertical, HudSpacing.lg)
            }
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
        switch style {
        case .tray:
            self.modifier(HudPhoneComplicationsTray(complications: complications))
        case .scattered:
            self.modifier(HudPhoneComplicationsScattered(complications: complications))
        case .minimal:
            self.modifier(HudPhoneComplicationsMinimal(complications: complications))
        }
    }
}

#endif
