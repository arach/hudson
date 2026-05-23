import Foundation

/// Commands a native host app can send into an embedded `HudVantageSurface`
/// through the menu bar, settings window, or menu-bar extra.
public enum VantageHostCommand: String, Sendable, CaseIterable {
    case showCommandPalette
    case showAppearanceSettings
    case openLens
    case fitViewport
    case resetViewport
    case layoutByTag
    case saveWorkspace
    case clearSelection
}

extension Notification.Name {
    public static let vantageHostCommand = Notification.Name("com.hudsonkit.vantage.hostCommand")
}

public enum VantageHostCommandCenter {
    public static func post(_ command: VantageHostCommand) {
        NotificationCenter.default.post(
            name: .vantageHostCommand,
            object: nil,
            userInfo: ["command": command.rawValue]
        )
    }
}
