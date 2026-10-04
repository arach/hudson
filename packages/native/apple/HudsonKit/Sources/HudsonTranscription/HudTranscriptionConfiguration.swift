import Foundation
import CryptoKit

/// Secret-free provider/model selection and routing options.
public struct HudTranscriptionConfiguration: Codable, Hashable, Sendable {
    public var providerID: HudTranscriptionProviderID
    public var modelID: HudTranscriptionModelID
    public var endpoint: URL?
    public var region: String?
    public var credentialReference: HudTranscriptionCredentialReference?
    public var localModel: HudTranscriptionLocalModelReference?
    public var options: [String: String]

    public init(
        providerID: HudTranscriptionProviderID,
        modelID: HudTranscriptionModelID,
        endpoint: URL? = nil,
        region: String? = nil,
        credentialReference: HudTranscriptionCredentialReference? = nil,
        localModel: HudTranscriptionLocalModelReference? = nil,
        options: [String: String] = [:]
    ) {
        self.providerID = providerID
        self.modelID = modelID
        self.endpoint = endpoint
        self.region = region
        self.credentialReference = credentialReference
        self.localModel = localModel
        self.options = options
    }

    /// Versioned digest of the canonical configuration. Credential values must remain
    /// in the credential store; only an opaque reference belongs in this value.
    /// Hashing prevents routing paths and reference identifiers appearing in results.
    public var secretFreeFingerprint: String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        // This value contains only strings and string-keyed containers, whose JSON
        // encoding cannot fail. Keep an explicit fallback without exposing fields.
        guard let bytes = try? encoder.encode(self) else { return "sha256:invalid" }
        return "sha256:" + SHA256.hash(data: bytes).map {
            let hex = String($0, radix: 16)
            return hex.count == 1 ? "0" + hex : hex
        }.joined()
    }
}
