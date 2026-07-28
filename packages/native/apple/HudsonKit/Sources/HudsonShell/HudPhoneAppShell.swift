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
    public let background: Color
    public let appearance: HudPhoneAppShellAppearance
    @ViewBuilder public let root: () -> Root

    @State private var complications: HudPhoneComplications = .empty

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
        self.complicationsStyle = complicationsStyle
        self.background = background
        self.appearance = appearance
        self.root = root
    }

    public var body: some View {
        NavigationStack {
            root()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(background.ignoresSafeArea())
                .onPreferenceChange(HudPhoneComplicationsKey.self) { value in
                    Task { @MainActor in
                        complications = value ?? .empty
                    }
                }
                .hudPhoneComplicationsRenderer(complications, style: complicationsStyle)
        }
        .preferredColorScheme(appearance.preferredColorScheme)
    }
}
#endif
