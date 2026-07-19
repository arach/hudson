#if os(macOS)
import AppKit

@main
final class HudsonKitAppKitReferenceApp: NSObject, NSApplicationDelegate {
    private var window: NSWindow?

    static func main() {
        let app = NSApplication.shared
        let delegate = HudsonKitAppKitReferenceApp()
        app.delegate = delegate
        app.setActivationPolicy(.regular)
        app.run()
        _ = delegate
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 920, height: 620),
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.title = "HudsonKit AppKit Reference"
        window.titlebarAppearsTransparent = true
        window.isMovableByWindowBackground = true
        window.center()
        window.contentView = AppKitReferenceView(frame: window.contentView?.bounds ?? .zero)
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        self.window = window
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }
}

private final class AppKitReferenceView: NSView {
    private enum Palette {
        static let background = NSColor(calibratedRed: 0.025, green: 0.032, blue: 0.036, alpha: 1)
        static let surface = NSColor(calibratedRed: 0.075, green: 0.085, blue: 0.088, alpha: 1)
        static let border = NSColor.white.withAlphaComponent(0.12)
        static let cyan = NSColor(calibratedRed: 0.23, green: 0.82, blue: 0.93, alpha: 1)
        static let ink = NSColor(calibratedWhite: 0.92, alpha: 1)
        static let muted = NSColor(calibratedWhite: 0.62, alpha: 1)
        static let dim = NSColor(calibratedWhite: 0.42, alpha: 1)
    }

    private let rail = NSStackView()
    private let content = NSStackView()
    private let inspector = NSStackView()
    private let status = NSTextField(labelWithString: "HUDSONKIT   shell baseline   AppKit")

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        wantsLayer = true
        layer?.backgroundColor = Palette.background.cgColor
        buildLayout()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func layout() {
        super.layout()
        let bounds = bounds
        let statusHeight: CGFloat = 30
        let railWidth: CGFloat = 240
        let inspectorWidth: CGFloat = 280

        rail.frame = NSRect(x: 0, y: statusHeight, width: railWidth, height: bounds.height - statusHeight)
        inspector.frame = NSRect(x: bounds.width - inspectorWidth, y: statusHeight, width: inspectorWidth, height: bounds.height - statusHeight)
        content.frame = NSRect(
            x: railWidth,
            y: statusHeight,
            width: max(0, bounds.width - railWidth - inspectorWidth),
            height: bounds.height - statusHeight
        )
        status.frame = NSRect(x: 18, y: 7, width: bounds.width - 36, height: 16)
    }

    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        Palette.border.setStroke()
        NSBezierPath(rect: NSRect(x: 0, y: 30, width: 240, height: bounds.height - 30)).stroke()
        NSBezierPath(rect: NSRect(x: bounds.width - 280, y: 30, width: 280, height: bounds.height - 30)).stroke()
        NSBezierPath(rect: NSRect(x: 0, y: 0, width: bounds.width, height: 30)).stroke()
    }

    private func buildLayout() {
        [rail, content, inspector].forEach {
            $0.orientation = .vertical
            $0.alignment = .leading
            $0.spacing = 12
            $0.edgeInsets = NSEdgeInsets(top: 24, left: 18, bottom: 18, right: 18)
            addSubview($0)
        }

        rail.addArrangedSubview(label("HUDSONKIT", size: 11, weight: .bold, color: Palette.ink))
        rail.addArrangedSubview(nav("Welcome", selected: true))
        rail.addArrangedSubview(nav("Configuration", selected: false))
        rail.addArrangedSubview(nav("Runtime", selected: false))
        rail.addArrangedSubview(spacer(height: 260))
        rail.addArrangedSubview(label("BASELINE", size: 10, weight: .bold, color: Palette.cyan))
        rail.addArrangedSubview(badge("APPKIT ONLY"))

        content.addArrangedSubview(label("REFERENCE", size: 10, weight: .bold, color: Palette.cyan))
        content.addArrangedSubview(label("AppKit shell baseline", size: 22, weight: .semibold, color: Palette.ink))
        content.addArrangedSubview(wrapping("This target does not import SwiftUI or HudsonKit. It approximates the same shell shape with a plain NSApplication, NSWindow, NSStackView, and NSTextField controls.", width: 500))
        content.addArrangedSubview(card(title: "Window", value: "NSWindow", detail: "Regular titled macOS app window."))
        content.addArrangedSubview(card(title: "Chrome", value: "NSStackView", detail: "Rail, content, inspector, and status regions."))
        content.addArrangedSubview(card(title: "Framework", value: "AppKit", detail: "No SwiftUI, no AttributeGraph, no Hudson modules."))

        inspector.addArrangedSubview(label("INSPECTOR", size: 10, weight: .bold, color: Palette.cyan))
        inspector.addArrangedSubview(card(title: "Mode", value: "AppKit", detail: "Native baseline."))
        inspector.addArrangedSubview(card(title: "Purpose", value: "Measure", detail: "Compare against HudsonKit shell-only."))

        status.font = NSFont.monospacedSystemFont(ofSize: 10, weight: .semibold)
        status.textColor = Palette.muted
        addSubview(status)
    }

    private func nav(_ text: String, selected: Bool) -> NSView {
        let field = label(text, size: 13, weight: .semibold, color: selected ? Palette.ink : Palette.muted)
        field.frame.size = NSSize(width: 200, height: 34)
        let container = NSView(frame: NSRect(x: 0, y: 0, width: 200, height: 34))
        container.wantsLayer = true
        container.layer?.cornerRadius = 6
        container.layer?.backgroundColor = selected ? Palette.cyan.withAlphaComponent(0.14).cgColor : NSColor.clear.cgColor
        field.frame = NSRect(x: 12, y: 8, width: 176, height: 18)
        container.addSubview(field)
        return container
    }

    private func card(title: String, value: String, detail: String) -> NSView {
        let container = NSStackView()
        container.orientation = .vertical
        container.alignment = .leading
        container.spacing = 8
        container.edgeInsets = NSEdgeInsets(top: 14, left: 14, bottom: 14, right: 14)
        container.wantsLayer = true
        container.layer?.cornerRadius = 8
        container.layer?.backgroundColor = Palette.surface.cgColor
        container.layer?.borderColor = Palette.border.cgColor
        container.layer?.borderWidth = 1
        container.widthAnchor.constraint(equalToConstant: 260).isActive = true

        container.addArrangedSubview(label(title.uppercased(), size: 9, weight: .bold, color: Palette.cyan))
        container.addArrangedSubview(label(value, size: 13, weight: .semibold, color: Palette.ink))
        container.addArrangedSubview(wrapping(detail, width: 220))
        return container
    }

    private func badge(_ text: String) -> NSTextField {
        let field = label("  \(text)  ", size: 10, weight: .bold, color: Palette.cyan)
        field.wantsLayer = true
        field.layer?.cornerRadius = 4
        field.layer?.backgroundColor = Palette.cyan.withAlphaComponent(0.12).cgColor
        field.layer?.borderColor = Palette.cyan.withAlphaComponent(0.35).cgColor
        field.layer?.borderWidth = 1
        return field
    }

    private func wrapping(_ text: String, width: CGFloat) -> NSTextField {
        let field = label(text, size: 12, weight: .regular, color: Palette.muted)
        field.maximumNumberOfLines = 0
        field.lineBreakMode = .byWordWrapping
        field.widthAnchor.constraint(equalToConstant: width).isActive = true
        return field
    }

    private func label(_ text: String, size: CGFloat, weight: NSFont.Weight, color: NSColor) -> NSTextField {
        let field = NSTextField(labelWithString: text)
        field.font = NSFont.systemFont(ofSize: size, weight: weight)
        field.textColor = color
        field.backgroundColor = .clear
        field.isBordered = false
        field.isEditable = false
        return field
    }

    private func spacer(height: CGFloat) -> NSView {
        let view = NSView()
        view.heightAnchor.constraint(equalToConstant: height).isActive = true
        return view
    }
}
#else
@main
struct HudsonKitAppKitReferenceApp {
    static func main() {
        fatalError("HudsonKitAppKitReference is macOS-only")
    }
}
#endif
