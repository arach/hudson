import SwiftUI
import Testing
@testable import HudsonShell

private enum CompatSection: Hashable {
    case home, settings
}

private let compatEntries: [HudSidebarEntry<CompatSection>] = [
    .item(HudSidebarItem(id: .home, title: "Home", icon: "house", selectedIcon: "house.fill")),
    .section(id: "system", title: "System"),
    .item(HudSidebarItem(id: .settings, title: "Settings", icon: "gear")),
]

/// Compile-time guard for the deprecation window: `HudResizableNavigationSidebar`
/// must keep building until an explicitly approved breaking release. The whole
/// harness is marked deprecated so exercising the shim does not warn.
@available(*, deprecated)
private struct DeprecatedResizableSidebarHarness: View {
    @State var selection: CompatSection? = .home
    @State var isCompact = false
    @State var labelWidth: CGFloat = 156

    var body: some View {
        VStack {
            // Footer-less convenience initializer.
            HudResizableNavigationSidebar(
                selection: $selection,
                entries: compatEntries,
                isCompact: $isCompact,
                labelWidth: $labelWidth,
                railHeader: { Image(systemName: "circle") },
                labelHeader: { Text("Hudson") }
            )

            // Full initializer, every knob supplied.
            HudResizableNavigationSidebar(
                selection: $selection,
                entries: compatEntries,
                isCompact: $isCompact,
                labelWidth: $labelWidth,
                accent: .teal,
                minLabelWidth: 120,
                maxLabelWidth: 280,
                collapseLabelWidth: 44,
                activationDistance: 6,
                leadingInset: HudSidebarLayout.leadingInset,
                onResizePhaseChange: { _ in },
                railHeader: { Image(systemName: "circle") },
                labelHeader: { Text("Hudson") },
                footer: { Text("footer") }
            )
        }
    }
}

/// The canonical shape from the proposal: one component, resizing opted into
/// with a modifier. No second sidebar type is named.
private struct CanonicalResizableSidebarHarness: View {
    @State var selection: CompatSection? = .home
    @State var isCompact = false
    @State var labelWidth: CGFloat = 156

    var body: some View {
        VStack {
            HudNavigationSidebar(
                selection: $selection,
                entries: compatEntries,
                isCompact: isCompact,
                railHeader: { Image(systemName: "circle") },
                labelHeader: { Text("Hudson") }
            )
            .resizable(isCompact: $isCompact, labelWidth: $labelWidth)

            HudNavigationSidebar(
                selection: $selection,
                entries: compatEntries,
                isCompact: isCompact,
                accent: .teal,
                onHeaderTap: { },
                railHeader: { Image(systemName: "circle") },
                labelHeader: { Text("Hudson") },
                footer: { Text("footer") }
            )
            .resizable(
                isCompact: $isCompact,
                labelWidth: $labelWidth,
                minLabelWidth: 120,
                maxLabelWidth: 280,
                collapseLabelWidth: 44,
                activationDistance: 6,
                onResizePhaseChange: { _ in }
            )

            // Resizing composes with the progress initializer too — the
            // bindings supersede the constructed progress.
            HudNavigationSidebar(
                selection: $selection,
                entries: compatEntries,
                progress: 0.5,
                railHeader: { Image(systemName: "circle") },
                labelHeader: { Text("Hudson") }
            )
            .resizable(isCompact: $isCompact, labelWidth: $labelWidth)
        }
    }
}

@Suite("HudNavigationSidebar resizable API")
struct HudSidebarResizeCompatibilityTests {

    @Test("Deprecated HudResizableNavigationSidebar still builds")
    @available(*, deprecated)
    func deprecatedShimStillBuilds() {
        _ = DeprecatedResizableSidebarHarness()
    }

    @Test("Canonical HudNavigationSidebar.resizable builds in every form")
    func canonicalModifierBuilds() {
        _ = CanonicalResizableSidebarHarness()
    }

    @Test("Reduce Motion suppresses the expand/collapse animation")
    func reduceMotionSuppressesAnimation() {
        #expect(HudSidebarMotion.expandCollapse(reduceMotion: true) == nil)
        #expect(HudSidebarMotion.expandCollapse(reduceMotion: false) != nil)
    }
}
