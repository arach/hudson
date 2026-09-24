#if os(macOS)
import AppKit
import HudsonNotch
import HudsonNotchCore
import HudsonUI
import SwiftUI

/// A menu bar host for the notch engine. Listens on the default socket (or
/// `--socket PATH`) so `hudson-notch post|ask` can drive it.
@MainActor
final class NotchDemoDelegate: NSObject, NSApplicationDelegate {
    private let controller = HudNotchController(persistenceKey: "HudsonNotchDemo.configuration")
    private var statusItem: NSStatusItem?
    private var tunerWindow: NSWindow?

    func applicationDidFinishLaunching(_ notification: Notification) {
        controller.start()
        do {
            try controller.serve(socketURL: Self.socketURL())
        } catch {
            FileHandle.standardError.write(Data("HudsonNotchDemo: \(error.localizedDescription)\n".utf8))
        }
        controller.onResponse = { response in
            print("response:", response)
        }
        installStatusItem()
        if CommandLine.arguments.contains("--tuner") { showTuner() }
    }

    func applicationWillTerminate(_ notification: Notification) {
        controller.stopServing()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }

    private static func socketURL() -> URL {
        let arguments = CommandLine.arguments
        if let index = arguments.firstIndex(of: "--socket"), index + 1 < arguments.count {
            return URL(fileURLWithPath: (arguments[index + 1] as NSString).expandingTildeInPath)
        }
        return HudNotchSocket.defaultURL
    }

    // MARK: Menu

    private func installStatusItem() {
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        item.button?.image = NSImage(systemSymbolName: "capsule.portrait", accessibilityDescription: "Notch")
        item.menu = makeMenu()
        statusItem = item
    }

    private func makeMenu() -> NSMenu {
        let menu = NSMenu()
        menu.addItem(action("Show or Hide", #selector(toggle)))
        menu.addItem(action("Pulse", #selector(pulse)))
        menu.addItem(action("Pin Open", #selector(pin)))
        menu.addItem(.separator())

        let shape = NSMenuItem(title: "Shape", action: nil, keyEquivalent: "")
        let shapeMenu = NSMenu()
        for mode in HudNotchDisplayMode.allCases {
            let item = action(mode.label, #selector(setShape(_:)))
            item.representedObject = mode.rawValue
            shapeMenu.addItem(item)
        }
        shape.submenu = shapeMenu
        menu.addItem(shape)
        menu.addItem(action("Tuner…", #selector(showTuner), key: ","))
        menu.addItem(.separator())
        menu.addItem(action("Quit", #selector(quit), key: "q"))
        return menu
    }

    private func action(_ title: String, _ selector: Selector, key: String = "") -> NSMenuItem {
        let item = NSMenuItem(title: title, action: selector, keyEquivalent: key)
        item.target = self
        return item
    }

    @objc private func toggle() { controller.toggleVisibility() }
    @objc private func pulse() { controller.pulse() }
    @objc private func pin() { controller.togglePinned() }
    @objc private func quit() { NSApp.terminate(nil) }

    @objc private func setShape(_ sender: NSMenuItem) {
        guard let raw = sender.representedObject as? String,
              let mode = HudNotchDisplayMode(rawValue: raw) else { return }
        controller.setDisplayMode(mode)
    }

    @objc private func showTuner() {
        if tunerWindow == nil {
            let window = NSWindow(
                contentRect: NSRect(x: 0, y: 0, width: 380, height: 640),
                styleMask: [.titled, .closable, .fullSizeContentView],
                backing: .buffered,
                defer: false
            )
            window.title = "Notch"
            window.titlebarAppearsTransparent = true
            window.isReleasedWhenClosed = false
            window.contentView = NSHostingView(rootView: HudNotchTuner(controller: controller))
            window.center()
            tunerWindow = window
        }
        tunerWindow?.makeKeyAndOrderFront(nil)
    }
}

let app = NSApplication.shared
let delegate = MainActor.assumeIsolated { NotchDemoDelegate() }
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
#else
print("HudsonNotchDemo runs on macOS only.")
#endif
