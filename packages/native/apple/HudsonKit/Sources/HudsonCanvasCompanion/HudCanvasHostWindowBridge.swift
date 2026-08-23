#if os(macOS)
import AppKit
import SwiftUI
import HudsonCanvasCore

/// Native window treatment paired with the Canvas shell composition.
public enum HudCanvasHostWindowStyle: String, CaseIterable, Identifiable, Sendable {
    case standard
    case fullHeightSidebar

    public var id: String { rawValue }
}

/// Bridges AppKit menu-bar actions and title-bar accessories into SwiftUI hosts.
public struct HudCanvasHostWindowBridge: View {
    @Environment(\.openWindow) private var openWindow
    private let style: HudCanvasHostWindowStyle

    public init(style: HudCanvasHostWindowStyle = .standard) {
        self.style = style
    }

    public var body: some View {
        Color.clear
            .frame(width: .zero, height: .zero)
            .background(HudCanvasTitlebarChromeInstaller(style: style))
            .onReceive(NotificationCenter.default.publisher(for: .canvasHostShowMainWindow)) { _ in
                openWindow(id: "main")
                NSApp.activate(ignoringOtherApps: true)
            }
    }
}

extension View {
    public func hudCanvasHostWindowBridge(
        style: HudCanvasHostWindowStyle = .standard
    ) -> some View {
        background(HudCanvasHostWindowBridge(style: style))
    }
}

private struct HudCanvasTitlebarChromeInstaller: NSViewRepresentable {
    let style: HudCanvasHostWindowStyle

    func makeNSView(context: Context) -> HudCanvasTitlebarChromeView {
        HudCanvasTitlebarChromeView(style: style)
    }

    func updateNSView(_ view: HudCanvasTitlebarChromeView, context: Context) {
        view.setStyle(style)
        view.installIfPossible()
    }
}

private final class HudCanvasTitlebarChromeView: NSView {
    private static let accessoryMarker = "com.hudsonkit.canvas.titlebar-accessory"
    private var installationScheduled = false
    private var style: HudCanvasHostWindowStyle

    init(style: HudCanvasHostWindowStyle) {
        self.style = style
        super.init(frame: .zero)
    }

    required init?(coder: NSCoder) {
        self.style = .standard
        super.init(coder: coder)
    }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        installIfPossible()
    }

    func setStyle(_ style: HudCanvasHostWindowStyle) {
        guard self.style != style else { return }
        self.style = style
        installIfPossible()
    }

    func installIfPossible() {
        guard let window else { return }
        guard !installationScheduled else { return }
        installationScheduled = true

        DispatchQueue.main.async { [weak self, weak window] in
            guard let self else { return }
            self.installationScheduled = false
            guard let window, self.window === window else { return }
            self.performInstall(in: window)
        }
    }

    private func performInstall(in window: NSWindow) {
        window.titlebarSeparatorStyle = .none
        window.isMovableByWindowBackground = false

        if window.toolbar?.identifier == NSToolbar.Identifier("com.hudsonkit.canvas.window-toolbar") {
            window.toolbar = nil
        }

        for (index, controller) in window.titlebarAccessoryViewControllers.enumerated().reversed() {
            if controller.representedObject as? String == Self.accessoryMarker {
                window.removeTitlebarAccessoryViewController(at: index)
            }
        }

        switch style {
        case .standard:
            window.titleVisibility = .visible
            window.titlebarAppearsTransparent = false
            window.styleMask.remove(.fullSizeContentView)
            window.toolbar?.isVisible = true
            window.toolbarStyle = .unified
            window.addTitlebarAccessoryViewController(
                titlebarButtonAccessory(
                    placement: .left,
                    label: "Toggle Navigator",
                    symbolName: "sidebar.left",
                    action: #selector(toggleNavigator)
                )
            )
            window.addTitlebarAccessoryViewController(
                titlebarButtonAccessory(
                    placement: .right,
                    label: "Toggle Inspector",
                    symbolName: "sidebar.right",
                    action: #selector(toggleInspector)
                )
            )

        case .fullHeightSidebar:
            window.titleVisibility = .hidden
            window.titlebarAppearsTransparent = true
            window.styleMask.insert(.fullSizeContentView)
            window.toolbar?.isVisible = false
        }
    }

    private func titlebarButtonAccessory(
        placement: NSLayoutConstraint.Attribute,
        label: String,
        symbolName: String,
        action: Selector
    ) -> NSTitlebarAccessoryViewController {
        let button = NSButton(
            image: NSImage(systemSymbolName: symbolName, accessibilityDescription: label) ?? NSImage(),
            target: self,
            action: action
        )
        button.translatesAutoresizingMaskIntoConstraints = false
        button.bezelStyle = .texturedRounded
        button.imagePosition = .imageOnly
        button.isBordered = true
        button.toolTip = label
        button.setButtonType(.momentaryPushIn)

        let container = NSView(frame: NSRect(x: 0, y: 0, width: 28, height: 24))
        container.addSubview(button)
        NSLayoutConstraint.activate([
            button.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            button.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            button.topAnchor.constraint(equalTo: container.topAnchor),
            button.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            container.widthAnchor.constraint(equalToConstant: 28),
            container.heightAnchor.constraint(equalToConstant: 24),
        ])

        let controller = NSTitlebarAccessoryViewController()
        controller.representedObject = Self.accessoryMarker
        controller.layoutAttribute = placement
        controller.view = container
        return controller
    }

    @objc private func toggleNavigator() {
        CanvasHostCommandCenter.post(.toggleNavigator)
    }

    @objc private func toggleInspector() {
        CanvasHostCommandCenter.post(.toggleInspector)
    }
}
#endif
