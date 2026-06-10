import SwiftUI
import HudsonUI
import HudsonShell

enum DemoTab: String, CaseIterable, Identifiable {
    case dashboard, explorer, vantage, voice, shell, sidebar, tokens, primitives, manifest, about
    var id: String { rawValue }
    var label: String { rawValue.capitalized }

    var icon: String {
        switch self {
        case .dashboard:  return "rectangle.grid.2x2"
        case .explorer:   return "folder"
        case .vantage:    return "square.grid.3x3.fill"
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

enum DemoVariant: String, CaseIterable, Identifiable {
    case scout, lattices
    var id: String { rawValue }

    var manifest: HudAppManifest {
        switch self {
        case .scout:    return HudAppManifest(name: "Scout",    tint: .cyan,  targetLabel: "Agent")
        case .lattices: return HudAppManifest(name: "Lattices", tint: .green, targetLabel: "Machine")
        }
    }

    var label: String {
        switch self {
        case .scout:    return "Scout"
        case .lattices: return "Lattices"
        }
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
    @State private var variant: DemoVariant = .lattices
    @State private var navExpanded: Bool = true
    @State private var navLabelWidth: CGFloat = HudSidebarLayout.labelWidth
    @State private var sidebarSurface: HudSidebarSurfaceStyle = .base
    @State private var glassRadius: CGFloat = 10
    @State private var glassTranslucency: Double = 1.0
    @State private var glassAccentChoice: GlassAccentChoice = .none
    @State private var inspectorCollapsed: Bool = false
    @State private var terminalOpen: Bool = false
    @State private var selectedTargetId: String? = nil
    @State private var takeoverOpen: Bool = false
    @State private var terminalAppOpen: Bool = false
    @State private var paletteOpen: Bool = false

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var selectedTarget: TargetMock? {
        guard let id = selectedTargetId else { return nil }
        return TargetMock.fleet.first(where: { $0.id == id })
    }

    private var sidebarEntries: [HudSidebarEntry<DemoTab>] {
        let workbench: [DemoTab] = [.dashboard, .explorer, .vantage, .voice, .shell, .sidebar]
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
                    HudStatusDot(color: variant.manifest.accent)
                        .frame(width: HudIconSize.micro, height: HudIconSize.micro)
                        .contentShape(Rectangle())
                        .accessibilityLabel("Toggle navigation")
                },
                labelHeader: {
                    Text(variant.manifest.name)
                        .font(HudFont.ui(HudTextSize.base, weight: .semibold))
                        .foregroundStyle(HudPalette.ink)
                        .lineLimit(1)
                        .contentShape(Rectangle())
                        .accessibilityLabel("Toggle navigation")
                },
                footer: {
                    variantPicker
                }
            )
        } trailing: {
            HudInspector(isCollapsed: $inspectorCollapsed) {
                HStack(spacing: HudSpacing.md) {
                    HudSectionLabel("Inspector")
                    Spacer()
                    if let target = selectedTarget {
                        HudBadge(target.statusLabel, tint: target.statusColor, dot: true)
                    } else {
                        HudBadge(tab.label.uppercased())
                    }
                }
            } content: {
                inspectorContent
            }
        } topDrawer: {
            EmptyView()
        } bottomDrawer: {
            HudTerminalDrawer(
                isOpen: $terminalOpen,
                title: "Terminal",
                subtitle: "arach-laptop · ~/dev/lattices",
                statusColor: variant.manifest.accent
            ) {
                DrawerTerminal(host: "arach-laptop.local")
            }
        } content: {
            tabContent
        } statusBar: {
            statusBar
        }
        .hudsonAppManifest(variant.manifest)
        .environment(\.hudsonSidebarStyle, HudSidebarStyle(
            surface: sidebarSurface,
            liquidGlass: HudLiquidGlassConfig(
                cornerRadius: glassRadius,
                translucency: glassTranslucency,
                accent: glassAccentChoice.resolve(manifestAccent: variant.manifest.accent)
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

        for candidate in DemoVariant.allCases where candidate != variant {
            cmds.append(HudCommand(
                id: "variant.\(candidate.rawValue)",
                title: "Variant: \(candidate.label)",
                icon: "paintbrush",
                group: "Theme",
                action: { variant = candidate }
            ))
        }

        cmds.append(HudCommand(
            id: "drawer.toggle",
            title: terminalOpen ? "Close terminal drawer" : "Open terminal drawer",
            subtitle: "Bottom chrome · attached to host app",
            icon: "rectangle.bottomthird.inset.filled",
            group: "Surfaces",
            action: { terminalOpen.toggle() }
        ))
        cmds.append(HudCommand(
            id: "terminalapp.open",
            title: "Open terminal app",
            subtitle: "Floating · own header + status bar",
            icon: "terminal",
            group: "Surfaces",
            action: {
                if selectedTargetId == nil {
                    selectedTargetId = TargetMock.fleet.first?.id
                }
                terminalAppOpen = true
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
            HudSectionLabel("Takeover", tint: variant.manifest.accent)
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

    @ViewBuilder
    private var tabContent: some View {
        switch tab {
        case .dashboard:
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
        case .vantage:
            VantageTab()
                .padding(HudSpacing.md)
        case .explorer:
            ExplorerTab()
                .padding(HudSpacing.xxl)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        case .voice, .shell, .sidebar, .tokens, .primitives, .manifest, .about:
            ScrollView {
                Group {
                    switch tab {
                    case .voice: VoiceTab()
                    case .shell:
                        ShellTab(
                            onOpenPalette:    { paletteOpen = true },
                            onOpenTakeover: {
                                if selectedTargetId == nil {
                                    selectedTargetId = TargetMock.fleet.first?.id
                                }
                                takeoverOpen = true
                            },
                            onToggleDrawer:   { terminalOpen.toggle() },
                            onToggleRail:     { navExpanded.toggle() },
                            onToggleInspector: { inspectorCollapsed.toggle() }
                        )
                    case .sidebar:    SidebarTab()
                    case .tokens:     TokensTab()
                    case .primitives: PrimitivesTab()
                    case .manifest:   ManifestTab()
                    case .about:      AboutTab()
                    case .dashboard, .explorer, .vantage: EmptyView()
                    }
                }
                .padding(HudSpacing.xxl)
                .frame(maxWidth: .infinity, alignment: .topLeading)
            }
        }
    }

    // MARK: Variant picker (sidebar footer)

    @ViewBuilder
    private var variantPicker: some View {
        if navExpanded {
            VStack(alignment: .leading, spacing: HudSpacing.xs) {
                HudSectionLabel("Variant")
                Picker("Variant", selection: $variant) {
                    ForEach(DemoVariant.allCases) { Text($0.label).tag($0) }
                }
                .pickerStyle(.segmented)
                .controlSize(.small)
            }
            .padding(.horizontal, HudSpacing.md)
            .padding(.vertical, HudSpacing.xs)
        } else {
            // Rail-only: a single icon button that cycles through variants.
            Button(action: cycleVariant) {
                Image(systemName: "paintpalette")
                    .font(HudFont.ui(HudTextSize.base, weight: .medium))
                    .foregroundStyle(variant.manifest.accent)
                    .frame(width: HudSidebarLayout.railWidth, height: HudSidebarLayout.rowHeight)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .help("Cycle variant")
        }
    }

    private func cycleVariant() {
        let all = DemoVariant.allCases
        guard let i = all.firstIndex(of: variant) else { return }
        variant = all[(i + 1) % all.count]
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
        let manifest = variant.manifest
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
                    HudButton("Terminal app", icon: "terminal", style: .secondary) {
                        terminalAppOpen = true
                    }
                    HudButton("Toggle drawer", icon: "rectangle.bottomthird.inset.filled", style: .ghost) {
                        terminalOpen.toggle()
                    }
                    HudButton("Reconnect", icon: "arrow.clockwise", style: .ghost) {
                        takeoverOpen = true
                    }
                }
            }
        }
    }

    // MARK: Status bar

    private var statusBar: some View {
        HStack(spacing: HudSpacing.xl) {
            HudStatusDot(color: variant.manifest.accent, pulses: true)
            Text("HUDSON·KIT")
                .font(HudFont.mono(HudTextSize.xxs, weight: .bold))
                .tracking(1.5)
                .foregroundStyle(HudPalette.muted)

            statusSeparator
            statusContext

            Spacer()

            Button(action: { paletteOpen = true }) {
                HStack(spacing: HudSpacing.xs) {
                    Image(systemName: "command")
                        .font(HudFont.ui(HudTextSize.micro, weight: .semibold))
                    Text("K")
                        .font(HudFont.mono(HudTextSize.micro, weight: .semibold))
                    Text("palette")
                        .font(HudFont.mono(HudTextSize.micro))
                        .tracking(0.6)
                }
                .foregroundStyle(HudPalette.dim)
                .padding(.horizontal, HudSpacing.md)
                .padding(.vertical, HudSpacing.xxs)
                .overlay(
                    RoundedRectangle(cornerRadius: HudRadius.tight)
                        .stroke(HudHairline.standard, lineWidth: 1)
                )
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Open command palette")

            statusSeparator

            Text("v\(variant.manifest.version)")
                .font(HudFont.mono(HudTextSize.xxs))
                .foregroundStyle(HudPalette.dim)
            HudBadge(tab.label.uppercased(), tint: variant.manifest.accent)
        }
        .padding(.horizontal, HudSpacing.xxl)
        .frame(height: HudLayout.statusBarHeight)
    }

    @ViewBuilder
    private var statusContext: some View {
        if takeoverOpen, let target = selectedTarget {
            HudStatusDot(color: HudPalette.statusOk, size: 5, pulses: true)
            Text("connected · \(target.name)")
                .font(HudFont.mono(HudTextSize.xxs))
                .foregroundStyle(HudPalette.statusOk)
        } else if let target = selectedTarget {
            Image(systemName: target.icon)
                .font(HudFont.ui(HudTextSize.micro))
                .foregroundStyle(target.iconTint.color)
            Text("canvas · \(target.name)")
                .font(HudFont.mono(HudTextSize.xxs))
                .foregroundStyle(HudPalette.ink)
        } else {
            Text("ready")
                .font(HudFont.mono(HudTextSize.xxs))
                .foregroundStyle(HudPalette.muted)
        }
    }

    private var statusSeparator: some View {
        Text("·")
            .font(HudFont.mono(HudTextSize.xxs))
            .foregroundStyle(HudPalette.dim)
    }
}
