import Foundation
import Combine

struct TerminiCanvasControlCommand: Decodable, Sendable {
    var id: String?
    var action: String
    var columns: Int?
    var rows: Int?
    var count: Int?
    var originX: Double?
    var originY: Double?
    var width: Double?
    var height: Double?
    var gap: Double?
    var reset: Bool?
    var allowLarge: Bool?
    var includeChildren: Bool?

    var normalizedAction: String {
        action.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }
}

struct TerminiCanvasControlResponse: Encodable, Sendable {
    var id: String?
    var action: String
    var ok: Bool
    var message: String
    var nodeCount: Int
    var appPID: Int32?
    var childPIDs: [Int32]?
    var commandPath: String?
    var responsePath: String?
    var timestamp: String

    init(
        id: String?,
        action: String,
        ok: Bool,
        message: String,
        nodeCount: Int,
        appPID: Int32? = nil,
        childPIDs: [Int32]? = nil,
        commandPath: String? = nil,
        responsePath: String? = nil
    ) {
        self.id = id
        self.action = action
        self.ok = ok
        self.message = message
        self.nodeCount = nodeCount
        self.appPID = appPID
        self.childPIDs = childPIDs
        self.commandPath = commandPath
        self.responsePath = responsePath
        self.timestamp = ISO8601DateFormatter().string(from: Date())
    }
}

final class TerminiCanvasControlAPI: ObservableObject {
    let commandURL = URL(fileURLWithPath: "/tmp/termini-canvas-control.jsonl")
    let responseURL = URL(fileURLWithPath: "/tmp/termini-canvas-control.responses.jsonl")

    private enum PollEvent {
        case command(TerminiCanvasControlCommand)
        case decodeFailure(String)
    }

    private let queue = DispatchQueue(label: "dev.arach.hudson.termini-canvas.control-api")
    private var pollTimer: DispatchSourceTimer?
    private var readOffset: UInt64 = 0
    private let decoder = JSONDecoder()

    func start(
        handler: @escaping @MainActor (TerminiCanvasControlCommand) -> TerminiCanvasControlResponse
    ) {
        stop()
        ensureFileExists(at: commandURL)
        ensureFileExists(at: responseURL)
        readOffset = endOffset(of: commandURL)

        appendResponse(
            TerminiCanvasControlResponse(
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
                let command = try decoder.decode(TerminiCanvasControlCommand.self, from: lineData)
                return .command(command)
            } catch {
                return .decodeFailure(error.localizedDescription)
            }
        }
    }

    private func appendDecodeFailure(_ message: String) {
        appendResponse(
            TerminiCanvasControlResponse(
                id: nil,
                action: "decode",
                ok: false,
                message: message,
                nodeCount: 0
            )
        )
    }

    private func appendResponse(_ response: TerminiCanvasControlResponse) {
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

    private func endOffset(of url: URL) -> UInt64 {
        guard let file = try? FileHandle(forReadingFrom: url) else { return 0 }
        defer {
            try? file.close()
        }
        return (try? file.seekToEnd()) ?? 0
    }
}
