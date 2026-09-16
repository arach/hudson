import Foundation
import HudsonTranscription

// Mirrors TalkieTranscription.TranscriptionWorkspace.Selection exactly.
struct SelectionMirror: Codable, Equatable {
    let configuration: HudTranscriptionConfiguration
    let remoteConsentFingerprint: String?
}

let args = CommandLine.arguments
guard args.count > 1 else { fputs("usage: ConfigCheck <dir>\n", stderr); exit(2) }
let dir = URL(fileURLWithPath: args[1], isDirectory: true)
let files = try FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)
    .filter { $0.pathExtension == "json" }.sorted { $0.lastPathComponent < $1.lastPathComponent }
let decoder = JSONDecoder()
let encoder = JSONEncoder()
encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
var failures = 0

for file in files {
    let data = try Data(contentsOf: file)
    let name = file.lastPathComponent
    if name == "selections.json" {
        do {
            let selections = try decoder.decode([String: SelectionMirror].self, from: data)
            var notes: [String] = []
            for (useCase, selection) in selections.sorted(by: { $0.key < $1.key }) {
                let fp = selection.configuration.secretFreeFingerprint
                let consentOK = selection.remoteConsentFingerprint == nil
                    || selection.remoteConsentFingerprint == fp
                if !consentOK { failures += 1 }
                notes.append("\(useCase)=\(selection.configuration.providerID.rawValue)/\(selection.configuration.modelID.rawValue) consent:\(consentOK ? "matches" : "MISMATCH") fp:\(fp)")
            }
            // Round-trip
            let again = try decoder.decode([String: SelectionMirror].self, from: try encoder.encode(selections))
            let stable = again == selections
            if !stable { failures += 1 }
            print("OK   \(name) roundTrip:\(stable ? "stable" : "UNSTABLE")")
            for note in notes { print("     \(note)") }
        } catch {
            failures += 1
            print("FAIL \(name): \(error)")
        }
        continue
    }
    do {
        let config = try decoder.decode(HudTranscriptionConfiguration.self, from: data)
        let canonical = try encoder.encode(config)
        let again = try decoder.decode(HudTranscriptionConfiguration.self, from: canonical)
        let stable = again == config && again.secretFreeFingerprint == config.secretFreeFingerprint
        if !stable { failures += 1 }
        print("OK   \(name) roundTrip:\(stable ? "stable" : "UNSTABLE")")
        print("     fingerprint: \(config.secretFreeFingerprint)")
        print("     canonical:   \(String(data: canonical, encoding: .utf8) ?? "")")
    } catch {
        failures += 1
        print("FAIL \(name): \(error)")
    }
}
print(failures == 0 ? "\nAll \(files.count) example files decoded." : "\n\(failures) failure(s).")
exit(failures == 0 ? 0 : 1)
