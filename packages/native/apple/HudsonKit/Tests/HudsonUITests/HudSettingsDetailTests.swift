import SwiftUI
import Testing
@testable import HudsonUI

@Suite("HudSettingsDetail")
struct HudSettingsDetailTests {
    @Test("settings detail layout collapses below its configured threshold")
    func choosesResponsiveLayout() {
        #expect(
            HudSettingsDetailLayoutPolicy.layout(for: 759, collapseBelow: 760) == .stacked
        )
        #expect(
            HudSettingsDetailLayoutPolicy.layout(for: 760, collapseBelow: 760) == .columns
        )
        #expect(
            HudSettingsDetailLayoutPolicy.layout(for: 499, collapseBelow: 500) == .stacked
        )
        #expect(
            HudSettingsDetailLayoutPolicy.layout(for: 500, collapseBelow: 500) == .columns
        )
    }

    @MainActor
    @Test("settings detail primitives construct with default and custom slots")
    func constructsSettingsPrimitives() {
        _ = HudSettingsDetail {
            Text("Accounts")
        } detail: {
            Text("Account detail")
        }

        _ = HudSettingsNavigationRow(
            title: "Voice",
            subtitle: "Speech providers",
            icon: "waveform",
            isSelected: true,
            onTap: {}
        )

        _ = HudSettingsNavigationRow(
            title: "Advanced",
            icon: "gearshape",
            isSelected: false,
            onTap: {},
            trailing: { Text("3") }
        )

        _ = HudCredentialSection(
            "API key",
            text: .constant("secret"),
            destinationTitle: "Create key",
            destinationURL: URL(string: "https://example.com")
        )
    }
}
