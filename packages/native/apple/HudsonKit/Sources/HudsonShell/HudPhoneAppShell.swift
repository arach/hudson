import SwiftUI
#if os(iOS)
import HudsonUI
#endif

enum HudPhoneAppShellAppearancePolicy: Equatable, Sendable {
    case hudson
    case inherited

    var preferredColorScheme: ColorScheme? {
        switch self {
        case .hudson: .dark
        case .inherited: nil
        }
    }
}

#if os(iOS)

/// Controls how a phone shell coordinates system-drawn chrome with its
/// content palette.
public enum HudPhoneAppShellAppearance: Equatable, Sendable {
    /// Match Hudson's stable dark palette. This is the shell default so native
    /// navigation, toolbars, sheets, dialogs, and controls remain readable
    /// even when the device itself uses Light appearance.
    case hudson

    /// Inherit the surrounding presentation's appearance. Use this only when
    /// the hosted root also supplies a scheme-adaptive palette.
    case system

    var preferredColorScheme: ColorScheme? {
        switch self {
        case .hudson: HudPhoneAppShellAppearancePolicy.hudson.preferredColorScheme
        case .system: HudPhoneAppShellAppearancePolicy.inherited.preferredColorScheme
        }
    }
}

/// iOS-first app shell. Sibling to `HudAppShell` (which targets the
/// macOS/iPad-regular chassis with leading rail + trailing inspector +
/// drawers); `HudPhoneAppShell` targets compact iPhone surfaces where the
/// chrome is a `NavigationStack` plus HUD-coordinated complications.
///
/// Pages publish their five-zone chrome via `View.hudComplications(_:)`. The
/// shell reads the preference and dispatches to the chosen renderer (`.tray`
/// by default, `.scattered` or `.minimal` for sparser shells).
/// `complicationsPresentation: .summonOnDemand()` instead keeps the five
/// slots collapsed behind a shell-owned pivot until the person asks for them.
///
/// ```
/// +-----------------------------+
/// |  [TL]·s          s·[TR]     |   <- top corner complications
/// |                             |
/// |          content            |   <- root view
/// |                             |
/// |          ╭─────╮            |
/// |          │  ★  │            |   <- center (situation-aware)
/// |          ╰─────╯            |
/// |  [BL]              [BR]     |   <- bottom corner complications
/// +-----------------------------+   (in `.tray`, BL · ★ · BR are grouped
///                                    in a glass tray; in `.scattered` they
///                                    float at their corners)
/// ```
///
/// Native `.sheet`/`.fullScreenCover`/`.toolbar` modifiers remain available
/// on the root view — the shell does not own modal presentation.
public struct HudPhoneAppShell<Root: View>: View {
    public let complicationsStyle: HudPhoneComplicationsStyle
    public let complicationsPresentation: HudPhoneComplicationsPresentation
    public let background: Color
    public let appearance: HudPhoneAppShellAppearance
    @ViewBuilder public let root: () -> Root

    @State private var complications: HudPhoneComplications = .empty
    @State private var controlDeck: HudPhoneControlDeckRuntime
    @Environment(\.accessibilityVoiceOverEnabled) private var voiceOverEnabled

    /// Creates a shell using Hudson's stable dark appearance contract.
    ///
    /// This overload preserves the original public initializer symbol for
    /// binary clients while making the new default explicit.
    public init(
        complicationsStyle: HudPhoneComplicationsStyle = .tray,
        background: Color = HudPalette.bg,
        @ViewBuilder root: @escaping () -> Root
    ) {
        self.init(
            complicationsStyle: complicationsStyle,
            complicationsPresentation: .alwaysVisible,
            background: background,
            appearance: .hudson,
            root: root
        )
    }

    /// Creates a shell with an explicit system-chrome appearance policy.
    public init(
        complicationsStyle: HudPhoneComplicationsStyle = .tray,
        background: Color = HudPalette.bg,
        appearance: HudPhoneAppShellAppearance,
        @ViewBuilder root: @escaping () -> Root
    ) {
        self.init(
            complicationsStyle: complicationsStyle,
            complicationsPresentation: .alwaysVisible,
            background: background,
            appearance: appearance,
            root: root
        )
    }

    /// Creates a shell that either keeps route complications visible or places
    /// them behind Hudson's shell-owned control-deck pivot.
    public init(
        complicationsStyle: HudPhoneComplicationsStyle = .tray,
        complicationsPresentation: HudPhoneComplicationsPresentation,
        background: Color = HudPalette.bg,
        @ViewBuilder root: @escaping () -> Root
    ) {
        self.init(
            complicationsStyle: complicationsStyle,
            complicationsPresentation: complicationsPresentation,
            background: background,
            appearance: .hudson,
            root: root
        )
    }

    /// Creates a shell with explicit appearance and complications-presentation
    /// policies.
    public init(
        complicationsStyle: HudPhoneComplicationsStyle = .tray,
        complicationsPresentation: HudPhoneComplicationsPresentation,
        background: Color = HudPalette.bg,
        appearance: HudPhoneAppShellAppearance,
        @ViewBuilder root: @escaping () -> Root
    ) {
        self.complicationsStyle = complicationsStyle
        self.complicationsPresentation = complicationsPresentation
        self.background = background
        self.appearance = appearance
        self.root = root
        self._controlDeck = State(
            initialValue: HudPhoneControlDeckRuntime(
                policy: complicationsPresentation.controlDeckPolicy
            )
        )
    }

    public var body: some View {
        NavigationStack {
            root()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(background.ignoresSafeArea())
                .onPreferenceChange(HudPhoneComplicationsKey.self) { value in
                    Task { @MainActor in
                        let resolved = value ?? .empty
                        complications = resolved
                        controlDeck.synchronize(
                            hasComplications: HudPhoneControlDeckEligibility.hasRenderableComplications(
                                resolved,
                                style: complicationsStyle
                            ),
                            voiceOverEnabled: voiceOverEnabled
                        )
                    }
                }
                .onChange(of: voiceOverEnabled) { _, enabled in
                    controlDeck.synchronize(
                        hasComplications: HudPhoneControlDeckEligibility.hasRenderableComplications(
                            complications,
                            style: complicationsStyle
                        ),
                        voiceOverEnabled: enabled
                    )
                }
                .onChange(of: complicationsPresentation) { _, presentation in
                    controlDeck.reconfigure(policy: presentation.controlDeckPolicy)
                    controlDeck.synchronize(
                        hasComplications: HudPhoneControlDeckEligibility.hasRenderableComplications(
                            complications,
                            style: complicationsStyle
                        ),
                        voiceOverEnabled: voiceOverEnabled
                    )
                }
                .onChange(of: complicationsStyle) { _, style in
                    controlDeck.synchronize(
                        hasComplications: HudPhoneControlDeckEligibility.hasRenderableComplications(
                            complications,
                            style: style
                        ),
                        voiceOverEnabled: voiceOverEnabled
                    )
                }
                .modifier(
                    HudPhoneComplicationsPresentationModifier(
                        complications: complications,
                        style: complicationsStyle,
                        presentation: complicationsPresentation,
                        controlDeck: controlDeck
                    )
                )
        }
        .preferredColorScheme(appearance.preferredColorScheme)
    }
}

private struct HudPhoneComplicationsPresentationModifier: ViewModifier {
    let complications: HudPhoneComplications
    let style: HudPhoneComplicationsStyle
    let presentation: HudPhoneComplicationsPresentation
    let controlDeck: HudPhoneControlDeckRuntime

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @AccessibilityFocusState private var expandedCloseFocused: Bool

    func body(content: Content) -> some View {
        let isExpanded = usesControlDeck && controlDeck.state == .expanded
        let renderedComplications = usesControlDeck && !isExpanded ? .empty : complications

        // Keep the hosted product content in one structural branch. State
        // and presentation changes alter only shell chrome, so opening the
        // deck or switching policy cannot reset product-local state.
        content
            .accessibilityHidden(isExpanded)
            .overlay {
                if isExpanded { dismissBackdrop }
            }
            .hudPhoneShellComplicationsRenderer(
                renderedComplications,
                style: style,
                usesControlDeck: usesControlDeck,
                reservesBottomLane: shouldReserveRendererBottomLane,
                onSlotActivated: slotActivation,
                onModePickerPresentationChanged: modePickerPresentationChange,
                onDeckDismiss: deckDismiss
            )
            // The pivot is visually floating, but it still reserves its lane
            // through the shell. Product-owned composers and other bottom
            // content never need magic padding to avoid it.
            .safeAreaInset(edge: .bottom, spacing: 0) {
                if showsRestingPivot && !rendererCanReserveBottomLane {
                    restingPivotLane
                }
            }
            .overlay(alignment: .bottom) {
                if showsRestingPivot && rendererCanReserveBottomLane {
                    restingPivot
                }
            }
            .overlay(alignment: .top) {
                if isExpanded { expandedClosePivot }
            }
            .overlay {
                if isExpanded { keyboardDismissal }
            }
            .accessibilityAddTraits(isExpanded ? .isModal : [])
            .onChange(of: isExpanded) { _, expanded in
                expandedCloseFocused = expanded
            }
            .animation(
                HudMotion.ifAllowed(HudMotion.quickFade, reduceMotion: reduceMotion),
                value: isExpanded
            )
    }

    private var usesControlDeck: Bool {
        presentation.controlDeckPolicy != nil
    }

    private var showsRestingPivot: Bool {
        usesControlDeck && controlDeck.state == .resting && hasRenderableComplications
    }

    private var hasRenderableComplications: Bool {
        HudPhoneControlDeckEligibility.hasRenderableComplications(complications, style: style)
    }

    private var rendererCanReserveBottomLane: Bool {
        guard usesControlDeck else { return false }
        switch style {
        case .tray: return false
        case .scattered, .minimal: return true
        }
    }

    private var shouldReserveRendererBottomLane: Bool {
        guard rendererCanReserveBottomLane else { return false }
        if showsRestingPivot { return true }
        guard controlDeck.state == .expanded else { return false }
        return HudPhoneControlDeckEligibility.hasBottomComplications(complications, style: style)
    }

    private var slotActivation: ((HudPhoneComplications.Position) -> Void)? {
        guard usesControlDeck else { return nil }
        return { _ in controlDeck.slotActivated() }
    }

    private var modePickerPresentationChange: ((HudPhoneComplications.Position, Bool) -> Void)? {
        guard usesControlDeck else { return nil }
        return { position, isPresented in
            controlDeck.setModePickerPresented(isPresented, at: position)
        }
    }

    private var deckDismiss: (() -> Void)? {
        guard usesControlDeck, controlDeck.state == .expanded else { return nil }
        return { controlDeck.dismiss() }
    }

    private var dismissBackdrop: some View {
        Button(action: controlDeck.dismiss) {
            Color.clear
                .contentShape(Rectangle())
                .ignoresSafeArea()
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Dismiss controls")
        .accessibilityHint("Hides the contextual controls.")
        .accessibilityAction(.escape) {
            controlDeck.dismiss()
        }
    }

    private var keyboardDismissal: some View {
        Button("Dismiss controls", action: controlDeck.dismiss)
            .keyboardShortcut(.escape, modifiers: [])
            .opacity(0)
            // Invisible keyboard sink. The visible close pivot remains the
            // discoverable control for touch and VoiceOver.
            // hudlint:disable next-line geometry
            .frame(width: 0, height: 0)
            .accessibilityHidden(true)
    }

    private var expandedClosePivot: some View {
        Button(action: controlDeck.dismiss) {
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
        .padding(.top, HudSpacing.sm)
        .accessibilityLabel("Hide controls")
        .accessibilityHint("Returns to the compact control pivot.")
        .accessibilityFocused($expandedCloseFocused)
        .accessibilityAction(.escape) {
            controlDeck.dismiss()
        }
    }

    @ViewBuilder
    private var restingPivotLane: some View {
        if !complications.slots.isEmpty {
            Color.clear
                .frame(height: HudPhoneComplicationsLayout.controlDeckLaneHeight)
                .overlay(alignment: .bottom) {
                    restingPivot
                }
        }
    }

    private var restingPivot: some View {
        Button(action: controlDeck.pivotTapped) {
            Image(systemName: "circle.grid.2x2.fill")
                .font(HudFont.ui(HudTextSize.lg, weight: .medium))
                .foregroundStyle(HudPalette.bg)
                .frame(
                    width: HudPhoneComplicationsLayout.controlDeckPivotSize,
                    height: HudPhoneComplicationsLayout.controlDeckPivotSize
                )
                .background(Circle().fill(HudPalette.accent))
                .overlay(
                    Circle().stroke(
                        HudSurface.tintStrong(HudPalette.accent),
                        lineWidth: HudStrokeWidth.standard
                    )
                )
                .shadow(
                    color: HudSurface.tintStrong(HudPalette.accent),
                    radius: 8,
                    y: 3
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Show controls")
        .accessibilityHint("Shows contextual controls for this screen.")
    }
}
#endif
