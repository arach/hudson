import SwiftUI
import Testing
@testable import HudsonUI

@Suite("HudLiquidBar")
struct HudLiquidBarTests {

    @Test("tab value preserves id icon and title")
    func tabValueRoundtrip() {
        let tab = HudLiquidBarTab(id: "home", icon: "house.fill", title: "Home")
        #expect(tab.id == "home")
        #expect(tab.icon == "house.fill")
        #expect(tab.title == "Home")
    }

    @Test("action value preserves id icon title role and handler")
    func actionValueRoundtrip() {
        let action = HudLiquidBarAction(
            id: "delete",
            icon: "trash",
            title: "Delete",
            role: .destructive
        ) {}

        #expect(action.id == "delete")
        #expect(action.icon == "trash")
        #expect(action.title == "Delete")
        #expect(action.role == .destructive)
        action.handler()
    }

    @Test("tint switch covers every public case")
    func tintExhaustiveness() {
        let variants: [HudLiquidBarTint] = [
            .regular,
            .tinted(HudPalette.accent),
            .clear,
        ]

        let labels = variants.map { tint in
            switch tint {
            case .regular: return "regular"
            case .tinted: return "tinted"
            case .clear: return "clear"
            }
        }

        #expect(labels == ["regular", "tinted", "clear"])
    }

    @Test("tab row selection binding updates through row state")
    func tabSelectionBindingFlow() {
        var selected = "home"
        let binding = Binding<String>(
            get: { selected },
            set: { selected = $0 }
        )
        let tabs = [
            HudLiquidBarTab(id: "home", icon: "house.fill", title: "Home"),
            HudLiquidBarTab(id: "search", icon: "magnifyingglass", title: "Search"),
        ]
        let row = HudLiquidBarTabRow(tabs: tabs, selection: binding)

        row.select(tabs[1])

        #expect(selected == "search")
    }
}
