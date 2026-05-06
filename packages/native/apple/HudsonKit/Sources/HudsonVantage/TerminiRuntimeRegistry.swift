import Foundation

struct TmuxTarget: Codable, Hashable, Sendable {
    var session: String
    var window: String
    var pane: String?
    var role: String
    var path: GraphitePath

    init(
        session: String,
        window: String,
        pane: String? = nil,
        role: String,
        path: GraphitePath
    ) throws {
        self.session = try TmuxTarget.validatedName(session, field: "session")
        self.window = try TmuxTarget.validatedName(window, field: "window")
        self.pane = try pane.map { try TmuxTarget.validatedPane($0) }
        self.role = try GraphitePath.validatedSlug(role, field: "role")
        self.path = path
    }

    var windowTarget: String {
        "\(session):\(window)"
    }

    var paneTarget: String {
        guard let pane else { return windowTarget }
        return "\(windowTarget).\(pane)"
    }

    static func from(path: GraphitePath, pane: String? = nil) throws -> TmuxTarget {
        try TmuxTarget(
            session: "\(GraphitePath.root)-\(path.workspace)",
            window: "\(path.namespace)-\(path.app)-\(path.instance)",
            pane: pane,
            role: path.role,
            path: path
        )
    }

    static func validatedName(_ value: String, field: String) throws -> String {
        let candidate = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !candidate.isEmpty else {
            throw TmuxTargetError.emptyField(field)
        }

        let disallowed = CharacterSet(charactersIn: ":. \t\r\n")
        guard candidate.rangeOfCharacter(from: disallowed) == nil else {
            throw TmuxTargetError.invalidField(field: field, value: value)
        }

        return candidate
    }

    static func validatedTarget(_ value: String) throws -> String {
        let candidate = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !candidate.isEmpty else {
            throw TmuxTargetError.emptyField("target")
        }

        let disallowed = CharacterSet.whitespacesAndNewlines
            .union(CharacterSet(charactersIn: ";'\"`$\\"))
        guard candidate.rangeOfCharacter(from: disallowed) == nil else {
            throw TmuxTargetError.invalidField(field: "target", value: value)
        }

        return candidate
    }

    static func validatedPane(_ value: String) throws -> String {
        let candidate = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !candidate.isEmpty else {
            throw TmuxTargetError.emptyField("pane")
        }
        guard candidate.allSatisfy(\.isNumber) || candidate.first == "%" else {
            throw TmuxTargetError.invalidField(field: "pane", value: value)
        }
        return candidate
    }
}

enum TmuxTargetError: Error, LocalizedError, Equatable, Sendable {
    case emptyField(String)
    case invalidField(field: String, value: String)

    var errorDescription: String? {
        switch self {
        case .emptyField(let field):
            "\(field) is empty"
        case .invalidField(let field, let value):
            "\(field) contains characters that are unsafe for a tmux target: '\(value)'"
        }
    }
}

struct TerminiCanvasBounds: Codable, Hashable, Sendable {
    var x: Double
    var y: Double
    var width: Double
    var height: Double
}

enum TerminiRenderState: String, Codable, Sendable {
    case live
    case preview
    case suspended
    case missing
}

struct TerminiRegistryRecord: Codable, Identifiable, Hashable, Sendable {
    var id: UUID { nodeID }

    var nodeID: UUID
    var path: GraphitePath
    var tmuxTarget: TmuxTarget
    var bounds: TerminiCanvasBounds
    var zIndex: Double
    var renderState: TerminiRenderState
    var updatedAt: Date

    init(
        nodeID: UUID,
        path: GraphitePath,
        tmuxTarget: TmuxTarget,
        bounds: TerminiCanvasBounds,
        zIndex: Double,
        renderState: TerminiRenderState,
        updatedAt: Date = Date()
    ) {
        self.nodeID = nodeID
        self.path = path
        self.tmuxTarget = tmuxTarget
        self.bounds = bounds
        self.zIndex = zIndex
        self.renderState = renderState
        self.updatedAt = updatedAt
    }
}
