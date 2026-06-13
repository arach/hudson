import SwiftUI
import HudsonUI
import HudsonUIWeb
import HudsonShell

enum DemoTab: String, CaseIterable, Identifiable {
    case dashboard, explorer, terminal, canvas, voice, shell, sidebar, tokens, primitives, manifest, about
    var id: String { rawValue }
    var label: String { rawValue.capitalized }

    var icon: String {
        switch self {
        case .dashboard:  return "rectangle.grid.2x2"
        case .explorer:   return "folder"
        case .terminal:   return "terminal"
        case .canvas:     return "square.grid.3x3.fill"
        case .voice:      return "waveform"
        case .shell:      return "rectangle.split.3x1"
        case .sidebar:    return "sidebar.left"
        case .tokens:     return "circle.hexagongrid"
        case .primitives: return "square.stack.3d.up"
        case .manifest:   return "doc.text"
        case .about:      return "info.circle"
        }
    }

    var navItem: HudRailItem {
        HudRailItem(id: rawValue, label: label, icon: icon)
    }
}

enum GlassAccentChoice: String, CaseIterable, Identifiable {
    case none, manifest, cyan, magenta, amber, white
    var id: String { rawValue }

    var label: String {
        switch self {
        case .none:     return "Neutral"
        case .manifest: return "App accent"
        case .cyan:     return "Cyan"
        case .magenta:  return "Magenta"
        case .amber:    return "Amber"
        case .white:    return "White"
        }
    }

    func resolve(manifestAccent: Color) -> Color? {
        switch self {
        case .none:     return nil
        case .manifest: return manifestAccent
        case .cyan:     return .cyan
        // Demo-only one-off color used by the accent picker swatch list.
        // hudlint:disable next-line palette
        case .magenta:  return Color(red: 1.0, green: 0.4, blue: 0.85)
        case .amber:    return .orange
        case .white:    return .white
        }
    }
}

struct ContentView: View {
    @State private var tab: DemoTab = .dashboard
    @State private var navExpanded: Bool = true
    @State private var navLabelWidth: CGFloat = HudSidebarLayout.labelWidth
    @State private var sidebarSurface: HudSidebarSurfaceStyle = .base
    @State private var glassRadius: CGFloat = 10
    @State private var glassTranslucency: Double = 1.0
    @State private var glassAccentChoice: GlassAccentChoice = .none
    @State private var inspectorCollapsed: Bool = false
    @State private var selectedTargetId: String? = nil
    @State private var takeoverOpen: Bool = false
    @State private var terminalAppOpen: Bool = false
    @State private var paletteOpen: Bool = false
    @State private var shellWidth: CGFloat = DemoLayout.shellCompactBreakpoint
    @State private var shellCompact = false
    @State private var explorerModel = HudFileExplorerModel(rootURL: DemoResources.defaultExplorerRoot)
    @State private var settingsPresented = false
    @State private var settingsSelection: DemoSettingsSection = .general
    @StateObject private var settingsNavState = HudSecondaryNavState()
    // Terminal & Canvas own live PTY/tmux sessions. Track which heavy tabs have
    // been opened so we can mount them lazily and keep them alive once visited,
    // instead of booting every tab at launch.
    @State private var liveHeavyTabs: Set<DemoTab> = []

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var selectedTarget: TargetMock? {
        guard let id = selectedTargetId else { return nil }
        return TargetMock.fleet.first(where: { $0.id == id })
    }

    private var sidebarEntries: [HudSidebarEntry<DemoTab>] {
        let workbench: [DemoTab] = [.dashboard, .explorer, .terminal, .canvas, .voice, .shell, .sidebar]
        let reference: [DemoTab] = [.tokens, .primitives, .manifest]
        var entries: [HudSidebarEntry<DemoTab>] = []
        entries.append(contentsOf: workbench.map {
            .item(HudSidebarItem(id: $0, title: $0.label, icon: $0.icon))
        })
        entries.append(.section(id: "reference", title: "Reference"))
        entries.append(contentsOf: reference.map {
            .item(HudSidebarItem(id: $0, title: $0.label, icon: $0.icon))
        })
        return entries
    }

    var body: some View {
        GeometryReader { geometry in
            shellBody
                .onAppear {
                    shellWidth = geometry.size.width
                    shellCompact = geometry.size.width < DemoLayout.shellCompactBreakpoint
                }
                .onChange(of: geometry.size.width) { _, width in
                    shellWidth = width
                    let nextCompact = width < DemoLayout.shellCompactBreakpoint
                    guard nextCompact != shellCompact else { return }
                    shellCompact = nextCompact
                    if nextCompact {
                        applyCompactChromePolicy(width: width)
                    }
                }
        }
    }

    private var shellBody: some View {
        HudAppShell {
            HudResizableNavigationSidebar(
                selection: Binding(
                    get: { tab as DemoTab? },
                    set: { if let next = $0 { tab = next } }
                ),
                entries: sidebarEntries,
                isCompact: Binding(
                    get: { !navExpanded },
                    set: { navExpanded = !$0 }
                ),
                labelWidth: $navLabelWidth,
                railHeader: {
                    HudStatusDot(color: DemoManifest.app.accent)
                        .frame(width: HudIconSize.micro, height: HudIconSize.micro)
                        .contentShape(Rectangle())
                        .accessibilityLabel("Toggle navigation")
                },
                labelHeader: {
                    Text(DemoManifest.app.name)
                        .font(HudFont.ui(HudTextSize.base, weight: .semibold))
                        .foregroundStyle(HudPalette.ink)
                        .lineLimit(1)
                        .contentShape(Rectangle())
                        .accessibilityLabel("Toggle navigation")
                },
                footer: {
                    HudSettingsFooterButton(showsLabel: navExpanded) {
                        openSettings()
                    }
                }
            )
        } trailing: {
            if showsHostInspector {
                HudInspector(isCollapsed: $inspectorCollapsed) {
                    HStack(spacing: HudSpacing.md) {
                        HudSectionLabel("Inspector")
                        Spacer()
                        if let target = selectedTarget {
                            HudBadge(target.statusLabel, tint: target.statusColor, dot: true)
                        }
                    }
                } content: {
                    inspectorContent
                }
            } else {
                EmptyView()
            }
        } topDrawer: {
            EmptyView()
        } bottomDrawer: {
            EmptyView()
        } content: {
            if settingsPresented {
                HudSettingsWorkspace(
                    selection: $settingsSelection,
                    catalog: DemoSettings.catalog,
                    navState: settingsNavState
                )
            } else {
                tabContent
            }
        } statusBar: {
            if tab == .canvas {
                EmptyView()
            } else {
                DashboardBottomChrome()
            }
        }
        .onChange(of: tab) { _, next in
            settingsPresented = false
            if next == .canvas {
                inspectorCollapsed = true
            }
            if next == .terminal || next == .canvas {
                liveHeavyTabs.insert(next)
            }
        }
        .hudsonAppManifest(DemoManifest.app)
        .environment(\.hudsonSidebarStyle, HudSidebarStyle(
            surface: sidebarSurface,
            liquidGlass: HudLiquidGlassConfig(
                cornerRadius: glassRadius,
                translucency: glassTranslucency,
                accent: glassAccentChoice.resolve(manifestAccent: DemoManifest.app.accent)
            )
        ))
        .hudsonTakeover(isPresented: $takeoverOpen) {
            HudTakeover(isPresented: $takeoverOpen) {
                takeoverHeader
            } content: {
                if let target = selectedTarget {
                    ConnectFlow(target: target)
                }
            }
        }
        .hudsonTakeover(isPresented: $terminalAppOpen) {
            if let target = selectedTarget {
                TerminalApp(target: target) {
                    terminalAppOpen = false
                }
            }
        }
        .hudsonCommandPalette(isPresented: $paletteOpen, commands: commands)
        .background(
            Button("Open command palette") { paletteOpen = true }
                .keyboardShortcut("k", modifiers: .command)
                .opacity(0)
                // Invisible keyboard sink — zero-size shape for routing the ⌘K shortcut.
                // hudlint:disable next-line geometry
                .frame(width: 0, height: 0)
        )
        .toolbar {
            ToolbarItem(placement: .navigation) {
                Button(action: toggleNav) {
                    Image(systemName: "sidebar.left")
                }
                .help(navExpanded ? "Collapse navigation" : "Expand navigation")
            }
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    Picker("Surface", selection: $sidebarSurface) {
                        ForEach(HudSidebarSurfaceStyle.allCases) { style in
                            Text(style.label).tag(style)
                        }
                    }
                    if sidebarSurface == .liquidGlass {
                        Divider()
                        Picker("Corner radius", selection: $glassRadius) {
                            Text("Square (0)").tag(CGFloat(0))
                            Text("Subtle (6)").tag(CGFloat(6))
                            Text("Standard (10)").tag(CGFloat(10))
                            Text("Soft (16)").tag(CGFloat(16))
                            Text("Pill (24)").tag(CGFloat(24))
                        }
                        Picker("Translucency", selection: $glassTranslucency) {
                            Text("Faint (0.4)").tag(0.4)
                            Text("Light (0.7)").tag(0.7)
                            Text("Native (1.0)").tag(1.0)
                        }
                        Picker("Accent", selection: $glassAccentChoice) {
                            ForEach(GlassAccentChoice.allCases) { choice in
                                Text(choice.label).tag(choice)
                            }
                        }
                    }
                } label: {
                    Image(systemName: "rectangle.lefthalf.inset.filled")
                }
                .help("Sidebar surface style")
            }
        }
        #if os(macOS)
        .toolbarBackground(.visible, for: .windowToolbar)
        .toolbarBackground(Color.black, for: .windowToolbar)
        .toolbarColorScheme(.dark, for: .windowToolbar)
        .background(HudWindowChrome(
            colorScheme: .dark,
            titleVisibility: .hidden,
            titlebarAppearsTransparent: true,
            usesFullSizeContentView: false,
            isMovableByWindowBackground: false,
            hidesToolbar: false
        ))
        #endif
    }

    private func openSettings() {
        settingsNavState.prepareForPresentation()
        if let defaultSelection = DemoSettings.catalog.defaultSelection {
            settingsSelection = defaultSelection
        }
        settingsPresented = true
    }

    private func toggleNav() {
        if reduceMotion {
            navExpanded.toggle()
        } else {
            withAnimation(HudMotion.chromeResize) {
                navExpanded.toggle()
            }
        }
    }

    private func applyCompactChromePolicy(width: CGFloat) {
        guard width < DemoLayout.shellCompactBreakpoint else { return }

        if !inspectorCollapsed {
            inspectorCollapsed = true
        }

        guard navExpanded else { return }
        if reduceMotion {
            navExpanded = false
        } else {
            withAnimation(HudMotion.chromeResize) {
                navExpanded = false
            }
        }
    }

    // MARK: Command palette commands

    private var commands: [HudCommand] {
        var cmds: [HudCommand] = []

        for candidate in DemoTab.allCases where candidate != tab {
            cmds.append(HudCommand(
                id: "tab.\(candidate.rawValue)",
                title: "Go to \(candidate.label)",
                icon: candidate.icon,
                group: "Tabs",
                action: {
                    tab = candidate
                    selectedTargetId = nil
                }
            ))
        }

        for target in TargetMock.fleet where selectedTargetId != target.id {
            cmds.append(HudCommand(
                id: "open.\(target.id)",
                title: "Open \(target.name)",
                subtitle: "\(target.host) · \(target.statusLabel)",
                icon: target.icon,
                group: "Targets",
                action: {
                    tab = .dashboard
                    selectedTargetId = target.id
                }
            ))
        }

        cmds.append(HudCommand(
            id: "terminal.open",
            title: "Go to Terminal",
            subtitle: "Primary shell in the Hudson checkout",
            icon: "terminal",
            group: "Surfaces",
            action: {
                tab = .terminal
                selectedTargetId = nil
            }
        ))
        cmds.append(HudCommand(
            id: "rail.toggle",
            title: navExpanded ? "Collapse navigation rail" : "Expand navigation rail",
            icon: "sidebar.left",
            group: "Surfaces",
            action: { navExpanded.toggle() }
        ))
        cmds.append(HudCommand(
            id: "inspector.toggle",
            title: inspectorCollapsed ? "Open inspector" : "Close inspector",
            icon: "sidebar.right",
            group: "Surfaces",
            action: { inspectorCollapsed.toggle() }
        ))

        if selectedTarget != nil {
            cmds.append(HudCommand(
                id: "canvas.close",
                title: "Back to fleet",
                icon: "chevron.left",
                group: "Surfaces",
                action: { selectedTargetId = nil }
            ))
        }

        return cmds
    }

    private var takeoverHeader: some View {
        HStack(spacing: HudSpacing.md) {
            HudSectionLabel("Takeover", tint: DemoManifest.app.accent)
            if let target = selectedTarget {
                Text("/")
                    .font(HudFont.mono(HudTextSize.xxs))
                    .foregroundStyle(HudPalette.dim)
                Text(target.name)
                    .font(HudFont.mono(HudTextSize.xs, weight: .semibold))
                    .foregroundStyle(HudPalette.ink)
            }
        }
    }

    // MARK: Tab content

    // Only the selected light tab is built into the view graph. Switching
    // between them tears down the previous tab instead of keeping all 11
    // mounted, so a tab change no longer rebuilds hidden tabs' subtrees.
    @ViewBuilder
    private var tabContent: some View {
        ZStack {
            activeLightTab
            heavyTabLayer
        }
    }

    @ViewBuilder
    private var activeLightTab: some View {
        switch tab {
        case .dashboard:
            dashboardTabBody
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        case .explorer:
            ExplorerTab(model: explorerModel, shellCompact: shellCompact)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        case .voice:
            referenceTab { VoiceTab() }
        case .shell:
            referenceTab {
                ShellTab(
                    onOpenPalette: { paletteOpen = true },
                    onOpenTakeover: {
                        if selectedTargetId == nil {
                            selectedTargetId = TargetMock.fleet.first?.id
                        }
                        takeoverOpen = true
                    },
                    onOpenTerminal: { tab = .terminal },
                    onToggleRail: { navExpanded.toggle() },
                    onToggleInspector: { inspectorCollapsed.toggle() }
                )
            }
        case .sidebar:
            referenceTab { SidebarTab() }
        case .tokens:
            referenceTab { TokensTab() }
        case .primitives:
            referenceTab { PrimitivesTab() }
        case .manifest:
            referenceTab { ManifestTab() }
        case .about:
            referenceTab { AboutTab() }
        case .terminal, .canvas:
            // Rendered by `heavyTabLayer` so their live sessions survive switches.
            Color.clear
        }
    }

    @ViewBuilder
    private var dashboardTabBody: some View {
        if let target = selectedTarget {
            TargetCanvas(
                target: target,
                onClose: { selectedTargetId = nil },
                onConnect: { takeoverOpen = true }
            )
        } else {
            DashboardTab(onSelectTarget: { target in
                selectedTargetId = target.id
            })
        }
    }

    // Terminal and Canvas own live processes (PTY / tmux), so we don't tear them
    // down on every switch. Each mounts lazily on first visit (`tab == candidate`)
    // and then stays alive (`liveHeavyTabs`) hidden behind opacity — and neither
    // boots until the user actually opens it.
    @ViewBuilder
    private var heavyTabLayer: some View {
        if liveHeavyTabs.contains(.terminal) || tab == .terminal {
            TerminalTab()
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .opacity(tab == .terminal ? 1 : 0)
                .allowsHitTesting(tab == .terminal)
                .accessibilityHidden(tab != .terminal)
        }
        if liveHeavyTabs.contains(.canvas) || tab == .canvas {
            CanvasTab()
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .opacity(tab == .canvas ? 1 : 0)
                .allowsHitTesting(tab == .canvas)
                .accessibilityHidden(tab != .canvas)
        }
    }

    @ViewBuilder
    private func referenceTab<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        ScrollView {
            content()
                .padding(HudSpacing.xxl)
                .frame(maxWidth: .infinity, alignment: .topLeading)
        }
    }

    private var showsHostInspector: Bool {
        tab != .canvas
    }

    // MARK: Inspector content

    @ViewBuilder
    private var inspectorContent: some View {
        if let target = selectedTarget {
            targetInspectorContent(target)
        } else {
            defaultInspectorContent
        }
    }

    private var defaultInspectorContent: some View {
        let manifest = DemoManifest.app
        return VStack(alignment: .leading, spacing: HudSpacing.xl) {
            HudCard {
                VStack(alignment: .leading, spacing: HudSpacing.md) {
                    HudKVRow("App",     value: manifest.name)
                    HudKVRow("Version", value: manifest.version)
                    HudKVRow("Target",  value: manifest.targetLabel)
                }
            }

            HudCard {
                VStack(alignment: .leading, spacing: HudSpacing.md) {
                    HStack {
                        HudSectionLabel("Surface", tint: HudPalette.muted)
                        Spacer()
                    }
                    HudKVRow("Tab",  value: tab.label)
                    HudKVRow("Mode", value: navExpanded ? "Expanded" : "Collapsed")
                }
            }
        }
    }

    @ViewBuilder
    private func targetInspectorContent(_ target: TargetMock) -> some View {
        VStack(alignment: .leading, spacing: HudSpacing.xl) {
            HudCard {
                VStack(alignment: .leading, spacing: HudSpacing.md) {
                    HStack(spacing: HudSpacing.lg) {
                        Image(systemName: target.icon)
                            .font(HudFont.ui(HudTextSize.md, weight: .medium))
                            .foregroundStyle(target.iconTint.color)
                            .frame(width: HudIconSize.large, height: HudIconSize.large)
                            .background(RoundedRectangle(cornerRadius: HudRadius.standard).fill(HudSurface.tintFill(target.iconTint.color)))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(target.name)
                                .font(HudFont.mono(HudTextSize.sm, weight: .semibold))
                                .foregroundStyle(HudPalette.ink)
                            Text(target.host)
                                .font(HudFont.mono(HudTextSize.xxs))
                                .foregroundStyle(HudPalette.muted)
                        }
                    }
                    HudDivider()
                    HudKVRow("Status",  value: target.statusLabel.capitalized, valueColor: target.statusColor)
                    HudKVRow("Latency", value: target.latency ?? "—")
                    if let scene = target.scene {
                        HudKVRow("Scene", value: scene)
                    }
                }
            }

            HudCard {
                VStack(alignment: .leading, spacing: HudSpacing.md) {
                    HStack {
                        HudSectionLabel("Agent")
                        Spacer()
                        HudStatusDot(
                            color: target.agentTint.color,
                            size: 6,
                            pulses: target.agentStatus == "running"
                        )
                    }
                    HudKVRow("State", value: target.agentStatus)
                    if let activity = target.agentActivity {
                        HudKVRow("Doing", value: activity)
                    }
                }
            }

            HudCard {
                VStack(alignment: .leading, spacing: HudSpacing.md) {
                    HudSectionLabel("Quick actions", tint: HudPalette.muted)
                    HudButton("Terminal", icon: "terminal", style: .secondary) {
                        tab = .terminal
                    }
                    HudButton("Reconnect", icon: "arrow.clockwise", style: .ghost) {
                        takeoverOpen = true
                    }
                }
            }
        }
    }

}
