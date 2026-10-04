import Foundation

public protocol HudTranscriptionSocket: Sendable {
    func send(_ data: Data) async throws
    func receive() async throws -> Data
    func close() async
}

public actor HudTranscriptionURLSocket: HudTranscriptionSocket {
    private let task: URLSessionWebSocketTask

    public init(request: URLRequest, session: URLSession = .shared) {
        task = session.webSocketTask(with: request)
        task.maximumMessageSize = 2 * 1024 * 1024
        task.resume()
    }

    public func send(_ data: Data) async throws {
        do { try await task.send(.string(String(decoding: data, as: UTF8.self))) }
        catch { throw HudTranscriptionHTTPError.connectionFailed }
    }

    public func receive() async throws -> Data {
        do {
            switch try await task.receive() {
            case .data(let data): return data
            case .string(let text): return Data(text.utf8)
            @unknown default: throw HudTranscriptionHTTPError.invalidResponse
            }
        } catch is CancellationError { throw CancellationError() }
        catch { throw HudTranscriptionHTTPError.connectionFailed }
    }

    public func close() { task.cancel(with: .goingAway, reason: nil) }
}
