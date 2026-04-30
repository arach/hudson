import Foundation

private struct HudsonVoxProbeRequest: Encodable {
    let id: String
    let method: String
    let params: [String: HudsonJSONValue]
}

private struct HudsonVoxProbeResponse: Decodable {
    let result: [String: HudsonJSONValue]?
    let error: HudsonJSONValue?
}

/// Lightweight one-shot Vox daemon checks for native HudsonKit surfaces.
public enum HudsonVoxProbe {
    public static func health(
        endpoint: HudsonVoxEndpoint = HudsonVoxEndpoint(),
        clientId: String = "HudsonKit"
    ) async throws -> HudsonVoxHealth {
        let response = try await call(
            endpoint: endpoint,
            method: "health",
            params: ["clientId": .string(clientId)]
        )

        return HudsonVoxHealth(
            service: response.string("service") ?? "Vox",
            version: response.string("version") ?? "unknown",
            startedAt: response.string("startedAt"),
            pid: response.int("pid"),
            port: response.int("port")
        )
    }

    private static func call(
        endpoint: HudsonVoxEndpoint,
        method: String,
        params: [String: HudsonJSONValue]
    ) async throws -> [String: HudsonJSONValue] {
        let webSocket = URLSession.shared.webSocketTask(with: endpoint.url)
        webSocket.resume()
        defer { webSocket.cancel(with: .normalClosure, reason: nil) }

        let request = HudsonVoxProbeRequest(id: UUID().uuidString, method: method, params: params)
        let data = try JSONEncoder().encode(request)
        guard let text = String(data: data, encoding: .utf8) else {
            throw HudsonVoxError.invalidMessage
        }

        try await webSocket.send(.string(text))
        let message = try await webSocket.receive()

        let payload: Data
        switch message {
        case .string(let text):
            guard let encoded = text.data(using: .utf8) else {
                throw HudsonVoxError.invalidMessage
            }
            payload = encoded
        case .data(let data):
            payload = data
        @unknown default:
            throw HudsonVoxError.invalidMessage
        }

        let response = try JSONDecoder().decode(HudsonVoxProbeResponse.self, from: payload)
        if let error = response.error {
            throw HudsonVoxError.provider(error.stringValue ?? String(describing: error))
        }
        guard let result = response.result else {
            throw HudsonVoxError.invalidMessage
        }
        return result
    }
}
