import Foundation

struct TmuxInstallResult: Sendable {
    var ok: Bool
    var message: String
    var tmuxURL: URL?

    init(ok: Bool, message: String, tmuxURL: URL? = nil) {
        self.ok = ok
        self.message = message
        self.tmuxURL = tmuxURL
    }
}

enum TmuxToolchain {
    static var localTmuxURL: URL? {
        cachedExecutableURL(
            named: "tmux",
            commonCandidates: [
                URL(fileURLWithPath: "/opt/homebrew/bin/tmux"),
                URL(fileURLWithPath: "/usr/local/bin/tmux"),
                URL(fileURLWithPath: "/usr/bin/tmux"),
            ]
        )
    }

    static var homebrewURL: URL? {
        cachedExecutableURL(
            named: "brew",
            commonCandidates: [
                URL(fileURLWithPath: "/opt/homebrew/bin/brew"),
                URL(fileURLWithPath: "/usr/local/bin/brew"),
            ]
        )
    }

    static var homebrewInstallCommandDescription: String? {
        homebrewURL.map { "\($0.path) install tmux" }
    }

    static func installTmuxWithHomebrew() async -> TmuxInstallResult {
        if let tmuxURL = localTmuxURL {
            return TmuxInstallResult(
                ok: true,
                message: "tmux already available at \(tmuxURL.path)",
                tmuxURL: tmuxURL
            )
        }

        guard let homebrewURL else {
            return TmuxInstallResult(
                ok: false,
                message: "Homebrew not found; install Homebrew or tmux manually"
            )
        }

        invalidateExecutableCache(named: "tmux")
        do {
            let result = try await runInstaller(
                executableURL: homebrewURL,
                arguments: ["install", "tmux"]
            )
            guard result.status == 0 else {
                let detail = result.stderr.isEmpty ? result.stdout : result.stderr
                return TmuxInstallResult(
                    ok: false,
                    message: "Homebrew failed installing tmux: \(detail.trimmingCharacters(in: .whitespacesAndNewlines))"
                )
            }

            if let tmuxURL = localTmuxURL {
                return TmuxInstallResult(
                    ok: true,
                    message: "tmux installed at \(tmuxURL.path)",
                    tmuxURL: tmuxURL
                )
            }

            return TmuxInstallResult(
                ok: false,
                message: "Homebrew completed, but tmux was not found in PATH or common install locations"
            )
        } catch {
            return TmuxInstallResult(
                ok: false,
                message: "failed to launch Homebrew: \(error.localizedDescription)"
            )
        }
    }

    private static let executableCache = TmuxExecutableCache()

    private static func cachedExecutableURL(
        named name: String,
        commonCandidates: [URL]
    ) -> URL? {
        switch executableCache.lookup(name) {
        case .hit(let url):
            return url
        case .missing:
            return nil
        case .uncached:
            break
        }

        let environment = ProcessInfo.processInfo.environment
        let pathCandidates = (environment["PATH"] ?? "")
            .split(separator: ":")
            .map { URL(fileURLWithPath: String($0)).appendingPathComponent(name) }

        let resolved = (pathCandidates + commonCandidates)
            .first { FileManager.default.isExecutableFile(atPath: $0.path) }

        executableCache.store(resolved, for: name)
        return resolved
    }

    private static func invalidateExecutableCache(named name: String) {
        executableCache.invalidate(name)
    }

    private static func runInstaller(
        executableURL: URL,
        arguments: [String]
    ) async throws -> TmuxProcessResult {
        try await Task.detached(priority: .utility) {
            let process = Process()
            let stdoutPipe = Pipe()
            let stderrPipe = Pipe()

            process.executableURL = executableURL
            process.arguments = arguments
            process.standardOutput = stdoutPipe
            process.standardError = stderrPipe

            try process.run()

            let stdoutTask = Task.detached(priority: .utility) {
                stdoutPipe.fileHandleForReading.readDataToEndOfFile()
            }
            let stderrTask = Task.detached(priority: .utility) {
                stderrPipe.fileHandleForReading.readDataToEndOfFile()
            }

            process.waitUntilExit()

            let stdout = await stdoutTask.value
            let stderr = await stderrTask.value

            return TmuxProcessResult(
                status: process.terminationStatus,
                stdout: String(data: stdout, encoding: .utf8) ?? "",
                stderr: String(data: stderr, encoding: .utf8) ?? ""
            )
        }.value
    }
}

private final class TmuxExecutableCache: @unchecked Sendable {
    enum Lookup {
        case hit(URL)
        case missing
        case uncached
    }

    private let lock = NSLock()
    private var executables: [String: URL] = [:]
    private var missing = Set<String>()

    func lookup(_ name: String) -> Lookup {
        lock.lock()
        defer { lock.unlock() }

        if let executable = executables[name] {
            return .hit(executable)
        }
        if missing.contains(name) {
            return .missing
        }
        return .uncached
    }

    func store(_ executable: URL?, for name: String) {
        lock.lock()
        defer { lock.unlock() }

        if let executable {
            executables[name] = executable
            missing.remove(name)
        } else {
            executables.removeValue(forKey: name)
            missing.insert(name)
        }
    }

    func invalidate(_ name: String) {
        lock.lock()
        executables.removeValue(forKey: name)
        missing.remove(name)
        lock.unlock()
    }
}
