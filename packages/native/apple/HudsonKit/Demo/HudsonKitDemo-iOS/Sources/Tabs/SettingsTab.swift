import SwiftUI
import HudsonUI

struct SettingsTab: View {
    private let quickNavItems: [HudSettingsQuickNav.Item] = [
        .init(icon: "person.crop.circle", label: "Account",    anchor: "ACCOUNT"),
        .init(icon: "paintpalette",       label: "Appearance", anchor: "APPEARANCE"),
        .init(icon: "speaker.wave.2",     label: "Audio",      anchor: "AUDIO"),
        .init(icon: "bell",               label: "Alerts",     anchor: "ALERTS"),
        .init(icon: "wrench.and.screwdriver", label: "Advanced", anchor: "ADVANCED"),
    ]

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: HudSpacing.xxl) {
                    HudSettingsQuickNav(items: quickNavItems, proxy: proxy)
                        .padding(.top, HudSpacing.md)

                    HudSettingsSection("ACCOUNT") {
                        HudSettingsRow(icon: "person.crop.circle", iconColor: HudPalette.accent,
                                       title: "Signed in",
                                       subtitle: "demo@hudson.dev",
                                       onTap: {})
                        HudSettingsRow(icon: "key", iconColor: HudTint.amber.color,
                                       title: "API keys",
                                       subtitle: "2 active",
                                       onTap: {})
                    }

                    HudSettingsSection("APPEARANCE") {
                        HudSettingsRow(icon: "paintpalette", iconColor: HudTint.cyan.color,
                                       title: "Theme",
                                       subtitle: "Dark · Hudson default") {
                            Text("Dark")
                                .font(HudFont.mono(HudTextSize.xs))
                                .foregroundStyle(HudPalette.dim)
                        }
                        HudSettingsRow(icon: "textformat", iconColor: HudTint.teal.color,
                                       title: "Type scale",
                                       subtitle: "13pt body",
                                       onTap: {})
                    }

                    HudSettingsSection("AUDIO") {
                        HudSettingsRow(icon: "speaker.wave.2", iconColor: HudTint.green.color,
                                       title: "Output",
                                       subtitle: "System default",
                                       onTap: {})
                    }

                    HudSettingsSection("ALERTS") {
                        HudSettingsRow(icon: "bell", iconColor: HudTint.amber.color,
                                       title: "Notifications",
                                       subtitle: "Enabled") {
                            Text("ON")
                                .font(HudFont.mono(HudTextSize.xs, weight: .semibold))
                                .foregroundStyle(HudPalette.statusOk)
                        }
                    }

                    HudSettingsSection("ADVANCED") {
                        HudSettingsRow(icon: "wrench.and.screwdriver", iconColor: HudPalette.muted,
                                       title: "Diagnostics",
                                       subtitle: "Send anonymized usage")
                        HudSettingsRow(icon: "trash", iconColor: HudPalette.statusError,
                                       title: "Reset all data",
                                       subtitle: "This cannot be undone",
                                       onTap: {})
                    }
                }
                .padding(HudSpacing.xxl)
            }
        }
    }
}
