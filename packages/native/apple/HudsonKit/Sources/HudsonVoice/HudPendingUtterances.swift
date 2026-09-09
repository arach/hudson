import Foundation
import OSLog

/// Durable, ordered storage for captured audio that could not be transcribed at
/// the moment it was spoken.
///
/// Dictation that survives a model download, an app switch, or a cold launch is
/// the entire point of this type: a recording is discarded only once it has
/// actually produced a transcript, or once the operator explicitly cancels it.
/// Nothing here is a cache — the temporary directory is not durable enough for
/// speech the user believes they have already said.
struct HudPendingUtteranceStore: Sendable {
    /// A held recording and whatever the host was doing when it was spoken.
    /// Delivery can lag capture by minutes, so context that decides *where* a
    /// transcript goes has to travel with the audio rather than being read off
    /// live app state at drain time.
    struct Held: Equatable, Sendable {
        let url: URL
        let context: String?
    }

    private let directory: URL
    private let log = Logger(subsystem: "com.hudson.voice", category: "pending-utterances")
    private static let contextSeparator: Character = "~"

    /// Test seam: store into an explicit directory instead of Application Support.
    init(directory: URL) {
        self.directory = directory
    }

    init(folderName: String = "PendingDictation") {
        let root = (try? FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )) ?? FileManager.default.temporaryDirectory

        // Application Support is shared per-user on macOS, so scope by bundle.
        directory = root
            .appendingPathComponent(Bundle.main.bundleIdentifier ?? "HudsonVoice", isDirectory: true)
            .appendingPathComponent("HudsonVoice", isDirectory: true)
            .appendingPathComponent(folderName, isDirectory: true)
    }

    /// Move a finished recording into durable storage, preserving capture order.
    ///
    /// The name carries a fixed-width capture timestamp so a plain lexicographic
    /// sort replays utterances in the order they were spoken, with no index file
    /// to corrupt or fall out of sync.
    @discardableResult
    func adopt(_ url: URL, capturedAt: Date = Date(), context: String? = nil) throws -> URL {
        try createDirectoryIfNeeded()
        let stamp = String(format: "%015.3f", capturedAt.timeIntervalSince1970)
        var name = "\(stamp)-\(UUID().uuidString)"
        if let encoded = Self.encode(context: context) {
            name += "\(Self.contextSeparator)\(encoded)"
        }
        let destination = directory
            .appendingPathComponent(name)
            .appendingPathExtension(url.pathExtension.isEmpty ? "caf" : url.pathExtension)

        try FileManager.default.moveItem(at: url, to: destination)
        try? FileManager.default.setAttributes(
            [.posixPermissions: 0o600],
            ofItemAtPath: destination.path
        )
        log.notice("Held one utterance for later transcription")
        return destination
    }

    /// Every held recording, oldest first.
    func pending() -> [Held] {
        guard let entries = try? FileManager.default.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: nil,
            options: [.skipsHiddenFiles]
        ) else { return [] }

        return entries
            .sorted { $0.lastPathComponent < $1.lastPathComponent }
            .map { Held(url: $0, context: Self.decodeContext(from: $0)) }
    }

    var count: Int { pending().count }

    /// Contexts are host-supplied, so they are reduced to characters that
    /// survive a filename round trip. Anything else is simply dropped.
    private static func encode(context: String?) -> String? {
        guard let context else { return nil }
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: ":_-."))
        let cleaned = String(context.unicodeScalars.filter { allowed.contains($0) }.prefix(64))
        return cleaned.isEmpty ? nil : cleaned
    }

    private static func decodeContext(from url: URL) -> String? {
        let name = url.deletingPathExtension().lastPathComponent
        guard let separator = name.lastIndex(of: contextSeparator) else { return nil }
        let context = String(name[name.index(after: separator)...])
        return context.isEmpty ? nil : context
    }

    /// Drop a recording that has been transcribed, or that the operator cancelled.
    func discard(_ url: URL) {
        try? FileManager.default.removeItem(at: url)
    }

    func discardAll() {
        pending().forEach { discard($0.url) }
    }

    private func createDirectoryIfNeeded() throws {
        guard !FileManager.default.fileExists(atPath: directory.path) else { return }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

        // Held audio is transient work-in-progress, not user documents; keeping
        // it out of backups avoids syncing recordings that exist for seconds.
        var mutable = directory
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try? mutable.setResourceValues(values)
    }
}
