import SwiftUI
import HudsonUI
import HudsonObservability

public struct HudVoicePanel: View {
    @State private var session: HudVoxLiveSession?
    @State private var listenTask: Task<Void, Never>?
    @State private var state: HudVoiceSessionState = .done
    @State private var transcript = ""
    @State private var partial = ""
    @State private var errorMessage: String?
    @State private var health: HudVoxHealth?
    @State private var hasCheckedHealth = false
    @State private var isCheckingHealth = false

    private let endpoint: HudVoxEndpoint
    private let options: HudVoxLiveSessionOptions

    public init(endpoint: HudVoxEndpoint = HudVoxEndpoint(), options: HudVoxLiveSessionOptions = HudVoxLiveSessionOptions()) {
        self.endpoint = endpoint
        self.options = options
    }

    public var body: some View {
        HudCard {
            VStack(alignment: .leading, spacing: HudSpacing.xl) {
                header
                transcriptSurface
                controls
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .onDisappear {
            listenTask?.cancel()
            session?.close()
        }
    }

    private var header: some View {
        HStack(spacing: HudSpacing.lg) {
            HudStatusDot(color: statusColor, size: 8, pulses: state == .recording)

            VStack(alignment: .leading, spacing: 2) {
                Text("Vox")
                    .font(HudFont.mono(13, weight: .semibold))
                    .foregroundStyle(HudPalette.ink)
                Text(endpoint.url.absoluteString)
                    .font(HudFont.mono(10))
                    .foregroundStyle(HudPalette.dim)
            }

            Spacer()
            HudBadge(statusLabel, tint: statusColor)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Vox \(statusLabel)")
    }

    private var transcriptSurface: some View {
        HudInset {
            VStack(alignment: .leading, spacing: HudSpacing.md) {
                Text(displayText)
                    .font(HudFont.ui(13))
                    .foregroundStyle(transcript.isEmpty && partial.isEmpty ? HudPalette.dim : HudPalette.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, minHeight: 136, alignment: .topLeading)

                if let errorMessage {
                    HudDivider()
                    Text(errorMessage)
                        .font(HudFont.mono(10))
                        .foregroundStyle(HudPalette.statusError)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .accessibilityLabel(displayText)
    }

    private var controls: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: HudSpacing.md) {
                primaryControls
                Spacer(minLength: HudSpacing.lg)
                secondaryControls
            }

            VStack(alignment: .leading, spacing: HudSpacing.md) {
                primaryControls
                secondaryControls
            }
        }
    }

    private var primaryControls: some View {
        HStack(spacing: HudSpacing.md) {
            // Voice control min-widths sized to fit each label without resize jitter.
            // hudlint:disable next-line geometry
            listenButton.frame(minWidth: 118)
            // hudlint:disable next-line geometry
            stopButton.frame(minWidth: 96)
            // hudlint:disable next-line geometry
            cancelButton.frame(minWidth: 104)
        }
    }

    private var secondaryControls: some View {
        HStack(spacing: HudSpacing.md) {
            // hudlint:disable next-line geometry
            checkButton.frame(minWidth: 104)
            // hudlint:disable next-line geometry
            clearButton.frame(minWidth: 96)
        }
    }

    private var listenButton: some View {
        HudButton("Listen", icon: "waveform", style: .primary(.cyan)) {
            Task { await startListening() }
        }
        .disabled(session != nil || isCheckingHealth)
    }

    private var stopButton: some View {
        HudButton("Stop", icon: "stop.fill", style: .secondary) {
            Task { await stopListening() }
        }
        .disabled(session == nil)
    }

    private var cancelButton: some View {
        HudButton("Cancel", icon: "xmark", style: .ghost) {
            Task { await cancelListening() }
        }
        .disabled(session == nil)
    }

    private var checkButton: some View {
        HudButton("Check", icon: "stethoscope", style: .ghost) {
            Task { await refreshHealth() }
        }
        .disabled(isCheckingHealth)
    }

    private var clearButton: some View {
        HudButton("Clear", icon: "trash", style: .ghost) {
            transcript = ""
            partial = ""
            errorMessage = nil
        }
    }

    private var displayText: String {
        if transcript.isEmpty && partial.isEmpty {
            if !hasCheckedHealth {
                return "Vox has not been checked yet. Use Check to verify the local companion, or Listen to check and start a live session."
            }
            if let health {
                return "\(health.service) \(health.version) is reachable. Start a live session to capture speech from the local companion."
            }
            return "Vox is not reachable at \(endpoint.url.absoluteString). Launch Vox and check again."
        }
        if partial.isEmpty {
            return transcript
        }
        return [transcript, partial].filter { !$0.isEmpty }.joined(separator: "\n")
    }

    private var statusColor: Color {
        if !hasCheckedHealth && state == .done {
            return HudPalette.statusInfo
        }
        if health == nil && state == .done {
            return HudPalette.statusError
        }

        switch state {
        case .recording:
            return HudPalette.statusOk
        case .starting, .processing:
            return HudPalette.statusWarn
        case .error:
            return HudPalette.statusError
        case .done, .cancelled:
            return HudPalette.statusInfo
        }
    }

    private var statusLabel: String {
        if isCheckingHealth {
            return "CHECKING"
        }
        if !hasCheckedHealth && state == .done {
            return "UNCHECKED"
        }
        if health == nil && state == .done {
            return "OFFLINE"
        }
        return state.rawValue.uppercased()
    }

    @MainActor
    private func refreshHealth() async {
        HudInstrumentation.ui.event("Voice.check", metadata: voiceMetadata(status: "start"))
        isCheckingHealth = true
        defer {
            hasCheckedHealth = true
            isCheckingHealth = false
        }

        do {
            health = try await HudInstrumentation.ui.span("Voice.check.health", metadata: voiceMetadata(status: "pending")) {
                try await HudVoxProbe.health(endpoint: endpoint, clientId: options.clientId)
            }
            if state == .error {
                state = .done
            }
            errorMessage = nil
            HudInstrumentation.ui.event("Voice.check.result", metadata: voiceMetadata(status: "ok"))
        } catch {
            health = nil
            errorMessage = error.localizedDescription
            HudInstrumentation.ui.event("Voice.check.result", metadata: voiceMetadata(status: "error"))
        }
    }

    @MainActor
    private func startListening() async {
        guard session == nil else {
            HudInstrumentation.ui.event("Voice.listen", metadata: voiceMetadata(status: "ignored"))
            return
        }
        HudInstrumentation.ui.event("Voice.listen", metadata: voiceMetadata(status: "start"))
        if health == nil {
            await refreshHealth()
        }
        guard health != nil else {
            HudInstrumentation.ui.event("Voice.listen.result", metadata: voiceMetadata(status: "offline"))
            return
        }

        errorMessage = nil
        partial = ""
        state = .starting

        let nextSession = HudVoxLiveSession(endpoint: endpoint, options: options)
        session = nextSession

        do {
            let events = try await HudInstrumentation.ui.span("Voice.listen.start", metadata: voiceMetadata(status: "pending")) {
                try await nextSession.start()
            }
            HudInstrumentation.ui.event("Voice.listen.result", metadata: voiceMetadata(status: "ok"))
            listenTask = Task {
                do {
                    for try await event in events {
                        await MainActor.run {
                            apply(event)
                        }
                    }
                    await MainActor.run {
                        HudInstrumentation.ui.event("Voice.listen.stream", metadata: voiceMetadata(status: "finished"))
                    }
                } catch {
                    await MainActor.run {
                        errorMessage = error.localizedDescription
                        state = .error
                        session = nil
                        HudInstrumentation.ui.event("Voice.listen.stream", metadata: voiceMetadata(status: "error"))
                    }
                }
            }
        } catch {
            errorMessage = error.localizedDescription
            state = .error
            session = nil
            HudInstrumentation.ui.event("Voice.listen.result", metadata: voiceMetadata(status: "error"))
        }
    }

    @MainActor
    private func stopListening() async {
        HudInstrumentation.ui.event("Voice.stop", metadata: voiceMetadata(status: "start"))
        let currentSession = session
        do {
            try await HudInstrumentation.ui.span("Voice.stop.request", metadata: voiceMetadata(status: "pending")) {
                try await currentSession?.stop()
            }
            HudInstrumentation.ui.event("Voice.stop.result", metadata: voiceMetadata(status: "ok"))
        } catch {
            errorMessage = error.localizedDescription
            state = .error
            HudInstrumentation.ui.event("Voice.stop.result", metadata: voiceMetadata(status: "error"))
        }
    }

    @MainActor
    private func cancelListening() async {
        HudInstrumentation.ui.event("Voice.cancel", metadata: voiceMetadata(status: "start"))
        let currentSession = session
        var status = "ok"
        do {
            try await HudInstrumentation.ui.span("Voice.cancel.request", metadata: voiceMetadata(status: "pending")) {
                try await currentSession?.cancel()
            }
        } catch {
            errorMessage = error.localizedDescription
            status = "error"
        }
        listenTask?.cancel()
        listenTask = nil
        session = nil
        state = .cancelled
        partial = ""
        HudInstrumentation.ui.event("Voice.cancel.result", metadata: voiceMetadata(status: status))
    }

    @MainActor
    private func apply(_ event: HudVoiceEvent) {
        switch event {
        case .state(let payload):
            state = payload.state
            if payload.state == .done || payload.state == .cancelled || payload.state == .error {
                session = nil
            }
        case .partial(let payload):
            partial = payload.text
        case .final(let payload):
            partial = ""
            if !payload.text.isEmpty {
                transcript = [transcript, payload.text].filter { !$0.isEmpty }.joined(separator: "\n")
            }
        case .raw:
            break
        }
    }

    private func voiceMetadata(status: String) -> [String: String] {
        [
            "hasCheckedHealth": hudsonBool(hasCheckedHealth),
            "hasHealth": hudsonBool(health != nil),
            "hasSession": hudsonBool(session != nil),
            "isCheckingHealth": hudsonBool(isCheckingHealth),
            "state": state.rawValue,
            "status": status,
        ]
    }
}

private func hudsonBool(_ value: Bool) -> String {
    value ? "true" : "false"
}
