import CoreGraphics
import HudsonUI

/// Demo-only layout policy and identity for HudsonKit Lab.
enum DemoManifest {
    static let app = HudAppManifest(name: "Hudson", tint: .cyan, targetLabel: "Demo")
    static let workspacePath = "~/dev/hudson"
}

enum DemoLayout {
    static let shellCompactBreakpoint: CGFloat = 980
    static let explorerToolbarCompactBreakpoint: CGFloat = 860
    static let explorerSplitBreakpoint: CGFloat = 680
    static let explorerStackedBreakpoint: CGFloat = 520
    static let explorerPreviewMinWidth: CGFloat = 420
    static let explorerPreviewMinWidthCompact: CGFloat = 220
    static let explorerTreeStackedHeight: CGFloat = 220
}