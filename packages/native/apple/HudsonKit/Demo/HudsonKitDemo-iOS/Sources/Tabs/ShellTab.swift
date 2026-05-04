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
                        Text("Sibling to HudAppShell. Wraps a NavigationStack and dispatches HUD-coordinated complications to the chosen renderer (.tray default).")
                            .font(HudFont.ui(HudTextSize.base))
                            .foregroundStyle(HudPalette.muted)
                    }
                }

                HudCard {
                    VStack(alignment: .leading, spacing: HudSpacing.lg) {
                        HudSectionLabel("TRY IT")
                        Label("Long-press the center button", systemImage: "hand.tap")
                            .font(HudFont.ui(HudTextSize.base))
                            .foregroundStyle(HudPalette.ink)
                        Text("That reveals the page picker — the situation-aware center slot in action.")
                            .font(HudFont.ui(HudTextSize.sm))
                            .foregroundStyle(HudPalette.muted)
                        Divider().background(HudHairline.subtle)
                        Label("Tap a corner button", systemImage: "hand.point.up")
                            .font(HudFont.ui(HudTextSize.base))
                            .foregroundStyle(HudPalette.ink)
                        Text("Top-left → Logs · top-right → About · bottom-left → Settings · bottom-right → Shell.")
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
