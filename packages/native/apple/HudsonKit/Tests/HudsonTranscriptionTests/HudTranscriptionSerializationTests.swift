import Foundation
import HudsonTranscription
import Testing

@Suite("HudTranscription serialization")
struct HudTranscriptionSerializationTests {
    @Test("unknown model IDs round-trip through JSON")
    func unknownModelIDsRoundTrip() throws {
        let modelID = HudTranscriptionModelID(rawValue: "gemini-future-9")
        let encodedID = try JSONEncoder().encode(modelID)
        let decodedID = try JSONDecoder().decode(HudTranscriptionModelID.self, from: encodedID)
        #expect(decodedID == modelID)
        #expect(String(data: encodedID, encoding: .utf8) == "\"gemini-future-9\"")

        let configuration = HudTranscriptionConfiguration(
            providerID: "unknown-vendor",
            modelID: modelID,
            endpoint: URL(string: "https://example.test/v1"),
            region: "us-central1"
        )
        let encodedConfiguration = try JSONEncoder().encode(configuration)
        let decodedConfiguration = try JSONDecoder().decode(
            HudTranscriptionConfiguration.self,
            from: encodedConfiguration
        )
        #expect(decodedConfiguration.modelID.rawValue == "gemini-future-9")
        #expect(decodedConfiguration.providerID.rawValue == "unknown-vendor")
        #expect(!decodedConfiguration.secretFreeFingerprint.contains("sk-"))

        let descriptor = TranscriptionFixtures.model(id: "not-in-any-catalog-xyz")
        let encodedDescriptor = try JSONEncoder().encode(descriptor)
        let decodedDescriptor = try JSONDecoder().decode(
            HudTranscriptionModelDescriptor.self,
            from: encodedDescriptor
        )
        #expect(decodedDescriptor.id.rawValue == "not-in-any-catalog-xyz")
        #expect(decodedDescriptor.limits.maximumFileDuration == .unknown)
    }
    @Test("fingerprints are canonical, opaque, and delimiter safe")
    func canonicalFingerprints() {
        let first = HudTranscriptionConfiguration(providerID: "a|b", modelID: "c",
            options: ["second": "two", "first": "one"])
        let reordered = HudTranscriptionConfiguration(providerID: "a|b", modelID: "c",
            options: ["first": "one", "second": "two"])
        let collision = HudTranscriptionConfiguration(providerID: "a", modelID: "b|c",
            options: first.options)
        #expect(first.secretFreeFingerprint == reordered.secretFreeFingerprint)
        #expect(first.secretFreeFingerprint != collision.secretFreeFingerprint)
        #expect(first.secretFreeFingerprint.count == 71)
        #expect(!first.secretFreeFingerprint.contains("one"))
    }

}
