import SwiftUI
import HudsonUI

private enum HudWorkflowCanvasMetrics {
    static let canvasBleed = HudLayout.popoverWidthCompact - HudLayout.popoverWidth + HudLayout.dialogWidth
}

public struct HudWorkflowCanvas: View {
    @Bindable private var document: HudWorkflowDocument
    private let schema: any HudWorkflowSchemaProvider

    public init(
        document: HudWorkflowDocument,
        schema: any HudWorkflowSchemaProvider = HudWorkflowEmptySchema()
    ) {
        self.document = document
        self.schema = schema
    }

    public var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .topLeading) {
                HudGridBackground()
                    .allowsHitTesting(false)

                ZStack(alignment: .topLeading) {
                    ForEach(document.connections) { connection in
                        HudWorkflowConnectionView(
                            connection: connection,
                            nodes: document.nodes,
                            selected: false
                        )
                    }

                    ForEach($document.nodes) { $node in
                        HudWorkflowNodeView(
                            node: $node,
                            schema: schema.schema(for: node.typeID),
                            selected: document.selectedNodeIDs.contains(node.id)
                        ) {
                            document.selectNode(node.id)
                        }
                    }
                }
                .frame(
                    width: max(geometry.size.width, workflowBounds.width + HudWorkflowCanvasMetrics.canvasBleed),
                    height: max(geometry.size.height, workflowBounds.height + HudWorkflowCanvasMetrics.canvasBleed),
                    alignment: .topLeading
                )
                .offset(document.viewport.pan)
                .scaleEffect(document.viewport.scale, anchor: .topLeading)
            }
            .background(HudPalette.bg)
            .clipShape(Rectangle())
            .onTapGesture {
                document.selectNode(nil)
            }
        }
    }

    private var workflowBounds: CGSize {
        let maxX = document.nodes.map { $0.position.x + $0.size.width }.max() ?? 0
        let maxY = document.nodes.map { $0.position.y + $0.size.height }.max() ?? 0
        return CGSize(width: maxX, height: maxY)
    }
}

private struct HudWorkflowNodeView: View {
    @Binding var node: HudWorkflowNode
    let schema: HudWorkflowNodeTypeSchema?
    let selected: Bool
    let onSelect: () -> Void

    private var tint: Color {
        schema?.tint.color ?? HudPalette.statusInfo
    }

    var body: some View {
        Button(action: onSelect) {
            VStack(alignment: .leading, spacing: HudSpacing.sm) {
                HStack(spacing: HudSpacing.sm) {
                    Image(systemName: schema?.iconName ?? "square.grid.2x2")
                        .font(HudFont.ui(HudTextSize.sm, weight: .semibold))
                        .foregroundStyle(tint)
                        .frame(width: HudSpacing.xxxl, height: HudSpacing.xxxl)

                    Text(schema?.label.uppercased() ?? node.typeID.uppercased())
                        .font(HudFont.mono(HudTextSize.xs, weight: .bold))
                        .foregroundStyle(tint)

                    Spacer()
                }

                Text(node.title)
                    .font(HudFont.mono(HudTextSize.base, weight: .semibold))
                    .foregroundStyle(HudPalette.ink)
                    .lineLimit(1)

                if let subtitle = node.subtitle, !subtitle.isEmpty {
                    Text(subtitle)
                        .font(HudFont.mono(HudTextSize.sm))
                        .foregroundStyle(HudPalette.muted)
                        .lineLimit(2)
                }

                Spacer(minLength: 0)

                HStack {
                    Text("\(node.inputs.count) in")
                    Spacer()
                    Text("\(node.outputs.count) out")
                }
                .font(HudFont.mono(HudTextSize.xs))
                .foregroundStyle(HudPalette.dim)
            }
            .padding(HudSpacing.md)
            .frame(width: node.size.width, height: node.size.height, alignment: .topLeading)
            .background(
                RoundedRectangle(cornerRadius: HudRadius.card)
                    .fill(HudPalette.surface)
            )
            .overlay(
                RoundedRectangle(cornerRadius: HudRadius.card)
                    .strokeBorder(selected ? tint : HudHairline.standard, lineWidth: selected ? 1.5 : 1)
            )
            .shadow(
                color: selected ? HudSurface.scrim : HudSurface.inset,
                radius: selected ? HudSpacing.xxxl - HudSpacing.xxs : HudSpacing.md,
                y: selected ? HudSpacing.md : HudRadius.tight
            )
        }
        .buttonStyle(.plain)
        .position(x: node.position.x + node.size.width / 2, y: node.position.y + node.size.height / 2)
    }
}

private struct HudWorkflowConnectionView: View {
    let connection: HudWorkflowConnection
    let nodes: [HudWorkflowNode]
    let selected: Bool

    var body: some View {
        if let source = nodes.first(where: { $0.id == connection.sourceNodeID }),
           let target = nodes.first(where: { $0.id == connection.targetNodeID }) {
            Path { path in
                let start = CGPoint(x: source.position.x + source.size.width, y: source.position.y + source.size.height / 2)
                let end = CGPoint(x: target.position.x, y: target.position.y + target.size.height / 2)
                let dx = max(80, abs(end.x - start.x) * 0.42)
                path.move(to: start)
                path.addCurve(
                    to: end,
                    control1: CGPoint(x: start.x + dx, y: start.y),
                    control2: CGPoint(x: end.x - dx, y: end.y)
                )
            }
            .stroke(selected ? HudPalette.accent : HudPalette.border, lineWidth: selected ? 2 : 1)
        }
    }
}
