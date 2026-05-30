import Foundation

/// Live snapshot published by an embedded `HudVantageSurface` for host chrome
/// such as the menu-bar extra or status widgets.
public struct HudVantageHostStatus: Sendable, Equatable {
    public var workspaceID: String
    public var nodeCount: Int
    public var selectedCount: Int
    public var controlStatus: String

    public init(
        workspaceID: String,
        nodeCount: Int,
        selectedCount: Int,
        controlStatus: String
    ) {
        self.workspaceID = workspaceID
        self.nodeCount = nodeCount
        self.selectedCount = selectedCount
        self.controlStatus = controlStatus
    }

    init?(userInfo: [AnyHashable: Any]?) {
        guard let workspaceID = userInfo?["workspaceID"] as? String,
              let nodeCount = userInfo?["nodeCount"] as? Int,
              let selectedCount = userInfo?["selectedCount"] as? Int,
              let controlStatus = userInfo?["controlStatus"] as? String
        else {
            return nil
        }
        self.workspaceID = workspaceID
        self.nodeCount = nodeCount
        self.selectedCount = selectedCount
        self.controlStatus = controlStatus
    }

    var userInfo: [AnyHashable: Any] {
        [
            "workspaceID": workspaceID,
            "nodeCount": nodeCount,
            "selectedCount": selectedCount,
            "controlStatus": controlStatus,
        ]
    }
}

extension Notification.Name {
    public static let vantageHostStatus = Notification.Name("com.hudsonkit.vantage.hostStatus")
}

public enum HudVantageHostStatusCenter {
    public static func post(_ status: HudVantageHostStatus) {
        NotificationCenter.default.post(
            name: .vantageHostStatus,
            object: nil,
            userInfo: status.userInfo
        )
    }
}
