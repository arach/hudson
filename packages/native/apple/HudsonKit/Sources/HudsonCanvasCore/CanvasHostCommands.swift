import Foundation

/// Commands a native host app can send into an embedded `HudCanvasSurface`
/// through the menu bar, settings window, or menu-bar extra.
public enum CanvasHostCommand: String, Sendable, CaseIterable {
    case showCommandPalette
    case showAppearanceSettings
    case openLens
    case fitViewport
    case resetViewport
    case layoutByTag
    case saveWorkspace
    case clearSelection
    case toggleNavigator
    case toggleInspector
}

extension Notification.Name {
    public static let canvasHostCommand = Notification.Name("com.hudsonkit.canvas.hostCommand")
}

public enum CanvasHostCommandCenter {
    public static func post(_ command: CanvasHostCommand) {
        NotificationCenter.default.post(
            name: .canvasHostCommand,
            object: nil,
            userInfo: ["command": command.rawValue]
        )
    }
}
