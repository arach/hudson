import SwiftUI
import HudsonUI
import Termini
import TerminiSSH

public struct HudTerminalSessionState: Equatable, Sendable {
    public var isConnected: Bool
    public var isConnecting: Bool
    public var statusMessage: String
    public var columns: Int?
    public var rows: Int?

    public init(
        isConnected: Bool,
        isConnecting: Bool,
        statusMessage: String,
        columns: Int? = nil,
        rows: Int? = nil
    ) {
        self.isConnected = isConnected
        self.isConnecting = isConnecting
        self.statusMessage = statusMessage
        self.columns = columns
        self.rows = rows
    }
}

/// Complete SSH-backed terminal surface for demos and simple host apps.
///
/// The workspace loads `TERMBRIDGEKIT_SSH_*` environment variables on appear
/// and connects automatically when credentials are present. More advanced
/// Hudson transports should keep using `HudTerminalSurface` directly.
public struct HudTerminalSSHSurface: View {
    public static let defaultConnection = TerminiConnectionConfig(
        name: "Hudson Terminal",
        startupCommand: "tmux new -A -s hudson"
    )

    @State private var workspace: TerminiSSHWorkspace
    @State private var didAttemptEnvironmentLoad = false

    private let hostLabel: String
    private let autoConnect: Bool
    private let showsSystemKeyboard: Bool
    private let appearance: HudTerminalAppearance
    private let onStateChange: (HudTerminalSessionState) -> Void

    public init(
        hostLabel: String = "SSH host",
        connection: TerminiConnectionConfig = Self.defaultConnection,
        autoConnect: Bool = true,
        showsSystemKeyboard: Bool = true,
        appearance: HudTerminalAppearance = .default,
        onStateChange: @escaping (HudTerminalSessionState) -> Void = { _ in }
    ) {
        self._workspace = State(initialValue: TerminiSSHWorkspace(connection: connection))
        self.hostLabel = hostLabel
        self.autoConnect = autoConnect
        self.showsSystemKeyboard = showsSystemKeyboard
        self.appearance = appearance
        self.onStateChange = onStateChange
    }

    public var body: some View {
        HudTerminalSurface(
            controller: workspace.controller,
            showsSystemKeyboard: showsSystemKeyboard,
            appearance: appearance
        )
        .overlay {
            if !workspace.isConnected {
                statusOverlay
            }
        }
        .task {
            guard autoConnect, !didAttemptEnvironmentLoad else { return }
            didAttemptEnvironmentLoad = true

            if workspace.loadEnvironmentConfigurationIfAvailable() {
                await workspace.connect()
            } else {
                reportState()
            }
        }
        .onChange(of: workspace.statusMessage) { _, _ in reportState() }
        .onChange(of: workspace.terminalSize) { _, _ in reportState() }
    }

    private var statusOverlay: some View {
        ZStack {
            appearance.backgroundColor.opacity(0.92)

            VStack(spacing: HudSpacing.xl) {
                HudStatusDot(
                    color: workspace.isConnecting ? HudPalette.statusWarn : HudPalette.statusInfo,
                    size: 8,
                    pulses: workspace.isConnecting
                )

                VStack(spacing: HudSpacing.sm) {
                    Text(hostLabel)
                        .font(HudFont.mono(12, weight: .semibold))
                        .foregroundStyle(HudPalette.ink)
                    Text(workspace.statusMessage)
                        .font(HudFont.mono(10))
                        .multilineTextAlignment(.center)
                        .foregroundStyle(HudPalette.muted)
                        .frame(maxWidth: 340)
                }

                HStack(spacing: HudSpacing.md) {
                    HudButton(
                        workspace.isConnecting ? "Connecting" : "Connect",
                        icon: "terminal",
                        style: .primary(.cyan)
                    ) {
                        Task { await workspace.connect() }
                    }
                    .disabled(!workspace.canConnect)

                    HudButton("Load env", icon: "arrow.clockwise", style: .secondary) {
                        if workspace.loadEnvironmentConfigurationIfAvailable() {
                            Task { await workspace.connect() }
                        }
                    }
                }
            }
            .padding(HudSpacing.huge)
        }
    }

    private func reportState() {
        let size = workspace.terminalSize
        onStateChange(
            HudTerminalSessionState(
                isConnected: workspace.isConnected,
                isConnecting: workspace.isConnecting,
                statusMessage: workspace.statusMessage,
                columns: size?.columns,
                rows: size?.rows
            )
        )
    }

}
