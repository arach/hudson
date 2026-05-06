import Foundation
import Combine

public enum HudVantageControlContract {
    public static let currentVersion = "v0"
    public static let commandKind = "hudson.vantage.command"
    public static let responseKind = "hudson.vantage.response"
}

public struct HudVantageControlCommand: Decodable, Sendable {
    public var apiVersion: String?
    public var version: String?
    public var kind: String?
    public var id: String?
    public var action: String
    public var workspaceID: String?
    public var statePath: String?
    public var nodeID: String?
    public var nodeIDs: [String]?
    public var selectionMode: String?
    public var columns: Int?
    public var rows: Int?
    public var count: Int?
    public var originX: Double?
    public var originY: Double?
    public var width: Double?
    public var height: Double?
    public var gap: Double?
    public var reset: Bool?
    public var allowLarge: Bool?
    public var includeChildren: Bool?
    public var ids: [String]?
    public var sessions: [String]?
    public var targets: [String]?
    public var createIfMissing: Bool?
    public var remoteHost: String?
    public var confirmInstall: Bool?
    public var installer: String?
    public var includeNodes: Bool?
    public var includeMetrics: Bool?
    public var includeViewport: Bool?

    public init(
        apiVersion: String? = nil,
        version: String? = nil,
        kind: String? = nil,
        id: String? = nil,
        action: String,
        workspaceID: String? = nil,
        statePath: String? = nil,
        nodeID: String? = nil,
        nodeIDs: [String]? = nil,
        selectionMode: String? = nil,
        columns: Int? = nil,
        rows: Int? = nil,
        count: Int? = nil,
        originX: Double? = nil,
        originY: Double? = nil,
        width: Double? = nil,
        height: Double? = nil,
        gap: Double? = nil,
        reset: Bool? = nil,
        allowLarge: Bool? = nil,
        includeChildren: Bool? = nil,
        ids: [String]? = nil,
        sessions: [String]? = nil,
        targets: [String]? = nil,
        createIfMissing: Bool? = nil,
        remoteHost: String? = nil,
        confirmInstall: Bool? = nil,
        installer: String? = nil,
        includeNodes: Bool? = nil,
        includeMetrics: Bool? = nil,
        includeViewport: Bool? = nil
    ) {
        self.apiVersion = apiVersion
        self.version = version
        self.kind = kind
        self.id = id
        self.action = action
        self.workspaceID = workspaceID
        self.statePath = statePath
        self.nodeID = nodeID
        self.nodeIDs = nodeIDs
        self.selectionMode = selectionMode
        self.columns = columns
        self.rows = rows
        self.count = count
        self.originX = originX
        self.originY = originY
        self.width = width
        self.height = height
        self.gap = gap
        self.reset = reset
        self.allowLarge = allowLarge
        self.includeChildren = includeChildren
        self.ids = ids
        self.sessions = sessions
        self.targets = targets
        self.createIfMissing = createIfMissing
        self.remoteHost = remoteHost
        self.confirmInstall = confirmInstall
        self.installer = installer
        self.includeNodes = includeNodes
        self.includeMetrics = includeMetrics
        self.includeViewport = includeViewport
    }

    public var normalizedAction: String {
        action.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    public var resolvedAPIVersion: String {
        apiVersion ?? version ?? HudVantageControlContract.currentVersion
    }

    public var normalizedSelectionMode: String {
        selectionMode?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? "replace"
    }
}

public struct HudVantageControlNode: Encodable, Hashable, Sendable {
    public var id: UUID
    public var title: String
    public var subtitle: String?
    public var runtimeKind: String
    public var target: String?
    public var graphitePath: String?
    public var remoteHost: String?
    public var selected: Bool?
    public var x: Double
    public var y: Double
    public var width: Double
    public var height: Double
    public var zIndex: Double

    public init(
        id: UUID,
        title: String,
        subtitle: String? = nil,
        runtimeKind: String,
        target: String? = nil,
        graphitePath: String? = nil,
        remoteHost: String? = nil,
        selected: Bool? = nil,
        x: Double,
        y: Double,
        width: Double,
        height: Double,
        zIndex: Double
    ) {
        self.id = id
        self.title = title
        self.subtitle = subtitle
        self.runtimeKind = runtimeKind
        self.target = target
        self.graphitePath = graphitePath
        self.remoteHost = remoteHost
        self.selected = selected
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.zIndex = zIndex
    }
}

public struct HudVantageControlViewport: Encodable, Hashable, Sendable {
    public var panX: Double
    public var panY: Double
    public var scale: Double
    public var viewportWidth: Double
    public var viewportHeight: Double
    public var worldMinX: Double
    public var worldMinY: Double
    public var worldWidth: Double
    public var worldHeight: Double

    public init(
        panX: Double,
        panY: Double,
        scale: Double,
        viewportWidth: Double,
        viewportHeight: Double,
        worldMinX: Double,
        worldMinY: Double,
        worldWidth: Double,
        worldHeight: Double
    ) {
        self.panX = panX
        self.panY = panY
        self.scale = scale
        self.viewportWidth = viewportWidth
        self.viewportHeight = viewportHeight
        self.worldMinX = worldMinX
        self.worldMinY = worldMinY
        self.worldWidth = worldWidth
        self.worldHeight = worldHeight
    }
}

public struct HudVantageControlMetrics: Encodable, Hashable, Sendable {
    public var nodeCount: Int
    public var selectedCount: Int
    public var localPTYCount: Int
    public var tmuxCount: Int
    public var remoteTmuxCount: Int
    public var liveSurfaceCount: Int
    public var controlCommandCount: Int
    public var lastCommandAction: String?
    public var lastCommandDurationMS: Double?
    public var perf: HudVantagePerfSnapshot?
    public var minScale: Double
    public var maxScale: Double

    public init(
        nodeCount: Int,
        selectedCount: Int,
        localPTYCount: Int,
        tmuxCount: Int,
        remoteTmuxCount: Int,
        liveSurfaceCount: Int,
        controlCommandCount: Int,
        lastCommandAction: String? = nil,
        lastCommandDurationMS: Double? = nil,
        perf: HudVantagePerfSnapshot? = nil,
        minScale: Double,
        maxScale: Double
    ) {
        self.nodeCount = nodeCount
        self.selectedCount = selectedCount
        self.localPTYCount = localPTYCount
        self.tmuxCount = tmuxCount
        self.remoteTmuxCount = remoteTmuxCount
        self.liveSurfaceCount = liveSurfaceCount
        self.controlCommandCount = controlCommandCount
        self.lastCommandAction = lastCommandAction
        self.lastCommandDurationMS = lastCommandDurationMS
        self.perf = perf
        self.minScale = minScale
        self.maxScale = maxScale
    }
}

public struct HudVantageControlResponse: Encodable, Sendable {
    public var apiVersion: String
    public var kind: String
    public var id: String?
    public var action: String
    public var ok: Bool
    public var message: String
    public var errorCode: String?
    public var workspaceID: String?
    public var nodeCount: Int
    public var nodes: [HudVantageControlNode]?
    public var selectedNodeIDs: [UUID]?
    public var viewport: HudVantageControlViewport?
    public var metrics: HudVantageControlMetrics?
    public var appPID: Int32?
    public var childPIDs: [Int32]?
    public var commandPath: String?
    public var responsePath: String?
    public var statePath: String?
    public var tmuxPath: String?
    public var tmuxInstallInProgress: Bool?
    public var requiresPermission: Bool?
    public var installerCommand: String?
    public var durationMS: Double?
    public var timestamp: String

    public init(
        apiVersion: String = HudVantageControlContract.currentVersion,
        kind: String = HudVantageControlContract.responseKind,
        id: String?,
        action: String,
        ok: Bool,
        message: String,
        errorCode: String? = nil,
        workspaceID: String? = nil,
        nodeCount: Int,
        nodes: [HudVantageControlNode]? = nil,
        selectedNodeIDs: [UUID]? = nil,
        viewport: HudVantageControlViewport? = nil,
        metrics: HudVantageControlMetrics? = nil,
        appPID: Int32? = nil,
        childPIDs: [Int32]? = nil,
        commandPath: String? = nil,
        responsePath: String? = nil,
        statePath: String? = nil,
        tmuxPath: String? = nil,
        tmuxInstallInProgress: Bool? = nil,
        requiresPermission: Bool? = nil,
        installerCommand: String? = nil,
        durationMS: Double? = nil
    ) {
        self.apiVersion = apiVersion
        self.kind = kind
        self.id = id
        self.action = action
        self.ok = ok
        self.message = message
        self.errorCode = errorCode
        self.workspaceID = workspaceID
        self.nodeCount = nodeCount
        self.nodes = nodes
        self.selectedNodeIDs = selectedNodeIDs
        self.viewport = viewport
        self.metrics = metrics
        self.appPID = appPID
        self.childPIDs = childPIDs
        self.commandPath = commandPath
        self.responsePath = responsePath
        self.statePath = statePath
        self.tmuxPath = tmuxPath
        self.tmuxInstallInProgress = tmuxInstallInProgress
        self.requiresPermission = requiresPermission
        self.installerCommand = installerCommand
        self.durationMS = durationMS
        self.timestamp = ISO8601DateFormatter().string(from: Date())
    }
}

final class HudVantageControlAPI: ObservableObject {
    let commandURL: URL
    let responseURL: URL

    private enum PollEvent {
        case command(HudVantageControlCommand)
        case decodeFailure(String)
    }

    private let queue = DispatchQueue(label: "dev.arach.hudson.vantage.control-api")
    private var pollTimer: DispatchSourceTimer?
    private var readOffset: UInt64 = 0
    private let decoder = JSONDecoder()

    init(
        commandURL: URL = URL(fileURLWithPath: "/tmp/hudson-vantage-control.jsonl"),
        responseURL: URL = URL(fileURLWithPath: "/tmp/hudson-vantage-control.responses.jsonl")
    ) {
        self.commandURL = commandURL
        self.responseURL = responseURL
    }

    func start(
        handler: @escaping @MainActor (HudVantageControlCommand) -> HudVantageControlResponse
    ) {
        stop()
        ensureFileExists(at: commandURL)
        ensureFileExists(at: responseURL)
        readOffset = 0

        appendResponse(
            HudVantageControlResponse(
                id: "control-api",
                action: "ready",
                ok: true,
                message: "control API ready",
                nodeCount: 0,
                commandPath: commandURL.path,
                responsePath: responseURL.path
            )
        )

        let timer = DispatchSource.makeTimerSource(queue: queue)
        timer.schedule(
            deadline: .now() + .milliseconds(250),
            repeating: .milliseconds(250),
            leeway: .milliseconds(100)
        )
        timer.setEventHandler { [weak self] in
            guard let self else { return }

            for event in self.pollEvents() {
                switch event {
                case .command(let command):
                    Task { @MainActor in
                        self.appendResponse(handler(command))
                    }
                case .decodeFailure(let message):
                    self.appendDecodeFailure(message)
                }
            }
        }
        pollTimer = timer
        timer.resume()
    }

    func stop() {
        pollTimer?.cancel()
        pollTimer = nil
    }

    private func pollEvents() -> [PollEvent] {
        guard let file = try? FileHandle(forReadingFrom: commandURL) else { return [] }
        defer {
            try? file.close()
        }

        let end = (try? file.seekToEnd()) ?? 0
        if end < readOffset {
            readOffset = 0
        }

        guard end > readOffset else { return [] }
        try? file.seek(toOffset: readOffset)
        let data = file.readDataToEndOfFile()
        readOffset = end

        guard let text = String(data: data, encoding: .utf8) else {
            return [.decodeFailure("command bytes were not valid UTF-8")]
        }

        return text.split(separator: "\n", omittingEmptySubsequences: true).compactMap { line in
            guard let lineData = String(line).data(using: .utf8) else { return nil }

            do {
                let command = try decoder.decode(HudVantageControlCommand.self, from: lineData)
                return .command(command)
            } catch {
                return .decodeFailure(error.localizedDescription)
            }
        }
    }

    private func appendDecodeFailure(_ message: String) {
        appendResponse(
            HudVantageControlResponse(
                id: nil,
                action: "decode",
                ok: false,
                message: message,
                nodeCount: 0
            )
        )
    }

    private func appendResponse(_ response: HudVantageControlResponse) {
        ensureFileExists(at: responseURL)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        guard let data = try? encoder.encode(response),
              let file = try? FileHandle(forWritingTo: responseURL)
        else { return }

        defer {
            try? file.close()
        }

        _ = try? file.seekToEnd()
        file.write(data)
        file.write(Data([0x0A]))
    }

    private func ensureFileExists(at url: URL) {
        guard !FileManager.default.fileExists(atPath: url.path) else { return }
        FileManager.default.createFile(atPath: url.path, contents: nil)
    }
}
