#if os(iOS)
import SwiftUI
import HudsonUI

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
    @ViewBuilder public let root: () -> Root

    @State private var complications: HudPhoneComplications = .empty

    public init(
        complicationsStyle: HudPhoneComplicationsStyle = .tray,
        background: Color = HudPalette.bg,
        @ViewBuilder root: @escaping () -> Root
    ) {
        self.complicationsStyle = complicationsStyle
        self.background = background
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
    }
}
#endif
