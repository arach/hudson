import Foundation

/// Durable Graphite-style identity for a Hudson runtime node.
///
/// Format:
/// `hudson.<workspace>.<namespace>.<app>.<instance>.<role>`
struct GraphitePath: Codable, Hashable, Sendable, CustomStringConvertible {
    static let root = "hudson"
    static let componentPattern = #"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$"#

    var workspace: String
    var namespace: String
    var app: String
    var instance: String
    var role: String

    init(
        workspace: String,
        namespace: String,
        app: String,
        instance: String,
        role: String
    ) throws {
        self.workspace = try Self.validatedSlug(workspace, field: "workspace")
        self.namespace = try Self.validatedSlug(namespace, field: "namespace")
        self.app = try Self.validatedSlug(app, field: "app")
        self.instance = try Self.validatedSlug(instance, field: "instance")
        self.role = try Self.validatedSlug(role, field: "role")
    }

    init(parse text: String) throws {
        let parts = text.split(separator: ".", omittingEmptySubsequences: false).map(String.init)
        guard parts.count == 6, parts.first == Self.root else {
            throw GraphitePathError.invalidPath(text)
        }

        try self.init(
            workspace: parts[1],
            namespace: parts[2],
            app: parts[3],
            instance: parts[4],
            role: parts[5]
        )
    }

    var components: [String] {
        [Self.root, workspace, namespace, app, instance, role]
    }

    var description: String {
        components.joined(separator: ".")
    }

    var tmuxSafeName: String {
        components.joined(separator: "_")
    }

    static func slugify(_ value: String, fallback: String = "node") -> String {
        let folded = value
            .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "en_US_POSIX"))
            .lowercased()

        var output = ""
        var previousWasDash = false

        for scalar in folded.unicodeScalars {
            let isLowercaseLetter = scalar.value >= 97 && scalar.value <= 122
            let isDigit = scalar.value >= 48 && scalar.value <= 57

            if isLowercaseLetter || isDigit {
                output.unicodeScalars.append(scalar)
                previousWasDash = false
            } else if !previousWasDash {
                output.append("-")
                previousWasDash = true
            }
        }

        let trimmed = output.trimmingCharacters(in: CharacterSet(charactersIn: "-"))
        let candidate = String(trimmed.prefix(63))
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
        return candidate.isEmpty ? fallback : candidate
    }

    static func validatedSlug(_ value: String, field: String) throws -> String {
        let candidate = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !candidate.isEmpty else {
            throw GraphitePathError.emptyComponent(field)
        }

        guard candidate.range(of: componentPattern, options: .regularExpression) != nil else {
            throw GraphitePathError.invalidComponent(field: field, value: value)
        }

        return candidate
    }
}

enum GraphitePathError: Error, LocalizedError, Equatable, Sendable {
    case emptyComponent(String)
    case invalidComponent(field: String, value: String)
    case invalidPath(String)

    var errorDescription: String? {
        switch self {
        case .emptyComponent(let field):
            "\(field) is empty"
        case .invalidComponent(let field, let value):
            "\(field) must be a lowercase slug, got '\(value)'"
        case .invalidPath(let value):
            "path must match hudson.<workspace>.<namespace>.<app>.<instance>.<role>, got '\(value)'"
        }
    }
}

