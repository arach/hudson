#if os(macOS)
import AppKit
import SwiftUI
import HudsonUI
import HudsonVantageCore

extension Notification.Name {
    /// Posted by the menu-bar controller when the host should bring the main window forward.
    public static let vantageHostShowMainWindow = Notification.Name("com.hudsonkit.vantage.hostShowMainWindow")
}

/// Lattices-style menu bar companion: template icon, left-click popover, right-click menu.
@MainActor
public final class HudVantageHostMenuBarController: NSObject, NSPopoverDelegate {
    private var model: HudVantageHostAppModel?
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
        popover.contentSize = HudVantageMenuBarPopoverMetrics.nsSize
        popover.appearance = NSAppearance(named: .darkAqua)
        popover.delegate = self

        if let model {
            popover.contentViewController = makePopoverHost(model: model)
        }

        self.popover = popover
        return popover
    }

    private func refreshPopoverRootView(model: HudVantageHostAppModel) {
        popover?.contentViewController = makePopoverHost(model: model)
        popover?.contentSize = HudVantageMenuBarPopoverMetrics.nsSize
    }

    private func makePopoverHost(model: HudVantageHostAppModel) -> NSViewController {
        HudVantageHostMenuBarPopoverViewController(
            model: model,
            onDismiss: { [weak self] in self?.dismissPopover() },
            onShowMainWindow: { [weak self] in self?.showMainWindow() },
            onOpenSettings: { [weak self] in self?.showSettingsWindow() }
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

    @objc private func menuShowMain() { showMainWindow() }
    @objc private func menuCommandPalette() { model?.send(.showCommandPalette); showMainWindow() }
    @objc private func menuLens() { model?.send(.openLens); showMainWindow() }
    @objc private func menuSaveWorkspace() { model?.send(.saveWorkspace) }
    @objc private func menuRevealControl() { model?.revealControlFile() }
    @objc private func menuCopyPaths() { model?.copyControlPaths() }
    @objc private func menuAbout() { model?.showsAbout = true; showMainWindow() }
    @objc private func menuSettings() { showSettingsWindow() }
    @objc private func menuQuit() { NSApp.terminate(nil) }

    private func showMainWindow() {
        dismissPopover()
        NotificationCenter.default.post(name: .vantageHostShowMainWindow, object: nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    private func showSettingsWindow() {
        dismissPopover()
        openSettings()
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

private final class HudVantageHostMenuBarPopoverViewController: NSViewController {
    private let model: HudVantageHostAppModel
    private let onDismiss: () -> Void
    private let onShowMainWindow: () -> Void
    private let onOpenSettings: () -> Void
    private let statusLabel = NSTextField(labelWithString: "")
    private let controlPathLabel = NSTextField(labelWithString: "")

    init(
        model: HudVantageHostAppModel,
        onDismiss: @escaping () -> Void,
        onShowMainWindow: @escaping () -> Void,
        onOpenSettings: @escaping () -> Void
    ) {
        self.model = model
        self.onDismiss = onDismiss
        self.onShowMainWindow = onShowMainWindow
        self.onOpenSettings = onOpenSettings
        super.init(nibName: nil, bundle: nil)
        preferredContentSize = HudVantageMenuBarPopoverMetrics.nsSize
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("HudVantageHostMenuBarPopoverViewController does not support storyboards")
    }

    override func loadView() {
        let container = NSView(frame: NSRect(origin: .zero, size: HudVantageMenuBarPopoverMetrics.nsSize))
        container.wantsLayer = true
        container.layer?.backgroundColor = NSColor(HudPalette.bg).cgColor

        let stack = NSStackView()
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.distribution = .fill
        stack.spacing = 12
        stack.edgeInsets = NSEdgeInsets(top: 18, left: 18, bottom: 16, right: 18)
        stack.translatesAutoresizingMaskIntoConstraints = false

        let header = NSStackView()
        header.orientation = .horizontal
        header.alignment = .centerY
        header.spacing = 10

        let icon = NSTextField(labelWithString: "▦")
        icon.translatesAutoresizingMaskIntoConstraints = false
        icon.font = .systemFont(ofSize: 28, weight: .semibold)
        icon.textColor = NSColor.systemTeal
        icon.alignment = .center
        icon.wantsLayer = true
        icon.layer?.cornerRadius = 8
        icon.layer?.backgroundColor = NSColor.systemTeal.withAlphaComponent(0.18).cgColor
        NSLayoutConstraint.activate([
            icon.widthAnchor.constraint(equalToConstant: 44),
            icon.heightAnchor.constraint(equalToConstant: 44),
        ])

        let titleStack = NSStackView()
        titleStack.orientation = .vertical
        titleStack.alignment = .leading
        titleStack.spacing = 3

        let title = NSTextField(labelWithString: model.appName)
        title.font = .systemFont(ofSize: 17, weight: .semibold)
        title.textColor = .white

        let subtitle = NSTextField(labelWithString: model.identity.tagline)
        subtitle.font = .systemFont(ofSize: 11, weight: .regular)
        subtitle.textColor = .secondaryLabelColor
        subtitle.lineBreakMode = .byTruncatingTail

        titleStack.addArrangedSubview(title)
        titleStack.addArrangedSubview(subtitle)

        header.addArrangedSubview(icon)
        header.addArrangedSubview(titleStack)

        statusLabel.font = .monospacedDigitSystemFont(ofSize: 12, weight: .medium)
        statusLabel.textColor = .secondaryLabelColor

        let actions = NSStackView()
        actions.orientation = .vertical
        actions.alignment = .leading
        actions.spacing = 8

        let firstRow = buttonRow([
            actionButton("Show Canvas", action: #selector(showCanvas)),
            actionButton("Palette", action: #selector(showPalette)),
        ])
        let secondRow = buttonRow([
            actionButton("Search", action: #selector(openLens)),
            actionButton("Save", action: #selector(saveWorkspace)),
        ])
        let thirdRow = buttonRow([
            actionButton("Copy Paths", action: #selector(copyPaths)),
            actionButton("Settings", action: #selector(openSettingsAction)),
        ])
        actions.addArrangedSubview(firstRow)
        actions.addArrangedSubview(secondRow)
        actions.addArrangedSubview(thirdRow)

        let controlTitle = NSTextField(labelWithString: "CONTROL LANE")
        controlTitle.font = .monospacedSystemFont(ofSize: 10, weight: .semibold)
        controlTitle.textColor = NSColor.systemTeal

        controlPathLabel.font = .monospacedSystemFont(ofSize: 10, weight: .regular)
        controlPathLabel.textColor = .secondaryLabelColor
        controlPathLabel.lineBreakMode = .byTruncatingMiddle
        controlPathLabel.maximumNumberOfLines = 1
        controlPathLabel.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)

        let footer = NSTextField(labelWithString: "Right-click the menu-bar icon for the full command menu.")
        footer.font = .systemFont(ofSize: 10, weight: .regular)
        footer.textColor = .tertiaryLabelColor
        footer.lineBreakMode = .byTruncatingTail

        stack.addArrangedSubview(header)
        stack.addArrangedSubview(separator())
        stack.addArrangedSubview(statusLabel)
        stack.addArrangedSubview(actions)
        stack.addArrangedSubview(separator())
        stack.addArrangedSubview(controlTitle)
        stack.addArrangedSubview(controlPathLabel)
        stack.addArrangedSubview(NSView())
        stack.addArrangedSubview(footer)

        container.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            stack.topAnchor.constraint(equalTo: container.topAnchor),
            stack.bottomAnchor.constraint(equalTo: container.bottomAnchor),
        ])

        view = container
        refreshContent()
    }

    override func viewDidLayout() {
        super.viewDidLayout()
        preferredContentSize = HudVantageMenuBarPopoverMetrics.nsSize
    }

    override func viewWillAppear() {
        super.viewWillAppear()
        refreshContent()
    }

    private func refreshContent() {
        if let status = model.status {
            statusLabel.stringValue = "\(status.nodeCount) nodes · \(status.selectedCount) selected · \(status.controlStatus)"
        } else {
            statusLabel.stringValue = "Starting canvas status..."
        }
        controlPathLabel.stringValue = model.controlFilePath
    }

    private func buttonRow(_ buttons: [NSButton]) -> NSStackView {
        let row = NSStackView(views: buttons)
        row.orientation = .horizontal
        row.alignment = .centerY
        row.distribution = .fillEqually
        row.spacing = 8
        row.translatesAutoresizingMaskIntoConstraints = false
        row.widthAnchor.constraint(equalToConstant: HudVantageMenuBarPopoverMetrics.width - 36).isActive = true
        return row
    }

    private func actionButton(_ title: String, action: Selector) -> NSButton {
        let button = NSButton(title: title, target: self, action: action)
        button.bezelStyle = .rounded
        button.controlSize = .regular
        button.font = .systemFont(ofSize: 12, weight: .medium)
        return button
    }

    private func separator() -> NSView {
        let line = NSBox()
        line.boxType = .separator
        return line
    }

    @objc private func showCanvas() {
        onShowMainWindow()
    }

    @objc private func showPalette() {
        model.send(.showCommandPalette)
        onShowMainWindow()
    }

    @objc private func openLens() {
        model.send(.openLens)
        onShowMainWindow()
    }

    @objc private func saveWorkspace() {
        model.send(.saveWorkspace)
    }

    @objc private func copyPaths() {
        model.copyControlPaths()
    }

    @objc private func openSettingsAction() {
        onOpenSettings()
    }
}
#endif
