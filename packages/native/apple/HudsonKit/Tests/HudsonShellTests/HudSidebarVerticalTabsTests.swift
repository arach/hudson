import SwiftUI
import Testing
@testable import HudsonShell

private enum VerticalTarget: Hashable {
    case canvas, terminal
}

private enum VerticalWorkspace: Hashable {
    case alpha, beta
}

private struct VerticalTabsSidebarHarness: View {
    @State private var target: VerticalTarget? = .canvas
    @State private var workspace: VerticalWorkspace? = .alpha
    @State private var compact = false
    @State private var labelWidth: CGFloat = 172

    private let targets: [HudSidebarEntry<VerticalTarget>] = [
        .item(HudSidebarItem(id: .canvas, title: "Canvas", icon: "square.grid.3x3")),
        .item(HudSidebarItem(id: .terminal, title: "Terminal", icon: "terminal")),
    ]

    private let workspaces: [HudSidebarVerticalTab<VerticalWorkspace>] = [
        HudSidebarVerticalTab(id: .alpha, title: "Alpha", subtitle: "Local", badge: "Live"),
        HudSidebarVerticalTab(id: .beta, title: "Beta"),
    ]

    var body: some View {
        HudNavigationSidebar(
            selection: $target,
            entries: targets,
            isCompact: compact,
            variant: .verticalTabs,
            accent: .cyan,
            labelWidth: labelWidth,
            railHeader: { Image(systemName: "circle.grid.2x2") },
            labelHeader: { Text("Hudson") },
            verticalTabs: {
                HudSidebarVerticalTabs(
                    selection: $workspace,
                    tabs: workspaces,
                    progress: compact ? 1 : 0,
                    labelWidth: labelWidth,
                    onCreate: { }
                )
            },
            footer: { Text("Ready") }
        )
        .resizable(isCompact: $compact, labelWidth: $labelWidth)
    }
}

@Suite("HudNavigationSidebar vertical tabs")
struct HudSidebarVerticalTabsTests {
    @Test("Vertical-tabs variant composes with typed targets, tabs, and resizing")
    func variantBuilds() {
        _ = VerticalTabsSidebarHarness()
    }

    @Test("Vertical-tab values retain their display and accessibility metadata")
    func tabMetadata() {
        let tab = HudSidebarVerticalTab(
            id: VerticalWorkspace.alpha,
            title: "Alpha",
            subtitle: "Local workspace",
            badge: "Live",
            icon: "rectangle.stack",
            accessibilityLabel: "Open Alpha workspace"
        )

        #expect(tab.id == .alpha)
        #expect(tab.title == "Alpha")
        #expect(tab.subtitle == "Local workspace")
        #expect(tab.badge == "Live")
        #expect(tab.icon == "rectangle.stack")
        #expect(tab.accessibilityLabel == "Open Alpha workspace")
    }

    @Test("Sidebar variants remain additive")
    func variantsRemainAdditive() {
        #expect(HudNavigationSidebarVariant.allCases == [.standard, .verticalTabs])
    }
}
