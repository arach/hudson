import SwiftUI
import HudsonUI
import HudsonCanvasCore

#if canImport(AppKit)
import AppKit
#endif

enum HudCanvasMenuBarPopoverMetrics {
    static let width: CGFloat = HudLayout.popoverWidth
    static let height: CGFloat = HudLayout.textDocumentPreviewHeight
    static let metadataLabelWidth: CGFloat = 96
    static let iconButtonSize: CGFloat = HudLayout.textDocumentModeButtonHeight
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
private struct CanvasIdentityHero: View {
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
private struct CanvasMetaRow: View {
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
                .frame(width: HudCanvasMenuBarPopoverMetrics.metadataLabelWidth, alignment: .leading)

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
                CanvasInlineActionButton(systemName: "doc.on.doc", help: "Copy \(label)", action: onCopy)
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
private struct CanvasPathRow: View {
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
                    CanvasInlineActionButton(systemName: "doc.on.doc", help: "Copy \(label) path", action: onCopy)
                }
                if let onReveal {
                    CanvasInlineActionButton(systemName: "folder", help: "Reveal \(label) in Finder", action: onReveal)
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

private struct CanvasInlineActionButton: View {
    let systemName: String
    let help: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(HudFont.ui(HudTextSize.xs, weight: .medium))
                .foregroundStyle(HudPalette.muted)
                .frame(
                    width: HudCanvasMenuBarPopoverMetrics.iconButtonSize,
                    height: HudCanvasMenuBarPopoverMetrics.iconButtonSize
                )
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

private struct CanvasHairlineDivider: View {
    var body: some View {
        Rectangle()
            .fill(HudHairline.subtle)
            .frame(height: HudStrokeWidth.thin)
    }
}

/// Compact on/off chip used by the Workspace section to surface boolean
/// configuration flags. Read-only by design — these reflect runtime config
/// supplied by the host, not user-editable preferences.
private struct CanvasFlagChip: View {
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

public struct HudCanvasHostAboutView: View {
    @ObservedObject private var model: HudCanvasHostAppModel
    @Environment(\.dismiss) private var dismiss

    public init(model: HudCanvasHostAppModel) {
        self.model = model
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: HudSpacing.xxxl) {
                CanvasIdentityHero(
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
        .frame(width: HudCanvasMenuBarPopoverMetrics.settingsWindowWidth)
        .background(HudPalette.bg)
    }

    private var controlLaneCard: some View {
        VStack(alignment: .leading, spacing: HudSpacing.md) {
            HudSectionLabel("Control lane")
                .padding(.horizontal, HudSpacing.xs)

            VStack(spacing: 0) {
                CanvasPathRow(
                    icon: "terminal",
                    label: "Command",
                    path: model.controlFilePath,
                    iconColor: model.identity.tint.color,
                    onCopy: { copyToPasteboard(model.controlFilePath) },
                    onReveal: { model.revealControlFile() }
                )
                CanvasHairlineDivider()
                CanvasPathRow(
                    icon: "arrow.turn.down.right",
                    label: "Response",
                    path: model.responseFilePath,
                    iconColor: model.identity.tint.color,
                    onCopy: { copyToPasteboard(model.responseFilePath) }
                )
                CanvasHairlineDivider()
                CanvasPathRow(
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
            CanvasHairlineDivider()
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

public struct HudCanvasHostSettingsView: View {
    @ObservedObject private var model: HudCanvasHostAppModel

    public init(model: HudCanvasHostAppModel) {
        self.model = model
    }

    public var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: HudSpacing.huge) {
                    CanvasIdentityHero(
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
        .frame(
            minWidth: HudCanvasMenuBarPopoverMetrics.aboutWindowMinSize,
            minHeight: HudCanvasMenuBarPopoverMetrics.aboutWindowMinSize
        )
        .background(HudPalette.bg)
    }

    // MARK: Sections

    private var applicationSection: some View {
        HudSettingsSection("Application") {
            CanvasMetaRow(
                icon: "app",
                label: "Name",
                value: model.appName,
                iconColor: model.identity.tint.color
            )
            CanvasHairlineDivider()
            CanvasMetaRow(
                icon: "number",
                label: "Version",
                value: model.appVersion,
                iconColor: model.identity.tint.color,
                monoValue: true,
                onCopy: { copyToPasteboard(model.appVersion) }
            )
            CanvasHairlineDivider()
            CanvasMetaRow(
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
            CanvasPathRow(
                icon: "terminal",
                label: "Command",
                path: model.controlFilePath,
                iconColor: model.identity.tint.color,
                onCopy: { copyToPasteboard(model.controlFilePath) },
                onReveal: { model.revealControlFile() }
            )
            CanvasHairlineDivider()
            CanvasPathRow(
                icon: "arrow.turn.down.right",
                label: "Response",
                path: model.responseFilePath,
                iconColor: model.identity.tint.color,
                onCopy: { copyToPasteboard(model.responseFilePath) }
            )
            CanvasHairlineDivider()
            CanvasPathRow(
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
            CanvasMetaRow(
                icon: "square.grid.2x2",
                label: "Workspace",
                value: model.configuration.workspaceID,
                iconColor: model.identity.tint.color,
                monoValue: true,
                onCopy: { copyToPasteboard(model.configuration.workspaceID) }
            )
            CanvasHairlineDivider()
            CanvasFlagChip(
                label: "Restore state on launch",
                isOn: model.configuration.restoresStateOnLaunch,
                tint: model.identity.tint.color
            )
            CanvasHairlineDivider()
            CanvasFlagChip(
                label: "Follow system color scheme",
                isOn: model.configuration.followsSystemColorScheme,
                tint: model.identity.tint.color
            )
        }
    }

    // MARK: Footer

    private var footerBar: some View {
        VStack(spacing: 0) {
            CanvasHairlineDivider()
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
final class HudCanvasHostMenuBarControllerStorage: ObservableObject {
    let controller = HudCanvasHostMenuBarController()
}

public struct HudCanvasHostMenuBarCoordinator: View {
    @ObservedObject private var model: HudCanvasHostAppModel
    @StateObject private var storage = HudCanvasHostMenuBarControllerStorage()

    public init(model: HudCanvasHostAppModel) {
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

public struct HudCanvasHostMenuBarPopoverView: View {
    @ObservedObject private var model: HudCanvasHostAppModel
    private let onDismiss: () -> Void
    private let onShowMainWindow: () -> Void
    private let onOpenSettings: () -> Void

    public init(
        model: HudCanvasHostAppModel,
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
            CanvasHairlineDivider()
            metricsSection
            actionSection
            controlLane
            footer
        }
        .frame(width: HudCanvasMenuBarPopoverMetrics.width, height: HudCanvasMenuBarPopoverMetrics.height)
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
            CanvasPopoverMetricCard(
                title: "Nodes",
                value: "\(model.status?.nodeCount ?? 0)",
                icon: "square.stack.3d.up",
                tint: model.identity.tint.color
            )
            CanvasPopoverMetricCard(
                title: "Selected",
                value: "\(model.status?.selectedCount ?? 0)",
                icon: "scope",
                tint: (model.status?.selectedCount ?? 0) > 0 ? HudPalette.statusOk : HudPalette.muted
            )
            CanvasPopoverMetricCard(
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
                CanvasPopoverActionButton(title: "Palette", icon: "command", tint: model.identity.tint.color) {
                    performCanvasCommand(.showCommandPalette)
                }
                CanvasPopoverActionButton(title: "Lens", icon: "magnifyingglass", tint: model.identity.tint.color) {
                    performCanvasCommand(.openLens)
                }
                CanvasPopoverActionButton(title: "Save", icon: "square.and.arrow.down", tint: HudPalette.statusOk) {
                    model.send(.saveWorkspace)
                }
            }
            HStack(spacing: HudSpacing.sm) {
                CanvasPopoverActionButton(title: "Fit", icon: "viewfinder", tint: model.identity.tint.color) {
                    performCanvasCommand(.fitViewport)
                }
                CanvasPopoverActionButton(title: "Tags", icon: "rectangle.3.group", tint: model.identity.tint.color) {
                    performCanvasCommand(.layoutByTag)
                }
                CanvasPopoverActionButton(title: "Paths", icon: "doc.on.doc", tint: HudPalette.muted) {
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
                CanvasInlineActionButton(systemName: "folder", help: "Reveal control file") {
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

    private func performCanvasCommand(_ command: CanvasHostCommand) {
        activateMainWindow()
        model.send(command)
    }

    private func activateMainWindow() {
        onShowMainWindow()
    }
}

private struct CanvasPopoverMetricCard: View {
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

private struct CanvasPopoverActionButton: View {
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

public struct HudCanvasHostMenuBarContents: View {
    @ObservedObject private var model: HudCanvasHostAppModel
    @Environment(\.openWindow) private var openWindow
    @Environment(\.openSettings) private var openSettings

    public init(model: HudCanvasHostAppModel) {
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
