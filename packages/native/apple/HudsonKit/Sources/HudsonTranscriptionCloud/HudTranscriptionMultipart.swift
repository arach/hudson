import Foundation

/// Multipart encoder shared by file adapters. File names are caller supplied metadata,
/// never full paths. Reject header injection before constructing any request.
public struct HudTranscriptionMultipart: Sendable {
    public let boundary: String
    private var body = Data()

    public init() { boundary = "hudson-" + UUID().uuidString }
    public var contentType: String { "multipart/form-data; boundary=\(boundary)" }

    public mutating func append(name: String, text: String) throws {
        try validate(name)
        append("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(name)\"\r\n\r\n")
        append(text)
        append("\r\n")
    }

    public mutating func append(name: String, filename: String, mimeType: String, data: Data) throws {
        try validate(name)
        try validate(filename)
        try validate(mimeType)
        append("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(name)\"; filename=\"\(filename)\"\r\nContent-Type: \(mimeType)\r\n\r\n")
        body.append(data)
        append("\r\n")
    }

    public func encoded() -> Data {
        var result = body
        result.append(Data("--\(boundary)--\r\n".utf8))
        return result
    }

    private func validate(_ value: String) throws {
        guard !value.isEmpty, !value.unicodeScalars.contains(where: { $0.value < 32 || $0.value == 127 || $0 == "\"" || $0 == "\\" }) else {
            throw HudTranscriptionHTTPError.invalidMultipartField
        }
    }

    private mutating func append(_ value: String) { body.append(Data(value.utf8)) }
}
