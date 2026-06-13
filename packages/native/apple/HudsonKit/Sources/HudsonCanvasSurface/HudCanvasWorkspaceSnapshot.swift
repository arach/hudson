import Foundation
import HudsonCanvasCore

public struct HudCanvasViewportSnapshot: Codable, Hashable, Sendable {
    public var panX: Double
    public var panY: Double
    public var scale: Double

    public init(panX: Double, panY: Double, scale: Double) {
        self.panX = panX
        self.panY = panY
        self.scale = scale
    }
}

public struct HudCanvasSurfaceLayoutSnapshot: Codable, Hashable, Sendable {
    public var canvasTool: String
    public var navigationFilter: String
    public var navigationTagFilter: String?
    public var navigationCollapsed: Bool
    public var navigationWidth: Double
    public var minimapCollapsed: Bool?
    public var inspectorCollapsed: Bool
    public var inspectorWidth: Double
    public var style: HudCanvasStyleProfile?
    public var tagStyles: [String: HudCanvasTerminalStyleOverride]?

    public init(
        canvasTool: String,
        navigationFilter: String,
        navigationTagFilter: String? = nil,
        navigationCollapsed: Bool,
        navigationWidth: Double,
        minimapCollapsed: Bool? = nil,
        inspectorCollapsed: Bool,
        inspectorWidth: Double,
        style: HudCanvasStyleProfile? = nil,
        tagStyles: [String: HudCanvasTerminalStyleOverride]? = nil
    ) {
        self.canvasTool = canvasTool
        self.navigationFilter = navigationFilter
        self.navigationTagFilter = navigationTagFilter
        self.navigationCollapsed = navigationCollapsed
        self.navigationWidth = navigationWidth
        self.minimapCollapsed = minimapCollapsed
        self.inspectorCollapsed = inspectorCollapsed
        self.inspectorWidth = inspectorWidth
        self.style = style
        self.tagStyles = tagStyles
    }
}

public struct HudCanvasWorkspaceGroupSnapshot: Codable, Identifiable, Hashable, Sendable {
    public var id: String
    public var name: String
    public var nodeIDs: [UUID]
    public var tags: [String]

    public init(
        id: String,
        name: String,
        nodeIDs: [UUID],
        tags: [String] = []
    ) {
        self.id = id
        self.name = name
        self.nodeIDs = nodeIDs
        self.tags = tags
    }
}

public struct HudCanvasRuntimeReference: Codable, Hashable, Sendable {
    public var kind: String
    public var target: String?
    public var graphitePath: String?
    public var remoteHost: String?
    public var path: String?
    public var language: String?
    public var content: String?
    public var role: String?

    public init(
        kind: String,
        target: String? = nil,
        graphitePath: String? = nil,
        remoteHost: String? = nil,
        path: String? = nil,
        language: String? = nil,
        content: String? = nil,
        role: String? = nil
    ) {
        self.kind = kind
        self.target = target
        self.graphitePath = graphitePath
        self.remoteHost = remoteHost
        self.path = path
        self.language = language
        self.content = content
        self.role = role
    }
}

public struct HudCanvasNodeSnapshot: Codable, Identifiable, Hashable, Sendable {
    public var id: UUID
    public var externalID: String?
    public var title: String
    public var subtitle: String
    public var tint: String
    public var x: Double
    public var y: Double
    public var width: Double
    public var height: Double
    public var zIndex: Double
    public var tag: String?
    public var style: HudCanvasTerminalStyleOverride?
    public var runtime: HudCanvasRuntimeReference

    public init(
        id: UUID,
        externalID: String? = nil,
        title: String,
        subtitle: String,
        tint: String,
        x: Double,
        y: Double,
        width: Double,
        height: Double,
        zIndex: Double,
        tag: String? = nil,
        style: HudCanvasTerminalStyleOverride? = nil,
        runtime: HudCanvasRuntimeReference
    ) {
        self.id = id
        self.externalID = externalID
        self.title = title
        self.subtitle = subtitle
        self.tint = tint
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.zIndex = zIndex
        self.tag = tag
        self.style = style
        self.runtime = runtime
    }
}

public struct HudCanvasWorkspaceSnapshot: Codable, Hashable, Sendable {
    public static let documentKind = "hudson.canvas.workspace"

    public var kind: String
    public var schemaVersion: Int
    public var workspaceID: String
    public var surfaceTitle: String
    public var viewport: HudCanvasViewportSnapshot
    public var layout: HudCanvasSurfaceLayoutSnapshot?
    public var nodes: [HudCanvasNodeSnapshot]
    public var selectedNodeIDs: [UUID]
    public var focusedNodeID: UUID?
    public var groups: [HudCanvasWorkspaceGroupSnapshot]
    public var savedAt: Date

    public init(
        kind: String = HudCanvasWorkspaceSnapshot.documentKind,
        schemaVersion: Int = 1,
        workspaceID: String,
        surfaceTitle: String,
        viewport: HudCanvasViewportSnapshot,
        layout: HudCanvasSurfaceLayoutSnapshot? = nil,
        nodes: [HudCanvasNodeSnapshot],
        selectedNodeIDs: [UUID],
        focusedNodeID: UUID? = nil,
        groups: [HudCanvasWorkspaceGroupSnapshot] = [],
        savedAt: Date = Date()
    ) {
        self.kind = kind
        self.schemaVersion = schemaVersion
        self.workspaceID = workspaceID
        self.surfaceTitle = surfaceTitle
        self.viewport = viewport
        self.layout = layout
        self.nodes = nodes
        self.selectedNodeIDs = selectedNodeIDs
        self.focusedNodeID = focusedNodeID
        self.groups = groups
        self.savedAt = savedAt
    }

    private enum CodingKeys: String, CodingKey {
        case kind
        case schemaVersion
        case workspaceID
        case surfaceTitle
        case viewport
        case layout
        case nodes
        case selectedNodeIDs
        case focusedNodeID
        case groups
        case savedAt
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        kind = try container.decodeIfPresent(String.self, forKey: .kind)
            ?? Self.documentKind
        schemaVersion = try container.decodeIfPresent(Int.self, forKey: .schemaVersion)
            ?? 1
        workspaceID = try container.decode(String.self, forKey: .workspaceID)
        surfaceTitle = try container.decode(String.self, forKey: .surfaceTitle)
        viewport = try container.decode(HudCanvasViewportSnapshot.self, forKey: .viewport)
        layout = try container.decodeIfPresent(HudCanvasSurfaceLayoutSnapshot.self, forKey: .layout)
        nodes = try container.decodeIfPresent([HudCanvasNodeSnapshot].self, forKey: .nodes)
            ?? []
        selectedNodeIDs = try container.decodeIfPresent([UUID].self, forKey: .selectedNodeIDs)
            ?? []
        focusedNodeID = try container.decodeIfPresent(UUID.self, forKey: .focusedNodeID)
        groups = try container.decodeIfPresent([HudCanvasWorkspaceGroupSnapshot].self, forKey: .groups)
            ?? []
        savedAt = try container.decodeIfPresent(Date.self, forKey: .savedAt)
            ?? Date()
    }
}
