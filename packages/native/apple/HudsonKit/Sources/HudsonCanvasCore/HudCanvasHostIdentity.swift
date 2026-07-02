import SwiftUI
import HudsonUI

/// Branding and window chrome for a native Canvas host application.
public struct HudCanvasHostIdentity: Sendable {
    public var appName: String
    public var tagline: String
    public var tint: HudTint
    public var targetLabel: String
    public var menuBarTitle: String
    public var menuBarSystemImage: String
    public var windowTitle: String

    public init(
        appName: String,
        tagline: String,
        tint: HudTint,
        targetLabel: String = "Node",
        menuBarTitle: String? = nil,
        menuBarSystemImage: String = "square.grid.2x2",
        windowTitle: String? = nil
    ) {
        self.appName = appName
        self.tagline = tagline
        self.tint = tint
        self.targetLabel = targetLabel
        self.menuBarTitle = menuBarTitle ?? appName
        self.menuBarSystemImage = menuBarSystemImage
        self.windowTitle = windowTitle ?? appName
    }

    public var appManifest: HudAppManifest {
        HudAppManifest(name: appName, tint: tint, targetLabel: targetLabel)
    }

    public static let canvas = HudCanvasHostIdentity(
        appName: "Canvas",
        tagline: "Spatial runtime canvas for tmux sessions, terminals, and workspace artifacts.",
        tint: .cyan,
        targetLabel: "Node",
        windowTitle: "Hudson Canvas"
    )
}
