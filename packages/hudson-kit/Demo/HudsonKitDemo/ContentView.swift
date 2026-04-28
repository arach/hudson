import SwiftUI
import HudsonUI
import HudsonShell

enum DemoTab: String, CaseIterable, Identifiable {
    case dashboard, tokens, primitives, manifest
    var id: String { rawValue }
    var label: String { rawValue.capitalized }

    var icon: String {
        switch self {
        case .dashboard:  return "rectangle.grid.2x2"
        case .tokens:     return "circle.hexagongrid"
        case .primitives: return "square.stack.3d.up"
        case .manifest:   return "doc.text"
        }
    }

    var navItem: HudsonNavRailItem {
        HudsonNavRailItem(id: rawValue, label: label, icon: icon)
    }
}

enum DemoVariant: String, CaseIterable, Identifiable {
    case scout, lattices
    var id: String { rawValue }

    var manifest: HudsonAppManifest {
        switch self {
        case .scout:    return HudsonAppManifest(name: "Scout",    tint: .cyan,  targetLabel: "Agent")
        case .lattices: return HudsonAppManifest(name: "Lattices", tint: .green, targetLabel: "Machine")
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
    @State private var paletteOpen: Bool = false

    private var selectedTarget: TargetMock? {
        guard let id = selectedTargetId else { return nil }
        return TargetMock.fleet.first(where: { $0.id == id })
    }

    var body: some View {
        HudsonAppShell {
            HudsonNavigationRail(
                selection: Binding(
                    get: { tab.rawValue },
                    set: { newId in if let next = DemoTab(rawValue: newId) { tab = next } }
                ),
                items: DemoTab.allCases.map(\.navItem),
                isExpanded: $navExpanded
            ) {
                variantPicker
            }
        } trailing: {
            HudsonInspector(isCollapsed: $inspectorCollapsed) {
                HStack(spacing: HudsonSpacing.md) {
                    HudsonSectionLabel("Inspector")
                    Spacer()
                    HudsonBadge(tab.label.uppercased())
                }
            } content: {
                inspectorContent
            }
        } topDrawer: {
            EmptyView()
        } bottomDrawer: {
            HudsonTerminalDrawer(
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
            HudsonTakeover(isPresented: $takeoverOpen) {
                takeoverHeader
            } content: {
                if let target = selectedTarget {
                    ConnectFlow(target: target)
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
    }

    // MARK: Command palette commands

    private var commands: [HudsonCommand] {
        var cmds: [HudsonCommand] = []

        for candidate in DemoTab.allCases where candidate != tab {
            cmds.append(HudsonCommand(
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
            cmds.append(HudsonCommand(
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
            cmds.append(HudsonCommand(
                id: "variant.\(candidate.rawValue)",
                title: "Variant: \(candidate.label)",
                icon: "paintbrush",
                group: "Theme",
                action: { variant = candidate }
            ))
        }

        cmds.append(HudsonCommand(
            id: "drawer.toggle",
            title: terminalOpen ? "Close terminal drawer" : "Open terminal drawer",
            icon: "terminal",
            group: "Surfaces",
            action: { terminalOpen.toggle() }
        ))
        cmds.append(HudsonCommand(
            id: "rail.toggle",
            title: navExpanded ? "Collapse navigation rail" : "Expand navigation rail",
            icon: "sidebar.left",
            group: "Surfaces",
            action: { navExpanded.toggle() }
        ))
        cmds.append(HudsonCommand(
            id: "inspector.toggle",
            title: inspectorCollapsed ? "Open inspector" : "Close inspector",
            icon: "sidebar.right",
            group: "Surfaces",
            action: { inspectorCollapsed.toggle() }
        ))

        if selectedTarget != nil {
            cmds.append(HudsonCommand(
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
        HStack(spacing: HudsonSpacing.md) {
            HudsonSectionLabel("Takeover", tint: variant.manifest.accent)
            if let target = selectedTarget {
                Text("/")
                    .font(HudsonFont.mono(10))
                    .foregroundStyle(HudsonPalette.dim)
                Text(target.name)
                    .font(HudsonFont.mono(11, weight: .semibold))
                    .foregroundStyle(HudsonPalette.ink)
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
        case .tokens, .primitives, .manifest:
            ScrollView {
                Group {
                    switch tab {
                    case .tokens:     TokensTab()
                    case .primitives: PrimitivesTab()
                    case .manifest:   ManifestTab()
                    case .dashboard:  EmptyView()
                    }
                }
                .padding(HudsonSpacing.xxl)
                .frame(maxWidth: .infinity, alignment: .topLeading)
            }
        }
    }

    // MARK: Variant picker (rail footer)

    private var variantPicker: some View {
        VStack(alignment: .leading, spacing: HudsonSpacing.md) {
            HudsonSectionLabel("Variant")
            Picker("Variant", selection: $variant) {
                ForEach(DemoVariant.allCases) { Text($0.label).tag($0) }
            }
            .pickerStyle(.segmented)
        }
    }

    // MARK: Inspector content

    @ViewBuilder
    private var inspectorContent: some View {
        let manifest = variant.manifest
        VStack(alignment: .leading, spacing: HudsonSpacing.xl) {
            HudsonCard {
                VStack(alignment: .leading, spacing: HudsonSpacing.md) {
                    HudsonKVRow("App",     value: manifest.name)
                    HudsonKVRow("Version", value: manifest.version)
                    HudsonKVRow("Target",  value: manifest.targetLabel)
                }
            }

            HudsonCard {
                VStack(alignment: .leading, spacing: HudsonSpacing.md) {
                    HStack {
                        HudsonSectionLabel("Surface", tint: HudsonPalette.muted)
                        Spacer()
                    }
                    HudsonKVRow("Tab",  value: tab.label)
                    HudsonKVRow("Mode", value: navExpanded ? "Expanded" : "Collapsed")
                }
            }
        }
    }

    // MARK: Status bar

    private var statusBar: some View {
        HStack(spacing: HudsonSpacing.xl) {
            HudsonStatusDot(color: variant.manifest.accent, pulses: true)
            Text("HUDSON·KIT")
                .font(HudsonFont.mono(10, weight: .bold))
                .tracking(1.5)
                .foregroundStyle(HudsonPalette.muted)

            Spacer()

            Text("v\(variant.manifest.version)")
                .font(HudsonFont.mono(10))
                .foregroundStyle(HudsonPalette.dim)
            HudsonBadge(tab.label.uppercased(), tint: variant.manifest.accent)
        }
        .padding(.horizontal, HudsonSpacing.xxl)
        .frame(height: HudsonLayout.statusBarHeight)
    }
}
