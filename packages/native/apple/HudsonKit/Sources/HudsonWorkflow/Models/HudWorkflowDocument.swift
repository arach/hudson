import Foundation
import SwiftUI
import Observation

public struct HudWorkflowViewportState: Codable, Equatable, Sendable {
    public var pan: CGSize
    public var scale: CGFloat

    public init(pan: CGSize = .zero, scale: CGFloat = 1) {
        self.pan = pan
        self.scale = scale
    }
}

public enum HudWorkflowPortRole: String, Codable, Sendable {
    case input
    case output
}

public struct HudWorkflowPort: Identifiable, Codable, Hashable, Sendable {
    public var id: String
    public var label: String
    public var role: HudWorkflowPortRole

    public init(id: String, label: String, role: HudWorkflowPortRole) {
        self.id = id
        self.label = label
        self.role = role
    }

    public static func input(_ id: String = "in", label: String = "In") -> HudWorkflowPort {
        HudWorkflowPort(id: id, label: label, role: .input)
    }

    public static func output(_ id: String = "out", label: String = "Out") -> HudWorkflowPort {
        HudWorkflowPort(id: id, label: label, role: .output)
    }
}

public struct HudWorkflowNode: Identifiable, Codable, Hashable, Sendable {
    public var id: String
    public var typeID: String
    public var title: String
    public var subtitle: String?
    public var position: CGPoint
    public var size: CGSize
    public var inputs: [HudWorkflowPort]
    public var outputs: [HudWorkflowPort]
    public var fieldValues: [String: String]

    public init(
        id: String,
        typeID: String,
        title: String,
        subtitle: String? = nil,
        position: CGPoint = .zero,
        size: CGSize = CGSize(width: 220, height: 120),
        inputs: [HudWorkflowPort] = [.input()],
        outputs: [HudWorkflowPort] = [.output()],
        fieldValues: [String: String] = [:]
    ) {
        self.id = id
        self.typeID = typeID
        self.title = title
        self.subtitle = subtitle
        self.position = position
        self.size = size
        self.inputs = inputs
        self.outputs = outputs
        self.fieldValues = fieldValues
    }
}

public struct HudWorkflowConnection: Identifiable, Codable, Hashable, Sendable {
    public var id: String
    public var sourceNodeID: String
    public var sourcePortID: String
    public var targetNodeID: String
    public var targetPortID: String
    public var label: String?

    public init(
        id: String,
        sourceNodeID: String,
        sourcePortID: String,
        targetNodeID: String,
        targetPortID: String,
        label: String? = nil
    ) {
        self.id = id
        self.sourceNodeID = sourceNodeID
        self.sourcePortID = sourcePortID
        self.targetNodeID = targetNodeID
        self.targetPortID = targetPortID
        self.label = label
    }
}

@Observable
public final class HudWorkflowDocument: Codable {
    public var id: String
    public var title: String
    public var nodes: [HudWorkflowNode]
    public var connections: [HudWorkflowConnection]
    public var viewport: HudWorkflowViewportState
    public var selectedNodeIDs: Set<String>

    public init(
        id: String,
        title: String,
        nodes: [HudWorkflowNode] = [],
        connections: [HudWorkflowConnection] = [],
        viewport: HudWorkflowViewportState = HudWorkflowViewportState(),
        selectedNodeIDs: Set<String> = []
    ) {
        self.id = id
        self.title = title
        self.nodes = nodes
        self.connections = connections
        self.viewport = viewport
        self.selectedNodeIDs = selectedNodeIDs
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case title
        case nodes
        case connections
        case viewport
        case selectedNodeIDs
    }

    public convenience init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            id: try container.decode(String.self, forKey: .id),
            title: try container.decode(String.self, forKey: .title),
            nodes: try container.decode([HudWorkflowNode].self, forKey: .nodes),
            connections: try container.decode([HudWorkflowConnection].self, forKey: .connections),
            viewport: try container.decodeIfPresent(HudWorkflowViewportState.self, forKey: .viewport) ?? HudWorkflowViewportState(),
            selectedNodeIDs: try container.decodeIfPresent(Set<String>.self, forKey: .selectedNodeIDs) ?? []
        )
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(title, forKey: .title)
        try container.encode(nodes, forKey: .nodes)
        try container.encode(connections, forKey: .connections)
        try container.encode(viewport, forKey: .viewport)
        try container.encode(selectedNodeIDs, forKey: .selectedNodeIDs)
    }

    @MainActor
    public func selectNode(_ id: String?) {
        selectedNodeIDs = id.map { [$0] } ?? []
    }
}
