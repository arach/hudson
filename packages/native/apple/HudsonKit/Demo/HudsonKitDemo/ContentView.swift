import SwiftUI
import HudsonUI
import HudsonShell

enum DemoTab: String, CaseIterable, Identifiable {
    case dashboard, voice, shell, sidebar, tokens, primitives, manifest
    var id: String { rawValue }
    var label: String { rawValue.capitalized }

    var icon: String {
        switch self {
        case .dashboard:  return "rectangle.grid.2x2"
        case .voice:      return "waveform"
        case .shell:      return "rectangle.split.3x1"
        case .sidebar:    return "sidebar.left"
        case .tokens:     return "circle.hexagongrid"
        case .primitives: return "square.stack.3d.up"
        case .manifest:   return "doc.text"
        }
    }

    var navItem: HRailItem {
        HRailItem(id: rawValue, label: label, icon: icon)
    }
}

enum DemoVariant: String, CaseIterable, Identifiable {
    case scout, lattices
    var id: String { rawValue }

    var manifest: HAppManifest {
        switch self {
        case .scout:    return HAppManifest(name: "Scout",    tint: .cyan,  targetLabel: "Agent")
        case .lattices: return HAppManifest(name: "Lattices", tint: .green, targetLabel: "Machine")
        }
    }

    var label: String {
        switch self {
        case .scout:    return "Scout"
        case .lattices: return "Lattices"
        }
    }
}

struct ContentView: View {
    @State private var tab: DemoTab = .dashboard
    @State private var variant: DemoVariant = .lattices
    @State private var navExpanded: Bool = true
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

    var body: some View {
        HAppShell {
            HNavigationRail(
                selection: Binding(
                    get: { tab.rawValue },
                    set: { newId in if let next = DemoTab(rawValue: newId) { tab = next } }
                ),
                items: DemoTab.allCases.map(\.navItem),
                isExpanded: $navExpanded,
                showHeaderToggle: false
            ) {
                variantPicker
            }
        } trailing: {
            HInspector(isCollapsed: $inspectorCollapsed) {
                HStack(spacing: HSpacing.md) {
                    HSectionLabel("Inspector")
                    Spacer()
                    if let target = selectedTarget {
                        HBadge(target.statusLabel, tint: target.statusColor, dot: true)
                    } else {
                        HBadge(tab.label.uppercased())
                    }
                }
            } content: {
                inspectorContent
            }
        } topDrawer: {
            EmptyView()
        } bottomDrawer: {
            HTerminalDrawer(
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
        .hudsonTakeover(isPresented: $takeoverOpen) {
            HTakeover(isPresented: $takeoverOpen) {
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
                .frame(width: 0, height: 0)
        )
        .toolbar {
            ToolbarItem(placement: .navigation) {
                Button(action: toggleNav) {
                    Image(systemName: "sidebar.left")
                }
                .help(navExpanded ? "Collapse navigation" : "Expand navigation")
            }
        }
    }

    private func toggleNav() {
        if reduceMotion {
            navExpanded.toggle()
        } else {
            withAnimation(HMotion.chromeResize) {
                navExpanded.toggle()
            }
        }
    }

    // MARK: Command palette commands

    private var commands: [HCommand] {
        var cmds: [HCommand] = []

        for candidate in DemoTab.allCases where candidate != tab {
            cmds.append(HCommand(
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
            cmds.append(HCommand(
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
            cmds.append(HCommand(
                id: "variant.\(candidate.rawValue)",
                title: "Variant: \(candidate.label)",
                icon: "paintbrush",
                group: "Theme",
                action: { variant = candidate }
            ))
        }

        cmds.append(HCommand(
            id: "drawer.toggle",
            title: terminalOpen ? "Close terminal drawer" : "Open terminal drawer",
            subtitle: "Bottom chrome · attached to host app",
            icon: "rectangle.bottomthird.inset.filled",
            group: "Surfaces",
            action: { terminalOpen.toggle() }
        ))
        cmds.append(HCommand(
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
        cmds.append(HCommand(
            id: "rail.toggle",
            title: navExpanded ? "Collapse navigation rail" : "Expand navigation rail",
            icon: "sidebar.left",
            group: "Surfaces",
            action: { navExpanded.toggle() }
        ))
        cmds.append(HCommand(
            id: "inspector.toggle",
            title: inspectorCollapsed ? "Open inspector" : "Close inspector",
            icon: "sidebar.right",
            group: "Surfaces",
            action: { inspectorCollapsed.toggle() }
        ))

        if selectedTarget != nil {
            cmds.append(HCommand(
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
        HStack(spacing: HSpacing.md) {
            HSectionLabel("Takeover", tint: variant.manifest.accent)
            if let target = selectedTarget {
                Text("/")
                    .font(HFont.mono(10))
                    .foregroundStyle(HPalette.dim)
                Text(target.name)
                    .font(HFont.mono(11, weight: .semibold))
                    .foregroundStyle(HPalette.ink)
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
        case .voice, .shell, .sidebar, .tokens, .primitives, .manifest:
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
                    case .dashboard:  EmptyView()
                    }
                }
                .padding(HSpacing.xxl)
                .frame(maxWidth: .infinity, alignment: .topLeading)
            }
        }
    }

    // MARK: Variant picker (rail footer)

    private var variantPicker: some View {
        VStack(alignment: .leading, spacing: HSpacing.md) {
            HSectionLabel("Variant")
            Picker("Variant", selection: $variant) {
                ForEach(DemoVariant.allCases) { Text($0.label).tag($0) }
            }
            .pickerStyle(.segmented)
        }
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
        return VStack(alignment: .leading, spacing: HSpacing.xl) {
            HCard {
                VStack(alignment: .leading, spacing: HSpacing.md) {
                    HKVRow("App",     value: manifest.name)
                    HKVRow("Version", value: manifest.version)
                    HKVRow("Target",  value: manifest.targetLabel)
                }
            }

            HCard {
                VStack(alignment: .leading, spacing: HSpacing.md) {
                    HStack {
                        HSectionLabel("Surface", tint: HPalette.muted)
                        Spacer()
                    }
                    HKVRow("Tab",  value: tab.label)
                    HKVRow("Mode", value: navExpanded ? "Expanded" : "Collapsed")
                }
            }
        }
    }

    @ViewBuilder
    private func targetInspectorContent(_ target: TargetMock) -> some View {
        VStack(alignment: .leading, spacing: HSpacing.xl) {
            HCard {
                VStack(alignment: .leading, spacing: HSpacing.md) {
                    HStack(spacing: HSpacing.lg) {
                        Image(systemName: target.icon)
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(target.iconTint.color)
                            .frame(width: 32, height: 32)
                            .background(RoundedRectangle(cornerRadius: HRadius.standard).fill(target.iconTint.color.opacity(0.15)))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(target.name)
                                .font(HFont.mono(12, weight: .semibold))
                                .foregroundStyle(HPalette.ink)
                            Text(target.host)
                                .font(HFont.mono(10))
                                .foregroundStyle(HPalette.muted)
                        }
                    }
                    HDivider()
                    HKVRow("Status",  value: target.statusLabel.capitalized, valueColor: target.statusColor)
                    HKVRow("Latency", value: target.latency ?? "—")
                    if let scene = target.scene {
                        HKVRow("Scene", value: scene)
                    }
                }
            }

            HCard {
                VStack(alignment: .leading, spacing: HSpacing.md) {
                    HStack {
                        HSectionLabel("Agent")
                        Spacer()
                        HStatusDot(
                            color: target.agentTint.color,
                            size: 6,
                            pulses: target.agentStatus == "running"
                        )
                    }
                    HKVRow("State", value: target.agentStatus)
                    if let activity = target.agentActivity {
                        HKVRow("Doing", value: activity)
                    }
                }
            }

            HCard {
                VStack(alignment: .leading, spacing: HSpacing.md) {
                    HSectionLabel("Quick actions", tint: HPalette.muted)
                    HButton("Terminal app", icon: "terminal", style: .secondary) {
                        terminalAppOpen = true
                    }
                    HButton("Toggle drawer", icon: "rectangle.bottomthird.inset.filled", style: .ghost) {
                        terminalOpen.toggle()
                    }
                    HButton("Reconnect", icon: "arrow.clockwise", style: .ghost) {
                        takeoverOpen = true
                    }
                }
            }
        }
    }

    // MARK: Status bar

    private var statusBar: some View {
        HStack(spacing: HSpacing.xl) {
            HStatusDot(color: variant.manifest.accent, pulses: true)
            Text("HUDSON·KIT")
                .font(HFont.mono(10, weight: .bold))
                .tracking(1.5)
                .foregroundStyle(HPalette.muted)

            statusSeparator
            statusContext

            Spacer()

            Button(action: { paletteOpen = true }) {
                HStack(spacing: HSpacing.xs) {
                    Image(systemName: "command")
                        .font(.system(size: 9, weight: .semibold))
                    Text("K")
                        .font(HFont.mono(9, weight: .semibold))
                    Text("palette")
                        .font(HFont.mono(9))
                        .tracking(0.6)
                }
                .foregroundStyle(HPalette.dim)
                .padding(.horizontal, HSpacing.md)
                .padding(.vertical, 2)
                .overlay(
                    RoundedRectangle(cornerRadius: HRadius.tight)
                        .stroke(HHairline.standard, lineWidth: 1)
                )
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Open command palette")

            statusSeparator

            Text("v\(variant.manifest.version)")
                .font(HFont.mono(10))
                .foregroundStyle(HPalette.dim)
            HBadge(tab.label.uppercased(), tint: variant.manifest.accent)
        }
        .padding(.horizontal, HSpacing.xxl)
        .frame(height: HLayout.statusBarHeight)
    }

    @ViewBuilder
    private var statusContext: some View {
        if takeoverOpen, let target = selectedTarget {
            HStatusDot(color: HPalette.statusOk, size: 5, pulses: true)
            Text("connected · \(target.name)")
                .font(HFont.mono(10))
                .foregroundStyle(HPalette.statusOk)
        } else if let target = selectedTarget {
            Image(systemName: target.icon)
                .font(.system(size: 9))
                .foregroundStyle(target.iconTint.color)
            Text("canvas · \(target.name)")
                .font(HFont.mono(10))
                .foregroundStyle(HPalette.ink)
        } else {
            Text("ready")
                .font(HFont.mono(10))
                .foregroundStyle(HPalette.muted)
        }
    }

    private var statusSeparator: some View {
        Text("·")
            .font(HFont.mono(10))
            .foregroundStyle(HPalette.dim)
    }
}
