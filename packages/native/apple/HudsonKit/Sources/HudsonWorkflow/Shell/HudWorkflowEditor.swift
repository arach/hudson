import SwiftUI
import HudsonUI
import HudsonShell

private enum HudWorkflowEditorMetrics {
    static let canvasMinHeight = HudLayout.dialogWidth - HudSpacing.huge - HudSpacing.xl
    static let paletteMinWidth = HudLayout.panelWidth - HudSpacing.huge - HudSpacing.xxxl - HudSpacing.xl
}

public enum HudWorkflowEditorMode: Sendable {
    case editable
    case readOnly
}

public struct HudWorkflowEditor: View {
    @Bindable private var document: HudWorkflowDocument
    private let schema: any HudWorkflowSchemaProvider
    private let mode: HudWorkflowEditorMode
    @State private var inspectorCollapsed = false

    public init(
        document: HudWorkflowDocument,
        schema: any HudWorkflowSchemaProvider = HudWorkflowBasicSchema(),
        mode: HudWorkflowEditorMode = .editable
    ) {
        self.document = document
        self.schema = schema
        self.mode = mode
    }

    public var body: some View {
        HudAppShell {
            HudWorkflowNodePalette(schema: schema)
        } trailing: {
            HudInspector(isCollapsed: $inspectorCollapsed) {
                HudSectionLabel("Workflow")
            } content: {
                HudWorkflowInspector(document: document, schema: schema)
            }
        } content: {
            HudCanvas(showGrid: false) {
                header
            } content: {
                HudWorkflowCanvas(document: document, schema: schema)
                    .frame(minHeight: HudWorkflowEditorMetrics.canvasMinHeight)
            }
        } statusBar: {
            statusBar
        }
    }

    private var header: some View {
        HStack(spacing: HudSpacing.md) {
            Image(systemName: "point.3.connected.trianglepath.dotted")
                .foregroundStyle(HudPalette.accent)
            Text(document.title)
                .font(HudFont.mono(HudTextSize.base, weight: .bold))
                .foregroundStyle(HudPalette.ink)
            Spacer()
            Text(mode == .editable ? "Editable" : "Read Only")
                .font(HudFont.mono(HudTextSize.xs))
                .foregroundStyle(HudPalette.muted)
        }
    }

    private var statusBar: some View {
        HStack(spacing: HudSpacing.lg) {
            HudStatusDot(color: HudPalette.statusOk)
            Text("READY")
            Spacer()
            Text("\(document.nodes.count) nodes")
            Text("\(document.connections.count) edges")
            Text("\(Int(document.viewport.scale * 100))%")
        }
        .font(HudFont.mono(HudTextSize.xs, weight: .medium))
        .foregroundStyle(HudPalette.muted)
        .padding(.horizontal, HudSpacing.lg)
        .frame(height: HudLayout.statusBarHeight)
        .background(HudPalette.chrome)
    }
}

private struct HudWorkflowNodePalette: View {
    let schema: any HudWorkflowSchemaProvider

    var body: some View {
        VStack(alignment: .leading, spacing: HudSpacing.sm) {
            HudSectionLabel("Nodes")
            ForEach(schema.nodeTypes) { nodeType in
                HStack(spacing: HudSpacing.sm) {
                    Image(systemName: nodeType.iconName)
                        .foregroundStyle(nodeType.tint.color)
                        .frame(width: HudIconSize.micro)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(nodeType.label)
                            .font(HudFont.mono(HudTextSize.sm, weight: .semibold))
                            .foregroundStyle(HudPalette.ink)
                        Text(nodeType.category)
                            .font(HudFont.mono(HudTextSize.xs))
                            .foregroundStyle(HudPalette.dim)
                    }
                    Spacer()
                }
                .padding(.horizontal, HudSpacing.sm)
                .padding(.vertical, HudSpacing.xs)
                .background(
                    RoundedRectangle(cornerRadius: HudRadius.standard)
                        .fill(HudSurface.hover)
                )
            }
            Spacer()
        }
        .padding(HudSpacing.md)
        .frame(minWidth: HudWorkflowEditorMetrics.paletteMinWidth)
    }
}

private struct HudWorkflowInspector: View {
    @Bindable var document: HudWorkflowDocument
    let schema: any HudWorkflowSchemaProvider

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: HudSpacing.lg) {
                if let selected = selectedNode {
                    nodeInspector(selected)
                } else {
                    documentInspector
                }
            }
            .padding(HudSpacing.md)
        }
    }

    private var selectedNode: HudWorkflowNode? {
        guard let id = document.selectedNodeIDs.first else { return nil }
        return document.nodes.first { $0.id == id }
    }

    private var documentInspector: some View {
        VStack(alignment: .leading, spacing: HudSpacing.md) {
            HudSectionLabel("Document")
            HudKVRow("ID", value: document.id)
            HudKVRow("Title", value: document.title)
            HudKVRow("Nodes", value: "\(document.nodes.count)")
            HudKVRow("Connections", value: "\(document.connections.count)")
        }
    }

    private func nodeInspector(_ node: HudWorkflowNode) -> some View {
        VStack(alignment: .leading, spacing: HudSpacing.md) {
            HudSectionLabel("Node")
            HudKVRow("ID", value: node.id)
            HudKVRow("Type", value: schema.schema(for: node.typeID)?.label ?? node.typeID)
            HudKVRow("Title", value: node.title)
            if let subtitle = node.subtitle {
                HudKVRow("Subtitle", value: subtitle)
            }
            HudKVRow("Position", value: "\(Int(node.position.x)), \(Int(node.position.y))")
        }
    }
}
