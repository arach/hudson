import Foundation
import HudsonConversation
import HudsonConversationGemini
import HudsonConversationOpenAI

/// Settings file import: a versioned, secret-free, portable JSON document
/// shared byte-for-byte with the web implementation
/// (`@hudsonkit/ai/conversation`).
///
/// Guarantees:
/// - Secret-free by construction: the schema has no secret-bearing field and
///   unknown keys at any level are strict errors. Options are an explicit
///   version-1 allowlist (`delegationModel` only) so authored delegation JSON
///   cannot smuggle tools, headers, or tokens through an import. A
///   defense-in-depth heuristic additionally rejects documents whose string
///   values look like known secret shapes.
/// - No consent, ever: import STAGES a configuration for the host's existing
///   explicit save path; nothing becomes active here and no network or
///   provider call is made.
/// - Host secrets untouched: provider-rule validation runs against importer-
///   owned adapter instances with a resolver that never yields a credential.
///   The host's credential storage is not consulted by any import path.
/// - Atomic: `importDocument` either returns a fully-formed staged value or
///   throws; a failed import cannot have touched prior settings, typed
///   secrets, or stored credentials.
/// - Unknown or unsupported inputs (format, version, keys, combinations) are
///   rejected with the reason, never imported best-effort.
///
/// All string bounds are measured in UTF-8 bytes on both platforms so the
/// same document is accepted or rejected identically everywhere.
public enum HudConversationSettingsImport {
    public static let format = "hudson-conversation-settings"
    public static let version = 1
    /// Documents larger than this are rejected before parsing.
    public static let maximumBytes = 65_536

    /// A parsed document, staged for the host's explicit save path. The
    /// portable fields `credentialReference` and `credentialKind` map into
    /// the native configuration; the document shape stays identical to web.
    /// Constructable only by `importDocument`, so a `Staged` value is proof
    /// that decoding AND validation both ran.
    public struct Staged: Sendable, Equatable {
        public internal(set) var configuration: HudConversationConfiguration
        internal init(configuration: HudConversationConfiguration) {
            self.configuration = configuration
        }
    }

    /// The one public entry point: structural decode plus provider-rule
    /// validation. Settings surfaces cannot stage a document that skipped
    /// validation, because nothing else returns a `Staged`.
    public static func importDocument(_ data: Data) async throws -> Staged {
        let staged = try decode(data)
        if let problem = await validate(staged) {
            throw HudConversationError.invalidConfiguration(problem)
        }
        return staged
    }

    private static let topLevelKeys: Set<String> =
        ["format", "version", "configuration", "credentialReference", "credentialKind"]
    private static let configurationKeys: Set<String> =
        ["provider", "model", "instructions", "voice", "inputSampleRate", "thinkingLevel", "options"]
    /// Version-1 options allowlist. Authored delegation JSON is deliberately
    /// not importable; it is configured in the app where its own validation
    /// and review apply.
    private static let allowedOptionKeys: Set<String> = ["delegationModel"]
    private static let secretShapes = ["sk-", "AIza", "ya29.", "Bearer "]

    /// Structural, strict decode. Internal so the import path cannot be used
    /// without validation; tests reach it via @testable.
    static func decode(_ data: Data) throws -> Staged {
        guard data.count <= maximumBytes else {
            throw invalid("Settings documents are limited to \(maximumBytes) bytes.")
        }
        guard let parsed = try? JSONSerialization.jsonObject(with: data),
              let root = parsed as? [String: Any] else {
            throw invalid("The file is not a JSON object.")
        }
        try rejectUnknownKeys(root, allowed: topLevelKeys, where: "The document")
        guard root["format"] as? String == format else {
            throw invalid("The document is not a \(format) file.")
        }
        // JSON booleans bridge to NSNumber and would otherwise cast as 1;
        // `is Bool` cannot distinguish them because NSNumber(1) also answers
        // true, so the CoreFoundation type identifies actual booleans.
        // A different version is understood-but-unsupported, not malformed —
        // the same classification the web importer uses.
        guard let rawVersion = root["version"], !isJSONBoolean(rawVersion),
              let documentVersion = rawVersion as? Int, documentVersion == version else {
            throw HudConversationError.unsupported(
                "This settings document version is not supported; this importer reads version \(version).")
        }
        guard let rawConfiguration = root["configuration"] as? [String: Any] else {
            throw invalid("The document must carry a configuration object.")
        }
        try rejectUnknownKeys(rawConfiguration, allowed: configurationKeys, where: "The configuration")

        var configuration = HudConversationConfiguration(
            providerID: .init(rawValue: try string(rawConfiguration["provider"], "provider", maxBytes: 128, minimumBytes: 1)),
            modelID: .init(rawValue: try string(rawConfiguration["model"], "model", maxBytes: 256, minimumBytes: 1)))
        guard let rawRate = rawConfiguration["inputSampleRate"], !isJSONBoolean(rawRate),
              let rate = rawRate as? Int, (1...384_000).contains(rate) else {
            throw invalid("inputSampleRate must be an integer between 1 and 384000.")
        }
        configuration.inputAudio = .init(sampleRate: rate)
        if rawConfiguration["instructions"] != nil {
            configuration.instructions = try string(rawConfiguration["instructions"], "instructions", maxBytes: 8_192)
        }
        if rawConfiguration["voice"] != nil {
            configuration.voice = try string(rawConfiguration["voice"], "voice", maxBytes: 128)
        }
        if let rawLevel = rawConfiguration["thinkingLevel"] {
            guard let text = rawLevel as? String,
                  let level = HudConversationThinkingLevel(rawValue: text) else {
                throw invalid("thinkingLevel must be low, medium, or high.")
            }
            configuration.thinkingLevel = level
        }
        if let rawOptions = rawConfiguration["options"] {
            guard let object = rawOptions as? [String: Any] else {
                throw invalid("options must be an object of strings.")
            }
            var options: [String: String] = [:]
            for (key, value) in object {
                if key == "delegation" {
                    throw invalid(
                        "Authored delegation JSON is not importable in version 1; set delegationModel and configure delegation in the app.")
                }
                guard allowedOptionKeys.contains(key) else {
                    throw invalid("options carries the unsupported key \"\(key)\"; version 1 imports only delegationModel.")
                }
                options[key] = try string(value, "options.\(key)", maxBytes: 2_048)
            }
            configuration.options = options
        }
        // credentialReference and credentialKind travel as a pair so neither
        // platform inherits a default kind for a named credential: the same
        // document means the same credential shape everywhere.
        switch (root["credentialReference"] != nil, root["credentialKind"] != nil) {
        case (true, false):
            throw invalid("credentialReference needs credentialKind (apiKey or ephemeralToken) beside it.")
        case (false, true):
            throw invalid("credentialKind without credentialReference names no credential.")
        case (false, false):
            break
        case (true, true):
            configuration.credentialReference = .init(identifier:
                try string(root["credentialReference"], "credentialReference", maxBytes: 256, minimumBytes: 1))
            guard let text = root["credentialKind"] as? String,
                  let kind = HudConversationCredentialKind(rawValue: text) else {
                throw invalid("credentialKind must be apiKey or ephemeralToken.")
            }
            configuration.credentialKind = kind
        }
        return Staged(configuration: configuration)
    }

    /// Provider rules come from the adapters' own passive readiness checks —
    /// the same rules a live open enforces — using importer-owned adapter
    /// instances whose resolver never yields a credential. The host's real
    /// resolver and credential storage are never consulted, and no network
    /// or provider call is made. Version-1 limitation: the importer knows
    /// the two shipped providers, matching the web validator.
    static func validate(_ staged: Staged) async -> String? {
        let resolver = HudConversationNoCredentialResolver()
        let adapters: [any HudConversationAdapter] = [
            HudGPTLiveAdapter(credentials: resolver),
            HudGeminiConversationAdapter(credentials: resolver),
        ]
        guard let adapter = adapters.first(where: { $0.descriptor.id == staged.configuration.providerID }) else {
            return "Unknown conversation provider: \(staged.configuration.providerID.rawValue)."
        }
        do {
            let readiness = try await adapter.readiness(configuration: staged.configuration)
            switch readiness.status {
            case .ready, .needsCredential:
                // Structurally valid; credentials stay a save/connect concern.
                return nil
            case .unconfigured, .unavailable, .failed:
                return readiness.reason ?? "The configuration is not valid for this provider."
            }
        } catch {
            return "The configuration could not be validated for this provider."
        }
    }

    private static func invalid(_ message: String) -> HudConversationError {
        .invalidConfiguration(message)
    }

    private static func rejectUnknownKeys(_ object: [String: Any], allowed: Set<String>,
                                          where location: String) throws {
        for key in object.keys where !allowed.contains(key) {
            throw invalid("\(location) carries the unknown field \"\(key)\"; unknown fields are not imported.")
        }
    }

    private static func isJSONBoolean(_ value: Any) -> Bool {
        guard let number = value as? NSNumber else { return false }
        return CFGetTypeID(number) == CFBooleanGetTypeID()
    }

    private static func string(_ value: Any?, _ field: String, maxBytes: Int, minimumBytes: Int = 0) throws -> String {
        guard let value, !isJSONBoolean(value), let text = value as? String else {
            throw invalid("\(field) must be a string.")
        }
        let byteCount = text.utf8.count
        guard byteCount >= minimumBytes else { throw invalid("\(field) must not be empty.") }
        guard byteCount <= maxBytes else { throw invalid("\(field) exceeds \(maxBytes) UTF-8 bytes.") }
        for shape in secretShapes where text.hasPrefix(shape) {
            throw invalid("\(field) looks like a secret value; settings documents carry no keys or tokens.")
        }
        if text.contains("-----BEGIN") {
            throw invalid("\(field) looks like a secret value; settings documents carry no keys or tokens.")
        }
        return text
    }
}

/// A resolver that never yields a credential. Import-time validation runs
/// against adapter instances built on it, so host secrets stay untouched.
struct HudConversationNoCredentialResolver: HudConversationCredentialResolver {
    func credential(for reference: HudConversationCredentialReference) async throws -> Data { Data() }
}
