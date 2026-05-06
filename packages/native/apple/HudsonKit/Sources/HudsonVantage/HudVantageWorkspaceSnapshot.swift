import Foundation

public struct HudVantageViewportSnapshot: Codable, Hashable, Sendable {
    public var panX: Double
    public var panY: Double
    public var scale: Double

    public init(panX: Double, panY: Double, scale: Double) {
        self.panX = panX
        self.panY = panY
        self.scale = scale
    }
}

public struct HudVantageRuntimeReference: Codable, Hashable, Sendable {
    public var kind: String
    public var target: String?
    public var graphitePath: String?
    public var remoteHost: String?

    public init(
        kind: String,
        target: String? = nil,
        graphitePath: String? = nil,
        remoteHost: String? = nil
    ) {
        self.kind = kind
        self.target = target
        self.graphitePath = graphitePath
        self.remoteHost = remoteHost
    }
}

public struct HudVantageNodeSnapshot: Codable, Identifiable, Hashable, Sendable {
    public var id: UUID
    public var title: String
    public var subtitle: String
    public var tint: String
    public var x: Double
    public var y: Double
    public var width: Double
    public var height: Double
    public var zIndex: Double
    public var runtime: HudVantageRuntimeReference

    public init(
        id: UUID,
        title: String,
        subtitle: String,
        tint: String,
        x: Double,
        y: Double,
        width: Double,
        height: Double,
        zIndex: Double,
        runtime: HudVantageRuntimeReference
    ) {
        self.id = id
        self.title = title
        self.subtitle = subtitle
        self.tint = tint
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.zIndex = zIndex
        self.runtime = runtime
    }
}

public struct HudVantageWorkspaceSnapshot: Codable, Hashable, Sendable {
    public var schemaVersion: Int
    public var workspaceID: String
    public var surfaceTitle: String
    public var viewport: HudVantageViewportSnapshot
    public var nodes: [HudVantageNodeSnapshot]
    public var selectedNodeIDs: [UUID]
    public var savedAt: Date

    public init(
        schemaVersion: Int = 1,
        workspaceID: String,
        surfaceTitle: String,
        viewport: HudVantageViewportSnapshot,
        nodes: [HudVantageNodeSnapshot],
        selectedNodeIDs: [UUID],
        savedAt: Date = Date()
    ) {
        self.schemaVersion = schemaVersion
        self.workspaceID = workspaceID
        self.surfaceTitle = surfaceTitle
        self.viewport = viewport
        self.nodes = nodes
        self.selectedNodeIDs = selectedNodeIDs
        self.savedAt = savedAt
    }
}
