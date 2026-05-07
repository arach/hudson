import Foundation

struct TmuxCommand: Hashable, Sendable {
    var executableURL: URL
    var arguments: [String]

    init(arguments: [String], executableURL: URL = URL(fileURLWithPath: "/usr/bin/env")) {
        self.executableURL = executableURL
        self.arguments = ["tmux"] + arguments
    }
}

struct TmuxSession: Codable, Hashable, Sendable {
    var name: String
    var id: String?
    var attachedClients: Int?
    var createdAt: Date?
}

struct TmuxWindow: Codable, Hashable, Sendable {
    var sessionName: String
    var index: Int
    var name: String
    var id: String?
    var active: Bool
}

struct TmuxPane: Codable, Hashable, Sendable {
    var sessionName: String
    var windowIndex: Int
    var index: Int
    var id: String
    var active: Bool
    var currentCommand: String?
    var title: String?
}

protocol TmuxCommandRunning: Sendable {
    func listSessions() async throws -> [TmuxSession]
    func listWindows(session: String?) async throws -> [TmuxWindow]
    func listPanes(target: String?) async throws -> [TmuxPane]
    func makeCreateSessionCommand(session: String, startDirectory: URL?) throws -> TmuxCommand
    func makeCreateWindowCommand(target: TmuxTarget, startDirectory: URL?) throws -> TmuxCommand
}

struct TmuxRuntime: TmuxCommandRunning {
    private static let fieldSeparator = "\u{1F}"

    var processRunner: @Sendable (TmuxCommand) async throws -> TmuxProcessResult

    init(processRunner: (@Sendable (TmuxCommand) async throws -> TmuxProcessResult)? = nil) {
        self.processRunner = processRunner ?? { command in
            try await TmuxProcess.run(command)
        }
    }

    func listSessions() async throws -> [TmuxSession] {
        let format = [
            "#{session_name}",
            "#{session_id}",
            "#{session_attached}",
            "#{session_created}",
        ].joined(separator: Self.fieldSeparator)
        let result = try await processRunner(TmuxCommand(arguments: ["list-sessions", "-F", format]))
        try result.throwIfFailed(allowNoServer: true)
        return result.stdoutLines.compactMap(Self.parseSession)
    }

    func listWindows(session: String? = nil) async throws -> [TmuxWindow] {
        let format = [
            "#{session_name}",
            "#{window_index}",
            "#{window_name}",
            "#{window_id}",
            "#{window_active}",
        ].joined(separator: Self.fieldSeparator)
        if let session {
            let target = try TmuxTarget.validatedName(session, field: "session")
            let result = try await processRunner(TmuxCommand(arguments: ["list-windows", "-t", target, "-F", format]))
            try result.throwIfFailed(allowNoServer: true)
            return result.stdoutLines.compactMap(Self.parseWindow)
        }

        let arguments = ["list-windows", "-a", "-F", format]
        let result = try await processRunner(TmuxCommand(arguments: arguments))
        try result.throwIfFailed(allowNoServer: true)
        return result.stdoutLines.compactMap(Self.parseWindow)
    }

    func listPanes(target: String? = nil) async throws -> [TmuxPane] {
        let format = [
            "#{session_name}",
            "#{window_index}",
            "#{pane_index}",
            "#{pane_id}",
            "#{pane_active}",
            "#{pane_current_command}",
            "#{pane_title}",
        ].joined(separator: Self.fieldSeparator)
        if let target {
            let target = try TmuxTarget.validatedTarget(target)
            let result = try await processRunner(TmuxCommand(arguments: ["list-panes", "-t", target, "-F", format]))
            try result.throwIfFailed(allowNoServer: true)
            return result.stdoutLines.compactMap(Self.parsePane)
        }

        let arguments = ["list-panes", "-a", "-F", format]
        let result = try await processRunner(TmuxCommand(arguments: arguments))
        try result.throwIfFailed(allowNoServer: true)
        return result.stdoutLines.compactMap(Self.parsePane)
    }

    func makeCreateSessionCommand(session: String, startDirectory: URL? = nil) throws -> TmuxCommand {
        let session = try TmuxTarget.validatedName(session, field: "session")
        var arguments = ["new-session", "-d", "-s", session]
        if let startDirectory {
            arguments += ["-c", startDirectory.path]
        }
        return TmuxCommand(arguments: arguments)
    }

    func makeCreateWindowCommand(target: TmuxTarget, startDirectory: URL? = nil) throws -> TmuxCommand {
        var arguments = ["new-window", "-t", target.session, "-n", target.window]
        if let startDirectory {
            arguments += ["-c", startDirectory.path]
        }
        return TmuxCommand(arguments: arguments)
    }

    private static func parseSession(_ line: String) -> TmuxSession? {
        let fields = splitFields(line)
        guard fields.count >= 4 else { return nil }
        return TmuxSession(
            name: fields[0],
            id: nilIfEmpty(fields[1]),
            attachedClients: Int(fields[2]),
            createdAt: TimeInterval(fields[3]).map(Date.init(timeIntervalSince1970:))
        )
    }

    private static func parseWindow(_ line: String) -> TmuxWindow? {
        let fields = splitFields(line)
        guard fields.count >= 5, let index = Int(fields[1]) else { return nil }
        return TmuxWindow(
            sessionName: fields[0],
            index: index,
            name: fields[2],
            id: nilIfEmpty(fields[3]),
            active: fields[4] == "1"
        )
    }

    private static func parsePane(_ line: String) -> TmuxPane? {
        let fields = splitFields(line)
        guard fields.count >= 7,
              let windowIndex = Int(fields[1]),
              let paneIndex = Int(fields[2])
        else { return nil }

        return TmuxPane(
            sessionName: fields[0],
            windowIndex: windowIndex,
            index: paneIndex,
            id: fields[3],
            active: fields[4] == "1",
            currentCommand: nilIfEmpty(fields[5]),
            title: nilIfEmpty(fields[6])
        )
    }

    private static func splitFields(_ line: String) -> [String] {
        line.components(separatedBy: fieldSeparator)
    }

    private static func nilIfEmpty(_ value: String) -> String? {
        value.isEmpty ? nil : value
    }
}

struct TmuxProcessResult: Codable, Hashable, Sendable {
    var status: Int32
    var stdout: String
    var stderr: String

    var stdoutLines: [String] {
        stdout.split(separator: "\n", omittingEmptySubsequences: true).map(String.init)
    }

    func throwIfFailed(allowNoServer: Bool = false) throws {
        if allowNoServer, status != 0, stderr.localizedCaseInsensitiveContains("no server running") {
            return
        }
        guard status == 0 else {
            throw TmuxRuntimeError.commandFailed(status: status, stderr: stderr)
        }
    }
}

struct TmuxRemoteHealthProbeResult: Codable, Hashable, Sendable {
    var status: String
    var session: String?
    var window: String?
    var activeWindow: String?
    var attachedClients: Int?
    var paneCount: Int?
    var message: String
}

struct TmuxRemoteHealthCommand: Hashable, Sendable {
    var executableURL: URL
    var arguments: [String]
}

struct TmuxRemoteHealthProcessResult: Hashable, Sendable {
    var status: Int32
    var stdout: String
    var stderr: String
    var timedOut: Bool
}

struct TmuxRemoteHealthProbe: Sendable {
    private static let defaultTimeoutSeconds = 3.0

    var processRunner: @Sendable (TmuxRemoteHealthCommand, Double) -> TmuxRemoteHealthProcessResult

    init(
        processRunner: (@Sendable (TmuxRemoteHealthCommand, Double) -> TmuxRemoteHealthProcessResult)? = nil
    ) {
        self.processRunner = processRunner ?? { command, timeoutSeconds in
            TmuxRemoteHealthProcess.run(command, timeoutSeconds: timeoutSeconds)
        }
    }

    func check(
        remoteHost: String,
        target: String,
        timeoutSeconds: Double = Self.defaultTimeoutSeconds
    ) -> TmuxRemoteHealthProbeResult {
        let command = Self.command(
            remoteHost: remoteHost,
            target: target,
            timeoutSeconds: timeoutSeconds
        )
        let result = processRunner(command, timeoutSeconds)
        return Self.result(from: result)
    }

    static func command(
        remoteHost: String,
        target: String,
        timeoutSeconds: Double
    ) -> TmuxRemoteHealthCommand {
        let connectTimeout = max(1, Int(ceil(timeoutSeconds)))
        return TmuxRemoteHealthCommand(
            executableURL: URL(fileURLWithPath: "/usr/bin/ssh"),
            arguments: [
                "-T",
                "-o", "BatchMode=yes",
                "-o", "NumberOfPasswordPrompts=0",
                "-o", "PasswordAuthentication=no",
                "-o", "KbdInteractiveAuthentication=no",
                "-o", "ConnectionAttempts=1",
                "-o", "ConnectTimeout=\(connectTimeout)",
                "-o", "ServerAliveInterval=1",
                "-o", "ServerAliveCountMax=1",
                "-o", "LogLevel=ERROR",
                remoteHost,
                "sh -lc \(shellQuoted(remoteHealthScript(target: target)))",
            ]
        )
    }

    static func result(from processResult: TmuxRemoteHealthProcessResult) -> TmuxRemoteHealthProbeResult {
        if processResult.timedOut {
            return TmuxRemoteHealthProbeResult(
                status: "unreachable",
                message: "remote tmux health check timed out"
            )
        }

        let fields = parseHealthFields(processResult.stdout)
        if let status = fields["VANTAGE_STATUS"] {
            return TmuxRemoteHealthProbeResult(
                status: status,
                session: nilIfEmpty(fields["VANTAGE_SESSION"]),
                window: nilIfEmpty(fields["VANTAGE_WINDOW"]),
                activeWindow: nilIfEmpty(fields["VANTAGE_ACTIVE_WINDOW"]),
                attachedClients: fields["VANTAGE_ATTACHED"].flatMap(Int.init),
                paneCount: fields["VANTAGE_PANES"].flatMap(Int.init),
                message: message(forRemoteStatus: status)
            )
        }

        let combinedError = "\(processResult.stderr)\n\(processResult.stdout)"
        return TmuxRemoteHealthProbeResult(
            status: classifiedSSHFailureStatus(from: combinedError, status: processResult.status),
            message: classifiedSSHFailureMessage(from: combinedError, status: processResult.status)
        )
    }

    private static func remoteHealthScript(target: String) -> String {
        let quotedTarget = shellQuoted(target)
        return """
        target=\(quotedTarget)
        if ! command -v tmux >/dev/null 2>&1; then
          printf 'VANTAGE_STATUS=tmux-missing\\n'
          exit 42
        fi
        if ! tmux has-session -t "$target" >/dev/null 2>&1; then
          printf 'VANTAGE_STATUS=session-missing\\n'
          exit 44
        fi
        printf 'VANTAGE_STATUS=ready\\n'
        printf 'VANTAGE_SESSION=%s\\n' "$(tmux display-message -t "$target" -p '#{session_name}' 2>/dev/null)"
        printf 'VANTAGE_WINDOW=%s\\n' "$(tmux display-message -t "$target" -p '#{window_name}' 2>/dev/null)"
        printf 'VANTAGE_ACTIVE_WINDOW=%s\\n' "$(tmux display-message -t "$target" -p '#{window_name}' 2>/dev/null)"
        printf 'VANTAGE_ATTACHED=%s\\n' "$(tmux display-message -t "$target" -p '#{session_attached}' 2>/dev/null)"
        printf 'VANTAGE_PANES=%s\\n' "$(tmux list-panes -t "$target" -F '#{pane_id}' 2>/dev/null | wc -l | tr -d ' ')"
        """
    }

    private static func parseHealthFields(_ stdout: String) -> [String: String] {
        stdout
            .split(separator: "\n", omittingEmptySubsequences: true)
            .reduce(into: [:]) { fields, line in
                let parts = line.split(separator: "=", maxSplits: 1, omittingEmptySubsequences: false)
                guard parts.count == 2 else { return }
                fields[String(parts[0])] = String(parts[1])
            }
    }

    private static func classifiedSSHFailureStatus(from error: String, status: Int32) -> String {
        let normalized = error.lowercased()
        if normalized.contains("permission denied")
            || normalized.contains("publickey")
            || normalized.contains("authentication failed")
            || normalized.contains("host key verification failed")
            || normalized.contains("remote host identification has changed") {
            return "auth-needed"
        }
        if normalized.contains("could not resolve hostname")
            || normalized.contains("name or service not known")
            || normalized.contains("nodename nor servname")
            || normalized.contains("no route to host")
            || normalized.contains("connection timed out")
            || normalized.contains("operation timed out")
            || normalized.contains("connection refused") {
            return "unreachable"
        }
        return status == 255 ? "auth-needed" : "remote-error"
    }

    private static func classifiedSSHFailureMessage(from error: String, status: Int32) -> String {
        switch classifiedSSHFailureStatus(from: error, status: status) {
        case "auth-needed":
            return "remote ssh authentication or host-key approval is needed"
        case "unreachable":
            return "remote host is unreachable"
        default:
            let trimmed = error.trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed.isEmpty ? "remote tmux health check failed" : trimmed
        }
    }

    private static func message(forRemoteStatus status: String) -> String {
        switch status {
        case "ready":
            return "remote tmux target is ready"
        case "tmux-missing":
            return "tmux executable not found on remote host"
        case "session-missing":
            return "remote tmux session or target was not found"
        default:
            return "remote tmux health returned \(status)"
        }
    }

    private static func nilIfEmpty(_ value: String?) -> String? {
        guard let value, !value.isEmpty else { return nil }
        return value
    }

    private static func shellQuoted(_ value: String) -> String {
        "'\(value.replacingOccurrences(of: "'", with: "'\"'\"'"))'"
    }
}

enum TmuxRemoteHealthProcess {
    static func run(
        _ command: TmuxRemoteHealthCommand,
        timeoutSeconds: Double
    ) -> TmuxRemoteHealthProcessResult {
        let process = Process()
        let stdoutPipe = Pipe()
        let stderrPipe = Pipe()
        var timedOut = false
        let finished = DispatchSemaphore(value: 0)

        process.executableURL = command.executableURL
        process.arguments = command.arguments
        process.standardOutput = stdoutPipe
        process.standardError = stderrPipe
        process.terminationHandler = { _ in
            finished.signal()
        }

        do {
            try process.run()
        } catch {
            return TmuxRemoteHealthProcessResult(
                status: 127,
                stdout: "",
                stderr: error.localizedDescription,
                timedOut: false
            )
        }

        if finished.wait(timeout: .now() + timeoutSeconds) == .timedOut {
            timedOut = true
            process.terminate()
            process.waitUntilExit()
        }

        let stdout = String(
            data: stdoutPipe.fileHandleForReading.readDataToEndOfFile(),
            encoding: .utf8
        ) ?? ""
        let stderr = String(
            data: stderrPipe.fileHandleForReading.readDataToEndOfFile(),
            encoding: .utf8
        ) ?? ""

        return TmuxRemoteHealthProcessResult(
            status: process.terminationStatus,
            stdout: stdout,
            stderr: stderr,
            timedOut: timedOut
        )
    }
}

enum TmuxRuntimeError: Error, LocalizedError, Equatable, Sendable {
    case tmuxMissing
    case commandFailed(status: Int32, stderr: String)
    case launchFailed(String)

    var errorDescription: String? {
        switch self {
        case .tmuxMissing:
            "tmux is not available on PATH"
        case .commandFailed(let status, let stderr):
            "tmux exited with status \(status): \(stderr)"
        case .launchFailed(let message):
            "failed to launch tmux: \(message)"
        }
    }
}

enum TmuxProcess {
    static func run(_ command: TmuxCommand) async throws -> TmuxProcessResult {
        try await Task.detached(priority: .utility) {
            let process = Process()
            let stdoutPipe = Pipe()
            let stderrPipe = Pipe()

            process.executableURL = command.executableURL
            process.arguments = command.arguments
            process.standardOutput = stdoutPipe
            process.standardError = stderrPipe

            do {
                try process.run()
            } catch CocoaError.fileNoSuchFile {
                throw TmuxRuntimeError.tmuxMissing
            } catch {
                throw TmuxRuntimeError.launchFailed(error.localizedDescription)
            }

            let stdoutTask = Task.detached(priority: .utility) {
                stdoutPipe.fileHandleForReading.readDataToEndOfFile()
            }
            let stderrTask = Task.detached(priority: .utility) {
                stderrPipe.fileHandleForReading.readDataToEndOfFile()
            }

            process.waitUntilExit()

            let stdout = await stdoutTask.value
            let stderr = await stderrTask.value
            let stderrText = String(data: stderr, encoding: .utf8) ?? ""

            if process.terminationStatus == 127, stderrText.localizedCaseInsensitiveContains("tmux") {
                throw TmuxRuntimeError.tmuxMissing
            }

            return TmuxProcessResult(
                status: process.terminationStatus,
                stdout: String(data: stdout, encoding: .utf8) ?? "",
                stderr: stderrText
            )
        }.value
    }
}
