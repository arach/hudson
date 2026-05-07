import Foundation

/// Host-level callbacks for embedders that want to observe Vantage without
/// coupling directly to the SwiftUI surface.
///
/// Callback closures are isolated to the main actor so future app hosts can
/// update UI state without adding an extra dispatch hop. Defaults are no-ops.
public struct HudVantageHostCallbacks: Sendable {
    public var onHostEvent: @MainActor @Sendable (HudVantageHostEvent) -> Void
    public var onPermissionRequest: @MainActor @Sendable (HudVantagePermissionRequest) -> Void
    public var onRuntimeEvent: @MainActor @Sendable (HudVantageRuntimeEvent) -> Void

    public init(
        onHostEvent: @escaping @MainActor @Sendable (HudVantageHostEvent) -> Void = { _ in },
        onPermissionRequest: @escaping @MainActor @Sendable (HudVantagePermissionRequest) -> Void = { _ in },
        onRuntimeEvent: @escaping @MainActor @Sendable (HudVantageRuntimeEvent) -> Void = { _ in }
    ) {
        self.onHostEvent = onHostEvent
        self.onPermissionRequest = onPermissionRequest
        self.onRuntimeEvent = onRuntimeEvent
    }

    public static var noop: HudVantageHostCallbacks {
        HudVantageHostCallbacks()
    }
}

public struct HudVantageHostEvent: Codable, Hashable, Sendable {
    public enum Kind: String, Codable, CaseIterable, Sendable {
        case surfaceAppeared
        case surfaceDisappeared
        case surfaceReady
        case workspaceChanged
        case selectionChanged
    }

    public var id: UUID
    public var kind: Kind
    public var workspaceID: String?
    public var nodeID: UUID?
    public var message: String?
    public var metadata: [String: String]
    public var emittedAt: Date

    public init(
        id: UUID = UUID(),
        kind: Kind,
        workspaceID: String? = nil,
        nodeID: UUID? = nil,
        message: String? = nil,
        metadata: [String: String] = [:],
        emittedAt: Date = Date()
    ) {
        self.id = id
        self.kind = kind
        self.workspaceID = workspaceID
        self.nodeID = nodeID
        self.message = message
        self.metadata = metadata
        self.emittedAt = emittedAt
    }
}

public struct HudVantagePermissionRequest: Codable, Hashable, Sendable {
    public enum Kind: String, Codable, CaseIterable, Sendable {
        case accessibility
        case automation
        case fileSystem
        case network
        case runtimeInstall
        case processSpawn
        case remoteConnection
    }

    public var id: UUID
    public var kind: Kind
    public var title: String
    public var detail: String
    public var workspaceID: String?
    public var nodeID: UUID?
    public var command: String?
    public var target: String?
    public var metadata: [String: String]
    public var requestedAt: Date

    public init(
        id: UUID = UUID(),
        kind: Kind,
        title: String,
        detail: String,
        workspaceID: String? = nil,
        nodeID: UUID? = nil,
        command: String? = nil,
        target: String? = nil,
        metadata: [String: String] = [:],
        requestedAt: Date = Date()
    ) {
        self.id = id
        self.kind = kind
        self.title = title
        self.detail = detail
        self.workspaceID = workspaceID
        self.nodeID = nodeID
        self.command = command
        self.target = target
        self.metadata = metadata
        self.requestedAt = requestedAt
    }
}

public struct HudVantageRuntimeEvent: Codable, Hashable, Sendable {
    public enum Kind: String, Codable, CaseIterable, Sendable {
        case created
        case starting
        case ready
        case output
        case exited
        case failed
        case permissionRequired
    }

    public var id: UUID
    public var kind: Kind
    public var runtimeKind: String
    public var runtimeID: String?
    public var workspaceID: String?
    public var nodeID: UUID?
    public var target: String?
    public var graphitePath: String?
    public var remoteHost: String?
    public var message: String?
    public var exitCode: Int?
    public var metadata: [String: String]
    public var emittedAt: Date

    public init(
        id: UUID = UUID(),
        kind: Kind,
        runtimeKind: String,
        runtimeID: String? = nil,
        workspaceID: String? = nil,
        nodeID: UUID? = nil,
        target: String? = nil,
        graphitePath: String? = nil,
        remoteHost: String? = nil,
        message: String? = nil,
        exitCode: Int? = nil,
        metadata: [String: String] = [:],
        emittedAt: Date = Date()
    ) {
        self.id = id
        self.kind = kind
        self.runtimeKind = runtimeKind
        self.runtimeID = runtimeID
        self.workspaceID = workspaceID
        self.nodeID = nodeID
        self.target = target
        self.graphitePath = graphitePath
        self.remoteHost = remoteHost
        self.message = message
        self.exitCode = exitCode
        self.metadata = metadata
        self.emittedAt = emittedAt
    }
}
