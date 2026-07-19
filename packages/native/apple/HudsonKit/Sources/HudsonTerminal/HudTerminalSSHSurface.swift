import SwiftUI
import HudsonUI

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

/// Complete SSH-backed terminal for simple hosts. Advanced hosts can create a
/// `HudTerminalSSHSession`, perform their own provisioning, and pass that same
/// session to this surface or `HudTerminalSurface` without importing Termini.
public struct HudTerminalSSHSurface: View {
    public static let defaultConnection = HudTerminalSSHConnection(
        name: "Hudson Terminal",
        startup: .shell(command: "tmux new -A -s hudson")
    )

    @State private var session: HudTerminalSSHSession
    @State private var didAttemptEnvironmentLoad = false
    @Environment(\.colorScheme) private var colorScheme

    private let hostLabel: String
    private let autoConnect: Bool
    private let showsSystemKeyboard: Bool
    private let appearance: HudTerminalAppearance
    private let onStateChange: (HudTerminalSessionState) -> Void

    public init(
        hostLabel: String = "SSH host",
        connection: HudTerminalSSHConnection = Self.defaultConnection,
        autoConnect: Bool = true,
        showsSystemKeyboard: Bool = true,
        appearance: HudTerminalAppearance = .default,
        onStateChange: @escaping (HudTerminalSessionState) -> Void = { _ in }
    ) {
        self._session = State(initialValue: HudTerminalSSHSession(connection: connection))
        self.hostLabel = hostLabel
        self.autoConnect = autoConnect
        self.showsSystemKeyboard = showsSystemKeyboard
        self.appearance = appearance
        self.onStateChange = onStateChange
    }

    public init(
        session: HudTerminalSSHSession,
        hostLabel: String = "SSH host",
        autoConnect: Bool = false,
        showsSystemKeyboard: Bool = true,
        appearance: HudTerminalAppearance = .default,
        onStateChange: @escaping (HudTerminalSessionState) -> Void = { _ in }
    ) {
        self._session = State(initialValue: session)
        self.hostLabel = hostLabel
        self.autoConnect = autoConnect
        self.showsSystemKeyboard = showsSystemKeyboard
        self.appearance = appearance
        self.onStateChange = onStateChange
    }

    public var body: some View {
        HudTerminalSurface(
            session: session,
            showsSystemKeyboard: showsSystemKeyboard,
            appearance: resolvedAppearance
        )
        .overlay {
            if !session.isConnected {
                statusOverlay
            }
        }
        .task {
            guard autoConnect, !didAttemptEnvironmentLoad else { return }
            didAttemptEnvironmentLoad = true

            if session.loadEnvironmentConfigurationIfAvailable() {
                await session.connect()
            } else {
                reportState()
            }
        }
        .onChange(of: session.statusMessage) { _, _ in reportState() }
        .onChange(of: session.snapshot.grid) { _, _ in reportState() }
    }

    private var statusOverlay: some View {
        ZStack {
            HudSurface.statusOverlayBackdrop(resolvedAppearance.backgroundColor)

            VStack(spacing: HudSpacing.xl) {
                HudStatusDot(
                    color: session.isConnecting ? HudPalette.statusWarn : HudPalette.statusInfo,
                    size: 8,
                    pulses: session.isConnecting
                )

                VStack(spacing: HudSpacing.sm) {
                    Text(hostLabel)
                        .font(HudFont.mono(12, weight: .semibold))
                        .foregroundStyle(HudPalette.ink)
                    Text(session.statusMessage)
                        .font(HudFont.mono(HudTextSize.xxs))
                        .multilineTextAlignment(.center)
                        .foregroundStyle(HudPalette.muted)
                        .frame(maxWidth: HudLayout.popoverWidthCompact)
                }

                HStack(spacing: HudSpacing.md) {
                    HudButton(
                        session.isConnecting ? "Connecting" : "Connect",
                        icon: "terminal",
                        style: .primary(.cyan)
                    ) {
                        Task { await session.connect() }
                    }
                    .disabled(!session.canConnect)

                    HudButton("Load env", icon: "arrow.clockwise", style: .secondary) {
                        if session.loadEnvironmentConfigurationIfAvailable() {
                            Task { await session.connect() }
                        }
                    }
                }
            }
            .padding(HudSpacing.huge)
        }
    }

    private func reportState() {
        let snapshot = session.snapshot
        onStateChange(
            HudTerminalSessionState(
                isConnected: snapshot.status == .connected,
                isConnecting: snapshot.status == .connecting,
                statusMessage: snapshot.statusMessage,
                columns: snapshot.grid?.columns,
                rows: snapshot.grid?.rows
            )
        )
    }

    private var resolvedAppearance: HudTerminalAppearance {
        appearance == .default
            ? HudTerminalAppearance.hudsonDefault(for: colorScheme)
            : appearance
    }
}
