import SwiftUI

/// Tabular data primitive. Presentational + selectable in v1 — sorting,
/// editing, and built-in detail-mode are deliberately deferred. Apps that
/// need drill-down compose `onSelect` with `NavigationStack` / sheet / their
/// own inspector.
///
/// ```swift
/// HudTable(agents, columns: [
///     HudTableColumn("Name") { Text($0.name) },
///     HudTableColumn("Status", alignment: .center) { HudBadge($0.status, ...) },
///     HudTableColumn("Updated", alignment: .trailing) { Text($0.updatedAt) },
/// ]) { agent in
///     selectedAgent = agent
/// }
/// ```
///
/// Density: `.compact` for dense data tables, `.regular` for primary content.
/// Selection: tap any row to dispatch `onSelect`. The selected-row id is held
/// internally for visual highlight; pass `selection:` if your view-model owns
/// the source of truth.
public struct HudTable<Item: Identifiable>: View {
    private let items: [Item]
    private let columns: [HudTableColumn<Item>]
    private let density: HudTableDensity
    private let selection: Binding<Item.ID?>?
    private let onSelect: ((Item) -> Void)?

    @State private var internalSelection: Item.ID?

    public init(
        _ items: [Item],
        columns: [HudTableColumn<Item>],
        density: HudTableDensity = .regular,
        selection: Binding<Item.ID?>? = nil,
        onSelect: ((Item) -> Void)? = nil
    ) {
        self.items = items
        self.columns = columns
        self.density = density
        self.selection = selection
        self.onSelect = onSelect
    }

    public var body: some View {
        VStack(spacing: 0) {
            header
            HudDivider(color: HudHairline.standard)
            ForEach(items) { item in
                row(for: item)
                if item.id != items.last?.id {
                    HudDivider()
                }
            }
        }
        .background(HudPalette.surface)
        .overlay(
            RoundedRectangle(cornerRadius: HudRadius.standard)
                .stroke(HudHairline.subtle, lineWidth: HudStrokeWidth.thin)
        )
        .clipShape(RoundedRectangle(cornerRadius: HudRadius.standard))
    }

    private var header: some View {
        HStack(spacing: HudSpacing.lg) {
            ForEach(Array(columns.enumerated()), id: \.offset) { _, column in
                Text(column.title.uppercased())
                    .font(HudFont.mono(HudTextSize.micro, weight: .medium))
                    .foregroundStyle(HudPalette.dim)
                    .frame(maxWidth: .infinity, alignment: column.alignment)
            }
        }
        .padding(.horizontal, HudSpacing.lg)
        .frame(height: HudLayout.rowHeightCompact)
    }

    private func row(for item: Item) -> some View {
        let currentSelection = selection?.wrappedValue ?? internalSelection
        let isSelected = currentSelection == item.id
        return HStack(spacing: HudSpacing.lg) {
            ForEach(Array(columns.enumerated()), id: \.offset) { _, column in
                column.cell(item)
                    .frame(maxWidth: .infinity, alignment: column.alignment)
                    .font(HudFont.ui(HudTextSize.sm))
                    .foregroundStyle(HudPalette.ink)
            }
        }
        .padding(.horizontal, HudSpacing.lg)
        .frame(height: density.rowHeight)
        .background(isSelected ? HudSurface.tintFill(HudPalette.accent) : Color.clear)
        .contentShape(Rectangle())
        .onTapGesture {
            if let selection {
                selection.wrappedValue = item.id
            } else {
                internalSelection = item.id
            }
            onSelect?(item)
        }
    }
}

/// One column descriptor for `HudTable`. Cell content is a closure receiving
/// the row item — return any `View`, including Hudson primitives like
/// `HudBadge`, `HudStatusDot`, etc.
public struct HudTableColumn<Item> {
    public let title: String
    public let alignment: Alignment
    public let cell: (Item) -> AnyView

    public init(
        _ title: String,
        alignment: Alignment = .leading,
        @ViewBuilder cell: @escaping (Item) -> some View
    ) {
        self.title = title
        self.alignment = alignment
        self.cell = { item in AnyView(cell(item)) }
    }
}

/// Row-height vocabulary for HudTable. `.compact` for dense data; `.regular`
/// for primary content. Tighter than the iOS `List` defaults so tables stay
/// dense without losing legibility.
public enum HudTableDensity: Sendable {
    case compact
    case regular

    var rowHeight: CGFloat {
        switch self {
        case .compact: return HudLayout.rowHeightCompact
        case .regular: return HudLayout.rowHeightRegular
        }
    }
}
