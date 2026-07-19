import SwiftUI
import Testing
@testable import HudsonShell

@Suite("HudPhoneAppShellAppearance")
struct HudPhoneAppShellAppearanceTests {
    @Test("Hudson appearance requests dark color scheme")
    func hudsonAppearanceUsesDarkColorScheme() {
        #expect(HudPhoneAppShellAppearancePolicy.hudson.preferredColorScheme == .dark)
    }

    @Test("Inherited appearance does not override the color scheme")
    func systemAppearanceDoesNotOverrideColorScheme() {
        #expect(HudPhoneAppShellAppearancePolicy.inherited.preferredColorScheme == nil)
    }
}
