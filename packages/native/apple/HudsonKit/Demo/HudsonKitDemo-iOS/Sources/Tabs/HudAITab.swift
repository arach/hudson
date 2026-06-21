import SwiftUI
import HudsonAI
import HudsonUI
#if HUDSON_VOICE
import HudsonVoice
#endif

struct HudAITab: View {
    @State private var apiKey: String = ""
    @State private var prompt: String = "Write one sentence about HudsonKit."
    @State private var transcript: String = ""
    @State private var status: String = "Idle"
    @State private var usage: HudAIUsage? = nil
    @State private var isSending = false
    @State private var sendTask: Task<Void, Never>? = nil
    @FocusState private var promptFocused: Bool

    #if HUDSON_VOICE
    @State private var dictation = HudDictation()
    @State private var micPulse = false
    #endif

    private let vault = HudVault(service: "com.hudsonkit.demoios.ai")
    private let credentialKey = "anthropic_key"

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: HudSpacing.xxl) {
                intro
                credentials
                composer
                response
                usageView
            }
            .padding(.horizontal, HudSpacing.xl)
            .padding(.top, HudSpacing.lg)
            .padding(.bottom, HudSpacing.huge)
        }
        .background(HudPalette.bg)
        .onAppear {
            loadKey()
            #if HUDSON_VOICE
            dictation.prepare()
            #endif
        }
        .onDisappear {
            sendTask?.cancel()
            sendTask = nil
            #if HUDSON_VOICE
            if dictation.isListening { dictation.cancel() }
            #endif
        }
        #if HUDSON_VOICE
        .onChange(of: dictation.finalCount) { _, _ in
            appendDictation(dictation.finalText)
        }
        .onChange(of: dictation.state) { _, state in
            updatePulse(for: state)
        }
        #endif
    }

    private var intro: some View {
        VStack(alignment: .leading, spacing: HudSpacing.sm) {
            HudSectionLabel("HudAI")
            Text("Streaming Anthropic chat demo backed by HudVault credentials and the provider-neutral HudAI event model.")
                .font(HudFont.ui(HudTextSize.sm))
                .foregroundStyle(HudPalette.muted)
        }
    }

    private var credentials: some View {
        HudInset {
            VStack(alignment: .leading, spacing: HudSpacing.lg) {
                HudSectionLabel("Credential")
                HudSecretField("Anthropic API key", text: $apiKey)
                HStack(spacing: HudSpacing.md) {
                    HudButton("Save key", icon: "key", style: .secondary) {
                        saveKey()
                    }
                    HudButton("Clear", icon: "trash", style: .ghost) {
                        clearKey()
                    }
                }
                Text(status)
                    .font(HudFont.mono(HudTextSize.xs))
                    .foregroundStyle(HudPalette.dim)
            }
        }
    }

    private var composer: some View {
        HudInset {
            VStack(alignment: .leading, spacing: HudSpacing.md) {
                HudSectionLabel("Prompt")
                HudComposer(
                    text: $prompt,
                    phase: isSending ? .streaming : .idle,
                    style: HudComposerStyle(
                        placeholder: composerPlaceholder,
                        fontSize: HudTextSize.base,
                        lineLimit: 1...5,
                        fieldHorizontalPadding: HudSpacing.xl,
                        fieldVerticalPadding: HudSpacing.lg,
                        fieldCornerRadius: HudRadius.card,
                        controlSize: HudIconSize.medium
                    ),
                    layout: .stacked,
                    focus: $promptFocused,
                    trailingAccessory: { dictationAccessory },
                    onAction: handleComposerAction,
                    model: HudComposerModelInfo(model: "Anthropic", effort: composerEffortLabel)
                )
                dictationStatus
            }
        }
    }

    private var composerPlaceholder: String {
        #if HUDSON_VOICE
        switch dictation.state {
        case .listening:
            let partial = dictation.partialText.trimmingCharacters(in: .whitespacesAndNewlines)
            return partial.isEmpty ? "Listening…" : partial
        case .transcribing:
            return "Transcribing…"
        case .preparing:
            return "Ask HudAI…"
        case .unavailable:
            return "Type while voice is unavailable…"
        case .idle:
            return "Dictate or type a prompt…"
        }
        #else
        return "Ask HudAI…"
        #endif
    }

    private var composerEffortLabel: String? {
        #if HUDSON_VOICE
        if dictation.modelReady { return "dictation ready" }
        if dictation.modelInstalled { return "dictation installed" }
        return "voice input"
        #else
        return nil
        #endif
    }

    @ViewBuilder
    private var dictationAccessory: some View {
        #if HUDSON_VOICE
        Button {
            dictation.toggle()
        } label: {
            ZStack {
                if dictation.isListening {
                    Circle()
                        .fill(HudSurface.tintAccent(HudPalette.accent))
                        .frame(width: HudIconSize.medium, height: HudIconSize.medium)
                        .scaleEffect(micPulse ? 1 : 0.86)
                        .opacity(micPulse ? HudOpacity.strong : HudOpacity.soft)
                }
                Image(systemName: dictationIconName)
                    .font(HudFont.ui(HudTextSize.base, weight: .semibold))
                    .foregroundStyle(dictationIconColor)
                    .frame(width: HudIconSize.medium, height: HudIconSize.medium)
                    .contentShape(Circle())
            }
        }
        .buttonStyle(.plain)
        .disabled(isSending)
        .help("Dictate prompt")
        #else
        Image(systemName: "mic.slash")
            .font(HudFont.ui(HudTextSize.base, weight: .semibold))
            .foregroundStyle(HudPalette.dim)
            .frame(width: HudIconSize.medium, height: HudIconSize.medium)
            .help("Build with HUDSON_VOICE to enable dictation")
        #endif
    }

    @ViewBuilder
    private var dictationStatus: some View {
        #if HUDSON_VOICE
        if let status = dictationStatusLine {
            HStack(spacing: HudSpacing.sm) {
                HudStatusDot(color: dictationStatusColor, size: HudDotSize.small, pulses: dictation.isListening)
                Text(status)
                    .font(HudFont.mono(HudTextSize.xs))
                    .foregroundStyle(HudPalette.dim)
                    .lineLimit(2)
            }
        }
        #else
        HStack(spacing: HudSpacing.sm) {
            HudStatusDot(color: HudPalette.statusWarn, size: HudDotSize.small)
            Text("Voice dictation is not compiled into this build.")
                .font(HudFont.mono(HudTextSize.xs))
                .foregroundStyle(HudPalette.dim)
        }
        #endif
    }

    #if HUDSON_VOICE
    private var dictationIconName: String {
        switch dictation.state {
        case .listening:
            return "mic.fill"
        case .preparing, .transcribing:
            return "waveform"
        case .unavailable:
            return "mic.slash"
        case .idle:
            return "mic"
        }
    }

    private var dictationIconColor: Color {
        switch dictation.state {
        case .listening:
            return HudPalette.accent
        case .preparing, .transcribing:
            return HudPalette.statusInfo
        case .unavailable:
            return HudPalette.statusError
        case .idle:
            return HudPalette.muted
        }
    }

    private var dictationStatusColor: Color {
        switch dictation.state {
        case .listening:
            return HudPalette.accent
        case .preparing, .transcribing:
            return HudPalette.statusInfo
        case .unavailable:
            return HudPalette.statusError
        case .idle:
            return HudPalette.statusOk
        }
    }

    private var dictationStatusLine: String? {
        switch dictation.state {
        case .listening:
            let partial = dictation.partialText.trimmingCharacters(in: .whitespacesAndNewlines)
            return partial.isEmpty ? "Listening…" : partial
        case .transcribing:
            return "Transcribing dictation…"
        case .preparing(let progress):
            return "Preparing voice \(Int(progress * 100))%"
        case .unavailable(let reason):
            return reason
        case .idle:
            return dictation.modelReady ? "Dictation ready." : nil
        }
    }
    #endif

    private var response: some View {
        HudInset {
            VStack(alignment: .leading, spacing: HudSpacing.md) {
                HudSectionLabel("Assistant")
                if transcript.isEmpty {
                    Text("Response deltas appear here as they stream.")
                        .font(HudFont.ui(HudTextSize.sm))
                        .foregroundStyle(HudPalette.dim)
                } else {
                    Text(transcript)
                        .font(HudFont.ui(HudTextSize.md))
                        .foregroundStyle(HudPalette.ink)
                }
            }
        }
    }

    @ViewBuilder
    private var usageView: some View {
        if let usage {
            HudInset {
                VStack(alignment: .leading, spacing: HudSpacing.md) {
                    HudSectionLabel("Usage")
                    HudKVRow("input", value: "\(usage.inputTokens)")
                    HudKVRow("output", value: "\(usage.outputTokens)")
                    HudKVRow("cache created", value: "\(usage.cacheCreationInputTokens)")
                    HudKVRow("cache hits", value: "\(usage.cacheReadInputTokens)")
                }
            }
        }
    }

    private func loadKey() {
        do {
            apiKey = try vault.getString(credentialKey) ?? ""
            status = apiKey.isEmpty ? "Add an Anthropic key to stream locally." : "Loaded key from HudVault."
        } catch {
            status = error.localizedDescription
        }
    }

    private func saveKey() {
        do {
            try vault.setString(credentialKey, apiKey)
            status = "Saved key to HudVault."
        } catch {
            status = error.localizedDescription
        }
    }

    private func clearKey() {
        do {
            try vault.delete(credentialKey)
            apiKey = ""
            status = "Deleted key from HudVault."
        } catch {
            status = error.localizedDescription
        }
    }

    private func handleComposerAction(_ action: HudComposerAction) {
        switch action {
        case .submit, .steer:
            send()
        case .queue:
            status = "Finish or stop the current stream before sending another prompt."
        case .stop:
            stopSending()
        }
    }

    private func send() {
        guard !isSending else { return }
        let currentPrompt = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !currentPrompt.isEmpty else { return }
        do {
            try vault.setString(credentialKey, apiKey)
        } catch {
            status = error.localizedDescription
            return
        }

        isSending = true
        transcript = ""
        usage = nil
        status = "Starting stream…"

        let currentVault = vault
        sendTask = Task {
            let client = HudAIClient(
                provider: HudAIProviders.Anthropic(),
                hudVault: currentVault,
                defaults: HudAIDefaults(maxOutputTokens: 512, cache: .automatic())
            )
            let request = HudAIRequest(
                messages: [.user(currentPrompt)],
                system: "You are a concise assistant inside the HudsonKit iOS demo."
            )

            do {
                for try await event in client.stream(request) {
                    guard !Task.isCancelled else { break }
                    handle(event)
                }
                await MainActor.run {
                    isSending = false
                    sendTask = nil
                    if status == "Starting stream…" { status = "Stream finished." }
                }
            } catch {
                await MainActor.run {
                    status = Task.isCancelled ? "Cancelled." : error.localizedDescription
                    isSending = false
                    sendTask = nil
                }
            }
        }
    }

    private func stopSending() {
        guard isSending else { return }
        sendTask?.cancel()
        sendTask = nil
        isSending = false
        status = "Cancelled."
    }

    #if HUDSON_VOICE
    private func appendDictation(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        guard !prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            prompt = trimmed
            return
        }

        prompt += (prompt.last?.isWhitespace == true ? "" : " ") + trimmed
        promptFocused = true
    }

    private func updatePulse(for state: HudDictation.State) {
        micPulse = false
        if case .listening = state {
            withAnimation(HudMotion.quickFade.repeatForever(autoreverses: true)) {
                micPulse = true
            }
        }
    }
    #endif

    @MainActor
    private func handle(_ event: HudAIStreamEvent) {
        switch event {
        case .started(_, _, let model):
            status = "Streaming with \(model)."
        case .textDelta(_, let text):
            transcript += text
        case .usage(let nextUsage):
            usage = nextUsage
        case .completed(let response):
            usage = response.usage
            status = "Finished."
        case .failed(let error):
            status = error.localizedDescription
        case .cancelled:
            status = "Cancelled."
        default:
            break
        }
    }
}
