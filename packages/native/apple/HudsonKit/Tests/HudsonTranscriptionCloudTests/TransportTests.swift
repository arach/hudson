import Foundation
import Testing
@testable import HudsonTranscriptionCloud

@Test func transportEncodingAndValidation() throws {
        let endpoint = try HudTranscriptionEndpoint(URL(string: "https://example.com/base")!)
        let url = try endpoint.url(path: "transcribe", query: [.init(name: "model", value: "a b")])
        #expect(url.absoluteString == "https://example.com/base/transcribe?model=a%20b")
        for raw in ["http://example.com", "https://user:secret@example.com", "https://example.com?key=secret"] {
            do { _ = try HudTranscriptionEndpoint(URL(string: raw)!); Issue.record("Invalid endpoint accepted") }
            catch is HudTranscriptionHTTPError {}
        }
        var multipart = HudTranscriptionMultipart()
        try multipart.append(name: "definition", text: "{\"model\":\"MAI-Transcribe-2\"}")
        try multipart.append(name: "audio", filename: "sample.wav", mimeType: "audio/wav", data: Data([0, 255, 13, 10]))
        let data = multipart.encoded()
        #expect(data.range(of: Data([0, 255, 13, 10])) != nil)
        #expect(data.suffix(Data("--\(multipart.boundary)--\r\n".utf8).count) == Data("--\(multipart.boundary)--\r\n".utf8))
        do { try multipart.append(name: "bad\r\nheader", text: "x"); Issue.record("Injection accepted") }
        catch HudTranscriptionHTTPError.invalidMultipartField {}
        let response = HudTranscriptionHTTPResponse(status: 429, headers: ["X-Request-ID": "request"], body: Data("private vendor payload".utf8))
        do { try response.requireSuccess(); Issue.record("429 accepted") }
        catch let error as HudTranscriptionHTTPError {
            #expect(error == .rejected(status: 429, requestID: "request"))
            #expect(!String(describing: error).contains("private vendor payload"))
        }
}
