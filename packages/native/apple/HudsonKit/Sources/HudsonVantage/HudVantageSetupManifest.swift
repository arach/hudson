import Foundation

public struct HudVantageSetupManifest: Codable, Hashable, Sendable {
    public static let documentKind = "hudson.vantage.setup"

    public var kind: String
    public var schemaVersion: Int
    public var workspaceID: String?
    public var surfaceTitle: String?
    public var createIfMissing: Bool?
    public var removeMissing: Bool?
    public var presentation: HudVantageSetupPresentation?
    public var style: HudVantageSetupStyle?
    public var viewport: HudVantageSetupViewport?
    public var layout: HudVantageSetupLayout?
    public var nodes: [HudVantageSetupNode]
    public var selection: [String]
    public var selectedNodeIDs: [UUID]
    public var focused: String?
    public var focusedNodeID: UUID?

    public init(
        kind: String = HudVantageSetupManifest.documentKind,
        schemaVersion: Int = 1,
        workspaceID: String? = nil,
        surfaceTitle: String? = nil,
        createIfMissing: Bool? = nil,
        removeMissing: Bool? = nil,
        presentation: HudVantageSetupPresentation? = nil,
        style: HudVantageSetupStyle? = nil,
        viewport: HudVantageSetupViewport? = nil,
        layout: HudVantageSetupLayout? = nil,
        nodes: [HudVantageSetupNode] = [],
        selection: [String] = [],
        selectedNodeIDs: [UUID] = [],
        focused: String? = nil,
        focusedNodeID: UUID? = nil
    ) {
        self.kind = kind
        self.schemaVersion = schemaVersion
        self.workspaceID = workspaceID
        self.surfaceTitle = surfaceTitle
        self.createIfMissing = createIfMissing
        self.removeMissing = removeMissing
        self.presentation = presentation
        self.style = style
        self.viewport = viewport
        self.layout = layout
        self.nodes = nodes
        self.selection = selection
        self.selectedNodeIDs = selectedNodeIDs
        self.focused = focused
        self.focusedNodeID = focusedNodeID
    }

    private enum CodingKeys: String, CodingKey {
        case kind
        case schemaVersion
        case workspaceID
        case surfaceTitle
        case createIfMissing
        case removeMissing
        case removeMissingNodes
        case presentation
        case style
        case viewport
        case layout
        case nodes
        case selection
        case selected
        case selectedNodeIDs
        case focused
        case focusedNodeID
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        kind = try container.decodeIfPresent(String.self, forKey: .kind)
            ?? Self.documentKind
        schemaVersion = try container.decodeIfPresent(Int.self, forKey: .schemaVersion)
            ?? 1
        workspaceID = try container.decodeIfPresent(String.self, forKey: .workspaceID)
        surfaceTitle = try container.decodeIfPresent(String.self, forKey: .surfaceTitle)
        createIfMissing = try container.decodeIfPresent(Bool.self, forKey: .createIfMissing)
        removeMissing = try container.decodeIfPresent(Bool.self, forKey: .removeMissing)
            ?? container.decodeIfPresent(Bool.self, forKey: .removeMissingNodes)
        presentation = try container.decodeIfPresent(HudVantageSetupPresentation.self, forKey: .presentation)
        style = try container.decodeIfPresent(HudVantageSetupStyle.self, forKey: .style)
        viewport = try container.decodeIfPresent(HudVantageSetupViewport.self, forKey: .viewport)
        layout = try container.decodeIfPresent(HudVantageSetupLayout.self, forKey: .layout)
        nodes = try container.decodeIfPresent([HudVantageSetupNode].self, forKey: .nodes)
            ?? []
        selection = try container.decodeIfPresent([String].self, forKey: .selection)
            ?? container.decodeIfPresent([String].self, forKey: .selected)
            ?? []
        selectedNodeIDs = try container.decodeIfPresent([UUID].self, forKey: .selectedNodeIDs)
            ?? []
        focused = try container.decodeIfPresent(String.self, forKey: .focused)
        focusedNodeID = try container.decodeIfPresent(UUID.self, forKey: .focusedNodeID)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(kind, forKey: .kind)
        try container.encode(schemaVersion, forKey: .schemaVersion)
        try container.encodeIfPresent(workspaceID, forKey: .workspaceID)
        try container.encodeIfPresent(surfaceTitle, forKey: .surfaceTitle)
        try container.encodeIfPresent(createIfMissing, forKey: .createIfMissing)
        try container.encodeIfPresent(removeMissing, forKey: .removeMissing)
        try container.encodeIfPresent(presentation, forKey: .presentation)
        try container.encodeIfPresent(style, forKey: .style)
        try container.encodeIfPresent(viewport, forKey: .viewport)
        try container.encodeIfPresent(layout, forKey: .layout)
        try container.encode(nodes, forKey: .nodes)
        try container.encode(selection, forKey: .selection)
        try container.encode(selectedNodeIDs, forKey: .selectedNodeIDs)
        try container.encodeIfPresent(focused, forKey: .focused)
        try container.encodeIfPresent(focusedNodeID, forKey: .focusedNodeID)
    }
}

public struct HudVantageSetupPresentation: Codable, Hashable, Sendable {
    public var title: String?
    public var subtitle: String?
    public var badge: String?
    public var cobrand: String?
    public var productName: String?
    public var hostName: String?
    public var icon: String?
    public var theme: String?
    public var accent: String?

    public init(
        title: String? = nil,
        subtitle: String? = nil,
        badge: String? = nil,
        cobrand: String? = nil,
        productName: String? = nil,
        hostName: String? = nil,
        icon: String? = nil,
        theme: String? = nil,
        accent: String? = nil
    ) {
        self.title = title
        self.subtitle = subtitle
        self.badge = badge
        self.cobrand = cobrand
        self.productName = productName
        self.hostName = hostName
        self.icon = icon
        self.theme = theme
        self.accent = accent
    }
}

public struct HudVantageSetupStyle: Codable, Hashable, Sendable {
    public var preset: String?
    public var stylePreset: String?
    public var chromeStyle: String?
    public var terminalTheme: String?
    public var terminalThemeID: String?
    public var terminalFontFamily: String?
    public var terminalFontSize: Double?
    public var canvasGridMode: String?
    public var canvasGridStep: Double?
    public var canvasMinorOpacity: Double?
    public var canvasMajorOpacity: Double?
    public var focusPadding: Double?
    public var tagStyles: [String: HudVantageTerminalStyleOverride]?

    public init(
        preset: String? = nil,
        stylePreset: String? = nil,
        chromeStyle: String? = nil,
        terminalTheme: String? = nil,
        terminalThemeID: String? = nil,
        terminalFontFamily: String? = nil,
        terminalFontSize: Double? = nil,
        canvasGridMode: String? = nil,
        canvasGridStep: Double? = nil,
        canvasMinorOpacity: Double? = nil,
        canvasMajorOpacity: Double? = nil,
        focusPadding: Double? = nil,
        tagStyles: [String: HudVantageTerminalStyleOverride]? = nil
    ) {
        self.preset = preset
        self.stylePreset = stylePreset
        self.chromeStyle = chromeStyle
        self.terminalTheme = terminalTheme
        self.terminalThemeID = terminalThemeID
        self.terminalFontFamily = terminalFontFamily
        self.terminalFontSize = terminalFontSize
        self.canvasGridMode = canvasGridMode
        self.canvasGridStep = canvasGridStep
        self.canvasMinorOpacity = canvasMinorOpacity
        self.canvasMajorOpacity = canvasMajorOpacity
        self.focusPadding = focusPadding
        self.tagStyles = tagStyles
    }
}

public struct HudVantageSetupViewport: Codable, Hashable, Sendable {
    public var panX: Double?
    public var panY: Double?
    public var scale: Double?
    public var fit: Bool?
    public var reset: Bool?

    public init(
        panX: Double? = nil,
        panY: Double? = nil,
        scale: Double? = nil,
        fit: Bool? = nil,
        reset: Bool? = nil
    ) {
        self.panX = panX
        self.panY = panY
        self.scale = scale
        self.fit = fit
        self.reset = reset
    }
}

public struct HudVantageSetupLayout: Codable, Hashable, Sendable {
    public var canvasTool: String?
    public var navigationFilter: String?
    public var navigationTagFilter: String?
    public var navigationCollapsed: Bool?
    public var navigationWidth: Double?
    public var minimapCollapsed: Bool?
    public var inspectorCollapsed: Bool?
    public var inspectorWidth: Double?

    public init(
        canvasTool: String? = nil,
        navigationFilter: String? = nil,
        navigationTagFilter: String? = nil,
        navigationCollapsed: Bool? = nil,
        navigationWidth: Double? = nil,
        minimapCollapsed: Bool? = nil,
        inspectorCollapsed: Bool? = nil,
        inspectorWidth: Double? = nil
    ) {
        self.canvasTool = canvasTool
        self.navigationFilter = navigationFilter
        self.navigationTagFilter = navigationTagFilter
        self.navigationCollapsed = navigationCollapsed
        self.navigationWidth = navigationWidth
        self.minimapCollapsed = minimapCollapsed
        self.inspectorCollapsed = inspectorCollapsed
        self.inspectorWidth = inspectorWidth
    }
}

public struct HudVantageSetupNode: Codable, Hashable, Sendable {
    public var id: String?
    public var nodeID: UUID?
    public var title: String?
    public var subtitle: String?
    public var runtime: HudVantageRuntimeReference?
    public var runtimeKind: String?
    public var target: String?
    public var graphitePath: String?
    public var remoteHost: String?
    public var x: Double?
    public var y: Double?
    public var width: Double?
    public var height: Double?
    public var zIndex: Double?
    public var tint: String?
    public var tag: String?
    public var style: HudVantageTerminalStyleOverride?
    public var terminalTheme: String?
    public var terminalThemeID: String?
    public var terminalFontFamily: String?
    public var terminalFontSize: Double?
    public var createIfMissing: Bool?

    public init(
        id: String? = nil,
        nodeID: UUID? = nil,
        title: String? = nil,
        subtitle: String? = nil,
        runtime: HudVantageRuntimeReference? = nil,
        runtimeKind: String? = nil,
        target: String? = nil,
        graphitePath: String? = nil,
        remoteHost: String? = nil,
        x: Double? = nil,
        y: Double? = nil,
        width: Double? = nil,
        height: Double? = nil,
        zIndex: Double? = nil,
        tint: String? = nil,
        tag: String? = nil,
        style: HudVantageTerminalStyleOverride? = nil,
        terminalTheme: String? = nil,
        terminalThemeID: String? = nil,
        terminalFontFamily: String? = nil,
        terminalFontSize: Double? = nil,
        createIfMissing: Bool? = nil
    ) {
        self.id = id
        self.nodeID = nodeID
        self.title = title
        self.subtitle = subtitle
        self.runtime = runtime
        self.runtimeKind = runtimeKind
        self.target = target
        self.graphitePath = graphitePath
        self.remoteHost = remoteHost
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.zIndex = zIndex
        self.tint = tint
        self.tag = tag
        self.style = style
        self.terminalTheme = terminalTheme
        self.terminalThemeID = terminalThemeID
        self.terminalFontFamily = terminalFontFamily
        self.terminalFontSize = terminalFontSize
        self.createIfMissing = createIfMissing
    }
}

public struct HudVantageSetupFailure: Codable, Hashable, Sendable {
    public var id: String?
    public var title: String?
    public var message: String

    public init(id: String? = nil, title: String? = nil, message: String) {
        self.id = id
        self.title = title
        self.message = message
    }
}

public struct HudVantageSetupReport: Codable, Hashable, Sendable {
    public var manifestKind: String
    public var workspaceID: String?
    public var presentation: HudVantageSetupPresentation?
    public var createdNodeIDs: [UUID]
    public var reusedNodeIDs: [UUID]
    public var updatedNodeIDs: [UUID]
    public var removedNodeIDs: [UUID]
    public var failedNodes: [HudVantageSetupFailure]

    public init(
        manifestKind: String = HudVantageSetupManifest.documentKind,
        workspaceID: String? = nil,
        presentation: HudVantageSetupPresentation? = nil,
        createdNodeIDs: [UUID] = [],
        reusedNodeIDs: [UUID] = [],
        updatedNodeIDs: [UUID] = [],
        removedNodeIDs: [UUID] = [],
        failedNodes: [HudVantageSetupFailure] = []
    ) {
        self.manifestKind = manifestKind
        self.workspaceID = workspaceID
        self.presentation = presentation
        self.createdNodeIDs = createdNodeIDs
        self.reusedNodeIDs = reusedNodeIDs
        self.updatedNodeIDs = updatedNodeIDs
        self.removedNodeIDs = removedNodeIDs
        self.failedNodes = failedNodes
    }
}
