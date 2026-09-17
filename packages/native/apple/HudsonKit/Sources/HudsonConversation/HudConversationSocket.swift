import Foundation

/// Transport abstraction so provider sessions are fixture-testable without a
/// network. Mirrors the transcription socket but keeps this stack independent.
public protocol HudConversationSocket: Sendable {
    func send(_ data: Data) async throws
    func receive() async throws -> Data
    func close() async
}

public typealias HudConversationSocketFactory = @Sendable (URLRequest) async throws -> any HudConversationSocket

public actor HudConversationURLSocket: HudConversationSocket {
    private let task: URLSessionWebSocketTask

    public init(request: URLRequest, session: URLSession = .shared) {
        task = session.webSocketTask(with: request)
        task.maximumMessageSize = 4 * 1024 * 1024
        task.resume()
    }

    public func send(_ data: Data) async throws {
        do { try await task.send(.string(String(decoding: data, as: UTF8.self))) }
        catch { throw HudConversationError.connectionFailed }
    }

    public func receive() async throws -> Data {
        do {
            switch try await task.receive() {
            case .data(let data): return data
            case .string(let text): return Data(text.utf8)
            @unknown default: throw HudConversationError.connectionFailed
            }
        } catch is CancellationError { throw CancellationError() }
        catch let error as HudConversationError { throw error }
        catch { throw HudConversationError.connectionFailed }
    }

    public func close() { task.cancel(with: .goingAway, reason: nil) }
}
