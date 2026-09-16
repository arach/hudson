import Foundation

public struct HudTranscriptionEndpoint: Sendable, Equatable {
    public let baseURL: URL

    public init(_ baseURL: URL) throws {
        guard baseURL.scheme == "https" else { throw HudTranscriptionHTTPError.insecureEndpoint }
        guard baseURL.host != nil, baseURL.user == nil, baseURL.password == nil,
              baseURL.query == nil, baseURL.fragment == nil else {
            throw HudTranscriptionHTTPError.invalidEndpoint
        }
        self.baseURL = baseURL
    }

    public func url(path: String, query: [URLQueryItem] = []) throws -> URL {
        guard !path.contains("://"), !path.split(separator: "/").contains("..") else {
            throw HudTranscriptionHTTPError.invalidEndpoint
        }
        let url = baseURL.appendingPathComponent(path)
        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            throw HudTranscriptionHTTPError.invalidEndpoint
        }
        components.queryItems = query.isEmpty ? nil : query
        guard let result = components.url else { throw HudTranscriptionHTTPError.invalidEndpoint }
        return result
    }
}
