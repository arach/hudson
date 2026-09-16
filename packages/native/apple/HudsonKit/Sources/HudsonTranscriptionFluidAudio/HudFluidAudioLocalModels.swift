import Foundation
import CoreML
import FluidAudio

/// Loads only the selected compiled assets. No ModelHub recovery or network access.
enum HudFluidAudioLocalModels {
    static func requiredFiles(version: AsrModelVersion) -> [String] {
        [ModelNames.ASR.preprocessorFile,
         version == .v3 ? ParakeetEncoderPrecision.int8.encoderFileName : ModelNames.ASR.encoderFile,
         ModelNames.ASR.decoderFile,
         version == .v3 ? ModelNames.ASR.jointV3File : ModelNames.ASR.jointFile,
         ModelNames.ASR.vocabularyFile]
    }

    static func exist(at directory: URL, version: AsrModelVersion) -> Bool {
        requiredFiles(version: version).allSatisfy { FileManager.default.fileExists(atPath: directory.appending(path: $0).path) }
    }

    static func load(from directory: URL, version: AsrModelVersion) async throws -> AsrModels {
        let names = requiredFiles(version: version)
        let config = AsrModels.defaultConfiguration()
        let preprocessing = MLModelConfiguration()
        preprocessing.computeUnits = .cpuOnly
        let preprocessor = try await MLModel.load(contentsOf: directory.appending(path: names[0]), configuration: preprocessing)
        try Task.checkCancellation()
        let encoder = try await MLModel.load(contentsOf: directory.appending(path: names[1]), configuration: config)
        try Task.checkCancellation()
        let decoder = try await MLModel.load(contentsOf: directory.appending(path: names[2]), configuration: config)
        try Task.checkCancellation()
        let joint = try await MLModel.load(contentsOf: directory.appending(path: names[3]), configuration: config)
        let data = try Data(contentsOf: directory.appending(path: names[4]))
        let dictionary = try JSONDecoder().decode([String: String].self, from: data)
        var vocabulary: [Int: String] = [:]
        for (key, value) in dictionary {
            guard let id = Int(key), id >= 0 else { throw CocoaError(.fileReadCorruptFile) }
            vocabulary[id] = value
        }
        guard !vocabulary.isEmpty else { throw CocoaError(.fileReadCorruptFile) }
        return AsrModels(encoder: encoder, preprocessor: preprocessor, decoder: decoder, joint: joint,
                         configuration: config, vocabulary: vocabulary, version: version)
    }
}
