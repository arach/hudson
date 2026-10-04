#if os(macOS)
import Darwin
import Foundation
import Synchronization

public enum HudNotchSocketError: LocalizedError, Equatable {
    case pathTooLong(String)
    case lineTooLong(Int)
    case alreadyRunning(String)
    case closed
    case timedOut
    case unix(String, Int32)

    public var errorDescription: String? {
        switch self {
        case .pathTooLong(let path): return "Socket path is too long: \(path)"
        case .lineTooLong(let bytes): return "Message is too large (\(bytes) bytes)."
        case .alreadyRunning(let path): return "Another notch is already listening on \(path)."
        case .closed: return "The notch closed the connection."
        case .timedOut: return "No answer before the timeout."
        case .unix(let call, let code): return "\(call) failed: \(String(cString: strerror(code)))"
        }
    }
}

/// Unix-socket plumbing shared by the server and the client.
public enum HudNotchSocket {
    /// Default location for a host that does not pick its own. Each host
    /// should pass its own URL so two notch apps never share a socket.
    public static var defaultURL: URL {
        FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Application Support/Hudson", isDirectory: true)
            .appendingPathComponent("notch.sock", isDirectory: false)
    }

    static func address(path: String) throws -> sockaddr_un {
        var address = sockaddr_un()
        address.sun_family = sa_family_t(AF_UNIX)
        address.sun_len = UInt8(MemoryLayout<sockaddr_un>.size)
        let bytes = Array(path.utf8)
        guard bytes.count < MemoryLayout.size(ofValue: address.sun_path) else {
            throw HudNotchSocketError.pathTooLong(path)
        }
        withUnsafeMutableBytes(of: &address.sun_path) { raw in
            raw.initializeMemory(as: UInt8.self, repeating: 0)
            for (index, byte) in bytes.enumerated() { raw[index] = byte }
        }
        return address
    }

    static func withSockaddr<T>(_ address: inout sockaddr_un, _ body: (UnsafePointer<sockaddr>, socklen_t) throws -> T) rethrows -> T {
        try withUnsafePointer(to: &address) { pointer in
            try pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                try body($0, socklen_t(MemoryLayout<sockaddr_un>.size))
            }
        }
    }

    static func makeStreamSocket() throws -> Int32 {
        let fd = Darwin.socket(AF_UNIX, SOCK_STREAM, 0)
        guard fd >= 0 else { throw HudNotchSocketError.unix("socket", errno) }
        var one: Int32 = 1
        setsockopt(fd, SOL_SOCKET, SO_NOSIGPIPE, &one, socklen_t(MemoryLayout<Int32>.size))
        return fd
    }

    static func connect(path: String) throws -> Int32 {
        let fd = try makeStreamSocket()
        var address = try address(path: path)
        let result = withSockaddr(&address) { Darwin.connect(fd, $0, $1) }
        guard result == 0 else {
            let code = errno
            Darwin.close(fd)
            throw HudNotchSocketError.unix("connect", code)
        }
        return fd
    }

    static func writeAll(_ data: Data, to fd: Int32) throws {
        guard data.count <= HudNotchWire.maxLineBytes else {
            throw HudNotchSocketError.lineTooLong(data.count)
        }
        try data.withUnsafeBytes { buffer in
            guard let base = buffer.baseAddress else { return }
            var sent = 0
            while sent < data.count {
                let result = Darwin.write(fd, base.advanced(by: sent), data.count - sent)
                if result < 0, errno == EINTR { continue }
                guard result > 0 else { throw HudNotchSocketError.unix("write", errno) }
                sent += result
            }
        }
    }

    static func setReadTimeout(_ seconds: TimeInterval?, on fd: Int32) {
        guard let seconds, seconds > 0 else { return }
        var value = timeval(tv_sec: Int(seconds), tv_usec: Int32((seconds - floor(seconds)) * 1_000_000))
        setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &value, socklen_t(MemoryLayout<timeval>.size))
    }
}

/// Splits a stream into newline-delimited lines, keeping partial reads.
struct HudNotchLineReader {
    private let fd: Int32
    private var pending = Data()
    private var buffer = [UInt8](repeating: 0, count: 4096)

    init(fd: Int32) { self.fd = fd }

    /// The next non-empty line, or nil at end of stream.
    mutating func next() throws -> Data? {
        while true {
            if let newline = pending.firstIndex(of: 0x0A) {
                let line = pending[pending.startIndex..<newline]
                pending.removeSubrange(pending.startIndex...newline)
                if line.isEmpty { continue }
                return Data(line)
            }
            guard pending.count <= HudNotchWire.maxLineBytes else {
                throw HudNotchSocketError.lineTooLong(pending.count)
            }
            let count = Darwin.read(fd, &buffer, buffer.count)
            if count < 0 {
                if errno == EINTR { continue }
                if errno == EAGAIN || errno == EWOULDBLOCK { throw HudNotchSocketError.timedOut }
                throw HudNotchSocketError.unix("read", errno)
            }
            if count == 0 {
                // A sender that writes one line and closes without a newline.
                guard !pending.isEmpty else { return nil }
                defer { pending.removeAll() }
                return pending
            }
            pending.append(buffer, count: count)
        }
    }
}

// MARK: - Server

/// Listens on a Unix socket, hands each command to the host, and routes
/// responses back: a reply goes to the connection that posted the activity
/// (if it is still open) and to every subscriber.
///
/// Fire-and-forget senders that write one line and close keep working.
public final class HudNotchSocketServer: Sendable {
    public typealias CommandHandler = @Sendable (HudNotchCommand) -> Void

    public let socketURL: URL
    private let onCommand: CommandHandler
    private let state = Mutex(State())

    private struct State {
        var listenFD: Int32 = -1
        var clients: Set<Int32> = []
        /// Activity id → the connection that is waiting for its answer.
        var askers: [String: Int32] = [:]
        var subscribers: Set<Int32> = []
    }

    public init(socketURL: URL = HudNotchSocket.defaultURL, onCommand: @escaping CommandHandler) {
        self.socketURL = socketURL
        self.onCommand = onCommand
    }

    deinit { stop() }

    public var isRunning: Bool { state.withLock { $0.listenFD >= 0 } }

    public func start() throws {
        guard !isRunning else { return }
        let path = socketURL.path

        try FileManager.default.createDirectory(
            at: socketURL.deletingLastPathComponent(),
            withIntermediateDirectories: true,
            attributes: [.posixPermissions: 0o700]
        )

        // A live socket means another notch owns it; a dead one is stale.
        if let probe = try? HudNotchSocket.connect(path: path) {
            Darwin.close(probe)
            throw HudNotchSocketError.alreadyRunning(path)
        }
        unlink(path)

        let fd = try HudNotchSocket.makeStreamSocket()
        do {
            var address = try HudNotchSocket.address(path: path)
            guard HudNotchSocket.withSockaddr(&address, { Darwin.bind(fd, $0, $1) }) == 0 else {
                throw HudNotchSocketError.unix("bind", errno)
            }
            chmod(path, 0o600)
            guard Darwin.listen(fd, 16) == 0 else {
                throw HudNotchSocketError.unix("listen", errno)
            }
        } catch {
            Darwin.close(fd)
            unlink(path)
            throw error
        }

        state.withLock { $0.listenFD = fd }
        let thread = Thread { [weak self] in self?.acceptLoop(fd) }
        thread.name = "HudNotchSocketServer.accept"
        thread.start()
    }

    public func stop() {
        let (listenFD, clients) = state.withLock { state -> (Int32, Set<Int32>) in
            let snapshot = (state.listenFD, state.clients)
            state.listenFD = -1
            state.askers.removeAll()
            state.subscribers.removeAll()
            return snapshot
        }
        guard listenFD >= 0 else { return }
        Darwin.shutdown(listenFD, SHUT_RDWR)
        Darwin.close(listenFD)
        // Unblocks each client's read; its thread closes the descriptor.
        for client in clients { Darwin.shutdown(client, SHUT_RDWR) }
        unlink(socketURL.path)
    }

    /// Sends a response to whoever asked and to every subscriber.
    public func respond(_ response: HudNotchResponse) {
        guard let line = try? HudNotchWire.encodeResponse(response) else { return }
        state.withLock { state in
            var targets = state.subscribers
            if let asker = state.askers.removeValue(forKey: response.activityID) {
                targets.insert(asker)
            }
            for fd in targets {
                try? HudNotchSocket.writeAll(line, to: fd)
            }
        }
    }

    private func acceptLoop(_ listenFD: Int32) {
        while true {
            let client = Darwin.accept(listenFD, nil, nil)
            if client < 0 {
                if errno == EINTR { continue }
                return
            }
            var one: Int32 = 1
            setsockopt(client, SOL_SOCKET, SO_NOSIGPIPE, &one, socklen_t(MemoryLayout<Int32>.size))
            state.withLock { _ = $0.clients.insert(client) }
            let thread = Thread { [weak self] in self?.serve(client) }
            thread.name = "HudNotchSocketServer.client"
            thread.start()
        }
    }

    private func serve(_ fd: Int32) {
        var reader = HudNotchLineReader(fd: fd)
        while let line = try? reader.next() {
            guard let command = try? HudNotchWire.decodeCommand(line) else { continue }
            state.withLock { state in
                switch command {
                case .post(let activity) where activity.state == .waiting:
                    state.askers[activity.id] = fd
                case .subscribe:
                    state.subscribers.insert(fd)
                default:
                    break
                }
            }
            onCommand(command)
        }
        state.withLock { state in
            state.clients.remove(fd)
            state.subscribers.remove(fd)
            state.askers = state.askers.filter { $0.value != fd }
            Darwin.close(fd)
        }
    }
}

// MARK: - Client

/// Talks to a running notch. Every call opens its own connection.
public struct HudNotchClient: Sendable {
    public var socketURL: URL

    public init(socketURL: URL = HudNotchSocket.defaultURL) {
        self.socketURL = socketURL
    }

    /// Writes one command and closes.
    public func send(_ command: HudNotchCommand) throws {
        let fd = try HudNotchSocket.connect(path: socketURL.path)
        defer { Darwin.close(fd) }
        try HudNotchSocket.writeAll(HudNotchWire.encodeCommand(command), to: fd)
    }

    /// Posts a waiting activity and blocks until the person answers or
    /// dismisses it. Other senders' updates on the same id do not end the wait.
    public func ask(_ activity: HudNotchActivity, timeout: TimeInterval? = nil) throws -> HudNotchResponse {
        var activity = activity
        activity.state = .waiting
        let fd = try HudNotchSocket.connect(path: socketURL.path)
        defer { Darwin.close(fd) }
        HudNotchSocket.setReadTimeout(timeout, on: fd)
        try HudNotchSocket.writeAll(HudNotchWire.encodeCommand(.post(activity)), to: fd)

        var reader = HudNotchLineReader(fd: fd)
        while let line = try reader.next() {
            if let response = try? HudNotchWire.decodeResponse(line), response.activityID == activity.id {
                return response
            }
        }
        throw HudNotchSocketError.closed
    }

    public func ask(_ activity: HudNotchActivity, timeout: TimeInterval? = nil) async throws -> HudNotchResponse {
        try await withCheckedThrowingContinuation { continuation in
            let thread = Thread {
                continuation.resume(with: Result { try self.ask(activity, timeout: timeout) })
            }
            thread.name = "HudNotchClient.ask"
            thread.start()
        }
    }

    /// Streams every response until `handler` returns false or the notch goes away.
    public func subscribe(_ handler: (HudNotchResponse) -> Bool) throws {
        let fd = try HudNotchSocket.connect(path: socketURL.path)
        defer { Darwin.close(fd) }
        try HudNotchSocket.writeAll(HudNotchWire.encodeCommand(.subscribe), to: fd)
        var reader = HudNotchLineReader(fd: fd)
        while let line = try reader.next() {
            guard let response = try? HudNotchWire.decodeResponse(line) else { continue }
            if !handler(response) { return }
        }
    }
}
#endif
