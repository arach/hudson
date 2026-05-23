#if os(macOS)
import AppKit
#endif

import SwiftUI
import HudsonUI

#if canImport(AppKit)
import AppKit
#endif

public struct HudVantageHostAboutView: View {
    @ObservedObject private var model: HudVantageHostAppModel
    @Environment(\.dismiss) private var dismiss
    @Environment(\.hudsonAppManifest) private var manifest

    public init(model: HudVantageHostAppModel) {
        self.model = model
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: HudSpacing.huge) {
            header
            pathSection
            actions
        }
        .padding(HudSpacing.xxxl)
        .frame(width: 480)
        .background(HudPalette.bg)
    }

    private var header: some View {
        HStack(alignment: .top, spacing: HudSpacing.xl) {
            #if canImport(AppKit)
            Image(nsImage: NSApp.applicationIconImage)
                .resizable()
                .frame(width: 56, height: 56)
                .clipShape(RoundedRectangle(cornerRadius: HudRadius.standard))
            #endif

            VStack(alignment: .leading, spacing: HudSpacing.xs) {
                Text(model.appName)
                    .font(HudFont.ui(HudTextSize.xl, weight: .semibold))
                    .foregroundStyle(HudPalette.ink)
                Text("Version \(model.appVersion)")
                    .font(HudFont.mono(HudTextSize.xs))
                    .foregroundStyle(HudPalette.muted)
                Text(model.identity.tagline)
                    .font(HudFont.ui(HudTextSize.sm))
                    .foregroundStyle(HudPalette.dim)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var pathSection: some View {
        VStack(alignment: .leading, spacing: HudSpacing.md) {
            HudSectionLabel("Control lane", tint: manifest.accent)

            VStack(spacing: 0) {
                pathRow("Command", model.controlFilePath)
                divider
                pathRow("Response", model.responseFilePath)
                divider
                pathRow("State", model.stateFilePath)
            }
            .padding(.horizontal, HudSpacing.lg)
            .padding(.vertical, HudSpacing.sm)
            .background(HudPalette.chrome)
            .overlay(
                RoundedRectangle(cornerRadius: HudRadius.standard)
                    .stroke(HudHairline.subtle, lineWidth: HudStrokeWidth.thin)
            )
        }
    }

    private var divider: some View {
        Divider().foregroundStyle(HudHairline.subtle)
    }

    private func pathRow(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: HudSpacing.xxs) {
            Text(label.uppercased())
                .font(HudFont.mono(HudTextSize.micro, weight: .semibold))
                .tracking(0.8)
                .foregroundStyle(HudPalette.dim)
            Text(value)
                .font(HudFont.mono(HudTextSize.xs))
                .foregroundStyle(HudPalette.muted)
                .textSelection(.enabled)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, HudSpacing.sm)
    }

    private var actions: some View {
        HStack(spacing: HudSpacing.md) {
            HudButton("Copy Paths", icon: "doc.on.doc", style: .secondary) {
                model.copyControlPaths()
            }
            HudButton("Reveal State", icon: "folder", style: .ghost) {
                model.revealStateFile()
            }
            Spacer()
            HudButton("Done", style: .primary(model.identity.tint)) {
                dismiss()
            }
        }
    }
}

public struct HudVantageHostSettingsView: View {
    @ObservedObject private var model: HudVantageHostAppModel

    public init(model: HudVantageHostAppModel) {
        self.model = model
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: HudSpacing.huge) {
                VStack(alignment: .leading, spacing: HudSpacing.md) {
                    HudSectionLabel(model.appName, tint: model.identity.tint.color)
                    Text("Application support paths and control-lane wiring for the native host.")
                        .font(HudFont.ui(HudTextSize.sm))
                        .foregroundStyle(HudPalette.muted)
                        .frame(maxWidth: HudLayout.readableWidth, alignment: .leading)
                }

                HudSettingsSection("Application") {
                    infoRow(icon: "app", title: "Name", value: model.appName)
                    settingsDivider
                    infoRow(icon: "number", title: "Version", value: model.appVersion)
                    settingsDivider
                    infoRow(icon: "barcode", title: "Bundle ID", value: model.bundleIdentifier)
                }

                HudSettingsSection("Control lane") {
                    infoRow(icon: "terminal", title: "Command", value: model.controlFilePath)
                    settingsDivider
                    infoRow(icon: "arrow.turn.down.right", title: "Response", value: model.responseFilePath)
                    settingsDivider
                    infoRow(icon: "externaldrive", title: "State", value: model.stateFilePath)
                }

                HStack(spacing: HudSpacing.md) {
                    HudButton("Copy Paths", icon: "doc.on.doc") {
                        model.copyControlPaths()
                    }
                    HudButton("Reveal State", icon: "folder", style: .ghost) {
                        model.revealStateFile()
                    }
                }
            }
            .padding(HudSpacing.xxxl)
        }
        .frame(minWidth: 540, minHeight: 460)
        .background(HudPalette.bg)
    }

    private var settingsDivider: some View {
        Divider().foregroundStyle(HudHairline.subtle)
    }

    private func infoRow(icon: String, title: String, value: String) -> some View {
        HStack(alignment: .top, spacing: HudSpacing.xl) {
            HudSettingsLeadingIcon(systemName: icon, color: model.identity.tint.color)
            VStack(alignment: .leading, spacing: HudSpacing.xxs) {
                Text(title)
                    .font(HudFont.ui(HudTextSize.md))
                    .foregroundStyle(HudPalette.ink)
                Text(value)
                    .font(HudFont.mono(HudTextSize.xs))
                    .foregroundStyle(HudPalette.muted)
                    .textSelection(.enabled)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, HudSpacing.lg)
        .padding(.vertical, HudSpacing.md)
    }
}

#if os(macOS)
@MainActor
final class HudVantageHostMenuBarControllerStorage: ObservableObject {
    let controller = HudVantageHostMenuBarController()
}

public struct HudVantageHostMenuBarCoordinator: View {
    @ObservedObject private var model: HudVantageHostAppModel
    @StateObject private var storage = HudVantageHostMenuBarControllerStorage()

    public init(model: HudVantageHostAppModel) {
        self.model = model
    }

    public var body: some View {
        Color.clear
            .frame(width: 0, height: 0)
            .onAppear {
                storage.controller.start(model: model)
                storage.controller.warmUpPopover()
            }
    }
}

public struct HudVantageHostMenuBarPopoverView: View {
    @ObservedObject private var model: HudVantageHostAppModel
    @Environment(\.openWindow) private var openWindow
    private let onDismiss: () -> Void

    public init(model: HudVantageHostAppModel, onDismiss: @escaping () -> Void) {
        self.model = model
        self.onDismiss = onDismiss
    }

    public var body: some View {
        VStack(spacing: 0) {
            header
            Divider().foregroundStyle(HudHairline.subtle)
            statusSection
            Divider().foregroundStyle(HudHairline.subtle)
            actionSection
            Spacer(minLength: 0)
            footer
        }
        .frame(width: 380, height: 320)
        .background(HudPalette.bg)
        .preferredColorScheme(.dark)
    }

    private var header: some View {
        HStack(spacing: HudSpacing.sm) {
            Text(model.appName)
                .font(HudFont.ui(HudTextSize.md, weight: .semibold))
                .foregroundStyle(HudPalette.ink)

            Spacer(minLength: HudSpacing.sm)

            headerIconButton("macwindow.on.rectangle", help: "Show canvas") {
                activateMainWindow()
            }
            headerIconButton("command", help: "Command palette") {
                activateMainWindow()
                model.send(.showCommandPalette)
            }
            headerIconButton("magnifyingglass", help: "Search nodes") {
                activateMainWindow()
                model.send(.openLens)
            }
            headerIconButton("square.and.arrow.down", help: "Save workspace") {
                model.send(.saveWorkspace)
            }
            headerIconButton("arrow.clockwise", help: "Focus canvas") {
                activateMainWindow()
            }
        }
        .padding(.horizontal, HudSpacing.xl)
        .padding(.top, HudSpacing.xl)
        .padding(.bottom, HudSpacing.md)
    }

    private func headerIconButton(_ icon: String, help: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 12, weight: .medium))
                .frame(width: 28, height: 24)
                .foregroundStyle(HudPalette.muted)
                .background(HudPalette.chrome.opacity(0.65))
                .clipShape(RoundedRectangle(cornerRadius: HudRadius.tight))
        }
        .buttonStyle(.plain)
        .help(help)
    }

    private var statusSection: some View {
        VStack(alignment: .leading, spacing: HudSpacing.md) {
            if let status = model.status {
                statusRow("Nodes", value: "\(status.nodeCount)")
                statusRow("Selected", value: "\(status.selectedCount)")
                statusRow("Control", value: status.controlStatus)
            } else {
                Text("Waiting for canvas status…")
                    .font(HudFont.ui(HudTextSize.sm))
                    .foregroundStyle(HudPalette.dim)
            }

            statusRow("Workspace", value: model.configuration.workspaceID)
        }
        .padding(.horizontal, HudSpacing.xl)
        .padding(.vertical, HudSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func statusRow(_ label: String, value: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: HudSpacing.md) {
            Text(label.uppercased())
                .font(HudFont.mono(HudTextSize.micro, weight: .semibold))
                .tracking(0.6)
                .foregroundStyle(HudPalette.dim)
                .frame(width: 72, alignment: .leading)
            Text(value)
                .font(HudFont.mono(HudTextSize.xs))
                .foregroundStyle(HudPalette.muted)
                .lineLimit(2)
                .textSelection(.enabled)
            Spacer(minLength: 0)
        }
    }

    private var actionSection: some View {
        HStack(spacing: HudSpacing.md) {
            HudButton("Show Canvas", icon: "macwindow.on.rectangle", style: .secondary) {
                activateMainWindow()
            }
            HudButton("Copy Paths", icon: "doc.on.doc", style: .ghost) {
                model.copyControlPaths()
            }
        }
        .padding(.horizontal, HudSpacing.xl)
        .padding(.vertical, HudSpacing.md)
    }

    private var footer: some View {
        HStack(spacing: HudSpacing.md) {
            Button("Settings") {
                onDismiss()
                NSApp.sendAction(Selector(("showSettingsWindow:")), to: nil, from: nil)
            }
            .buttonStyle(.plain)
            .font(HudFont.ui(HudTextSize.sm))
            .foregroundStyle(HudPalette.dim)

            Spacer()

            Button("About") {
                onDismiss()
                model.showsAbout = true
                activateMainWindow()
            }
            .buttonStyle(.plain)
            .font(HudFont.ui(HudTextSize.sm))
            .foregroundStyle(HudPalette.dim)
        }
        .padding(.horizontal, HudSpacing.xl)
        .padding(.bottom, HudSpacing.lg)
    }

    private func activateMainWindow() {
        onDismiss()
        openWindow(id: "main")
        NSApp.activate(ignoringOtherApps: true)
    }
}

/// Legacy dropdown menu items — kept for hosts that still use `MenuBarExtra`.
public struct HudVantageHostMenuBarContents: View {
    @ObservedObject private var model: HudVantageHostAppModel
    @Environment(\.openWindow) private var openWindow

    public init(model: HudVantageHostAppModel) {
        self.model = model
    }

    public var body: some View {
        Group {
            if let status = model.status {
                Text("\(status.nodeCount) nodes · \(status.controlStatus)")
                    .disabled(true)
                Divider()
            }

            Button("Show \(model.appName)") {
                activateMainWindow()
            }

            Button("Command Palette") {
                activateMainWindow()
                model.send(.showCommandPalette)
            }
            .keyboardShortcut("k", modifiers: [.command])

            Button("Save Workspace") {
                model.send(.saveWorkspace)
            }
            .keyboardShortcut("s", modifiers: [.command])

            Divider()

            Button("Reveal Control File") {
                model.revealControlFile()
            }

            Divider()

            Button("About \(model.appName)") {
                model.showsAbout = true
                activateMainWindow()
            }

            Button("Quit \(model.appName)") {
                NSApp.terminate(nil)
            }
            .keyboardShortcut("q", modifiers: [.command])
        }
    }

    private func activateMainWindow() {
        openWindow(id: "main")
        NSApp.activate(ignoringOtherApps: true)
    }
}
#endif
