import Foundation
import CryptoKit
import HudsonTranscription

/// Inspects a caller-selected WhisperKit model folder. Never downloads.
enum HudWhisperKitLocalModels {
    static let requiredTokenizerNames = ["tokenizer.json", "tokenizer_config.json"]
    static let requiredModelNames = ["MelSpectrogram", "AudioEncoder", "TextDecoder"]

    static func directory(_ configuration: HudTranscriptionConfiguration) -> URL? {
        guard let location = configuration.localModel?.location, !location.isEmpty else { return nil }
        return URL(fileURLWithPath: location, isDirectory: true)
    }

    static func exist(at directory: URL) -> Bool {
        requiredModelNames.allSatisfy { hasModel(in: directory, named: $0) } && hasTokenizer(in: directory)
    }

    /// True when compiled assets are still present and match the loaded config fingerprint.
    static func matches(_ handle: HudWhisperKitSessionHandle, at directory: URL) -> Bool {
        exist(at: directory) && handle.configFingerprint == configFingerprint(at: directory)
    }

    static func hasModel(in directory: URL, named name: String) -> Bool {
        FileManager.default.fileExists(atPath: directory.appending(path: "\(name).mlmodelc").path)
            || FileManager.default.fileExists(atPath: directory.appending(path: "\(name).mlpackage").path)
    }

    static func hasTokenizer(in directory: URL) -> Bool {
        requiredTokenizerNames.allSatisfy { name in
            guard let data = try? Data(contentsOf: directory.appending(path: name)),
                  (try? JSONSerialization.jsonObject(with: data)) is [String: Any] else { return false }
            return true
        }
    }

    /// Digest of configuration and tokenizer content plus model presence. Omits the folder path.
    static func configFingerprint(at directory: URL) -> String {
        var material = Data()
        let configURL = directory.appending(path: "config.json")
        if let config = try? Data(contentsOf: configURL) {
            material.append(config)
        }
        for name in requiredModelNames {
            let compiled = hasModel(in: directory, named: name)
            material.append(contentsOf: Array("\(name):\(compiled ? "1" : "0")".utf8))
        }
        for name in requiredTokenizerNames {
            material.append(contentsOf: name.utf8)
            if let data = try? Data(contentsOf: directory.appending(path: name)) {
                material.append(contentsOf: SHA256.hash(data: data))
            }
        }
        return "sha256:" + SHA256.hash(data: material).map { String(format: "%02x", $0) }.joined()
    }
}
