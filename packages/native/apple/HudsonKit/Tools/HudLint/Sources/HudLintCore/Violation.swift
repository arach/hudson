import Foundation

public struct Violation: Equatable, Hashable, Sendable {
    public let file: String
    public let line: Int
    public let column: Int
    public let category: RuleCategory
    public let message: String
    public let snippet: String

    public init(
        file: String,
        line: Int,
        column: Int,
        category: RuleCategory,
        message: String,
        snippet: String
    ) {
        self.file = file
        self.line = line
        self.column = column
        self.category = category
        self.message = message
        self.snippet = snippet
    }
}

public enum RuleCategory: String, CaseIterable, Sendable {
    case palette
    case typography
    case spacing
    case geometry
    case opacity

    public var token: String { rawValue }
}
