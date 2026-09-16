import Foundation

/// Inject a fixture transport to exercise provider requests without uploading audio.
public protocol HudTranscriptionHTTPTransport: Sendable {
    func send(_ request: URLRequest) async throws -> HudTranscriptionHTTPResponse
}

public struct HudTranscriptionHTTPResponse: Sendable {
    public let status: Int
    public let headers: [String: String]
    public let body: Data

    public init(status: Int, headers: [String: String] = [:], body: Data) {
        self.status = status
        self.headers = headers.reduce(into: [:]) { $0[$1.key.lowercased()] = $1.value }
        self.body = body
    }

    public var requestID: String? {
        headers["x-request-id"] ?? headers["request-id"] ?? headers["apim-request-id"]
    }

    public func requireSuccess() throws {
        guard (200..<300).contains(status) else {
            throw HudTranscriptionHTTPError.rejected(status: status, requestID: requestID)
        }
    }
}

/// Deliberately excludes vendor response bodies, URLs, and authorization headers.
public enum HudTranscriptionHTTPError: Error, Sendable, Equatable {
    case invalidResponse
    case insecureEndpoint
    case invalidEndpoint
    case rejected(status: Int, requestID: String?)
    case connectionFailed
    case invalidMultipartField
    case incompatibleOptions
    case fileNotReady
}

public struct HudTranscriptionURLSessionTransport: HudTranscriptionHTTPTransport {
    private let session: URLSession

    public init(session: URLSession = .shared) { self.session = session }

    public func send(_ request: URLRequest) async throws -> HudTranscriptionHTTPResponse {
        let timeout = request.timeoutInterval
        guard timeout.isFinite, timeout > 0 else { throw HudTranscriptionHTTPError.invalidResponse }
        return try await withThrowingTaskGroup(of: HudTranscriptionHTTPResponse.self) { group in
            group.addTask { try await perform(request) }
            group.addTask {
                try await Task.sleep(for: .seconds(timeout))
                throw HudTranscriptionHTTPError.connectionFailed
            }
            defer { group.cancelAll() }
            guard let response = try await group.next() else { throw HudTranscriptionHTTPError.connectionFailed }
            return response
        }
    }

    private func perform(_ request: URLRequest) async throws -> HudTranscriptionHTTPResponse {
        do {
            let (body, response) = try await session.data(for: request, delegate: HudTranscriptionNoRedirectDelegate())
            guard let response = response as? HTTPURLResponse else {
                throw HudTranscriptionHTTPError.invalidResponse
            }
            let headers = response.allHeaderFields.reduce(into: [String: String]()) {
                guard let key = $1.key as? String, let value = $1.value as? String else { return }
                $0[key] = value
            }
            return .init(status: response.statusCode, headers: headers, body: body)
        } catch is CancellationError {
            throw CancellationError()
        } catch let error as URLError where error.code == .cancelled {
            throw CancellationError()
        } catch let error as HudTranscriptionHTTPError {
            throw error
        } catch {
            // The caller must regard failure after submission as uncertain, not retry automatically.
            throw HudTranscriptionHTTPError.connectionFailed
        }
    }
}

/// Provider endpoints are explicit. A redirect must be reviewed as configuration,
/// never followed implicitly with a Speech resource key or Gemini API key.
private final class HudTranscriptionNoRedirectDelegate: NSObject, URLSessionTaskDelegate, Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest,
                    completionHandler: @escaping @Sendable (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}
