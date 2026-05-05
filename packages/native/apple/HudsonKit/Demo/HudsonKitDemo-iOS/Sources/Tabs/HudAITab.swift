import SwiftUI
import HudsonAI
import HudsonUI

struct HudAITab: View {
    @State private var apiKey: String = ""
    @State private var prompt: String = "Write one sentence about HudsonKit."
    @State private var transcript: String = ""
    @State private var status: String = "Idle"
    @State private var usage: HudAIUsage? = nil
    @State private var isSending = false

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
        .onAppear(perform: loadKey)
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
            VStack(alignment: .leading, spacing: HudSpacing.lg) {
                HudSectionLabel("Prompt")
                HudField("Ask HudAI…", text: $prompt, icon: "text.bubble")
                HudButton(isSending ? "Streaming" : "Send", icon: "paperplane.fill", style: .primary(.cyan)) {
                    send()
                }
                .disabled(isSending || prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
    }

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

    private func send() {
        guard !isSending else { return }
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

        let currentPrompt = prompt
        let currentVault = vault
        Task {
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
                    await handle(event)
                }
                await MainActor.run {
                    isSending = false
                    if status == "Starting stream…" { status = "Stream finished." }
                }
            } catch {
                await MainActor.run {
                    status = error.localizedDescription
                    isSending = false
                }
            }
        }
    }

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
