import SwiftUI
import HudsonUI
import HudsonObservability

public struct HudsonVoicePanel: View {
    @State private var session: HudsonVoxLiveSession?
    @State private var listenTask: Task<Void, Never>?
    @State private var state: HudsonVoiceSessionState = .done
    @State private var transcript = ""
    @State private var partial = ""
    @State private var errorMessage: String?
    @State private var health: HudsonVoxHealth?
    @State private var hasCheckedHealth = false
    @State private var isCheckingHealth = false

    private let endpoint: HudsonVoxEndpoint
    private let options: HudsonVoxLiveSessionOptions

    public init(endpoint: HudsonVoxEndpoint = HudsonVoxEndpoint(), options: HudsonVoxLiveSessionOptions = HudsonVoxLiveSessionOptions()) {
        self.endpoint = endpoint
        self.options = options
    }

    public var body: some View {
        HudsonCard {
            VStack(alignment: .leading, spacing: HudsonSpacing.xl) {
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
        HStack(spacing: HudsonSpacing.lg) {
            HudsonStatusDot(color: statusColor, size: 8, pulses: state == .recording)

            VStack(alignment: .leading, spacing: 2) {
                Text("Vox")
                    .font(HudsonFont.mono(13, weight: .semibold))
                    .foregroundStyle(HudsonPalette.ink)
                Text(endpoint.url.absoluteString)
                    .font(HudsonFont.mono(10))
                    .foregroundStyle(HudsonPalette.dim)
            }

            Spacer()
            HudsonBadge(statusLabel, tint: statusColor)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Vox \(statusLabel)")
    }

    private var transcriptSurface: some View {
        HudsonInset {
            VStack(alignment: .leading, spacing: HudsonSpacing.md) {
                Text(displayText)
                    .font(HudsonFont.ui(13))
                    .foregroundStyle(transcript.isEmpty && partial.isEmpty ? HudsonPalette.dim : HudsonPalette.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, minHeight: 136, alignment: .topLeading)

                if let errorMessage {
                    HudsonDivider()
                    Text(errorMessage)
                        .font(HudsonFont.mono(10))
                        .foregroundStyle(HudsonPalette.statusError)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .accessibilityLabel(displayText)
    }

    private var controls: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: HudsonSpacing.md) {
                primaryControls
                Spacer(minLength: HudsonSpacing.lg)
                secondaryControls
            }

            VStack(alignment: .leading, spacing: HudsonSpacing.md) {
                primaryControls
                secondaryControls
            }
        }
    }

    private var primaryControls: some View {
        HStack(spacing: HudsonSpacing.md) {
            listenButton
                .frame(minWidth: 118)
            stopButton
                .frame(minWidth: 96)
            cancelButton
                .frame(minWidth: 104)
        }
    }

    private var secondaryControls: some View {
        HStack(spacing: HudsonSpacing.md) {
            checkButton
                .frame(minWidth: 104)
            clearButton
                .frame(minWidth: 96)
        }
    }

    private var listenButton: some View {
        HudsonButton("Listen", icon: "waveform", style: .primary(.cyan)) {
            Task { await startListening() }
        }
        .disabled(session != nil || isCheckingHealth)
    }

    private var stopButton: some View {
        HudsonButton("Stop", icon: "stop.fill", style: .secondary) {
            Task { await stopListening() }
        }
        .disabled(session == nil)
    }

    private var cancelButton: some View {
        HudsonButton("Cancel", icon: "xmark", style: .ghost) {
            Task { await cancelListening() }
        }
        .disabled(session == nil)
    }

    private var checkButton: some View {
        HudsonButton("Check", icon: "stethoscope", style: .ghost) {
            Task { await refreshHealth() }
        }
        .disabled(isCheckingHealth)
    }

    private var clearButton: some View {
        HudsonButton("Clear", icon: "trash", style: .ghost) {
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
            return HudsonPalette.statusInfo
        }
        if health == nil && state == .done {
            return HudsonPalette.statusError
        }

        switch state {
        case .recording:
            return HudsonPalette.statusOk
        case .starting, .processing:
            return HudsonPalette.statusWarn
        case .error:
            return HudsonPalette.statusError
        case .done, .cancelled:
            return HudsonPalette.statusInfo
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
        HInstrumentation.ui.event("Voice.check", metadata: voiceMetadata(status: "start"))
        isCheckingHealth = true
        defer {
            hasCheckedHealth = true
            isCheckingHealth = false
        }

        do {
            health = try await HInstrumentation.ui.span("Voice.check.health", metadata: voiceMetadata(status: "pending")) {
                try await HudsonVoxProbe.health(endpoint: endpoint, clientId: options.clientId)
            }
            if state == .error {
                state = .done
            }
            errorMessage = nil
            HInstrumentation.ui.event("Voice.check.result", metadata: voiceMetadata(status: "ok"))
        } catch {
            health = nil
            errorMessage = error.localizedDescription
            HInstrumentation.ui.event("Voice.check.result", metadata: voiceMetadata(status: "error"))
        }
    }

    @MainActor
    private func startListening() async {
        guard session == nil else {
            HInstrumentation.ui.event("Voice.listen", metadata: voiceMetadata(status: "ignored"))
            return
        }
        HInstrumentation.ui.event("Voice.listen", metadata: voiceMetadata(status: "start"))
        if health == nil {
            await refreshHealth()
        }
        guard health != nil else {
            HInstrumentation.ui.event("Voice.listen.result", metadata: voiceMetadata(status: "offline"))
            return
        }

        errorMessage = nil
        partial = ""
        state = .starting

        let nextSession = HudsonVoxLiveSession(endpoint: endpoint, options: options)
        session = nextSession

        do {
            let events = try await HInstrumentation.ui.span("Voice.listen.start", metadata: voiceMetadata(status: "pending")) {
                try await nextSession.start()
            }
            HInstrumentation.ui.event("Voice.listen.result", metadata: voiceMetadata(status: "ok"))
            listenTask = Task {
                do {
                    for try await event in events {
                        await MainActor.run {
                            apply(event)
                        }
                    }
                    await MainActor.run {
                        HInstrumentation.ui.event("Voice.listen.stream", metadata: voiceMetadata(status: "finished"))
                    }
                } catch {
                    await MainActor.run {
                        errorMessage = error.localizedDescription
                        state = .error
                        session = nil
                        HInstrumentation.ui.event("Voice.listen.stream", metadata: voiceMetadata(status: "error"))
                    }
                }
            }
        } catch {
            errorMessage = error.localizedDescription
            state = .error
            session = nil
            HInstrumentation.ui.event("Voice.listen.result", metadata: voiceMetadata(status: "error"))
        }
    }

    @MainActor
    private func stopListening() async {
        HInstrumentation.ui.event("Voice.stop", metadata: voiceMetadata(status: "start"))
        let currentSession = session
        do {
            try await HInstrumentation.ui.span("Voice.stop.request", metadata: voiceMetadata(status: "pending")) {
                try await currentSession?.stop()
            }
            HInstrumentation.ui.event("Voice.stop.result", metadata: voiceMetadata(status: "ok"))
        } catch {
            errorMessage = error.localizedDescription
            state = .error
            HInstrumentation.ui.event("Voice.stop.result", metadata: voiceMetadata(status: "error"))
        }
    }

    @MainActor
    private func cancelListening() async {
        HInstrumentation.ui.event("Voice.cancel", metadata: voiceMetadata(status: "start"))
        let currentSession = session
        var status = "ok"
        do {
            try await HInstrumentation.ui.span("Voice.cancel.request", metadata: voiceMetadata(status: "pending")) {
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
        HInstrumentation.ui.event("Voice.cancel.result", metadata: voiceMetadata(status: status))
    }

    @MainActor
    private func apply(_ event: HudsonVoiceEvent) {
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
