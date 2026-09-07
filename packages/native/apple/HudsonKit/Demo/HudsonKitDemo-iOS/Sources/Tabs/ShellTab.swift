import SwiftUI
import HudsonUI

struct ShellTab: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: HudSpacing.xxl) {
                heroCopy

                HudCard {
                    VStack(alignment: .leading, spacing: HudSpacing.lg) {
                        HudSectionLabel("THE SHELL", tint: HudPalette.accent)
                        Text("HudPhoneAppShell")
                            .font(HudFont.mono(HudTextSize.lg, weight: .semibold))
                            .foregroundStyle(HudPalette.ink)
                        Text("Sibling to HudAppShell. Keeps app navigation native with a SwiftUI tab bar while still letting pages publish HUD-coordinated complications when they need contextual chrome.")
                            .font(HudFont.ui(HudTextSize.base))
                            .foregroundStyle(HudPalette.muted)
                    }
                }

                HudCard {
                    VStack(alignment: .leading, spacing: HudSpacing.lg) {
                        HudSectionLabel("TRY IT")
                        Label("Use the bottom tab bar", systemImage: "rectangle.bottomthird.inset.filled")
                            .font(HudFont.ui(HudTextSize.base))
                            .foregroundStyle(HudPalette.ink)
                        Text("Primary demo surfaces live in the iOS tab bar. Extra pages move behind More, keeping the bottom stable instead of turning it into a catch-all action tray.")
                            .font(HudFont.ui(HudTextSize.sm))
                            .foregroundStyle(HudPalette.muted)
                        Divider().background(HudHairline.subtle)
                        Label("Open the Complications demo", systemImage: "circle.grid.2x2")
                            .font(HudFont.ui(HudTextSize.base))
                            .foregroundStyle(HudPalette.ink)
                        Text("The custom HUD slots are still there, but now they demonstrate contextual chrome instead of carrying global navigation.")
                            .font(HudFont.ui(HudTextSize.sm))
                            .foregroundStyle(HudPalette.muted)
                    }
                }
            }
            .padding(HudSpacing.xxl)
        }
    }

    private var heroCopy: some View {
        VStack(alignment: .leading, spacing: HudSpacing.md) {
            Text("Hudson")
                .font(HudFont.ui(HudTextSize.xxxl, weight: .bold))
                .foregroundStyle(HudPalette.ink)
            Text("Shared app shell — web · iOS · macOS")
                .font(HudFont.mono(HudTextSize.sm))
                .foregroundStyle(HudPalette.muted)
        }
    }
}
