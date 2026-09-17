import Foundation
import Testing
import HudsonConversation
import HudsonConversationOpenAI
import HudsonConversationGemini
@testable import HudsonConversationHost

private func document(_ mutate: (inout [String: Any]) -> Void = { _ in }) -> Data {
    var root: [String: Any] = [
        "format": "hudson-conversation-settings",
        "version": 1,
        "configuration": [
            "provider": "gemini-live-conversation",
            "model": "gemini-3.8-live-extended-thinking",
            "voice": "Kore",
            "inputSampleRate": 16000,
            "thinkingLevel": "medium",
        ],
        "credentialReference": "gemini-conversation-key",
        "credentialKind": "apiKey",
    ]
    mutate(&root)
    return (try? JSONSerialization.data(withJSONObject: root)) ?? Data()
}

private func setConfiguration(_ root: inout [String: Any], _ key: String, _ value: Any?) {
    var configuration = root["configuration"] as? [String: Any] ?? [:]
    configuration[key] = value
    root["configuration"] = configuration
}

private func decodeReason(_ data: Data) -> String? {
    do {
        _ = try HudConversationSettingsImport.decode(data)
        return nil
    } catch HudConversationError.invalidConfiguration(let reason) {
        return reason
    } catch HudConversationError.unsupported(let reason) {
        return reason
    } catch {
        return "unexpected error"
    }
}

@Test("A valid document decodes into a staged configuration with mapped credentials")
func decodeValidDocument() async throws {
    let staged = try HudConversationSettingsImport.decode(document())
    #expect(staged.configuration.providerID == HudGeminiConversationAdapter.providerID)
    #expect(staged.configuration.modelID.rawValue == "gemini-3.8-live-extended-thinking")
    #expect(staged.configuration.inputAudio.sampleRate == 16000)
    #expect(staged.configuration.thinkingLevel == .medium)
    #expect(staged.configuration.credentialReference?.identifier == "gemini-conversation-key")
    #expect(staged.configuration.credentialKind == .apiKey)
    #expect(await HudConversationSettingsImport.validate(staged) == nil)
}

@Test("A GPT-Live document with delegation options validates through the adapter rules")
func decodeGPTLiveDocument() async throws {
    let data = document { root in
        root["credentialKind"] = "apiKey"
        root["configuration"] = [
            "provider": "openai-gpt-live",
            "model": "gpt-live-1",
            "instructions": "Be brief.",
            "voice": "alloy",
            "inputSampleRate": 24000,
            "options": ["delegationModel": "gpt-5.2"],
        ]
    }
    let staged = try HudConversationSettingsImport.decode(data)
    #expect(staged.configuration.options["delegationModel"] == "gpt-5.2")
    #expect(await HudConversationSettingsImport.validate(staged) == nil)
}

@Test("Wrong format and unsupported versions are rejected explicitly")
func formatAndVersion() {
    // A different version is understood-but-unsupported, a distinct error
    // class from malformed input, matching the web importer.
    do {
        _ = try HudConversationSettingsImport.decode(document { $0["version"] = 2 })
        Issue.record("version 2 decoded")
    } catch HudConversationError.unsupported { /* expected class */ }
    catch { Issue.record("wrong error class for version mismatch") }
    #expect(decodeReason(document { $0["format"] = "other" })?.contains("not a hudson-conversation-settings") == true)
    #expect(decodeReason(document { $0["version"] = 2 })?.contains("not supported") == true)
    #expect(decodeReason(document { $0["version"] = "1" })?.contains("not supported") == true)
    // JSON true bridges to NSNumber and must not pass as version 1.
    #expect(decodeReason(document { $0["version"] = true })?.contains("not supported") == true)
}

@Test("Unknown fields at any level are errors, never silently ignored")
func unknownFields() {
    #expect(decodeReason(document { $0["consent"] = true })?.contains("unknown field \"consent\"") == true)
    #expect(decodeReason(document { setConfiguration(&$0, "apiKey", "oops") })?
        .contains("unknown field \"apiKey\"") == true)
}

@Test("Secret-shaped values are rejected anywhere in the document")
func secretShapes() {
    #expect(decodeReason(document { $0["credentialReference"] = "sk-live-abcdef" })?
        .contains("looks like a secret") == true)
    #expect(decodeReason(document { setConfiguration(&$0, "options", ["delegationModel": "AIzaSyExample"]) })?
        .contains("looks like a secret") == true)
    #expect(decodeReason(document { setConfiguration(&$0, "instructions", "Bearer abc.def") })?
        .contains("looks like a secret") == true)
    #expect(decodeReason(document { setConfiguration(&$0, "instructions", "-----BEGIN PRIVATE KEY-----") })?
        .contains("looks like a secret") == true)
}

@Test("Size and field bounds are enforced")
func bounds() {
    #expect(decodeReason(document { setConfiguration(&$0, "instructions", String(repeating: "a", count: 70_000)) })?
        .contains("limited to 65536 bytes") == true)
    #expect(decodeReason(document { setConfiguration(&$0, "voice", String(repeating: "v", count: 129)) })?
        .contains("exceeds 128 UTF-8 bytes") == true)
    // Bounds are UTF-8 bytes on both platforms: 43 four-byte scalars exceed
    // a 128-byte cap even though only 43 characters are present.
    #expect(decodeReason(document { setConfiguration(&$0, "voice", String(repeating: "\u{1F600}", count: 43)) })?
        .contains("exceeds 128 UTF-8 bytes") == true)
}

@Test("Malformed shapes and values fail with reasons")
func malformedValues() {
    #expect(decodeReason(Data("not json".utf8))?.contains("not a JSON object") == true)
    #expect(decodeReason(document { setConfiguration(&$0, "inputSampleRate", "fast") })?
        .contains("between 1 and 384000") == true)
    #expect(decodeReason(document { setConfiguration(&$0, "thinkingLevel", "MINIMAL") })?
        .contains("low, medium, or high") == true)
    #expect(decodeReason(document { $0["credentialKind"] = "password" })?
        .contains("apiKey or ephemeralToken") == true)
    #expect(decodeReason(document { setConfiguration(&$0, "provider", "") })?
        .contains("must not be empty") == true)
    #expect(decodeReason(document { setConfiguration(&$0, "inputSampleRate", true) })?
        .contains("between 1 and 384000") == true)
}

@Test("credentialReference and credentialKind travel as a pair")
func credentialPairing() {
    #expect(decodeReason(document { $0["credentialKind"] = nil })?
        .contains("needs credentialKind") == true)
    #expect(decodeReason(document { $0["credentialReference"] = nil })?
        .contains("names no credential") == true)
    let neither = document { root in
        root["credentialReference"] = nil
        root["credentialKind"] = nil
    }
    let staged = try? HudConversationSettingsImport.decode(neither)
    #expect(staged?.configuration.credentialReference == nil)
}

@Test("Version 1 options are an allowlist; authored delegation cannot be imported")
func optionsAllowlist() {
    #expect(decodeReason(document { setConfiguration(&$0, "options", ["note": "hello"]) })?
        .contains("version 1 imports only delegationModel") == true)
    #expect(decodeReason(document { setConfiguration(&$0, "options",
        ["delegation": "{\"type\":\"responses\"}"]) })?
        .contains("not importable in version 1") == true)
}

@Test("Provider rules reject unsupported combinations via the adapters' own checks")
func providerRuleValidation() async throws {
    let thinkingOnBase = try HudConversationSettingsImport.decode(document { root in
        setConfiguration(&root, "model", "gemini-3.8-live")
    })
    let baseProblem = await HudConversationSettingsImport.validate(thinkingOnBase)
    #expect(baseProblem?.contains("thinking level") == true)

    let wrongRate = try HudConversationSettingsImport.decode(document { root in
        root["configuration"] = ["provider": "openai-gpt-live", "model": "gpt-live-1", "inputSampleRate": 8000]
    })
    let rateProblem = await HudConversationSettingsImport.validate(wrongRate)
    #expect(rateProblem?.contains("24000 or 16000") == true)

    let unknownProvider = try HudConversationSettingsImport.decode(document { root in
        root["configuration"] = ["provider": "someone-else", "model": "m", "inputSampleRate": 16000]
    })
    let providerProblem = await HudConversationSettingsImport.validate(unknownProvider)
    #expect(providerProblem?.contains("Unknown conversation provider") == true)
}

@Test("Import is atomic: failures return nothing and validation mutates nothing")
func atomicity() async throws {
    #expect(decodeReason(document { $0["consent"] = true }) != nil)
    let staged = try HudConversationSettingsImport.decode(document())
    let snapshot = staged
    _ = await HudConversationSettingsImport.validate(staged)
    // Value semantics plus a throwing decode: no partial state can escape,
    // and validation cannot rewrite what was decoded.
    #expect(staged == snapshot)
}
