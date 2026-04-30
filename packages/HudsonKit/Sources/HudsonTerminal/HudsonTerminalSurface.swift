import SwiftUI
import HudsonUI
import TermBridgeKit

/// Hudson-themed wrapper around TermBridgeKit's native terminal renderer.
public struct HudsonTerminalSurface: View {
    private let controller: TermBridgeKitTerminalController?
    private let showsSystemKeyboard: Bool
    private let appearance: HudsonTerminalAppearance
    private let onTap: (() -> Void)?

    public init(
        controller: TermBridgeKitTerminalController? = nil,
        showsSystemKeyboard: Bool = true,
        appearance: HudsonTerminalAppearance = .default,
        onTap: (() -> Void)? = nil
    ) {
        self.controller = controller
        self.showsSystemKeyboard = showsSystemKeyboard
        self.appearance = appearance
        self.onTap = onTap
    }

    public var body: some View {
        TermBridgeKitTerminalView(
            controller: controller,
            showsSystemKeyboard: showsSystemKeyboard,
            appearance: appearance.termBridgeAppearance
        )
        .background(appearance.backgroundColor)
        .contentShape(Rectangle())
        .simultaneousGesture(
            TapGesture()
                .onEnded {
                    controller?.focus()
                    onTap?()
                }
        )
        .accessibilityIdentifier("hudson-terminal")
        .accessibilityLabel("Hudson terminal")
    }
}
