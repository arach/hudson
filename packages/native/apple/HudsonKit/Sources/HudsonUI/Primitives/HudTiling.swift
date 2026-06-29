import SwiftUI

#if os(macOS)
import AppKit
#endif

// MARK: - Constraints (shared)

public struct TilingConstraints: Sendable, Equatable {
    public var maxColumns: Int?
    public var maxRows: Int?
    public var gap: CGFloat = HudSpacing.md
    public var maxItemWidth: CGFloat?
    public var maxItemHeight: CGFloat?
    public var minItemWidth: CGFloat = 120
    public var minItemHeight: CGFloat = 80
    public var maxFill: CGFloat = 1.0
    public var fillStrategy: FillStrategy = .maximize
    public var alignLastRow: AlignLastRow = .start
    public var preferMoreColumns: Bool = true

    public init(
        maxColumns: Int? = nil,
        maxRows: Int? = nil,
        gap: CGFloat = HudSpacing.md,
        maxItemWidth: CGFloat? = nil,
        maxItemHeight: CGFloat? = nil,
        minItemWidth: CGFloat = 120,
        minItemHeight: CGFloat = 80,
        maxFill: CGFloat = 1.0,
        fillStrategy: FillStrategy = .maximize,
        alignLastRow: AlignLastRow = .start,
        preferMoreColumns: Bool = true
    ) {
        self.maxColumns = maxColumns
        self.maxRows = maxRows
        self.gap = gap
        self.maxItemWidth = maxItemWidth
        self.maxItemHeight = maxItemHeight
        self.minItemWidth = minItemWidth
        self.minItemHeight = minItemHeight
        self.maxFill = maxFill
        self.fillStrategy = fillStrategy
        self.alignLastRow = alignLastRow
        self.preferMoreColumns = preferMoreColumns
    }

    public enum FillStrategy: Sendable, Equatable {
        case maximize
        case even
        case compact
    }

    public enum AlignLastRow: Sendable, Equatable {
        case start
        case center
        case stretch
    }

    public static let `default` = TilingConstraints()
}

public struct TileLayout: Equatable {
    public let key: AnyHashable
    public var x: CGFloat
    public var y: CGFloat
    public let width: CGFloat
    public let height: CGFloat

    fileprivate init(key: some Hashable, x: CGFloat, y: CGFloat, width: CGFloat, height: CGFloat) {
        self.key = AnyHashable(key)
        self.x = x
        self.y = y
        self.width = width
        self.height = height
    }
}

// MARK: - Shared layout computation (used by both backends)

/// Computes a space-filling grid layout for the given item keys inside a container.
/// Respects the provided constraints for columns, rows, gap, min/max sizes, fill strategy, etc.
public func computeTilingLayout(
    keys: [AnyHashable],
    containerWidth: CGFloat,
    containerHeight: CGFloat,
    constraints: TilingConstraints
) -> [TileLayout] {
    let n = keys.count
    if n == 0 || containerWidth <= 0 || containerHeight <= 0 { return [] }

    let gap = constraints.gap
    let maxCols = constraints.maxColumns ?? .max
    let maxRows = constraints.maxRows ?? .max
    let maxFill = min(max(constraints.maxFill, 0), 1)

    let effW = containerWidth * maxFill
    let effH = containerHeight * maxFill

    let minW = constraints.minItemWidth
    let minH = constraints.minItemHeight
    let maxW = constraints.maxItemWidth ?? .greatestFiniteMagnitude
    let maxH = constraints.maxItemHeight ?? .greatestFiniteMagnitude

    // Column count: respect explicit maxColumns as a hard upper bound.
    // When no maxColumns is set we use the old sqrt + preferMore heuristic.
    var cols: Int
    if let explicit = constraints.maxColumns {
        cols = min(explicit, n)
    } else {
        cols = max(1, Int(sqrt(Double(n))))
        if constraints.preferMoreColumns {
            cols = max(cols, (n + 1) / 2)
        }
        cols = min(maxCols, cols)
    }

    var rows = (n + cols - 1) / cols
    if rows > maxRows {
        rows = maxRows
        let effectiveMax = constraints.maxColumns ?? maxCols
        cols = min(effectiveMax, (n + rows - 1) / rows)
    }
    cols = min(cols, n)

    let totalGapW = CGFloat(max(0, cols - 1)) * gap
    let totalGapH = CGFloat(max(0, rows - 1)) * gap

    var cellW = (effW - totalGapW) / CGFloat(max(1, cols))
    var cellH = (effH - totalGapH) / CGFloat(max(1, rows))

    cellW = max(minW, min(cellW, maxW))
    cellH = max(minH, min(cellH, maxH))

    if constraints.fillStrategy == .maximize {
        let usedW = CGFloat(cols) * cellW + totalGapW
        if effW > usedW { cellW += (effW - usedW) / CGFloat(cols) }
        let usedH = CGFloat(rows) * cellH + totalGapH
        if effH > usedH { cellH += (effH - usedH) / CGFloat(rows) }
        cellW = max(minW, min(cellW, maxW))
        cellH = max(minH, min(cellH, maxH))
    }

    var colWidths = Array(repeating: cellW, count: cols)
    var rowHeights = Array(repeating: cellH, count: rows)

    let lastRowCount = n % cols == 0 ? cols : n % cols

    if constraints.fillStrategy != .even && constraints.alignLastRow == .stretch && lastRowCount > 0 {
        let lastGap = CGFloat(lastRowCount - 1) * gap
        let stretched = (effW - lastGap) / CGFloat(lastRowCount)
        for c in 0..<lastRowCount {
            colWidths[c] = max(minW, min(stretched, maxW))
        }
    }

    var colStarts: [CGFloat] = [0]
    for c in 0..<cols-1 {
        colStarts.append(colStarts.last! + colWidths[c] + gap)
    }

    var rowStarts: [CGFloat] = [0]
    for r in 0..<rows-1 {
        rowStarts.append(rowStarts.last! + rowHeights[r] + gap)
    }

    var layouts: [TileLayout] = []

    for i in 0..<n {
        let col = i % cols
        let row = i / cols
        var w = colWidths[col]
        var h = rowHeights[row]
        var x = colStarts[col]
        var y = rowStarts[row]

        if row == rows - 1 && constraints.alignLastRow == .center && lastRowCount < cols {
            let rowW = CGFloat(lastRowCount) * colWidths[col] + CGFloat(lastRowCount - 1) * gap
            let off = (effW - rowW) / 2
            x = off + CGFloat(col) * (w + gap)
        }

        layouts.append(TileLayout(key: keys[i], x: x, y: y, width: w, height: h))
    }

    // Global centering
    if constraints.fillStrategy == .even || (constraints.fillStrategy == .compact && constraints.alignLastRow != .stretch) {
        let totalW = colStarts.last! + colWidths.last!
        let totalH = rowStarts.last! + rowHeights.last!
        let offX = max(0, (effW - totalW) / 2)
        let offY = max(0, (effH - totalH) / 2)
        for i in layouts.indices {
            layouts[i].x += offX
            layouts[i].y += offY
        }
    }

    if maxFill < 1 {
        let offX = (containerWidth - effW) / 2
        let offY = (containerHeight - effH) / 2
        for i in layouts.indices {
            layouts[i].x += offX
            layouts[i].y += offY
        }
    }

    return layouts
}

// MARK: - Public API

/// Universal space-filling tiler for items (terminals, chats, docs, etc.).
///
/// On macOS this is implemented with AppKit for fine-grained control over
/// layout, dragging, and pixel-perfect behavior.
public struct HudTiling<Item: Identifiable & Sendable>: View where Item.ID: Hashable & Sendable {
    private let items: [Item]
    private let constraints: TilingConstraints
    private let renderItem: (Item) -> AnyView

    @State private var order: [Item.ID]

    public init(
        items: [Item],
        constraints: TilingConstraints = .default,
        @ViewBuilder renderItem: @escaping (Item) -> some View
    ) {
        self.items = items
        self.constraints = constraints
        self.renderItem = { AnyView(renderItem($0)) }
        _order = State(initialValue: items.map(\.id))
    }

    public var body: some View {
        #if os(macOS)
        HudTilingRepresentable(
            items: items,
            order: $order,
            constraints: constraints,
            renderItem: renderItem
        )
        #else
        // SwiftUI fallback for iOS/iPad (available "for free")
        _HudTilingSwiftUI(
            items: items,
            order: $order,
            constraints: constraints,
            renderItem: renderItem
        )
        #endif
    }
}

// MARK: - macOS: AppKit implementation for best polish and control

#if os(macOS)
private struct HudTilingRepresentable<Item: Identifiable>: NSViewRepresentable where Item.ID: Hashable {
    let items: [Item]
    @Binding var order: [Item.ID]
    let constraints: TilingConstraints
    let renderItem: (Item) -> AnyView

    func makeCoordinator() -> Coordinator {
        Coordinator(order: $order)
    }

    func makeNSView(context: Context) -> HudTilingView {
        let view = HudTilingView()
        // Coordinator wiring would be set via update or a separate generic coordinator pattern
        return view
    }

    func updateNSView(_ nsView: HudTilingView, context: Context) {
        // Rebuild hosted content
        let currentOrder = order.isEmpty ? items.map(\.id) : order
        let orderedItems = currentOrder.compactMap { id in items.first { $0.id == id } }

        let hostingViews: [NSView] = orderedItems.map { item in
            let hosting = NSHostingView(rootView: renderItem(item))
            hosting.translatesAutoresizingMaskIntoConstraints = false
            return hosting
        }

        nsView.onOrderChange = { newKeys in
            // Map AnyHashable back — in production you'd keep typed IDs
            DispatchQueue.main.async {
                self.order = newKeys.compactMap { $0 as? Item.ID }
            }
        }

        nsView.updateTiles(
            keys: currentOrder.map(AnyHashable.init),
            views: hostingViews,
            constraints: constraints
        )
    }

    final class Coordinator {
        var order: Binding<[Item.ID]>
        init(order: Binding<[Item.ID]>) { self.order = order }
    }
}

private final class HudTilingView: NSView {
    private var tileKeys: [AnyHashable] = []
    private var tileViews: [NSView] = []
    private var tilingConstraints = TilingConstraints.default

    // For order updates we use a callback (in real code this would be a generic coordinator)
    var onOrderChange: (([AnyHashable]) -> Void)?

    private var draggingIndex: Int?

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        wantsLayer = true
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { nil }

    func updateTiles(keys: [AnyHashable], views: [NSView], constraints: TilingConstraints) {
        tileViews.forEach { $0.removeFromSuperview() }

        self.tileKeys = keys
        self.tileViews = views
        self.tilingConstraints = constraints

        views.forEach { addSubview($0) }

        needsLayout = true
    }

    override func layout() {
        super.layout()
        relayoutTiles()
    }

    private func relayoutTiles() {
        guard !tileViews.isEmpty, bounds.width > 0, bounds.height > 0 else { return }

        let layouts = computeTilingLayout(
            keys: tileKeys,
            containerWidth: bounds.width,
            containerHeight: bounds.height,
            constraints: tilingConstraints
        )

        for (i, view) in tileViews.enumerated() {
            guard i < layouts.count else { continue }
            let l = layouts[i]
            view.frame = NSRect(x: l.x, y: l.y, width: l.width, height: l.height)
        }
    }

    // MARK: - Fine-grained AppKit drag & reorder for polish

    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }

    override func mouseDown(with event: NSEvent) {
        let location = convert(event.locationInWindow, from: nil)
        if let idx = tileViews.firstIndex(where: { $0.frame.contains(location) }) {
            draggingIndex = idx
        }
    }

    override func mouseDragged(with event: NSEvent) {
        guard let startIdx = draggingIndex else { return }
        let location = convert(event.locationInWindow, from: nil)

        var target = startIdx
        var bestDist = CGFloat.greatestFiniteMagnitude

        for (i, view) in tileViews.enumerated() {
            let center = NSPoint(x: view.frame.midX, y: view.frame.midY)
            let dist = hypot(center.x - location.x, center.y - location.y)
            if dist < bestDist {
                bestDist = dist
                target = i
            }
        }

        if target != startIdx {
            let v = tileViews.remove(at: startIdx)
            tileViews.insert(v, at: target)

            let k = tileKeys.remove(at: startIdx)
            tileKeys.insert(k, at: target)

            draggingIndex = target
            relayoutTiles()
        }
    }

    override func mouseUp(with event: NSEvent) {
        if draggingIndex != nil {
            onOrderChange?(tileKeys)
        }
        draggingIndex = nil
    }
}
#endif

// MARK: - iOS / fallback SwiftUI (minimal, "for free")

#if !os(macOS)
private struct _HudTilingSwiftUI<Item: Identifiable>: View where Item.ID: Hashable {
    let items: [Item]
    @Binding var order: [Item.ID]
    let constraints: TilingConstraints
    let renderItem: (Item) -> AnyView

    var body: some View {
        // Simplified version of the earlier pure-SwiftUI tiler for non-macOS
        GeometryReader { geo in
            let layouts = computeTilingLayout(
                keys: order.isEmpty ? items.map { AnyHashable($0.id) } : order.map(AnyHashable.init),
                containerWidth: geo.size.width,
                containerHeight: geo.size.height,
                constraints: constraints
            )

            let ordered = order.isEmpty ? items : order.compactMap { id in items.first(where: { $0.id == id }) }

            ZStack(alignment: .topLeading) {
                ForEach(Array(ordered.enumerated()), id: \.element.id) { pair in
                    let (idx, item) = pair
                    if idx < layouts.count {
                        let l = layouts[idx]
                        renderItem(item)
                            .frame(width: l.width, height: l.height)
                            .offset(x: l.x, y: l.y)
                    }
                }
            }
        }
    }
}
#endif

// Helper to loosen typing in coordinator example
private struct AnyIdentifiable: Identifiable {
    let id: AnyHashable
}