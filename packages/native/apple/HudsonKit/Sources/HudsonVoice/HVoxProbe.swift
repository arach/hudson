import Foundation

private struct HVoxProbeRequest: Encodable {
    let id: String
    let method: String
    let params: [String: HJSONValue]
}

private struct HVoxProbeResponse: Decodable {
    let result: [String: HJSONValue]?
    let error: HJSONValue?
}

/// Lightweight one-shot Vox daemon checks for native HudsonKit surfaces.
public enum HVoxProbe {
    public static func health(
        endpoint: HVoxEndpoint = HVoxEndpoint(),
        clientId: String = "HudsonKit"
    ) async throws -> HVoxHealth {
        let response = try await call(
            endpoint: endpoint,
            method: "health",
            params: ["clientId": .string(clientId)]
        )

        return HVoxHealth(
            service: response.string("service") ?? "Vox",
            version: response.string("version") ?? "unknown",
            startedAt: response.string("startedAt"),
            pid: response.int("pid"),
            port: response.int("port")
        )
    }

    private static func call(
        endpoint: HVoxEndpoint,
        method: String,
        params: [String: HJSONValue]
    ) async throws -> [String: HJSONValue] {
        let webSocket = URLSession.shared.webSocketTask(with: endpoint.url)
        webSocket.resume()
        defer { webSocket.cancel(with: .normalClosure, reason: nil) }

        let request = HVoxProbeRequest(id: UUID().uuidString, method: method, params: params)
        let data = try JSONEncoder().encode(request)
        guard let text = String(data: data, encoding: .utf8) else {
            throw HVoxError.invalidMessage
        }

        try await webSocket.send(.string(text))
        let message = try await webSocket.receive()

        let payload: Data
        switch message {
        case .string(let text):
            guard let encoded = text.data(using: .utf8) else {
                throw HVoxError.invalidMessage
            }
            payload = encoded
        case .data(let data):
            payload = data
        @unknown default:
            throw HVoxError.invalidMessage
        }

        let response = try JSONDecoder().decode(HVoxProbeResponse.self, from: payload)
        if let error = response.error {
            throw HVoxError.provider(error.stringValue ?? String(describing: error))
        }
        guard let result = response.result else {
            throw HVoxError.invalidMessage
        }
        return result
    }
}
