import SwiftUI

public struct HudSettingsDestination<Selection: Hashable> {
    public let item: HudSecondaryNavItem<Selection>
    private let contentBuilder: () -> AnyView

    public init<Content: View>(
        id: Selection,
        icon: String,
        title: String,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.item = HudSecondaryNavItem(id: id, title: title, icon: icon)
        self.contentBuilder = { AnyView(content()) }
    }

    @ViewBuilder
    public func content() -> some View {
        contentBuilder()
    }
}

public struct HudSettingsGroup<Selection: Hashable> {
    public let title: String?
    public let destinations: [HudSettingsDestination<Selection>]

    public init(
        _ title: String? = nil,
        destinations: [HudSettingsDestination<Selection>]
    ) {
        self.title = title
        self.destinations = destinations
    }
}

/// Declarative registry for a settings workspace. Apps describe groups and
/// destinations once; `HudSettingsWorkspace` renders nav + detail routing.
public struct HudSettingsCatalog<Selection: Hashable> {
    public let groups: [HudSettingsGroup<Selection>]

    public init(groups: [HudSettingsGroup<Selection>]) {
        self.groups = groups
    }

    public var entries: [HudSecondaryNavEntry<Selection>] {
        groups.flatMap { group in
            var rows: [HudSecondaryNavEntry<Selection>] = []
            if let title = group.title {
                rows.append(.section(id: title, title: title))
            }
            rows += group.destinations.map { .item($0.item) }
            return rows
        }
    }

    public var defaultSelection: Selection? {
        groups.first?.destinations.first?.item.id
    }

    public func title(for selection: Selection) -> String? {
        groups
            .flatMap(\.destinations)
            .first(where: { $0.item.id == selection })?
            .item
            .title
    }

    @ViewBuilder
    public func content(for selection: Selection) -> some View {
        if let destination = groups
            .flatMap(\.destinations)
            .first(where: { $0.item.id == selection }) {
            destination.content()
        } else {
            EmptyView()
        }
    }
}