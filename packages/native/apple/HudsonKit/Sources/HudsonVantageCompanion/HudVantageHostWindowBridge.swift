#if os(macOS)
import AppKit
import SwiftUI
import HudsonVantageCore

/// Bridges AppKit menu-bar actions and title-bar accessories into SwiftUI hosts.
public struct HudVantageHostWindowBridge: View {
    @Environment(\.openWindow) private var openWindow

    public init() {}

    public var body: some View {
        Color.clear
            .frame(width: .zero, height: .zero)
            .background(HudVantageTitlebarChromeInstaller())
            .onReceive(NotificationCenter.default.publisher(for: .vantageHostShowMainWindow)) { _ in
                openWindow(id: "main")
                NSApp.activate(ignoringOtherApps: true)
            }
    }
}

extension View {
    public func hudVantageHostWindowBridge() -> some View {
        background(HudVantageHostWindowBridge())
    }
}

private struct HudVantageTitlebarChromeInstaller: NSViewRepresentable {
    func makeNSView(context: Context) -> HudVantageTitlebarChromeView {
        HudVantageTitlebarChromeView()
    }

    func updateNSView(_ view: HudVantageTitlebarChromeView, context: Context) {
        view.installIfPossible()
    }
}

private final class HudVantageTitlebarChromeView: NSView {
    private static let accessoryMarker = "com.hudsonkit.vantage.titlebar-accessory"
    private var installationScheduled = false

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
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
        window.titleVisibility = .visible
        window.titlebarAppearsTransparent = false
        window.styleMask.remove(.fullSizeContentView)
        window.titlebarSeparatorStyle = .none
        window.isMovableByWindowBackground = false

        if window.toolbar?.identifier == NSToolbar.Identifier("com.hudsonkit.vantage.window-toolbar") {
            window.toolbar = nil
        }

        for (index, controller) in window.titlebarAccessoryViewControllers.enumerated().reversed() {
            if controller.representedObject as? String == Self.accessoryMarker {
                window.removeTitlebarAccessoryViewController(at: index)
            }
        }

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
        VantageHostCommandCenter.post(.toggleNavigator)
    }

    @objc private func toggleInspector() {
        VantageHostCommandCenter.post(.toggleInspector)
    }
}
#endif
