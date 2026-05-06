import SwiftUI
import HudsonUI
import Termini

/// Hudson-themed wrapper around Termini's native terminal renderer.
public struct HudTerminalSurface: View {
    private let controller: TerminiTerminalController?
    private let showsSystemKeyboard: Bool
    private let appearance: HudTerminalAppearance
    private let onTap: (() -> Void)?
    @Environment(\.colorScheme) private var colorScheme

    public init(
        controller: TerminiTerminalController? = nil,
        showsSystemKeyboard: Bool = true,
        appearance: HudTerminalAppearance = .default,
        onTap: (() -> Void)? = nil
    ) {
        self.controller = controller
        self.showsSystemKeyboard = showsSystemKeyboard
        self.appearance = appearance
        self.onTap = onTap
    }

    public var body: some View {
        let resolvedAppearance = appearance == .default
            ? HudTerminalAppearance.hudsonDefault(for: colorScheme)
            : appearance

        TerminiTerminalView(
            controller: controller,
            showsSystemKeyboard: showsSystemKeyboard,
            appearance: resolvedAppearance.terminiAppearance
        )
        .background(resolvedAppearance.backgroundColor)
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
