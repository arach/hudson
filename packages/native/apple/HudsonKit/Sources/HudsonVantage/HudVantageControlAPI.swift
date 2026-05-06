import Foundation
import Combine

public struct HudVantageControlCommand: Decodable, Sendable {
    public var id: String?
    public var action: String
    public var workspaceID: String?
    public var statePath: String?
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

    public init(
        id: String? = nil,
        action: String,
        workspaceID: String? = nil,
        statePath: String? = nil,
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
        installer: String? = nil
    ) {
        self.id = id
        self.action = action
        self.workspaceID = workspaceID
        self.statePath = statePath
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
    }

    public var normalizedAction: String {
        action.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }
}

public struct HudVantageControlNode: Encodable, Hashable, Sendable {
    public var id: UUID
    public var title: String
    public var runtimeKind: String
    public var target: String?
    public var graphitePath: String?
    public var remoteHost: String?
    public var x: Double
    public var y: Double
    public var width: Double
    public var height: Double
    public var zIndex: Double

    public init(
        id: UUID,
        title: String,
        runtimeKind: String,
        target: String? = nil,
        graphitePath: String? = nil,
        remoteHost: String? = nil,
        x: Double,
        y: Double,
        width: Double,
        height: Double,
        zIndex: Double
    ) {
        self.id = id
        self.title = title
        self.runtimeKind = runtimeKind
        self.target = target
        self.graphitePath = graphitePath
        self.remoteHost = remoteHost
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.zIndex = zIndex
    }
}

public struct HudVantageControlResponse: Encodable, Sendable {
    public var id: String?
    public var action: String
    public var ok: Bool
    public var message: String
    public var workspaceID: String?
    public var nodeCount: Int
    public var nodes: [HudVantageControlNode]?
    public var appPID: Int32?
    public var childPIDs: [Int32]?
    public var commandPath: String?
    public var responsePath: String?
    public var statePath: String?
    public var tmuxPath: String?
    public var tmuxInstallInProgress: Bool?
    public var requiresPermission: Bool?
    public var installerCommand: String?
    public var timestamp: String

    public init(
        id: String?,
        action: String,
        ok: Bool,
        message: String,
        workspaceID: String? = nil,
        nodeCount: Int,
        nodes: [HudVantageControlNode]? = nil,
        appPID: Int32? = nil,
        childPIDs: [Int32]? = nil,
        commandPath: String? = nil,
        responsePath: String? = nil,
        statePath: String? = nil,
        tmuxPath: String? = nil,
        tmuxInstallInProgress: Bool? = nil,
        requiresPermission: Bool? = nil,
        installerCommand: String? = nil
    ) {
        self.id = id
        self.action = action
        self.ok = ok
        self.message = message
        self.workspaceID = workspaceID
        self.nodeCount = nodeCount
        self.nodes = nodes
        self.appPID = appPID
        self.childPIDs = childPIDs
        self.commandPath = commandPath
        self.responsePath = responsePath
        self.statePath = statePath
        self.tmuxPath = tmuxPath
        self.tmuxInstallInProgress = tmuxInstallInProgress
        self.requiresPermission = requiresPermission
        self.installerCommand = installerCommand
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
