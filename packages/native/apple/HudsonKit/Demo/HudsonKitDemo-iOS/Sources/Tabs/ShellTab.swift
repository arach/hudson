import SwiftUI
import HudsonUI

struct ShellTab: View {
    @Environment(\.colorScheme) private var colorScheme
    @State private var isShowingSystemSheet = false
    @State private var isShowingSystemDialog = false

    init() {
        let arguments = ProcessInfo.processInfo.arguments
        _isShowingSystemSheet = State(
            initialValue: arguments.contains("--appearance-proof-sheet")
        )
        _isShowingSystemDialog = State(
            initialValue: arguments.contains("--appearance-proof-dialog")
        )
    }

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
                        Text("Its default Hudson appearance keeps system navigation, toolbars, sheets, dialogs, and controls dark enough for the stable palette, even when the device uses Light appearance.")
                            .font(HudFont.ui(HudTextSize.sm))
                            .foregroundStyle(HudPalette.muted)
                        Text("Resolved system scheme · \(colorScheme == .dark ? "DARK" : "LIGHT")")
                            .font(HudFont.mono(HudTextSize.xxs))
                            .foregroundStyle(HudPalette.dim)
                            .accessibilityIdentifier("hudson.shell.resolved-system-scheme")
                        VStack(alignment: .leading, spacing: HudSpacing.md) {
                            HudButton("Show native sheet", icon: "rectangle.bottomhalf.inset.filled") {
                                isShowingSystemSheet = true
                            }
                            HudButton("Show native dialog", icon: "exclamationmark.bubble", style: .ghost) {
                                isShowingSystemDialog = true
                            }
                        }
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
        .sheet(isPresented: $isShowingSystemSheet) {
            NavigationStack {
                VStack(alignment: .leading, spacing: HudSpacing.lg) {
                    HudSectionLabel("NATIVE PRESENTATION", tint: HudPalette.accent)
                    Text("System sheet chrome inherits the Hudson shell appearance.")
                        .font(HudFont.ui(HudTextSize.base))
                        .foregroundStyle(HudPalette.ink)
                    Text("Change the device between Light and Dark appearance: the navigation title, toolbar action, and grabber remain readable against Hudson's stable palette.")
                        .font(HudFont.ui(HudTextSize.sm))
                        .foregroundStyle(HudPalette.muted)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .padding(HudSpacing.xxl)
                .background(HudPalette.bg)
                .navigationTitle("System sheet")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") {
                            isShowingSystemSheet = false
                        }
                    }
                }
            }
            .presentationDetents([.medium])
            .presentationDragIndicator(.visible)
        }
        .confirmationDialog(
            "System dialog",
            isPresented: $isShowingSystemDialog,
            titleVisibility: .visible
        ) {
            Button("Keep Hudson appearance") {}
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Native dialog labels inherit readable system ink from the phone shell.")
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
