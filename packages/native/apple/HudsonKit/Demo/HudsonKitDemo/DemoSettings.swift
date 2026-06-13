import SwiftUI
import HudsonUI
import HudsonShell

enum DemoSettingsSection: String, Hashable, CaseIterable, Identifiable {
    case general
    case appearance
    case explorer
    case canvas
    case shell
    case about

    var id: String { rawValue }
}

enum DemoSettings {
    static let catalog = HudSettingsCatalog<DemoSettingsSection>(groups: [
        HudSettingsGroup(nil, destinations: [
            HudSettingsDestination(id: .general, icon: "slider.horizontal.3", title: "General") {
                DemoSettingsGeneralPanel()
            },
            HudSettingsDestination(id: .appearance, icon: "paintbrush", title: "Appearance") {
                DemoSettingsAppearancePanel()
            },
        ]),
        HudSettingsGroup("Workspace", destinations: [
            HudSettingsDestination(id: .explorer, icon: "folder", title: "Explorer") {
                DemoSettingsExplorerPanel()
            },
            HudSettingsDestination(id: .canvas, icon: "square.grid.3x3.fill", title: "Canvas") {
                DemoSettingsCanvasPanel()
            },
        ]),
        HudSettingsGroup("System", destinations: [
            HudSettingsDestination(id: .shell, icon: "rectangle.split.3x1", title: "Shell") {
                DemoSettingsShellPanel()
            },
            HudSettingsDestination(id: .about, icon: "info.circle", title: "About") {
                DemoSettingsAboutPanel()
            },
        ]),
    ])
}

// MARK: - Panels

private struct DemoSettingsGeneralPanel: View {
    @Environment(\.hudsonAppManifest) private var manifest

    var body: some View {
        VStack(alignment: .leading, spacing: HudSpacing.huge) {
            HudSettingsSection("Application") {
                HudSettingsRow(
                    icon: "app",
                    title: manifest.name,
                    subtitle: "HudsonKit Lab demo host"
                )
                HudSettingsRow(
                    icon: "target",
                    title: "Target",
                    subtitle: manifest.targetLabel
                )
            }

            HudSettingsSection("Workspace") {
                HudSettingsRow(
                    icon: "folder",
                    title: "Checkout",
                    subtitle: DemoManifest.workspacePath
                )
            }
        }
    }
}

private struct DemoSettingsAppearancePanel: View {
    var body: some View {
        VStack(alignment: .leading, spacing: HudSpacing.huge) {
            HudSettingsSection("Chrome") {
                HudSettingsRow(icon: "sidebar.left", title: "Navigation", subtitle: "Resizable primary sidebar")
                HudSettingsRow(icon: "sidebar.right", title: "Inspector", subtitle: "Collapsible trailing panel")
            }

            HudSettingsSection("Editor") {
                HudSettingsRow(icon: "chevron.left.forwardslash.chevron.right", title: "Code viewer", subtitle: "Edit mode by default, chromeless surface")
            }
        }
    }
}

private struct DemoSettingsExplorerPanel: View {
    var body: some View {
        HudSettingsSection("Sources") {
            HudSettingsRow(icon: "folder", title: "Default root", subtitle: "Hudson monorepo checkout")
            HudSettingsRow(icon: "doc.text", title: "Preview", subtitle: "CodeMirror-backed editor")
        }
    }
}

private struct DemoSettingsCanvasPanel: View {
    var body: some View {
        HudSettingsSection("Fixtures") {
            HudSettingsRow(icon: "square.grid.3x3.fill", title: "Practice setup", subtitle: "hudson-canvas-practice fixture")
            HudSettingsRow(icon: "terminal", title: "Termini", subtitle: "Requires HUDSONKIT_WITH_TERMINAL=1")
        }
    }
}

private struct DemoSettingsShellPanel: View {
    var body: some View {
        HudSettingsSection("Slots") {
            HudSettingsRow(icon: "sidebar.left", title: "Leading", subtitle: "Primary navigation")
            HudSettingsRow(icon: "rectangle.center.inset.filled", title: "Content", subtitle: "App or settings workspace")
            HudSettingsRow(icon: "sidebar.right", title: "Trailing", subtitle: "Inspector")
            HudSettingsRow(icon: "rectangle.bottomhalf.inset.filled", title: "Status", subtitle: "Full-width footer")
        }
    }
}

private struct DemoSettingsAboutPanel: View {
    @Environment(\.hudsonAppManifest) private var manifest

    var body: some View {
        HudSettingsSection("Build") {
            HudSettingsRow(icon: "info.circle", title: manifest.name, subtitle: "Version \(manifest.version)")
            HudSettingsRow(icon: "hammer", title: "Purpose", subtitle: "Component gallery and shell reference")
        }
    }
}