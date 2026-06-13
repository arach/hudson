import SwiftUI
import HudsonUI

/// Talkie-style settings surface: thin expandable secondary nav + detail pane.
///
/// Host apps provide a `HudSettingsCatalog` and a shared `HudSecondaryNavState`.
/// Pair with `HudSettingsFooterButton` in the primary sidebar footer so apps do
/// not rebuild settings chrome themselves.
public struct HudSettingsWorkspace<Selection: Hashable>: View {
    @Binding private var selection: Selection
    private let catalog: HudSettingsCatalog<Selection>
    @ObservedObject private var navState: HudSecondaryNavState
    private let title: String

    @Environment(\.hudTheme) private var theme

    public init(
        selection: Binding<Selection>,
        catalog: HudSettingsCatalog<Selection>,
        navState: HudSecondaryNavState,
        title: String = "Settings"
    ) {
        self._selection = selection
        self.catalog = catalog
        self._navState = ObservedObject(wrappedValue: navState)
        self.title = title
    }

    public var body: some View {
        HStack(alignment: .top, spacing: 0) {
            HudSecondaryNav(
                selection: $selection,
                entries: catalog.entries,
                state: navState,
                title: title
            )
            .frame(width: navState.layoutWidth, alignment: .leading)
            .frame(maxHeight: .infinity)
            .layoutPriority(1)

            HudDivider(color: theme.hairline.subtle, axis: .vertical)

            detailPane
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .background(theme.palette.bg)
    }

    private var detailPane: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let pageTitle = catalog.title(for: selection) {
                Text(pageTitle)
                    .font(HudFont.ui(HudTextSize.xl, weight: .semibold))
                    .foregroundStyle(theme.palette.ink)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, HudSpacing.huge)
                    .padding(.top, HudSpacing.xxl)
                    .padding(.bottom, HudSpacing.lg)
            }

            ScrollView {
                catalog.content(for: selection)
                    .frame(maxWidth: HudLayout.dialogWidth, alignment: .topLeading)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, HudSpacing.huge)
                    .padding(.bottom, HudSpacing.huge)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(theme.palette.bg)
    }
}