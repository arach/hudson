import Foundation
import Testing
@testable import HudsonAI

@Suite("Anthropic HudAI adapter", .serialized)
struct AnthropicHudAIAdapterTests {
    @Test("constructs Anthropic request body with system, tools, usage, and cache envelopes")
    func requestBodyConstruction() async throws {
        let session = MockURLProtocol.session(status: 200, body: Self.messageResponse)
        let client = HudAIClient(
            provider: HudAIProviders.Anthropic(endpoint: URL(string: "https://example.test/v1/messages")!),
            vault: StaticCredentialSource(),
            urlSession: session
        )
        let tool = HudAIToolDefinition.untyped(
            name: "lookup_weather",
            description: "Look up stable weather data.",
            inputSchema: ["type": .string("object")]
        )
        let response = try await client.complete(HudAIRequest(
            model: "claude-test",
            messages: [.user("Hello")],
            system: "Stable system prompt",
            tools: [tool],
            temperature: 0.2,
            maxOutputTokens: 64,
            cache: .force
        ))

        #expect(response.usage.inputTokens == 12)
        #expect(response.usage.outputTokens == 4)
        #expect(response.usage.cacheCreationInputTokens == 8)
        #expect(response.usage.cacheReadInputTokens == 3)

        let body = try #require(MockURLProtocol.lastBody)
        let json = try #require(JSONSerialization.jsonObject(with: body) as? [String: Any])
        #expect(json["model"] as? String == "claude-test")
        #expect(json["max_tokens"] as? Int == 64)
        #expect(json["stream"] as? Bool == false)

        let system = try #require(json["system"] as? [[String: Any]])
        #expect(system.first?["type"] as? String == "text")
        let systemCache = try #require(system.first?["cache_control"] as? [String: Any])
        #expect(systemCache["type"] as? String == "ephemeral")

        let tools = try #require(json["tools"] as? [[String: Any]])
        #expect(tools.first?["name"] as? String == "lookup_weather")
        let toolCache = try #require(tools.first?["cache_control"] as? [String: Any])
        #expect(toolCache["type"] as? String == "ephemeral")
    }

    @Test("parses Anthropic SSE text, usage cache counters, and finish reason")
    func sseEventParsing() async throws {
        let session = MockURLProtocol.session(status: 200, body: Self.sseBody, contentType: "text/event-stream")
        let client = HudAIClient(
            provider: HudAIProviders.Anthropic(endpoint: URL(string: "https://example.test/v1/messages")!),
            vault: StaticCredentialSource(),
            urlSession: session
        )

        var completed: HudAIResponse?
        var deltas = ""
        for try await event in client.stream(HudAIRequest(messages: [.user("Hello")])) {
            switch event {
            case .textDelta(_, let text):
                deltas += text
            case .completed(let response):
                completed = response
            default:
                break
            }
        }

        let response = try #require(completed)
        #expect(deltas == "Hel")
        #expect(response.text == "Hel")
        #expect(response.finishReason == .stop)
        #expect(response.usage.inputTokens == 5)
        #expect(response.usage.outputTokens == 2)
        #expect(response.usage.cacheReadInputTokens == 7)
    }

    @Test("normalizes 401, 429, and 500 provider errors")
    func errorMapping() async throws {
        let unauthorized = try await thrownError(status: 401)
        guard case .credentialsInvalid(let provider, let key) = unauthorized else {
            Issue.record("Expected credentialsInvalid for 401, got \(unauthorized)")
            return
        }
        #expect(provider == .anthropic)
        #expect(key == "anthropic_key")

        let rateLimited = try await thrownError(status: 429)
        guard case .rateLimited(_, let status, _, _) = rateLimited else {
            Issue.record("Expected rateLimited for 429, got \(rateLimited)")
            return
        }
        #expect(status == 429)

        let overloaded = try await thrownError(status: 500)
        guard case .overloaded(_, let status, _, _) = overloaded else {
            Issue.record("Expected overloaded for 500, got \(overloaded)")
            return
        }
        #expect(status == 500)
    }

    @Test("automatic prompt cache control honors thresholds for system and tools")
    func promptCacheAutomaticThreshold() async throws {
        let session = MockURLProtocol.session(status: 200, body: Self.messageResponse)
        let client = HudAIClient(
            provider: HudAIProviders.Anthropic(endpoint: URL(string: "https://example.test/v1/messages")!),
            vault: StaticCredentialSource(),
            urlSession: session
        )
        let tool = HudAIToolDefinition.untyped(
            name: "lookup_docs",
            description: "Stable docs lookup",
            inputSchema: ["type": .string("object")]
        )
        _ = try await client.complete(HudAIRequest(
            messages: [.user("Hello")],
            system: "Stable",
            tools: [tool],
            cache: .automatic(minimumCharacters: 1)
        ))

        let body = try #require(MockURLProtocol.lastBody)
        let json = try #require(JSONSerialization.jsonObject(with: body) as? [String: Any])
        let system = try #require(json["system"] as? [[String: Any]])
        #expect((system.first?["cache_control"] as? [String: Any])?["type"] as? String == "ephemeral")
        let tools = try #require(json["tools"] as? [[String: Any]])
        #expect((tools.first?["cache_control"] as? [String: Any])?["type"] as? String == "ephemeral")
    }

    private func thrownError(status: Int) async throws -> HudAIError {
        let body = Data("{\"error\":{\"message\":\"provider said no\"}}".utf8)
        let session = MockURLProtocol.session(status: status, body: body)
        let client = HudAIClient(
            provider: HudAIProviders.Anthropic(endpoint: URL(string: "https://example.test/v1/messages")!),
            vault: StaticCredentialSource(),
            urlSession: session
        )
        do {
            _ = try await client.complete(HudAIRequest(messages: [.user("Hello")]))
        } catch let error as HudAIError {
            return error
        }
        throw TestFailure("Expected HudAIError")
    }

    private static let messageResponse = Data("""
    {
      "id":"msg_1",
      "model":"claude-test",
      "content":[{"type":"text","text":"Hi"}],
      "stop_reason":"end_turn",
      "usage":{
        "input_tokens":12,
        "output_tokens":4,
        "cache_creation_input_tokens":8,
        "cache_read_input_tokens":3
      }
    }
    """.utf8)

    private static let sseBody = Data("""
    data: {"type":"message_start","message":{"id":"msg_stream","model":"claude-test","usage":{"input_tokens":5}}}

    data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

    data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hel"}}

    data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":2,"cache_read_input_tokens":7}}

    data: {"type":"message_stop"}

    """.utf8)
}

private struct StaticCredentialSource: HudAICredentialSource {
    func get(_ key: String) async throws -> Data? {
        Data("test-key".utf8)
    }
}

private final class MockURLProtocol: URLProtocol {
    nonisolated(unsafe) static var status = 200
    nonisolated(unsafe) static var body = Data()
    nonisolated(unsafe) static var contentType = "application/json"
    nonisolated(unsafe) static var lastBody: Data?

    static func session(status: Int, body: Data, contentType: String = "application/json") -> URLSession {
        self.status = status
        self.body = body
        self.contentType = contentType
        self.lastBody = nil
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MockURLProtocol.self]
        return URLSession(configuration: configuration)
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Self.lastBody = request.httpBody ?? request.httpBodyStream.flatMap(Self.read)
        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: Self.status,
            httpVersion: "HTTP/1.1",
            headerFields: [
                "content-type": Self.contentType,
                "request-id": "req_test"
            ]
        )!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Self.body)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}

    private static func read(_ stream: InputStream) -> Data {
        stream.open()
        defer { stream.close() }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 1_024)
        while stream.hasBytesAvailable {
            let count = stream.read(&buffer, maxLength: buffer.count)
            if count > 0 {
                data.append(buffer, count: count)
            } else {
                break
            }
        }
        return data
    }
}

private struct TestFailure: Error, CustomStringConvertible {
    var description: String
    init(_ description: String) { self.description = description }
}
