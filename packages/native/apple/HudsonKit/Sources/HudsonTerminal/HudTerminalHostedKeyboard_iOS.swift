#if canImport(UIKit)
import SwiftUI
import UIKit
import HudsonUIKeyboard

public enum HudTerminalDictationPhase: Equatable {
    case idle, recording, processing

    var keyboardState: HudHostedKeyboard.DictationState {
        switch self {
        case .idle: .idle
        case .recording: .recording
        case .processing: .processing
        }
    }
}

public enum HudTerminalKeyboardLayout: Equatable {
    case quick
    case full

    var hostedInitialLayout: HudHostedKeyboard.InitialLayout {
        switch self {
        case .quick: .minimal
        case .full: .compact
        }
    }
}

/// Hudson's hosted keyboard wired to a terminal byte sink. Hosts own dictation
/// and presentation; this component owns terminal key translation and modifier
/// latches so every client speaks the same PTY input language.
public struct HudTerminalHostedKeyboard: UIViewRepresentable {
    public var send: (Data) -> Void
    public var onDictate: () -> Void
    public var dictationPhase: HudTerminalDictationPhase
    public var successPulse: Int
    @Binding public var preferredHeight: CGFloat
    public var layout: HudTerminalKeyboardLayout
    public var onLayoutChange: (HudTerminalKeyboardLayout) -> Void

    private static let minimalSlots: [Int: SlotConfig] = [
        1: .action("ESC", icon: "escape"),
        2: .action("TAB", icon: "arrow.right.to.line"),
        3: .text("^C", inserts: "\u{03}"),
        4: .action("ENTER", icon: "return"),
    ]

    public init(
        send: @escaping (Data) -> Void,
        onDictate: @escaping () -> Void,
        dictationPhase: HudTerminalDictationPhase,
        successPulse: Int,
        preferredHeight: Binding<CGFloat>,
        layout: HudTerminalKeyboardLayout,
        onLayoutChange: @escaping (HudTerminalKeyboardLayout) -> Void
    ) {
        self.send = send
        self.onDictate = onDictate
        self.dictationPhase = dictationPhase
        self.successPulse = successPulse
        self._preferredHeight = preferredHeight
        self.layout = layout
        self.onLayoutChange = onLayoutChange
    }

    public func makeCoordinator() -> Coordinator {
        Coordinator(send: send, onDictate: onDictate)
    }

    public func makeUIView(context: Context) -> HudHostedKeyboard {
        let keyboard = HudHostedKeyboard()
        keyboard.preferredInitialLayout = layout.hostedInitialLayout
        keyboard.inputHost = context.coordinator
        keyboard.customMinimalSlotConfigs = Self.minimalSlots
        keyboard.showsMinimalDictateButton = true
        keyboard.onDictationToggle = { [weak coordinator = context.coordinator] in
            coordinator?.onDictate()
        }
        keyboard.onLayoutHeightChange = { [weak keyboard, weak coordinator = context.coordinator] in
            guard let keyboard else { return }
            let height = keyboard.intrinsicContentSize.height
            let resolvedLayout: HudTerminalKeyboardLayout = height < 160 ? .quick : .full
            DispatchQueue.main.async {
                preferredHeight = height
                coordinator?.onLayoutChange(resolvedLayout)
            }
        }
        context.coordinator.keyboard = keyboard
        context.coordinator.onLayoutChange = onLayoutChange
        context.coordinator.lastSuccessPulse = successPulse
        keyboard.setDictationState(dictationPhase.keyboardState)
        DispatchQueue.main.async { preferredHeight = keyboard.intrinsicContentSize.height }
        return keyboard
    }

    public func updateUIView(_ uiView: HudHostedKeyboard, context: Context) {
        context.coordinator.send = send
        context.coordinator.onDictate = onDictate
        context.coordinator.onLayoutChange = onLayoutChange
        let targetLayout = layout.hostedInitialLayout
        if uiView.preferredInitialLayout != targetLayout {
            uiView.preferredInitialLayout = targetLayout
        }
        uiView.setDictationState(dictationPhase.keyboardState)
        if successPulse != context.coordinator.lastSuccessPulse {
            context.coordinator.lastSuccessPulse = successPulse
            uiView.showDictationSuccessFeedback()
        }
    }

    @MainActor
    public final class Coordinator: KeyboardInputHost {
        var send: (Data) -> Void
        var onDictate: () -> Void
        var onLayoutChange: (HudTerminalKeyboardLayout) -> Void = { _ in }
        weak var keyboard: HudHostedKeyboard?
        var lastSuccessPulse = 0

        private var control: HudTerminalModifierState = .inactive
        private var shift: HudTerminalModifierState = .inactive

        init(send: @escaping (Data) -> Void, onDictate: @escaping () -> Void) {
            self.send = send
            self.onDictate = onDictate
        }

        private func write(_ string: String) {
            send(Data(string.utf8))
        }

        public func performKeyboardAction(_ action: KeyboardAction) {
            switch action {
            case .insert(let text):
                sendTranslated(text)
            case .deleteBackward:
                write("\u{7F}")
            case .tab:
                write("\t")
            case .escape:
                write("\u{1B}")
            case .enter:
                write("\r")
            case .interrupt:
                write("\u{03}")
            case .copy, .selectAll:
                break
            case .paste:
                if let string = UIPasteboard.general.string, !string.isEmpty {
                    sendTranslated(string)
                }
            case .toggleShift:
                shift = shift == .armed ? .inactive : .armed
            case .toggleControl:
                control = control == .armed ? .inactive : .armed
            case .dismissKeyboard:
                keyboard?.resignFirstResponder()
            case .moveCursor(let movement):
                switch movement {
                case .left: write("\u{1B}[D")
                case .right: write("\u{1B}[C")
                case .up: write("\u{1B}[A")
                case .down: write("\u{1B}[B")
                case .wordLeft: write("\u{1B}b")
                case .wordRight: write("\u{1B}f")
                }
            }
        }

        private func sendTranslated(_ text: String) {
            guard let resolved = HudTerminalInputTranslator.resolvedInput(
                for: text,
                controlModifierState: control,
                shiftModifierState: shift
            ) else { return }
            write(resolved.payload)
            if resolved.consumedControl, control.consumesAfterUse { control = .inactive }
            if resolved.consumedShift, shift.consumesAfterUse { shift = .inactive }
        }
    }
}
#endif
