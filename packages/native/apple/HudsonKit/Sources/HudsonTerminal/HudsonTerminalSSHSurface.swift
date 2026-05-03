import SwiftUI
import HudsonUI
import TermBridgeKit

public struct HudsonTerminalSessionState: Equatable, Sendable {
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
/// Hudson transports should keep using `HudsonTerminalSurface` directly.
public struct HudsonTerminalSSHSurface: View {
    public static let defaultConnection = TermBridgeKitConnectionConfig(
        name: "Hudson Terminal",
        startupCommand: "tmux new -A -s hudson"
    )

    @State private var workspace: TermBridgeKitSSHWorkspace
    @State private var didAttemptEnvironmentLoad = false

    private let hostLabel: String
    private let autoConnect: Bool
    private let showsSystemKeyboard: Bool
    private let appearance: HudsonTerminalAppearance
    private let onStateChange: (HudsonTerminalSessionState) -> Void

    public init(
        hostLabel: String = "SSH host",
        connection: TermBridgeKitConnectionConfig = Self.defaultConnection,
        autoConnect: Bool = true,
        showsSystemKeyboard: Bool = true,
        appearance: HudsonTerminalAppearance = .default,
        onStateChange: @escaping (HudsonTerminalSessionState) -> Void = { _ in }
    ) {
        self._workspace = State(initialValue: TermBridgeKitSSHWorkspace(connection: connection))
        self.hostLabel = hostLabel
        self.autoConnect = autoConnect
        self.showsSystemKeyboard = showsSystemKeyboard
        self.appearance = appearance
        self.onStateChange = onStateChange
    }

    public var body: some View {
        HudsonTerminalSurface(
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

            VStack(spacing: HudsonSpacing.xl) {
                HudsonStatusDot(
                    color: workspace.isConnecting ? HudsonPalette.statusWarn : HudsonPalette.statusInfo,
                    size: 8,
                    pulses: workspace.isConnecting
                )

                VStack(spacing: HudsonSpacing.sm) {
                    Text(hostLabel)
                        .font(HudsonFont.mono(12, weight: .semibold))
                        .foregroundStyle(HudsonPalette.ink)
                    Text(workspace.statusMessage)
                        .font(HudsonFont.mono(10))
                        .multilineTextAlignment(.center)
                        .foregroundStyle(HudsonPalette.muted)
                        .frame(maxWidth: 340)
                }

                HStack(spacing: HudsonSpacing.md) {
                    HudsonButton(
                        workspace.isConnecting ? "Connecting" : "Connect",
                        icon: "terminal",
                        style: .primary(.cyan)
                    ) {
                        Task { await workspace.connect() }
                    }
                    .disabled(!workspace.canConnect)

                    HudsonButton("Load env", icon: "arrow.clockwise", style: .secondary) {
                        if workspace.loadEnvironmentConfigurationIfAvailable() {
                            Task { await workspace.connect() }
                        }
                    }
                }
            }
            .padding(HudsonSpacing.huge)
        }
    }

    private func reportState() {
        let size = workspace.terminalSize
        onStateChange(
            HudsonTerminalSessionState(
                isConnected: workspace.isConnected,
                isConnecting: workspace.isConnecting,
                statusMessage: workspace.statusMessage,
                columns: size?.columns,
                rows: size?.rows
            )
        )
    }

}
