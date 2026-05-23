import SwiftUI
import HudsonUI

#if canImport(AppKit)
import AppKit
#endif

// MARK: - Shared identity hero

/// Identity strip shared by Settings and About: app icon, name, version pill,
/// and tagline. Sets the visual anchor for both surfaces so they read as one
/// family rather than two separate windows.
private struct VantageIdentityHero: View {
    let appName: String
    let appVersion: String
    let bundleIdentifier: String
    let tagline: String
    let tint: Color
    var iconSize: CGFloat = 56
    var showsBundleIdentifier: Bool = false

    var body: some View {
        HStack(alignment: .top, spacing: HudSpacing.xl) {
            iconView

            VStack(alignment: .leading, spacing: HudSpacing.sm) {
                HStack(alignment: .firstTextBaseline, spacing: HudSpacing.md) {
                    Text(appName)
                        .font(HudFont.ui(HudTextSize.xl, weight: .semibold))
                        .foregroundStyle(HudPalette.ink)

                    HudBadge("v\(appVersion)", tint: tint)
                }

                Text(tagline)
                    .font(HudFont.ui(HudTextSize.sm))
                    .foregroundStyle(HudPalette.muted)
                    .fixedSize(horizontal: false, vertical: true)

                if showsBundleIdentifier {
                    Text(bundleIdentifier)
                        .font(HudFont.mono(HudTextSize.xs))
                        .foregroundStyle(HudPalette.dim)
                        .textSelection(.enabled)
                }
            }

            Spacer(minLength: 0)
        }
    }

    @ViewBuilder
    private var iconView: some View {
        #if canImport(AppKit)
        Image(nsImage: NSApp.applicationIconImage)
            .resizable()
            .frame(width: iconSize, height: iconSize)
            .clipShape(RoundedRectangle(cornerRadius: HudRadius.card))
            .overlay(
                RoundedRectangle(cornerRadius: HudRadius.card)
                    .stroke(HudHairline.subtle, lineWidth: HudStrokeWidth.thin)
            )
        #else
        RoundedRectangle(cornerRadius: HudRadius.card)
            .fill(HudSurface.tintFill(tint))
            .frame(width: iconSize, height: iconSize)
            .overlay(
                Image(systemName: "square.grid.2x2")
                    .font(.system(size: iconSize * 0.45, weight: .semibold))
                    .foregroundStyle(tint)
            )
        #endif
    }
}

// MARK: - Settings row primitives

/// Simple labeled key/value row used by the Application + Workspace sections.
/// Two columns (label / value) with optional trailing copy button that fades
/// in on hover so the row reads as informational by default.
private struct VantageMetaRow: View {
    let icon: String
    let label: String
    let value: String
    var iconColor: Color
    var monoValue: Bool = false
    var onCopy: (() -> Void)? = nil

    @State private var isHovering = false

    var body: some View {
        HStack(alignment: .center, spacing: HudSpacing.xl) {
            HudSettingsLeadingIcon(systemName: icon, color: iconColor)

            Text(label)
                .font(HudFont.ui(HudTextSize.md))
                .foregroundStyle(HudPalette.ink)
                .frame(width: 96, alignment: .leading)

            Text(value)
                .font(monoValue
                    ? HudFont.mono(HudTextSize.xs)
                    : HudFont.ui(HudTextSize.sm))
                .foregroundStyle(HudPalette.muted)
                .textSelection(.enabled)
                .lineLimit(1)
                .truncationMode(.middle)
                .frame(maxWidth: .infinity, alignment: .leading)

            if let onCopy {
                VantageInlineActionButton(systemName: "doc.on.doc", help: "Copy \(label)", action: onCopy)
                    .opacity(isHovering ? 1 : 0)
            }
        }
        .padding(.horizontal, HudSpacing.lg)
        .padding(.vertical, HudSpacing.md)
        .contentShape(Rectangle())
        .onHover { isHovering = $0 }
        .animation(.easeOut(duration: 0.12), value: isHovering)
    }
}

/// Filesystem path row with optional inline copy + reveal actions. Path is
/// rendered in mono with mid-truncation; actions live on the trailing edge
/// and stay visible (paths are the primary content here, not metadata).
private struct VantagePathRow: View {
    let icon: String
    let label: String
    let path: String
    var iconColor: Color
    var onCopy: (() -> Void)? = nil
    var onReveal: (() -> Void)? = nil

    @State private var isHovering = false

    var body: some View {
        HStack(alignment: .top, spacing: HudSpacing.xl) {
            HudSettingsLeadingIcon(systemName: icon, color: iconColor)

            VStack(alignment: .leading, spacing: HudSpacing.xxs) {
                Text(label)
                    .font(HudFont.ui(HudTextSize.md))
                    .foregroundStyle(HudPalette.ink)
                Text(path)
                    .font(HudFont.mono(HudTextSize.xs))
                    .foregroundStyle(HudPalette.muted)
                    .textSelection(.enabled)
                    .lineLimit(2)
                    .truncationMode(.middle)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            HStack(spacing: HudSpacing.xs) {
                if let onCopy {
                    VantageInlineActionButton(systemName: "doc.on.doc", help: "Copy \(label) path", action: onCopy)
                }
                if let onReveal {
                    VantageInlineActionButton(systemName: "folder", help: "Reveal \(label) in Finder", action: onReveal)
                }
            }
            .opacity(isHovering ? 1 : 0.6)
        }
        .padding(.horizontal, HudSpacing.lg)
        .padding(.vertical, HudSpacing.md)
        .contentShape(Rectangle())
        .onHover { isHovering = $0 }
        .animation(.easeOut(duration: 0.12), value: isHovering)
    }
}

private struct VantageInlineActionButton: View {
    let systemName: String
    let help: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(HudFont.ui(HudTextSize.xs, weight: .medium))
                .foregroundStyle(HudPalette.muted)
                .frame(width: 24, height: 24)
                .background(
                    RoundedRectangle(cornerRadius: HudRadius.tight)
                        .fill(HudSurface.control)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: HudRadius.tight)
                        .stroke(HudHairline.subtle, lineWidth: HudStrokeWidth.thin)
                )
        }
        .buttonStyle(.plain)
        .help(help)
    }
}

private struct VantageHairlineDivider: View {
    var body: some View {
        Rectangle()
            .fill(HudHairline.subtle)
            .frame(height: HudStrokeWidth.thin)
    }
}

/// Compact on/off chip used by the Workspace section to surface boolean
/// configuration flags. Read-only by design — these reflect runtime config
/// supplied by the host, not user-editable preferences.
private struct VantageFlagChip: View {
    let label: String
    let isOn: Bool
    let tint: Color

    var body: some View {
        HStack(spacing: HudSpacing.sm) {
            HudStatusDot(
                color: isOn ? tint : HudPalette.dim,
                size: HudDotSize.tiny
            )
            Text(label)
                .font(HudFont.mono(HudTextSize.xs))
                .foregroundStyle(isOn ? HudPalette.ink : HudPalette.muted)
            Spacer(minLength: 0)
            Text(isOn ? "ON" : "OFF")
                .font(HudFont.mono(HudTextSize.micro, weight: .semibold))
                .tracking(0.8)
                .foregroundStyle(isOn ? tint : HudPalette.dim)
        }
        .padding(.horizontal, HudSpacing.lg)
        .padding(.vertical, HudSpacing.md)
    }
}

// MARK: - About

public struct HudVantageHostAboutView: View {
    @ObservedObject private var model: HudVantageHostAppModel
    @Environment(\.dismiss) private var dismiss

    public init(model: HudVantageHostAppModel) {
        self.model = model
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: HudSpacing.xxxl) {
                VantageIdentityHero(
                    appName: model.appName,
                    appVersion: model.appVersion,
                    bundleIdentifier: model.bundleIdentifier,
                    tagline: model.identity.tagline,
                    tint: model.identity.tint.color,
                    showsBundleIdentifier: true
                )

                controlLaneCard
            }
            .padding(.horizontal, HudSpacing.xxxl)
            .padding(.top, HudSpacing.xxxl)
            .padding(.bottom, HudSpacing.huge)

            footer
        }
        .frame(width: 500)
        .background(HudPalette.bg)
    }

    private var controlLaneCard: some View {
        VStack(alignment: .leading, spacing: HudSpacing.md) {
            HudSectionLabel("Control lane")
                .padding(.horizontal, HudSpacing.xs)

            VStack(spacing: 0) {
                VantagePathRow(
                    icon: "terminal",
                    label: "Command",
                    path: model.controlFilePath,
                    iconColor: model.identity.tint.color,
                    onCopy: { copyToPasteboard(model.controlFilePath) },
                    onReveal: { model.revealControlFile() }
                )
                VantageHairlineDivider()
                VantagePathRow(
                    icon: "arrow.turn.down.right",
                    label: "Response",
                    path: model.responseFilePath,
                    iconColor: model.identity.tint.color,
                    onCopy: { copyToPasteboard(model.responseFilePath) }
                )
                VantageHairlineDivider()
                VantagePathRow(
                    icon: "externaldrive",
                    label: "State",
                    path: model.stateFilePath,
                    iconColor: model.identity.tint.color,
                    onCopy: { copyToPasteboard(model.stateFilePath) },
                    onReveal: { model.revealStateFile() }
                )
            }
            .background(RoundedRectangle(cornerRadius: HudRadius.card).fill(HudPalette.surface))
            .overlay(
                RoundedRectangle(cornerRadius: HudRadius.card)
                    .stroke(HudHairline.subtle, lineWidth: HudStrokeWidth.thin)
            )
        }
    }

    private var footer: some View {
        VStack(spacing: 0) {
            VantageHairlineDivider()
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
            .padding(.horizontal, HudSpacing.xxxl)
            .padding(.vertical, HudSpacing.xl)
        }
        .background(HudPalette.chrome)
    }

    private func copyToPasteboard(_ value: String) {
        #if canImport(AppKit)
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(value, forType: .string)
        #endif
    }
}

// MARK: - Settings

public struct HudVantageHostSettingsView: View {
    @ObservedObject private var model: HudVantageHostAppModel

    public init(model: HudVantageHostAppModel) {
        self.model = model
    }

    public var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: HudSpacing.huge) {
                    VantageIdentityHero(
                        appName: model.appName,
                        appVersion: model.appVersion,
                        bundleIdentifier: model.bundleIdentifier,
                        tagline: model.identity.tagline,
                        tint: model.identity.tint.color
                    )
                    .padding(.horizontal, HudSpacing.xs)

                    applicationSection
                    controlLaneSection
                    workspaceSection
                }
                .padding(.horizontal, HudSpacing.xxxl)
                .padding(.top, HudSpacing.xxxl)
                .padding(.bottom, HudSpacing.huge)
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            footerBar
        }
        .frame(minWidth: 620, minHeight: 620)
        .background(HudPalette.bg)
    }

    // MARK: Sections

    private var applicationSection: some View {
        HudSettingsSection("Application") {
            VantageMetaRow(
                icon: "app",
                label: "Name",
                value: model.appName,
                iconColor: model.identity.tint.color
            )
            VantageHairlineDivider()
            VantageMetaRow(
                icon: "number",
                label: "Version",
                value: model.appVersion,
                iconColor: model.identity.tint.color,
                monoValue: true,
                onCopy: { copyToPasteboard(model.appVersion) }
            )
            VantageHairlineDivider()
            VantageMetaRow(
                icon: "barcode",
                label: "Bundle ID",
                value: model.bundleIdentifier,
                iconColor: model.identity.tint.color,
                monoValue: true,
                onCopy: { copyToPasteboard(model.bundleIdentifier) }
            )
        }
    }

    private var controlLaneSection: some View {
        HudSettingsSection("Control lane") {
            VantagePathRow(
                icon: "terminal",
                label: "Command",
                path: model.controlFilePath,
                iconColor: model.identity.tint.color,
                onCopy: { copyToPasteboard(model.controlFilePath) },
                onReveal: { model.revealControlFile() }
            )
            VantageHairlineDivider()
            VantagePathRow(
                icon: "arrow.turn.down.right",
                label: "Response",
                path: model.responseFilePath,
                iconColor: model.identity.tint.color,
                onCopy: { copyToPasteboard(model.responseFilePath) }
            )
            VantageHairlineDivider()
            VantagePathRow(
                icon: "externaldrive",
                label: "State",
                path: model.stateFilePath,
                iconColor: model.identity.tint.color,
                onCopy: { copyToPasteboard(model.stateFilePath) },
                onReveal: { model.revealStateFile() }
            )
        }
    }

    private var workspaceSection: some View {
        HudSettingsSection("Workspace") {
            VantageMetaRow(
                icon: "square.grid.2x2",
                label: "Workspace",
                value: model.configuration.workspaceID,
                iconColor: model.identity.tint.color,
                monoValue: true,
                onCopy: { copyToPasteboard(model.configuration.workspaceID) }
            )
            VantageHairlineDivider()
            VantageFlagChip(
                label: "Restore state on launch",
                isOn: model.configuration.restoresStateOnLaunch,
                tint: model.identity.tint.color
            )
            VantageHairlineDivider()
            VantageFlagChip(
                label: "Follow system color scheme",
                isOn: model.configuration.followsSystemColorScheme,
                tint: model.identity.tint.color
            )
        }
    }

    // MARK: Footer

    private var footerBar: some View {
        VStack(spacing: 0) {
            VantageHairlineDivider()
            HStack(spacing: HudSpacing.md) {
                Text("Changes apply on next launch")
                    .font(HudFont.mono(HudTextSize.xs))
                    .foregroundStyle(HudPalette.dim)

                Spacer()

                HudButton("Reveal State", icon: "folder", style: .ghost) {
                    model.revealStateFile()
                }
                HudButton("Copy Paths", icon: "doc.on.doc", style: .secondary) {
                    model.copyControlPaths()
                }
            }
            .padding(.horizontal, HudSpacing.xxxl)
            .padding(.vertical, HudSpacing.xl)
        }
        .background(HudPalette.chrome)
    }

    private func copyToPasteboard(_ value: String) {
        #if canImport(AppKit)
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(value, forType: .string)
        #endif
    }
}

// MARK: - Menu bar companion (popover + coordinator)

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
    @Environment(\.openSettings) private var openSettings
    private let onDismiss: () -> Void

    public init(model: HudVantageHostAppModel, onDismiss: @escaping () -> Void) {
        self.model = model
        self.onDismiss = onDismiss
    }

    public var body: some View {
        VStack(spacing: 0) {
            header
            VantageHairlineDivider()
            statusSection
            VantageHairlineDivider()
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
                popoverStatusRow("Nodes", value: "\(status.nodeCount)")
                popoverStatusRow("Selected", value: "\(status.selectedCount)")
                popoverStatusRow("Control", value: status.controlStatus)
            } else {
                Text("Waiting for canvas status…")
                    .font(HudFont.ui(HudTextSize.sm))
                    .foregroundStyle(HudPalette.dim)
            }

            popoverStatusRow("Workspace", value: model.configuration.workspaceID)
        }
        .padding(.horizontal, HudSpacing.xl)
        .padding(.vertical, HudSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func popoverStatusRow(_ label: String, value: String) -> some View {
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
                openSettings()
                NSApp.activate(ignoringOtherApps: true)
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

// MARK: - Menu bar dropdown (legacy MenuBarExtra)

public struct HudVantageHostMenuBarContents: View {
    @ObservedObject private var model: HudVantageHostAppModel
    @Environment(\.openWindow) private var openWindow
    @Environment(\.openSettings) private var openSettings

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

            Button("Settings…") {
                openSettings()
                NSApp.activate(ignoringOtherApps: true)
            }
            .keyboardShortcut(",", modifiers: [.command])

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
