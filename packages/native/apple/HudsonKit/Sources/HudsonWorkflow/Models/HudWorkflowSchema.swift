import Foundation
import SwiftUI
import HudsonUI

public enum HudWorkflowFieldType: Hashable, Sendable {
    case string
    case text
    case number
    case boolean
    case picker([HudWorkflowPickerOption])
    case slider(min: Double, max: Double, step: Double)
}

public struct HudWorkflowPickerOption: Identifiable, Hashable, Sendable {
    public var id: String { value }
    public var value: String
    public var label: String
    public var iconName: String?

    public init(value: String, label: String, iconName: String? = nil) {
        self.value = value
        self.label = label
        self.iconName = iconName
    }
}

public struct HudWorkflowFieldSchema: Identifiable, Hashable, Sendable {
    public var id: String
    public var label: String
    public var type: HudWorkflowFieldType
    public var placeholder: String?
    public var helpText: String?
    public var group: String?
    public var order: Int

    public init(
        id: String,
        label: String,
        type: HudWorkflowFieldType,
        placeholder: String? = nil,
        helpText: String? = nil,
        group: String? = nil,
        order: Int = 0
    ) {
        self.id = id
        self.label = label
        self.type = type
        self.placeholder = placeholder
        self.helpText = helpText
        self.group = group
        self.order = order
    }
}

public struct HudWorkflowNodeTypeSchema: Identifiable, Hashable, Sendable {
    public var id: String
    public var label: String
    public var category: String
    public var iconName: String
    public var tint: HudTint
    public var defaultInputs: [HudWorkflowPort]
    public var defaultOutputs: [HudWorkflowPort]
    public var fields: [HudWorkflowFieldSchema]

    public init(
        id: String,
        label: String,
        category: String,
        iconName: String,
        tint: HudTint = .blue,
        defaultInputs: [HudWorkflowPort] = [.input()],
        defaultOutputs: [HudWorkflowPort] = [.output()],
        fields: [HudWorkflowFieldSchema] = []
    ) {
        self.id = id
        self.label = label
        self.category = category
        self.iconName = iconName
        self.tint = tint
        self.defaultInputs = defaultInputs
        self.defaultOutputs = defaultOutputs
        self.fields = fields
    }
}

public protocol HudWorkflowSchemaProvider: Sendable {
    var nodeTypes: [HudWorkflowNodeTypeSchema] { get }
    func schema(for nodeTypeID: String) -> HudWorkflowNodeTypeSchema?
}

public extension HudWorkflowSchemaProvider {
    func schema(for nodeTypeID: String) -> HudWorkflowNodeTypeSchema? {
        nodeTypes.first { $0.id == nodeTypeID }
    }
}

public struct HudWorkflowEmptySchema: HudWorkflowSchemaProvider {
    public let nodeTypes: [HudWorkflowNodeTypeSchema] = []

    public init() {}
}

public struct HudWorkflowBasicSchema: HudWorkflowSchemaProvider {
    public let nodeTypes: [HudWorkflowNodeTypeSchema]

    public init() {
        nodeTypes = [
            HudWorkflowNodeTypeSchema(
                id: "trigger",
                label: "Trigger",
                category: "Input",
                iconName: "bolt.fill",
                tint: .cyan,
                defaultInputs: [],
                defaultOutputs: [.output()]
            ),
            HudWorkflowNodeTypeSchema(
                id: "transform",
                label: "Transform",
                category: "Logic",
                iconName: "wand.and.rays",
                tint: .blue
            ),
            HudWorkflowNodeTypeSchema(
                id: "model",
                label: "Model",
                category: "AI",
                iconName: "sparkles",
                tint: .teal,
                fields: [
                    HudWorkflowFieldSchema(id: "prompt", label: "Prompt", type: .text, order: 0),
                    HudWorkflowFieldSchema(id: "model", label: "Model", type: .string, order: 1),
                ]
            ),
            HudWorkflowNodeTypeSchema(
                id: "condition",
                label: "Condition",
                category: "Logic",
                iconName: "arrow.triangle.branch",
                tint: .amber,
                defaultOutputs: [
                    .output("true", label: "True"),
                    .output("false", label: "False"),
                ]
            ),
            HudWorkflowNodeTypeSchema(
                id: "action",
                label: "Action",
                category: "Output",
                iconName: "play.fill",
                tint: .green
            ),
        ]
    }
}
