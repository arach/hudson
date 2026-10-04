import Foundation
import HudsonConversation
import HudsonConversationGemini
import HudsonConversationOpenAI

// Checks every example against the REAL adapters: each file is decoded into
// HudConversationConfiguration and then passed to the owning adapter's
// readiness(configuration:), which runs that adapter's own validate() rules.
// No policy is duplicated here — if an adapter's rules change, this follows.
//
// Credentials are fake and never leave the process. Readiness performs no
// network I/O, so nothing here contacts a provider or incurs cost. Files named
// invalid-* must be REJECTED by their adapter; every other file must reach
// .ready. This establishes configuration validity only: it is not provider,
// account, session, or audio acceptance.

/// Resolves any reference to fixed non-secret bytes. Proves the credential
/// path is exercised; proves nothing about a real account.
struct FakeCredentials: HudConversationCredentialResolver {
    func credential(for reference: HudConversationCredentialReference) async throws -> Data {
        Data("fake-credential-for-validation".utf8)
    }
}

/// Fails loudly if an adapter ever performs discovery during readiness.
let forbiddenTransport: @Sendable (URLRequest) async throws -> (Data, Int) = { _ in
    fatalError("Example validation must not perform network I/O.")
}

let credentials = FakeCredentials()
let adapters: [HudConversationProviderID: any HudConversationAdapter] = [
    HudGPTLiveAdapter.providerID: HudGPTLiveAdapter(credentials: credentials, http: forbiddenTransport),
    HudGeminiConversationAdapter.providerID: HudGeminiConversationAdapter(credentials: credentials, http: forbiddenTransport),
]

let args = CommandLine.arguments
guard args.count > 1 else { fputs("usage: ConvCheck <dir>\n", stderr); exit(2) }
let dir = URL(fileURLWithPath: args[1], isDirectory: true)
let files = try FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)
    .filter { $0.pathExtension == "json" }.sorted { $0.lastPathComponent < $1.lastPathComponent }
let decoder = JSONDecoder()
let encoder = JSONEncoder()
encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
var failures = 0

for file in files {
    let name = file.lastPathComponent
    let expectRejection = name.hasPrefix("invalid-")
    do {
        let config = try decoder.decode(HudConversationConfiguration.self, from: Data(contentsOf: file))
        let again = try decoder.decode(HudConversationConfiguration.self, from: try encoder.encode(config))
        guard again == config, again.secretFreeFingerprint == config.secretFreeFingerprint else {
            failures += 1
            print("FAIL \(name): configuration does not round-trip stably")
            continue
        }
        guard let adapter = adapters[config.providerID] else {
            failures += 1
            print("FAIL \(name): no registered adapter for providerID '\(config.providerID.rawValue)'")
            continue
        }

        let readiness = try await adapter.readiness(configuration: config)
        let rejected = readiness.status == .unavailable

        if expectRejection && rejected {
            print("OK   \(name) correctly rejected by \(adapter.descriptor.id.rawValue)")
            print("     reason: \(readiness.reason ?? "(none)")")
        } else if expectRejection {
            failures += 1
            print("FAIL \(name): expected adapter rejection, got \(readiness.status.rawValue)")
        } else if readiness.isReady {
            print("OK   \(name) ready via \(adapter.descriptor.id.rawValue)")
            print("     fingerprint: \(config.secretFreeFingerprint)")
        } else {
            failures += 1
            print("FAIL \(name): expected ready, got \(readiness.status.rawValue) — \(readiness.reason ?? "(no reason)")")
        }
    } catch {
        failures += 1
        print("FAIL \(name): \(error)")
    }
}

print(failures == 0
      ? "\nAll \(files.count) examples checked against real adapter readiness. Configuration validity only."
      : "\n\(failures) failure(s).")
exit(failures == 0 ? 0 : 1)
