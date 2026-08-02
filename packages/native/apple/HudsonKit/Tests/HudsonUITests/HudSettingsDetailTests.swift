import SwiftUI
import Testing
@testable import HudsonUI

@Suite("HudSettingsDetail")
struct HudSettingsDetailTests {
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
