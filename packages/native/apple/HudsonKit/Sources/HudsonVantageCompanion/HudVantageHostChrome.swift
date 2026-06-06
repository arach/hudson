import SwiftUI
import HudsonUI
import HudsonVantageCore

#if canImport(AppKit)
import AppKit
#endif

enum HudVantageMenuBarPopoverMetrics {
    static let width: CGFloat = HudLayout.popoverWidth
    static let height: CGFloat = HudLayout.textDocumentPreviewHeight
    static let settingsWindowWidth: CGFloat = 500
    static let aboutWindowMinSize: CGFloat = 620
    static var size: CGSize { CGSize(width: width, height: height) }

    #if os(macOS)
    static var nsSize: NSSize { NSSize(width: width, height: height) }
    #endif
}

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

// MARK: - Settings row helpers

private struct VantageHairlineDivider: View {
    var body: some View {
        Rectangle()
            .fill(HudHairline.subtle)
            .frame(height: HudStrokeWidth.thin)
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
        .frame(width: HudVantageMenuBarPopoverMetrics.settingsWindowWidth)
        .background(HudPalette.bg)
    }

    private var controlLaneCard: some View {
        VStack(alignment: .leading, spacing: HudSpacing.md) {
            HudSectionLabel("Control lane")
                .padding(.horizontal, HudSpacing.xs)

            VStack(spacing: 0) {
                HudSettingsPathRow(
                    icon: "terminal",
                    iconColor: model.identity.tint.color,
                    label: "Command",
                    path: model.controlFilePath,
                    actions: [
                        HudSettingsInlineAction(systemName: "doc.on.doc", help: "Copy Command path") {
                            copyToPasteboard(model.controlFilePath)
                        },
                        HudSettingsInlineAction(systemName: "folder", help: "Reveal Command in Finder") {
                            model.revealControlFile()
                        },
                    ]
                )
                VantageHairlineDivider()
                HudSettingsPathRow(
                    icon: "arrow.turn.down.right",
                    iconColor: model.identity.tint.color,
                    label: "Response",
                    path: model.responseFilePath,
                    actions: [
                        HudSettingsInlineAction(systemName: "doc.on.doc", help: "Copy Response path") {
                            copyToPasteboard(model.responseFilePath)
                        },
                    ]
                )
                VantageHairlineDivider()
                HudSettingsPathRow(
                    icon: "externaldrive",
                    iconColor: model.identity.tint.color,
                    label: "State",
                    path: model.stateFilePath,
                    actions: [
                        HudSettingsInlineAction(systemName: "doc.on.doc", help: "Copy State path") {
                            copyToPasteboard(model.stateFilePath)
                        },
                        HudSettingsInlineAction(systemName: "folder", help: "Reveal State in Finder") {
                            model.revealStateFile()
                        },
                    ]
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

                    settingsStatusStrip
                    quickActionsSection
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
        .frame(
            minWidth: HudVantageMenuBarPopoverMetrics.aboutWindowMinSize,
            minHeight: HudVantageMenuBarPopoverMetrics.aboutWindowMinSize
        )
        .background(HudPalette.bg)
    }

    // MARK: Sections

    private var settingsStatusStrip: some View {
        HStack(spacing: HudSpacing.sm) {
            HudSettingsStatusChip(
                model.configuration.restoresStateOnLaunch ? "Restore on" : "Restore off",
                tone: model.configuration.restoresStateOnLaunch ? .ok : .neutral
            )
            HudSettingsStatusChip(
                model.configuration.followsSystemColorScheme ? "System color" : "Fixed color",
                tone: .info
            )
            HudSettingsStatusChip("Agent paths", tone: .neutral)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, HudSpacing.xs)
    }

    private var quickActionsSection: some View {
        HudSettingsSection("Quick actions") {
            HudSettingsQuickActionBar(actions: [
                HudSettingsQuickAction(
                    title: "Copy Paths",
                    subtitle: "Control lane",
                    systemName: "doc.on.doc",
                    tint: model.identity.tint.color
                ) {
                    model.copyControlPaths()
                },
                HudSettingsQuickAction(
                    title: "Reveal State",
                    subtitle: "Application data",
                    systemName: "folder",
                    tint: model.identity.tint.color
                ) {
                    model.revealStateFile()
                },
                HudSettingsQuickAction(
                    title: "Reveal Control",
                    subtitle: "Command file",
                    systemName: "terminal",
                    tint: model.identity.tint.color
                ) {
                    model.revealControlFile()
                },
            ])
        }
    }

    private var applicationSection: some View {
        HudSettingsSection("Application") {
            HudSettingsMetaRow(
                icon: "app",
                iconColor: model.identity.tint.color,
                label: "Name",
                value: model.appName
            )
            VantageHairlineDivider()
            HudSettingsMetaRow(
                icon: "number",
                iconColor: model.identity.tint.color,
                label: "Version",
                value: model.appVersion,
                monoValue: true
            ) {
                HudSettingsInlineActionButton(systemName: "doc.on.doc", help: "Copy Version") {
                    copyToPasteboard(model.appVersion)
                }
            }
            VantageHairlineDivider()
            HudSettingsMetaRow(
                icon: "barcode",
                iconColor: model.identity.tint.color,
                label: "Bundle ID",
                value: model.bundleIdentifier,
                monoValue: true
            ) {
                HudSettingsInlineActionButton(systemName: "doc.on.doc", help: "Copy Bundle ID") {
                    copyToPasteboard(model.bundleIdentifier)
                }
            }
        }
    }

    private var controlLaneSection: some View {
        HudSettingsSection("Control lane") {
            HudSettingsPathRow(
                icon: "terminal",
                iconColor: model.identity.tint.color,
                label: "Command",
                path: model.controlFilePath,
                actions: [
                    HudSettingsInlineAction(systemName: "doc.on.doc", help: "Copy Command path") {
                        copyToPasteboard(model.controlFilePath)
                    },
                    HudSettingsInlineAction(systemName: "folder", help: "Reveal Command in Finder") {
                        model.revealControlFile()
                    },
                ]
            )
            VantageHairlineDivider()
            HudSettingsPathRow(
                icon: "arrow.turn.down.right",
                iconColor: model.identity.tint.color,
                label: "Response",
                path: model.responseFilePath,
                actions: [
                    HudSettingsInlineAction(systemName: "doc.on.doc", help: "Copy Response path") {
                        copyToPasteboard(model.responseFilePath)
                    },
                ]
            )
            VantageHairlineDivider()
            HudSettingsPathRow(
                icon: "externaldrive",
                iconColor: model.identity.tint.color,
                label: "State",
                path: model.stateFilePath,
                actions: [
                    HudSettingsInlineAction(systemName: "doc.on.doc", help: "Copy State path") {
                        copyToPasteboard(model.stateFilePath)
                    },
                    HudSettingsInlineAction(systemName: "folder", help: "Reveal State in Finder") {
                        model.revealStateFile()
                    },
                ]
            )
        }
    }

    private var workspaceSection: some View {
        HudSettingsSection("Workspace") {
            HudSettingsMetaRow(
                icon: "square.grid.2x2",
                iconColor: model.identity.tint.color,
                label: "Workspace",
                value: model.configuration.workspaceID,
                monoValue: true
            ) {
                HudSettingsInlineActionButton(systemName: "doc.on.doc", help: "Copy Workspace") {
                    copyToPasteboard(model.configuration.workspaceID)
                }
            }
            VantageHairlineDivider()
            HudSettingsRow(
                icon: "arrow.clockwise",
                iconColor: model.identity.tint.color,
                title: "Restore state on launch",
                subtitle: "Runtime configuration supplied by the host"
            ) {
                HudSettingsStatusChip(
                    model.configuration.restoresStateOnLaunch ? "ON" : "OFF",
                    tone: model.configuration.restoresStateOnLaunch ? .ok : .neutral
                )
            }
            VantageHairlineDivider()
            HudSettingsRow(
                icon: "circle.lefthalf.filled",
                iconColor: model.identity.tint.color,
                title: "Follow system color scheme",
                subtitle: "Adapts chrome to the current macOS appearance"
            ) {
                HudSettingsStatusChip(
                    model.configuration.followsSystemColorScheme ? "ON" : "OFF",
                    tone: model.configuration.followsSystemColorScheme ? .ok : .neutral
                )
            }
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
            .frame(width: .zero, height: .zero)
            .onAppear {
                Task { @MainActor in
                    await Task.yield()
                    storage.controller.start(model: model)
                }
            }
    }
}

public struct HudVantageHostMenuBarPopoverView: View {
    @ObservedObject private var model: HudVantageHostAppModel
    private let onDismiss: () -> Void
    private let onShowMainWindow: () -> Void
    private let onOpenSettings: () -> Void

    public init(
        model: HudVantageHostAppModel,
        onDismiss: @escaping () -> Void,
        onShowMainWindow: @escaping () -> Void,
        onOpenSettings: @escaping () -> Void
    ) {
        self.model = model
        self.onDismiss = onDismiss
        self.onShowMainWindow = onShowMainWindow
        self.onOpenSettings = onOpenSettings
    }

    public var body: some View {
        VStack(spacing: 0) {
            hero
            VantageHairlineDivider()
            metricsSection
            actionSection
            controlLane
            footer
        }
        .frame(width: HudVantageMenuBarPopoverMetrics.width, height: HudVantageMenuBarPopoverMetrics.height)
        .background(popoverBackground)
        .preferredColorScheme(.dark)
    }

    private var popoverBackground: some View {
        ZStack(alignment: .topLeading) {
            HudPalette.bg
            LinearGradient(
                colors: [
                    HudSurface.tintFill(model.identity.tint.color),
                    HudSurface.tintGhost(model.identity.tint.color),
                    .clear,
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }

    private var hero: some View {
        HStack(alignment: .center, spacing: HudSpacing.lg) {
            ZStack {
                RoundedRectangle(cornerRadius: HudRadius.card)
                    .fill(HudSurface.tintFill(model.identity.tint.color))
                    .overlay(
                        RoundedRectangle(cornerRadius: HudRadius.card)
                            .stroke(HudSurface.tintBorder(model.identity.tint.color), lineWidth: HudStrokeWidth.standard)
                    )
                Image(systemName: "square.grid.2x2")
                    .font(HudFont.ui(HudTextSize.lg, weight: .semibold))
                    .foregroundStyle(model.identity.tint.color)
            }
            .frame(width: HudIconSize.huge, height: HudIconSize.huge)

            VStack(alignment: .leading, spacing: HudSpacing.xxs) {
                HStack(spacing: HudSpacing.sm) {
                    Text(model.appName)
                        .font(HudFont.ui(HudTextSize.lg, weight: .semibold))
                        .foregroundStyle(HudPalette.ink)
                    HudBadge(liveLabel, tint: statusTint, dot: model.status != nil)
                }
                Text(model.identity.tagline)
                    .font(HudFont.ui(HudTextSize.xs))
                    .foregroundStyle(HudPalette.muted)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Button {
                activateMainWindow()
            } label: {
                Image(systemName: "arrow.up.forward.app")
                    .font(HudFont.ui(HudTextSize.sm, weight: .medium))
                    .foregroundStyle(HudPalette.ink)
                    .frame(width: HudIconSize.medium, height: HudIconSize.medium)
                    .background(RoundedRectangle(cornerRadius: HudRadius.standard).fill(HudSurface.control))
                    .overlay(RoundedRectangle(cornerRadius: HudRadius.standard).stroke(HudHairline.subtle, lineWidth: HudStrokeWidth.thin))
            }
            .buttonStyle(.plain)
            .help("Show canvas")
        }
        .padding(.horizontal, HudSpacing.xxl)
        .padding(.vertical, HudSpacing.xl)
    }

    private var metricsSection: some View {
        HStack(spacing: HudSpacing.sm) {
            VantagePopoverMetricCard(
                title: "Nodes",
                value: "\(model.status?.nodeCount ?? 0)",
                icon: "square.stack.3d.up",
                tint: model.identity.tint.color
            )
            VantagePopoverMetricCard(
                title: "Selected",
                value: "\(model.status?.selectedCount ?? 0)",
                icon: "scope",
                tint: (model.status?.selectedCount ?? 0) > 0 ? HudPalette.statusOk : HudPalette.muted
            )
            VantagePopoverMetricCard(
                title: "Control",
                value: model.status?.controlStatus ?? "Warming",
                icon: "waveform.path.ecg",
                tint: statusTint
            )
        }
        .padding(.horizontal, HudSpacing.xxl)
        .padding(.vertical, HudSpacing.lg)
    }

    private var actionSection: some View {
        VStack(spacing: HudSpacing.sm) {
            HStack(spacing: HudSpacing.sm) {
                VantagePopoverActionButton(title: "Palette", icon: "command", tint: model.identity.tint.color) {
                    performCanvasCommand(.showCommandPalette)
                }
                VantagePopoverActionButton(title: "Lens", icon: "magnifyingglass", tint: model.identity.tint.color) {
                    performCanvasCommand(.openLens)
                }
                VantagePopoverActionButton(title: "Save", icon: "square.and.arrow.down", tint: HudPalette.statusOk) {
                    model.send(.saveWorkspace)
                }
            }
            HStack(spacing: HudSpacing.sm) {
                VantagePopoverActionButton(title: "Fit", icon: "viewfinder", tint: model.identity.tint.color) {
                    performCanvasCommand(.fitViewport)
                }
                VantagePopoverActionButton(title: "Tags", icon: "rectangle.3.group", tint: model.identity.tint.color) {
                    performCanvasCommand(.layoutByTag)
                }
                VantagePopoverActionButton(title: "Paths", icon: "doc.on.doc", tint: HudPalette.muted) {
                    model.copyControlPaths()
                }
            }
        }
        .padding(.horizontal, HudSpacing.xxl)
        .padding(.bottom, HudSpacing.lg)
    }

    private var controlLane: some View {
        VStack(alignment: .leading, spacing: HudSpacing.sm) {
            HStack(spacing: HudSpacing.sm) {
                HudSectionLabel("CONTROL LANE", tint: statusTint)
                Spacer(minLength: 0)
                Text(model.configuration.workspaceID)
                    .font(HudFont.mono(HudTextSize.micro, weight: .semibold))
                    .foregroundStyle(HudPalette.dim)
                    .lineLimit(1)
            }

            HStack(spacing: HudSpacing.sm) {
                Image(systemName: "point.3.connected.trianglepath.dotted")
                    .font(HudFont.ui(HudTextSize.xs, weight: .medium))
                    .foregroundStyle(statusTint)
                    .frame(width: HudIconSize.micro, height: HudIconSize.micro)
                Text(model.controlFilePath)
                    .font(HudFont.mono(HudTextSize.xxs))
                    .foregroundStyle(HudPalette.muted)
                    .lineLimit(1)
                    .truncationMode(.middle)
                Spacer(minLength: 0)
                HudSettingsInlineActionButton(systemName: "folder", help: "Reveal control file") {
                    model.revealControlFile()
                }
            }
            .padding(.horizontal, HudSpacing.md)
            .padding(.vertical, HudSpacing.sm)
            .background(RoundedRectangle(cornerRadius: HudRadius.standard).fill(HudSurface.inset))
            .overlay(RoundedRectangle(cornerRadius: HudRadius.standard).stroke(HudHairline.subtle, lineWidth: HudStrokeWidth.thin))
        }
        .padding(.horizontal, HudSpacing.xxl)
        .padding(.bottom, HudSpacing.lg)
    }

    private var footer: some View {
        HStack(spacing: HudSpacing.md) {
            Button {
                onDismiss()
                onOpenSettings()
            } label: {
                Label("Settings", systemImage: "slider.horizontal.3")
            }
            .buttonStyle(.plain)
            .font(HudFont.ui(HudTextSize.sm))
            .foregroundStyle(HudPalette.muted)

            Spacer(minLength: 0)

            Text("Right-click the icon for the full command menu")
                .font(HudFont.ui(HudTextSize.xs))
                .foregroundStyle(HudPalette.muted)
                .lineLimit(1)

            Button {
                model.showsAbout = true
                activateMainWindow()
            } label: {
                Label("About", systemImage: "info.circle")
            }
            .buttonStyle(.plain)
            .font(HudFont.ui(HudTextSize.sm))
            .foregroundStyle(HudPalette.muted)
        }
        .padding(.horizontal, HudSpacing.xxl)
        .padding(.bottom, HudSpacing.lg)
    }

    private var liveLabel: String {
        model.status == nil ? "WARMING" : "LIVE"
    }

    private var statusTint: Color {
        guard let status = model.status else { return HudPalette.statusWarn }
        let value = status.controlStatus.lowercased()
        if value.contains("error") || value.contains("failed") || value.contains("missing") {
            return HudPalette.statusError
        }
        if value.contains("saved") || value.contains("ready") {
            return HudPalette.statusOk
        }
        return model.identity.tint.color
    }

    private func performCanvasCommand(_ command: VantageHostCommand) {
        activateMainWindow()
        model.send(command)
    }

    private func activateMainWindow() {
        onShowMainWindow()
    }
}

private struct VantagePopoverMetricCard: View {
    let title: String
    let value: String
    let icon: String
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: HudSpacing.sm) {
            HStack(spacing: HudSpacing.xs) {
                Image(systemName: icon)
                    .font(HudFont.ui(HudTextSize.xs, weight: .medium))
                    .foregroundStyle(tint)
                    .frame(width: HudIconSize.micro, height: HudIconSize.micro)
                Text(title.uppercased())
                    .font(HudFont.mono(HudTextSize.micro, weight: .semibold))
                    .tracking(0.6)
                    .foregroundStyle(HudPalette.dim)
            }
            Text(value)
                .font(HudFont.mono(HudTextSize.sm, weight: .semibold))
                .foregroundStyle(HudPalette.ink)
                .lineLimit(1)
                .truncationMode(.tail)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(HudSpacing.md)
        .frame(maxWidth: .infinity, minHeight: HudLayout.rowHeightRegular)
        .background(RoundedRectangle(cornerRadius: HudRadius.standard).fill(HudSurface.control))
        .overlay(RoundedRectangle(cornerRadius: HudRadius.standard).stroke(HudSurface.tintBorder(tint), lineWidth: HudStrokeWidth.thin))
    }
}

private struct VantagePopoverActionButton: View {
    let title: String
    let icon: String
    let tint: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: HudSpacing.sm) {
                Image(systemName: icon)
                    .font(HudFont.ui(HudTextSize.xs, weight: .medium))
                    .foregroundStyle(tint)
                    .frame(width: HudIconSize.micro, height: HudIconSize.micro)
                Text(title)
                    .font(HudFont.ui(HudTextSize.sm, weight: .medium))
                    .foregroundStyle(HudPalette.ink)
                    .lineLimit(1)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, HudSpacing.md)
            .frame(maxWidth: .infinity, minHeight: HudLayout.rowHeightCompact)
            .background(RoundedRectangle(cornerRadius: HudRadius.standard).fill(HudSurface.control))
            .overlay(RoundedRectangle(cornerRadius: HudRadius.standard).stroke(HudHairline.subtle, lineWidth: HudStrokeWidth.thin))
            .contentShape(RoundedRectangle(cornerRadius: HudRadius.standard))
        }
        .buttonStyle(.plain)
        .help(title)
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
