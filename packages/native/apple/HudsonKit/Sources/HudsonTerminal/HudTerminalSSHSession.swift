import Foundation
import Observation
import Termini
import TerminiSSH

public enum HudTerminalSSHAuthentication: Equatable, Sendable {
    case password(String)
    case privateKey(pem: String)
}

public enum HudTerminalSSHStartup: Equatable, Sendable {
    case none
    case shell(command: String)
    case exec(command: String)
}

public enum HudTerminalSSHHostKeyPolicy: String, CaseIterable, Sendable {
    case trustOnFirstUse
    case requireStoredHostKey
    case acceptAny
}

/// Host-owned SSH inputs for HudsonTerminal. Termini remains the transport
/// implementation detail, so consumers do not need to import TerminiSSH.
public struct HudTerminalSSHConnection: Equatable, Sendable {
    public var name: String
    public var host: String
    public var port: Int
    public var username: String
    public var authentication: HudTerminalSSHAuthentication
    public var term: String
    public var startup: HudTerminalSSHStartup
    public var hostKeyPolicy: HudTerminalSSHHostKeyPolicy
    public var hostKeyFingerprint: String?

    public init(
        name: String = "Primary Mac",
        host: String = "",
        port: Int = 22,
        username: String = "",
        authentication: HudTerminalSSHAuthentication = .privateKey(pem: ""),
        term: String = "xterm-256color",
        startup: HudTerminalSSHStartup = .none,
        hostKeyPolicy: HudTerminalSSHHostKeyPolicy = .trustOnFirstUse,
        hostKeyFingerprint: String? = nil
    ) {
        self.name = name
        self.host = host
        self.port = port
        self.username = username
        self.authentication = authentication
        self.term = term
        self.startup = startup
        self.hostKeyPolicy = hostKeyPolicy
        self.hostKeyFingerprint = hostKeyFingerprint
    }

    public var endpointLabel: String {
        terminiConnection.endpointLabel
    }

    public var validationError: String? {
        terminiConnection.validationError
    }

    var terminiConnection: TerminiConnectionConfig {
        let authenticationMode: TerminiConnectionConfig.AuthenticationMode
        let password: String
        let privateKeyPEM: String
        switch authentication {
        case .password(let value):
            authenticationMode = .password
            password = value
            privateKeyPEM = ""
        case .privateKey(let pem):
            authenticationMode = .privateKey
            password = ""
            privateKeyPEM = pem
        }

        let startupCommand: String
        let useExecRequest: Bool
        switch startup {
        case .none:
            startupCommand = ""
            useExecRequest = false
        case .shell(let command):
            startupCommand = command
            useExecRequest = false
        case .exec(let command):
            startupCommand = command
            useExecRequest = true
        }

        return TerminiConnectionConfig(
            name: name,
            host: host,
            port: port,
            username: username,
            authenticationMode: authenticationMode,
            password: password,
            privateKeyPEM: privateKeyPEM,
            term: term,
            startupCommand: startupCommand,
            useExecRequest: useExecRequest,
            hostKeyPolicy: hostKeyPolicy.terminiPolicy,
            hostKeyFingerprint: hostKeyFingerprint ?? ""
        )
    }

    fileprivate init(terminiConnection: TerminiConnectionConfig) {
        self.name = terminiConnection.name
        self.host = terminiConnection.host
        self.port = terminiConnection.port
        self.username = terminiConnection.username
        switch terminiConnection.authenticationMode {
        case .password:
            self.authentication = .password(terminiConnection.password)
        case .privateKey:
            self.authentication = .privateKey(pem: terminiConnection.privateKeyPEM)
        }
        self.term = terminiConnection.term
        if terminiConnection.startupCommand.isEmpty {
            self.startup = .none
        } else if terminiConnection.useExecRequest {
            self.startup = .exec(command: terminiConnection.startupCommand)
        } else {
            self.startup = .shell(command: terminiConnection.startupCommand)
        }
        self.hostKeyPolicy = .init(terminiPolicy: terminiConnection.hostKeyPolicy)
        self.hostKeyFingerprint = terminiConnection.hostKeyFingerprint.isEmpty
            ? nil
            : terminiConnection.hostKeyFingerprint
    }
}

private extension HudTerminalSSHHostKeyPolicy {
    var terminiPolicy: TerminiSSHHostKeyPolicy {
        switch self {
        case .trustOnFirstUse: .trustOnFirstUse
        case .requireStoredHostKey: .requireStoredHostKey
        case .acceptAny: .acceptAny
        }
    }

    init(terminiPolicy: TerminiSSHHostKeyPolicy) {
        switch terminiPolicy {
        case .trustOnFirstUse: self = .trustOnFirstUse
        case .requireStoredHostKey: self = .requireStoredHostKey
        case .acceptAny: self = .acceptAny
        }
    }
}

public enum HudTerminalSSHStatus: Equatable, Sendable {
    case disconnected
    case connecting
    case connected
    case failed(String)
}

public struct HudTerminalGrid: Equatable, Sendable {
    public let columns: Int
    public let rows: Int
    public let cellWidthPixels: Int
    public let cellHeightPixels: Int
}

public struct HudTerminalSSHSnapshot: Equatable, Sendable {
    public let status: HudTerminalSSHStatus
    public let statusMessage: String
    public let endpoint: String
    public let grid: HudTerminalGrid?
    public let rendererDiagnostics: [String]
    public let rendererVisibleText: String
}

/// Reusable owner for one SSH-backed terminal session. Hosts provide
/// credentials/provisioning, while Hudson owns lifecycle, IO, renderer state,
/// and diagnostics over Termini's implementation.
@MainActor
@Observable
public final class HudTerminalSSHSession {
    public var connection: HudTerminalSSHConnection {
        didSet { workspace.connection = connection.terminiConnection }
    }

    private let workspace: TerminiSSHWorkspace

    public init(connection: HudTerminalSSHConnection = .init()) {
        self.connection = connection
        self.workspace = TerminiSSHWorkspace(connection: connection.terminiConnection)
    }

    public var status: HudTerminalSSHStatus {
        switch workspace.status {
        case .disconnected: .disconnected
        case .connecting: .connecting
        case .connected: .connected
        case .failed(let message): .failed(message)
        }
    }

    public var statusMessage: String { workspace.statusMessage }
    public var lastErrorMessage: String? { workspace.lastErrorMessage }
    public var isConnected: Bool { workspace.isConnected }
    public var isConnecting: Bool { workspace.isConnecting }
    public var canConnect: Bool { workspace.canConnect }

    public var snapshot: HudTerminalSSHSnapshot {
        let grid = workspace.terminalSize.map {
            HudTerminalGrid(
                columns: $0.columns,
                rows: $0.rows,
                cellWidthPixels: $0.cellWidthPixels,
                cellHeightPixels: $0.cellHeightPixels
            )
        }
        return HudTerminalSSHSnapshot(
            status: status,
            statusMessage: statusMessage,
            endpoint: connection.endpointLabel,
            grid: grid,
            rendererDiagnostics: workspace.diagnostics?.lines ?? [],
            rendererVisibleText: workspace.controller.visibleText() ?? ""
        )
    }

    @discardableResult
    public func loadEnvironmentConfigurationIfAvailable(
        _ environment: [String: String] = ProcessInfo.processInfo.environment
    ) -> Bool {
        guard workspace.loadEnvironmentConfigurationIfAvailable(environment) else {
            return false
        }
        connection = .init(terminiConnection: workspace.connection)
        return true
    }

    public func connect() async {
        workspace.connection = connection.terminiConnection
        await workspace.connect()
    }

    public func disconnect() async {
        await workspace.disconnect()
    }

    public func toggleConnection() async {
        await workspace.toggleConnection()
    }

    public func send(_ data: Data) {
        workspace.controller.onTransportWrite?(data)
    }

    public func send(_ text: String) {
        send(Data(text.utf8))
    }

    public func focus() {
        workspace.controller.focus()
    }

    public func blur() {
        workspace.controller.blur()
    }

    var terminiController: TerminiTerminalController {
        workspace.controller
    }
}
