#if os(macOS)
import AppKit
import SwiftUI

extension Notification.Name {
    /// Posted by the menu-bar controller when the host should bring the main window forward.
    public static let vantageHostShowMainWindow = Notification.Name("com.hudsonkit.vantage.hostShowMainWindow")
}

/// Lattices-style menu bar companion: template icon, left-click popover, right-click menu.
@MainActor
public final class HudVantageHostMenuBarController: NSObject, NSPopoverDelegate {
    private weak var model: HudVantageHostAppModel?
    private var statusItem: NSStatusItem?
    private var popover: NSPopover?
    private var contextMenu: NSMenu?

    public var isPopoverShown: Bool {
        popover?.isShown == true
    }

    public override init() {
        super.init()
    }

    public func start(model: HudVantageHostAppModel) {
        self.model = model
        guard statusItem == nil else { return }

        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        if let button = statusItem?.button {
            button.image = Self.templateMenuBarIcon
            button.action = #selector(statusItemClicked(_:))
            button.sendAction(on: [.leftMouseUp, .rightMouseUp])
            button.target = self
            button.toolTip = model.appName
        }

        contextMenu = buildContextMenu()
    }

    public func warmUpPopover() {
        let popover = makePopover()
        _ = popover.contentViewController?.view
    }

    public func dismissPopover() {
        popover?.performClose(nil)
    }

    private func showPopover() {
        guard let button = statusItem?.button else { return }
        let popover = makePopover()
        if let model {
            refreshPopoverRootView(model: model)
        }
        popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
        popover.contentViewController?.view.window?.makeKey()
    }

    @objc private func statusItemClicked(_ sender: Any?) {
        guard let event = NSApp.currentEvent,
              let button = statusItem?.button else { return }

        if event.type == .rightMouseUp {
            contextMenu?.popUp(
                positioning: nil,
                at: NSPoint(x: 0, y: button.bounds.height + 4),
                in: button
            )
        } else if let popover, popover.isShown {
            popover.performClose(sender)
        } else {
            showPopover()
        }
    }

    private func makePopover() -> NSPopover {
        if let popover { return popover }

        let popover = NSPopover()
        popover.behavior = .transient
        popover.contentSize = NSSize(width: 380, height: 320)
        popover.appearance = NSAppearance(named: .darkAqua)
        popover.delegate = self

        if let model {
            popover.contentViewController = NSHostingController(
                rootView: HudVantageHostMenuBarPopoverView(
                    model: model,
                    onDismiss: { [weak self] in self?.dismissPopover() }
                )
            )
        }

        self.popover = popover
        return popover
    }

    private func refreshPopoverRootView(model: HudVantageHostAppModel) {
        popover?.contentViewController = NSHostingController(
            rootView: HudVantageHostMenuBarPopoverView(
                model: model,
                onDismiss: { [weak self] in self?.dismissPopover() }
            )
        )
    }

    public func popoverWillShow(_ notification: Notification) {
        guard let model else { return }
        refreshPopoverRootView(model: model)
    }

    private func buildContextMenu() -> NSMenu {
        let menu = NSMenu()
        let appName = model?.appName ?? "Vantage"

        addMenuItem(to: menu, title: "Show \(appName)", action: #selector(menuShowMain))
        addMenuItem(to: menu, title: "Command Palette", action: #selector(menuCommandPalette), keyEquivalent: "k", modifiers: .command)
        addMenuItem(to: menu, title: "Search Nodes…", action: #selector(menuLens), keyEquivalent: "f", modifiers: [.command, .shift])
        addMenuItem(to: menu, title: "Save Workspace", action: #selector(menuSaveWorkspace), keyEquivalent: "s", modifiers: .command)

        menu.addItem(.separator())

        addMenuItem(to: menu, title: "Reveal Control File", action: #selector(menuRevealControl))
        addMenuItem(to: menu, title: "Copy Control Paths", action: #selector(menuCopyPaths))

        menu.addItem(.separator())

        addMenuItem(to: menu, title: "About \(appName)", action: #selector(menuAbout))
        addMenuItem(to: menu, title: "Settings…", action: #selector(menuSettings), keyEquivalent: ",", modifiers: .command)

        menu.addItem(.separator())

        addMenuItem(to: menu, title: "Quit \(appName)", action: #selector(menuQuit), keyEquivalent: "q", modifiers: .command)

        return menu
    }

    private func addMenuItem(
        to menu: NSMenu,
        title: String,
        action: Selector,
        keyEquivalent: String = "",
        modifiers: NSEvent.ModifierFlags = []
    ) {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: keyEquivalent)
        item.target = self
        if !modifiers.isEmpty {
            item.keyEquivalentModifierMask = modifiers
        }
        menu.addItem(item)
    }

    @objc private func menuShowMain() { performHostAction { showMainWindow() } }
    @objc private func menuCommandPalette() { performHostAction { model?.send(.showCommandPalette); showMainWindow() } }
    @objc private func menuLens() { performHostAction { model?.send(.openLens); showMainWindow() } }
    @objc private func menuSaveWorkspace() { performHostAction { model?.send(.saveWorkspace) } }
    @objc private func menuRevealControl() { performHostAction { model?.revealControlFile() } }
    @objc private func menuCopyPaths() { performHostAction { model?.copyControlPaths() } }
    @objc private func menuAbout() { performHostAction { model?.showsAbout = true; showMainWindow() } }
    @objc private func menuSettings() { performHostAction { openSettings() } }
    @objc private func menuQuit() { NSApp.terminate(nil) }

    private func performHostAction(_ action: @MainActor () -> Void) {
        Task { @MainActor in action() }
    }

    private func showMainWindow() {
        dismissPopover()
        NotificationCenter.default.post(name: .vantageHostShowMainWindow, object: nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    private func openSettings() {
        NSApp.sendAction(Selector(("showSettingsWindow:")), to: nil, from: nil)
    }

    private static let templateMenuBarIcon: NSImage = {
        let size: CGFloat = 18
        let image = NSImage(size: NSSize(width: size, height: size), flipped: true) { _ in
            let pad: CGFloat = 2
            let gap: CGFloat = 1.5
            let cellSize = (size - 2 * pad - gap) / 2
            let cells: [(Int, Int, CGFloat)] = [
                (0, 0, 1.0),
                (1, 0, 0.55),
                (0, 1, 0.55),
                (1, 1, 0.28),
            ]

            for (column, row, alpha) in cells {
                let x = pad + CGFloat(column) * (cellSize + gap)
                let y = pad + CGFloat(row) * (cellSize + gap)
                let rect = NSRect(x: x, y: y, width: cellSize, height: cellSize)
                NSColor.black.withAlphaComponent(alpha).setFill()
                let path = NSBezierPath(roundedRect: rect, xRadius: 0.8, yRadius: 0.8)
                path.fill()
            }
            return true
        }
        image.isTemplate = true
        return image
    }()
}
#endif
