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
    private static let toolbarIdentifier = NSToolbar.Identifier("com.hudsonkit.vantage.window-toolbar")
    private var installationScheduled = false
    private var toolbarDelegate: VantageWindowToolbarDelegate?

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

        for (index, controller) in window.titlebarAccessoryViewControllers.enumerated().reversed() {
            if controller.representedObject as? String == Self.accessoryMarker {
                window.removeTitlebarAccessoryViewController(at: index)
            }
        }

        let delegate = toolbarDelegate ?? VantageWindowToolbarDelegate()
        toolbarDelegate = delegate

        let toolbar: NSToolbar
        if let existingToolbar = window.toolbar,
           existingToolbar.identifier == Self.toolbarIdentifier {
            toolbar = existingToolbar
        } else {
            toolbar = NSToolbar(identifier: Self.toolbarIdentifier)
        }

        toolbar.delegate = delegate
        toolbar.displayMode = .iconOnly
        toolbar.sizeMode = .small
        toolbar.allowsUserCustomization = false
        toolbar.autosavesConfiguration = false
        toolbar.showsBaselineSeparator = false
        toolbar.isVisible = true

        window.toolbarStyle = .unifiedCompact
        window.toolbar = toolbar
        window.toolbar?.isVisible = true
    }
}

private final class VantageWindowToolbarDelegate: NSObject, NSToolbarDelegate {
    private static let sidebarToggles = NSToolbarItem.Identifier("com.hudsonkit.vantage.sidebar-toggles")

    func toolbarDefaultItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        [Self.sidebarToggles]
    }

    func toolbarAllowedItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        [
            Self.sidebarToggles,
            .flexibleSpace,
            .space,
        ]
    }

    func toolbar(
        _ toolbar: NSToolbar,
        itemForItemIdentifier itemIdentifier: NSToolbarItem.Identifier,
        willBeInsertedIntoToolbar flag: Bool
    ) -> NSToolbarItem? {
        switch itemIdentifier {
        case Self.sidebarToggles:
            sidebarToggleItem(identifier: itemIdentifier)
        default:
            nil
        }
    }

    private func sidebarToggleItem(identifier: NSToolbarItem.Identifier) -> NSToolbarItem {
        let item = NSToolbarItem(itemIdentifier: identifier)
        let control = NSSegmentedControl(frame: NSRect(x: 0, y: 0, width: 60, height: 24))
        control.translatesAutoresizingMaskIntoConstraints = false
        control.segmentCount = 2
        control.segmentStyle = .separated
        control.trackingMode = .momentary
        control.setImage(NSImage(systemSymbolName: "sidebar.left", accessibilityDescription: "Toggle Navigator"), forSegment: 0)
        control.setImage(NSImage(systemSymbolName: "sidebar.right", accessibilityDescription: "Toggle Inspector"), forSegment: 1)
        control.setToolTip("Toggle Navigator", forSegment: 0)
        control.setToolTip("Toggle Inspector", forSegment: 1)
        control.setWidth(28, forSegment: 0)
        control.setWidth(28, forSegment: 1)
        control.target = self
        control.action = #selector(toggleSidebar(_:))

        let container = NSView(frame: NSRect(x: 0, y: 0, width: 60, height: 24))
        container.addSubview(control)
        NSLayoutConstraint.activate([
            control.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            control.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            control.topAnchor.constraint(equalTo: container.topAnchor),
            control.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            container.widthAnchor.constraint(equalToConstant: 60),
            container.heightAnchor.constraint(equalToConstant: 24),
        ])

        item.label = "Sidebars"
        item.paletteLabel = "Sidebars"
        item.toolTip = "Toggle Navigator or Inspector"
        item.view = container
        item.isNavigational = true
        return item
    }

    @objc private func toggleSidebar(_ sender: NSSegmentedControl) {
        switch sender.selectedSegment {
        case 0:
            VantageHostCommandCenter.post(.toggleNavigator)
        case 1:
            VantageHostCommandCenter.post(.toggleInspector)
        default:
            break
        }
    }
}
#endif
