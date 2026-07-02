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
    let maxFill = min(max(constraints.maxFill, 0), 1)

    let effW = containerWidth * maxFill
    let effH = containerHeight * maxFill

    let minW = constraints.minItemWidth
    let minH = constraints.minItemHeight
    let maxW = constraints.maxItemWidth ?? .greatestFiniteMagnitude
    let maxH = constraints.maxItemHeight ?? .greatestFiniteMagnitude

    let (cols, rows) = computeTilingGridShape(count: n, constraints: constraints)

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

/// Grid shape (columns × rows) that `computeTilingLayout` will use for `count` items.
///
/// Exposed as the single source of truth for the grid shape so callers (committed
/// relayout, live resize preview, tests) never have to reverse-engineer the column
/// count from tile origins.
func computeTilingGridShape(count: Int, constraints: TilingConstraints) -> (columns: Int, rows: Int) {
    guard count > 0 else { return (0, 0) }

    let maxCols = constraints.maxColumns ?? .max
    let maxRows = constraints.maxRows ?? .max

    // Column count: respect explicit maxColumns as a hard upper bound.
    // When no maxColumns is set we use the old sqrt + preferMore heuristic.
    var cols: Int
    if let explicit = constraints.maxColumns {
        cols = min(explicit, count)
    } else {
        cols = max(1, Int(Double(count).squareRoot()))
        if constraints.preferMoreColumns {
            cols = max(cols, (count + 1) / 2)
        }
        cols = min(maxCols, cols)
    }

    var rows = (count + cols - 1) / cols
    if rows > maxRows {
        rows = maxRows
        cols = min(maxCols, (count + rows - 1) / rows)
    }
    cols = min(cols, count)
    return (cols, rows)
}

/// Distributes container space across grid tracks (columns or rows).
///
/// Guarantees each track is at least `minSpan`; any excess beyond the minimums is
/// shared proportionally to `desired`. Used by both the committed relayout and the
/// live resize preview so the two always agree (no jump on mouseUp).
func distributeTilingSpans(
    desired: [CGFloat],
    available: CGFloat,
    gap: CGFloat,
    minSpan: CGFloat
) -> [CGFloat] {
    let count = desired.count
    guard count > 0 else { return [] }

    let totalGap = CGFloat(max(0, count - 1)) * gap
    let usable = available - totalGap
    let minTotal = CGFloat(count) * minSpan
    let excess = max(0, usable - minTotal)
    let sumDesired = desired.reduce(0, +)

    guard excess > 0, sumDesired > 0 else {
        return desired.map { max(minSpan, $0) }
    }
    return desired.map { minSpan + excess * ($0 / sumDesired) }
}

/// Resolved grid geometry: shape plus per-column/row spans and origins.
///
/// This is the shared math behind both the committed layout (`relayoutTiles`) and
/// the live resize preview in the macOS backend.
struct TilingGridMetrics: Equatable {
    let columns: Int
    let rows: Int
    let columnWidths: [CGFloat]
    let rowHeights: [CGFloat]
    let columnStarts: [CGFloat]
    let rowStarts: [CGFloat]

    func frame(at index: Int) -> CGRect {
        let c = index % columns
        let r = index / columns
        return CGRect(
            x: columnStarts[c],
            y: rowStarts[r],
            width: columnWidths[c],
            height: rowHeights[r]
        )
    }
}

/// Computes the effective grid geometry for the given keys, honoring bespoke
/// per-tile sizes when present (redistributed to exactly fill the container while
/// respecting `minItemWidth`/`minItemHeight` and gaps).
func computeTilingGridMetrics(
    keys: [AnyHashable],
    customSizes: [AnyHashable: CGSize],
    containerWidth: CGFloat,
    containerHeight: CGFloat,
    constraints: TilingConstraints
) -> TilingGridMetrics? {
    let n = keys.count
    guard n > 0, containerWidth > 0, containerHeight > 0 else { return nil }

    let (numCols, numRows) = computeTilingGridShape(count: n, constraints: constraints)
    guard numCols > 0, numRows > 0 else { return nil }

    let base = computeTilingLayout(
        keys: keys,
        containerWidth: containerWidth,
        containerHeight: containerHeight,
        constraints: constraints
    )
    guard base.count == n else { return nil }

    let gap = constraints.gap
    var columnWidths = [CGFloat](repeating: 0, count: numCols)
    var rowHeights = [CGFloat](repeating: 0, count: numRows)

    if customSizes.isEmpty {
        // Uniform case: the base compute already did the fill/min/max logic.
        for i in 0..<n {
            columnWidths[i % numCols] = base[i].width
            rowHeights[i / numCols] = base[i].height
        }
    } else {
        // Bespoke: desired span per logical column/row from the custom sizes
        // (logical assignment is by order position, not by current x/y), then
        // redistribute so the grid exactly fills the container.
        for i in 0..<n {
            let c = i % numCols
            let r = i / numCols
            let prefW = customSizes[keys[i]]?.width ?? base[i].width
            let prefH = customSizes[keys[i]]?.height ?? base[i].height
            columnWidths[c] = max(columnWidths[c], prefW)
            rowHeights[r] = max(rowHeights[r], prefH)
        }
        columnWidths = distributeTilingSpans(
            desired: columnWidths,
            available: containerWidth,
            gap: gap,
            minSpan: constraints.minItemWidth
        )
        rowHeights = distributeTilingSpans(
            desired: rowHeights,
            available: containerHeight,
            gap: gap,
            minSpan: constraints.minItemHeight
        )
    }

    var columnStarts = [CGFloat](repeating: 0, count: numCols)
    for c in 1..<numCols {
        columnStarts[c] = columnStarts[c - 1] + columnWidths[c - 1] + gap
    }
    var rowStarts = [CGFloat](repeating: 0, count: numRows)
    for r in 1..<numRows {
        rowStarts[r] = rowStarts[r - 1] + rowHeights[r - 1] + gap
    }

    return TilingGridMetrics(
        columns: numCols,
        rows: numRows,
        columnWidths: columnWidths,
        rowHeights: rowHeights,
        columnStarts: columnStarts,
        rowStarts: rowStarts
    )
}

// MARK: - Public API

/// Universal space-filling tiler for items (terminals, chats, docs, etc.).
///
/// On macOS this is implemented with AppKit for fine-grained control over
/// layout, dragging, and pixel-perfect behavior.
///
/// Drag-to-reorder:
/// - Grid stays stable (no premature swapping of other tiles).
/// - Dragged tile lifts and follows the pointer (using the original grab point)
///   as a lightweight snapshot overlay; the heavy hosted view stays put, dimmed.
/// - At the prospective landing spot we render a clear, accent-outlined drop
///   indicator + highlight ring (no opaque ghost, so the tiles underneath stay
///   visible).
/// - This makes it obvious *what will land where* without the layout looking
///   like it has already committed.
/// - Actual reorder + relayout happens only on mouseUp.
///
/// Current scope (native):
/// - Public API takes `items + constraints + renderItem + resizable + sizes`.
/// - Internal order state for drag-reorder; custom sizes are internal state by
///   default, or caller-owned when a `sizes` binding is passed.
/// - When `resizable: true`, users can drag tile edges/corners to resize bespoke (per-tile sizes override the uniform grid cells). Column/row splits can be adjusted by dragging near shared edges.
/// - Reordering and resizing are committed on mouse up.
/// - A "rebalance" back to the uniform grid = set the `sizes` binding to `[:]`.
///
/// Richer interactive demo (drag + free resize + persistence + rebalance) lives in PrimitivesTab
/// as a reference implementation that directly uses `computeTilingLayout` + custom ZStack/gestures.
/// See the web HudTiling for the more fully-featured prop surface (order, sizes, resizable, renderItem layout).
///
/// This divergence is intentional while we dogfood use cases; parity can be increased later.
public struct HudTiling<Item: Identifiable & Sendable>: View where Item.ID: Hashable & Sendable {
    private let items: [Item]
    private let constraints: TilingConstraints
    private let renderItem: (Item) -> AnyView
    private let resizable: Bool

    @State private var order: [Item.ID]
    @State private var customSizes: [Item.ID: CGSize] = [:]

    public init(
        items: [Item],
        constraints: TilingConstraints = .default,
        resizable: Bool = false,
        @ViewBuilder renderItem: @escaping (Item) -> some View
    ) {
        self.items = items
        self.constraints = constraints
        self.resizable = resizable
        self.renderItem = { AnyView(renderItem($0)) }
        _order = State(initialValue: items.map(\.id))
    }

    public var body: some View {
        #if os(macOS)
        HudTilingRepresentable(
            items: items,
            order: $order,
            customSizes: $customSizes,
            constraints: constraints,
            resizable: resizable,
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

// Reconcile order when the set of items changes (drop removed ids, append new ones at the end).
// This prevents stale order causing dropped/new items after items prop updates.
private func reconciledOrder<ItemID: Hashable>(current: [ItemID], items: [ItemID]) -> [ItemID] {
    let currentSet = Set(current)
    let itemSet = Set(items)
    // Keep only still-present in their relative order
    var result = current.filter { itemSet.contains($0) }
    // Append any new ids (in the order they appear in items)
    for id in items where !currentSet.contains(id) {
        result.append(id)
    }
    return result
}

// MARK: - macOS: AppKit implementation for best polish and control

#if os(macOS)
private struct HudTilingRepresentable<Item: Identifiable>: NSViewRepresentable where Item.ID: Hashable {
    let items: [Item]
    @Binding var order: [Item.ID]
    @Binding var customSizes: [Item.ID: CGSize]
    let constraints: TilingConstraints
    let resizable: Bool
    let renderItem: (Item) -> AnyView

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeNSView(context: Context) -> HudTilingView {
        let view = HudTilingView()
        return view
    }

    func updateNSView(_ nsView: HudTilingView, context: Context) {
        // Reconcile order against current items.
        let reconciled = reconciledOrder(current: order, items: items.map(\.id))
        if reconciled != order {
            DispatchQueue.main.async {
                if !self.order.isEmpty || !reconciled.isEmpty {
                    self.order = reconciled
                }
            }
        }

        let effectiveOrder = reconciled.isEmpty ? items.map(\.id) : reconciled
        let orderedItems = effectiveOrder.compactMap { id in items.first { $0.id == id } }

        let hostingViews: [NSView] = orderedItems.map { item in
            let hosting = NSHostingView(rootView: renderItem(item))
            hosting.translatesAutoresizingMaskIntoConstraints = false
            return hosting
        }

        nsView.onOrderChange = { newKeys in
            DispatchQueue.main.async {
                let reconciledNew = reconciledOrder(current: newKeys.compactMap { $0 as? Item.ID }, items: self.items.map(\.id))
                self.order = reconciledNew
            }
        }

        nsView.onSizesChange = { newSizes in
            DispatchQueue.main.async {
                // Map AnyHashable back to Item.ID
                var mapped: [Item.ID: CGSize] = [:]
                for (k, v) in newSizes {
                    if let id = k as? Item.ID {
                        mapped[id] = v
                    }
                }
                self.customSizes = mapped
            }
        }

        nsView.updateTiles(
            keys: effectiveOrder.map(AnyHashable.init),
            views: hostingViews,
            constraints: constraints,
            resizable: resizable,
            customSizes: Dictionary(uniqueKeysWithValues: customSizes.map { (AnyHashable($0.key), $0.value) })
        )
    }

    final class Coordinator {
        // Minimal coordinator.
    }
}

private final class HudTilingView: NSView {
    private var tileKeys: [AnyHashable] = []
    private var tileViews: [NSView] = []
    private var tilingConstraints = TilingConstraints.default
    private var resizable = false
    private var customSizes: [AnyHashable: CGSize] = [:]

    // For order updates we use a callback (in real code this would be a generic coordinator)
    var onOrderChange: (([AnyHashable]) -> Void)?
    var onSizesChange: (([AnyHashable: CGSize]) -> Void)?

    // Drag state (preview-only until mouseUp; no live reordering of siblings)
    private var draggingIndex: Int?
    private var dropTargetIndex: Int?
    private var dragStartLocation: NSPoint?
    private var dragCurrentLocation: NSPoint?
    private var dragGrabOffset: NSPoint?
    private var dragGhostImage: NSImage?
    private var landingGhostView: NSView?
    private var highlightView: NSView?
    private var pendingDragIndex: Int?
    private var pendingDragStartLocation: NSPoint?
    private var pendingDragGrabOffset: NSPoint?
    private let dragStartThreshold: CGFloat = 5

    // Resize state for bespoke per-tile / split resizing
    private var resizingKey: AnyHashable?
    private var resizeStartMouse: NSPoint = .zero
    private var resizeStartSize: CGSize = .zero
    private var resizeBaseRect: NSRect = .zero
    private var dragOverlayView: NSImageView?

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        wantsLayer = true
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { nil }

    func updateTiles(
        keys: [AnyHashable],
        views: [NSView],
        constraints: TilingConstraints,
        resizable: Bool = false,
        customSizes: [AnyHashable: CGSize] = [:]
    ) {
        // If a drag/resize is in flight and data changes, cancel cleanly.
        if draggingIndex != nil || pendingDragIndex != nil || resizingKey != nil {
            resetInteractionState(restoreFrames: false)
        }

        // Clean any previous ghost chrome.
        landingGhostView?.removeFromSuperview()
        landingGhostView = nil
        highlightView?.removeFromSuperview()
        highlightView = nil
        if let overlay = dragOverlayView {
            overlay.removeFromSuperview()
            dragOverlayView = nil
        }

        tileViews.forEach { $0.removeFromSuperview() }

        self.tileKeys = keys
        self.tileViews = views
        self.tilingConstraints = constraints
        self.resizable = resizable
        self.customSizes = customSizes

        for view in views {
            view.wantsLayer = true
            view.layer?.masksToBounds = false
            addSubview(view)
        }

        needsLayout = true
    }

    override func layout() {
        super.layout()
        if draggingIndex == nil && resizingKey == nil {
            relayoutTiles()
        } else if draggingIndex != nil {
            updateDragPreview()
        }
        // resize is updated live in mouseDragged
    }

    private func relayoutTiles() {
        guard !tileViews.isEmpty, bounds.width > 0, bounds.height > 0 else { return }

        // Use a single source of truth for the *grid structure*.
        // Prefer explicit custom col/row sizes (when present) over re-deriving from uniform base.
        // This avoids the fragile "group by uniform x/y then override" that causes jumpy behavior on add/resize.
        let gap = tilingConstraints.gap
        let n = tileKeys.count

        // First, decide the grid *shape* (numCols/numRows) using the standard compute (respects maxColumns etc.).
        // We will override the *sizes* of those cells.
        let baseLayoutsForShape = computeTilingLayout(
            keys: tileKeys,
            containerWidth: bounds.width,
            containerHeight: bounds.height,
            constraints: tilingConstraints
        )

        if baseLayoutsForShape.isEmpty { return }

        // Derive shape from the first "row" of the base layout (row-major).
        // This is more stable than re-grouping after every custom change.
        var numCols = 1
        if let firstRowY = baseLayoutsForShape.first?.y {
            numCols = baseLayoutsForShape.prefix(while: { $0.y == firstRowY }).count
        }
        numCols = max(1, numCols)
        let numRows = max(1, (n + numCols - 1) / numCols)

        // Build per-col and per-row sizes.
        var effectiveColWidths = Array(repeating: CGFloat(0), count: numCols)
        var effectiveRowHeights = Array(repeating: CGFloat(0), count: numRows)

        if customSizes.isEmpty {
            // Uniform case: just use what the base compute gave us.
            // (The base already did the fill/min/max logic.)
            for i in 0..<n {
                let c = i % numCols
                let r = i / numCols
                effectiveColWidths[c] = baseLayoutsForShape[i].width
                effectiveRowHeights[r] = baseLayoutsForShape[i].height
            }
        } else {
            // Bespoke: compute desired per logical col/row from current customs.
            // Logical assignment is still by order position (stable), not by "current x".
            for i in 0..<n {
                let c = i % numCols
                let r = i / numCols
                let key = tileKeys[i]
                let prefW = customSizes[key]?.width ?? baseLayoutsForShape[i].width
                let prefH = customSizes[key]?.height ?? baseLayoutsForShape[i].height
                effectiveColWidths[c] = max(effectiveColWidths[c], prefW)
                effectiveRowHeights[r] = max(effectiveRowHeights[r], prefH)
            }

            // Now scale the *groups* to exactly fill the container (respect mins + gaps).
            // This is the "systematic fill" part.
            let totalColGap = CGFloat(max(0, numCols - 1)) * gap
            let availW = bounds.width - totalColGap
            let minW = tilingConstraints.minItemWidth
            let minTotalW = CGFloat(numCols) * minW
            let excessW = max(0, availW - minTotalW)

            if excessW > 0 && effectiveColWidths.reduce(0, +) > 0 {
                let sumDesired = effectiveColWidths.reduce(0, +)
                for c in 0..<numCols {
                    let share = effectiveColWidths[c] / sumDesired
                    effectiveColWidths[c] = minW + excessW * share
                }
            } else {
                for c in 0..<numCols {
                    effectiveColWidths[c] = max(minW, effectiveColWidths[c])
                }
            }

            // Same for rows
            let totalRowGap = CGFloat(max(0, numRows - 1)) * gap
            let availH = bounds.height - totalRowGap
            let minH = tilingConstraints.minItemHeight
            let minTotalH = CGFloat(numRows) * minH
            let excessH = max(0, availH - minTotalH)

            if excessH > 0 && effectiveRowHeights.reduce(0, +) > 0 {
                let sumDesired = effectiveRowHeights.reduce(0, +)
                for r in 0..<numRows {
                    let share = effectiveRowHeights[r] / sumDesired
                    effectiveRowHeights[r] = minH + excessH * share
                }
            } else {
                for r in 0..<numRows {
                    effectiveRowHeights[r] = max(minH, effectiveRowHeights[r])
                }
            }
        }

        // Now lay out using the (possibly variable) cell sizes, row-major.
        // Align to pixel grid to avoid subpixel clipping on borders/buttons.
        var colStarts = [CGFloat](repeating: 0, count: numCols)
        for c in 1..<numCols {
            colStarts[c] = colStarts[c-1] + effectiveColWidths[c-1] + gap
        }
        var rowStarts = [CGFloat](repeating: 0, count: numRows)
        for r in 1..<numRows {
            rowStarts[r] = rowStarts[r-1] + effectiveRowHeights[r-1] + gap
        }

        for i in 0..<n {
            guard i < baseLayoutsForShape.count else { continue }
            if draggingIndex == i { continue }
            if resizingKey == tileKeys[i] { continue }
            let c = i % numCols
            let r = i / numCols
            let x = colStarts[c]
            let y = rowStarts[r]
            let w = effectiveColWidths[c]
            let h = effectiveRowHeights[r]
            let view = tileViews[i]
            view.frame = pixelAligned(NSRect(x: x, y: y, width: w, height: h))
            view.alphaValue = 1.0
        }
    }

    private func pixelAligned(_ rect: NSRect) -> NSRect {
        let minX = floor(rect.minX)
        let minY = floor(rect.minY)
        let maxX = ceil(rect.maxX)
        let maxY = ceil(rect.maxY)
        return NSRect(x: minX, y: minY, width: maxX - minX, height: maxY - minY)
    }

    private func computeCurrentLayouts() -> [TileLayout] {
        guard bounds.width > 0, bounds.height > 0 else { return [] }
        return computeTilingLayout(
            keys: tileKeys,
            containerWidth: bounds.width,
            containerHeight: bounds.height,
            constraints: tilingConstraints
        )
    }

    private func snapshot(of view: NSView) -> NSImage? {
        let bounds = view.bounds
        guard bounds.width > 0, bounds.height > 0 else { return nil }
        guard let bitmap = view.bitmapImageRepForCachingDisplay(in: bounds) else { return nil }
        view.cacheDisplay(in: bounds, to: bitmap)
        let image = NSImage(size: bounds.size)
        image.addRepresentation(bitmap)
        return image
    }

    // MARK: - Fine-grained AppKit drag & reorder for polish

    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }

    override func mouseDown(with event: NSEvent) {
        let location = convert(event.locationInWindow, from: nil)
        guard let idx = tileViews.firstIndex(where: { $0.frame.contains(location) }) else { return }

        let tileFrame = tileViews[idx].frame
        let key = tileKeys[idx]

        // If resizable, check for edge/corner hit for split-style resize (right or bottom edge)
        if resizable {
            let hitMargin: CGFloat = 8
            let nearRightEdge = abs(location.x - tileFrame.maxX) <= hitMargin &&
                                location.y >= tileFrame.minY && location.y <= tileFrame.maxY
            let nearBottomEdge = abs(location.y - tileFrame.maxY) <= hitMargin &&
                                 location.x >= tileFrame.minX && location.x <= tileFrame.maxX

            if nearRightEdge || nearBottomEdge {
                resizingKey = key
                resizeStartMouse = location
                resizeStartSize = customSizes[key] ?? tileFrame.size
                resizeBaseRect = tileFrame
                // bring to front
                tileViews[idx].superview?.addSubview(tileViews[idx])
                return
            }
        }

        // Fall back to reorder drag, but do not create preview chrome until the
        // pointer has actually moved. A click inside a terminal must remain a click.
        pendingDragIndex = idx
        pendingDragStartLocation = location
        pendingDragGrabOffset = NSPoint(x: location.x - tileFrame.minX, y: location.y - tileFrame.minY)
    }

    private func beginDrag(index idx: Int, currentLocation location: NSPoint) {
        guard idx < tileViews.count else {
            clearPendingDrag()
            return
        }

        let startLocation = pendingDragStartLocation ?? location
        let tileFrame = tileViews[idx].frame
        draggingIndex = idx
        dropTargetIndex = idx
        dragStartLocation = startLocation
        dragCurrentLocation = location

        // Record grab point inside the tile so it doesn't jump when lifting.
        dragGrabOffset = pendingDragGrabOffset ?? NSPoint(
            x: startLocation.x - tileFrame.minX,
            y: startLocation.y - tileFrame.minY
        )
        clearPendingDrag()

        // Snapshot for the ghost preview at the landing spot (faded) and for drag overlay (full).
        dragGhostImage = snapshot(of: tileViews[idx])

        // Use a lightweight NSImageView overlay for the dragged item during gesture.
        // This keeps the heavy NSHostingView (with live terminal) stationary → smooth drag.
        if let img = dragGhostImage {
            let overlay = NSImageView(image: img)
            overlay.wantsLayer = true
            overlay.alphaValue = 0.85  // slightly transparent so it doesn't completely mask content underneath while dragging
            if let layer = overlay.layer {
                layer.shadowColor = NSColor.black.cgColor
                layer.shadowOpacity = 0.32
                layer.shadowRadius = 18
                layer.shadowOffset = CGSize(width: 0, height: 10)
            }
            addSubview(overlay)
            dragOverlayView = overlay
        }

        // Dim the original to show the "hole" (committed layout stays).
        tileViews[idx].alphaValue = 0.3

        // Setup ghost and highlight views once at drag start (avoid addSubview spam every frame)
        ensureLandingGhost()
        if let ghost = landingGhostView, ghost.superview == nil {
            addSubview(ghost)
        }
        ensureHighlightView()
        if let hv = highlightView, hv.superview == nil {
            addSubview(hv)
        }

        updateDragPreview()
    }

    override func mouseDragged(with event: NSEvent) {
        let location = convert(event.locationInWindow, from: nil)

        // Handle live bespoke resize (edge or corner drag for splits)
        if let key = resizingKey {
            let dx = location.x - resizeStartMouse.x
            let dy = location.y - resizeStartMouse.y

            var newW = max(100, resizeStartSize.width + dx)
            var newH = max(80, resizeStartSize.height + dy)

            // Soft clamp within container
            newW = min(newW, bounds.width * 0.9)
            newH = min(newH, bounds.height * 0.9)

            customSizes[key] = CGSize(width: newW, height: newH)

            // Live update the *column and row group* so dragging resizes the split (whole col/row) and shifts the rest.
            // This makes "resize rows or columns in the grid" work directly.
            let layouts = computeCurrentLayouts()
            if let idx = tileKeys.firstIndex(of: key), idx < layouts.count {
                let thisL = layouts[idx]
                let thisX = thisL.x
                let thisY = thisL.y
                for j in 0..<tileViews.count {
                    guard j < layouts.count else { continue }
                    let l = layouts[j]
                    let v = tileViews[j]
                    var f = NSRect(x: l.x, y: l.y, width: l.width, height: l.height)
                    if abs(l.x - thisX) < 1 {
                        f.size.width = newW
                    }
                    if abs(l.y - thisY) < 1 {
                        f.size.height = newH
                    }
                    if l.x > thisX {
                        f.origin.x += dx
                    }
                    if l.y > thisY {
                        f.origin.y += dy
                    }
                    v.frame = pixelAligned(f)
                }
            }

            // Do NOT notify onSizesChange live — only on mouseUp to avoid binding churn and re-renders during gesture
            return
        }

        if draggingIndex == nil, let pendingIdx = pendingDragIndex, let start = pendingDragStartLocation {
            let distance = hypot(location.x - start.x, location.y - start.y)
            guard distance >= dragStartThreshold else { return }
            beginDrag(index: pendingIdx, currentLocation: location)
        }

        guard let startIdx = draggingIndex else { return }
        dragCurrentLocation = location

        // During active reorder drag we deliberately keep committed positions for the *other* tiles.
        // For target finding we still want to consider the visual sizes of the *current* frames.
        var target = startIdx
        var bestDist = CGFloat.greatestFiniteMagnitude

        for (i, view) in tileViews.enumerated() {
            // Use the *actual current rendered rect* for center, not the base layout.
            // (During drag the non-dragged tiles keep their last committed frames.)
            let center = NSPoint(x: view.frame.midX, y: view.frame.midY)
            let dist = hypot(center.x - location.x, center.y - location.y)
            if dist < bestDist {
                bestDist = dist
                target = i
            }
        }

        if target != dropTargetIndex {
            dropTargetIndex = target
        }

        updateDragPreview()
    }

    override func mouseUp(with event: NSEvent) {
        let didResize = resizingKey != nil
        let didDrag = draggingIndex != nil
        let fromIdx = draggingIndex
        let toIdx = dropTargetIndex

        if pendingDragIndex != nil && !didDrag && !didResize {
            clearPendingDrag()
            return
        }

        if didResize {
            onSizesChange?(customSizes)
            resizingKey = nil
            resizeStartMouse = .zero
            resizeStartSize = .zero
            relayoutTiles()
            return
        }

        // Restore normal appearance / hide any preview chrome.
        resetDragState(restoreFrames: false)

        // Commit the reorder only on release, if it actually moved to a different landing spot.
        if let from = fromIdx, let to = toIdx, from != to, to < tileViews.count {
            let v = tileViews.remove(at: from)
            tileViews.insert(v, at: to)

            let k = tileKeys.remove(at: from)
            tileKeys.insert(k, at: to)
        }

        // Snap everything into the final grid positions.
        relayoutTiles()

        if didDrag {
            onOrderChange?(tileKeys)
        }
    }

    private func resetDragState(restoreFrames: Bool) {
        // Restore alphas on all hosted tile views.
        for v in tileViews {
            v.alphaValue = 1.0
            if let layer = v.layer {
                layer.shadowOpacity = 0
                layer.shadowRadius = 0
                layer.shadowOffset = .zero
            }
        }

        highlightView?.isHidden = true
        landingGhostView?.isHidden = true
        landingGhostView?.removeFromSuperview()

        if let overlay = dragOverlayView {
            overlay.removeFromSuperview()
            dragOverlayView = nil
        }

        if restoreFrames {
            relayoutTiles()
        }

        draggingIndex = nil
        dropTargetIndex = nil
        dragStartLocation = nil
        dragCurrentLocation = nil
        dragGrabOffset = nil
        dragGhostImage = nil
        landingGhostView = nil
        clearPendingDrag()
    }

    private func resetInteractionState(restoreFrames: Bool) {
        resetDragState(restoreFrames: false)
        resizingKey = nil
        resizeStartMouse = .zero
        resizeStartSize = .zero
        resizeBaseRect = .zero
        if let overlay = dragOverlayView {
            overlay.removeFromSuperview()
            dragOverlayView = nil
        }
        if restoreFrames {
            relayoutTiles()
        }
    }

    private func clearPendingDrag() {
        pendingDragIndex = nil
        pendingDragStartLocation = nil
        pendingDragGrabOffset = nil
    }

    private func updateDragPreview() {
        guard let dIdx = draggingIndex else { return }
        let mouse = dragCurrentLocation ?? dragStartLocation ?? NSPoint(x: bounds.midX, y: bounds.midY)

        // Use *committed* layout (original order). No live swapping of other tiles.
        // IMPORTANT: We intentionally avoid touching real tileViews frames here.
        // The heavy NSHostingViews (terminals) stay put; only cheap overlay moves.
        let layouts = computeCurrentLayouts()
        guard !layouts.isEmpty else { return }

        // Dim other tiles during drag so the floating overlay stands out without "masking" everything unpleasantly
        for (i, view) in tileViews.enumerated() {
            if i == dIdx { continue }
            view.alphaValue = 0.45
        }

        // Determine the landing rect.
        // Use the *dragged item's own preferred size* at the target's position if possible,
        // so the ghost matches what will actually land there.
        let targetIdx = dropTargetIndex ?? dIdx
        var landingRect: NSRect?
        if targetIdx < layouts.count {
            let l = layouts[targetIdx]
            let draggedKey = tileKeys[dIdx]
            let pref = customSizes[draggedKey] ?? CGSize(width: l.width, height: l.height)
            landingRect = NSRect(x: l.x, y: l.y, width: pref.width, height: pref.height)
        }

        // Move the lightweight drag overlay image (snapshot) instead of the real heavy view.
        if let overlay = dragOverlayView {
            let size = landingRect?.size ?? CGSize(width: 200, height: 150)
            let grab = dragGrabOffset ?? NSPoint(x: size.width / 2, y: size.height / 2)
            let floatFrame = NSRect(
                x: mouse.x - grab.x,
                y: mouse.y - grab.y,
                width: size.width,
                height: size.height
            )
            overlay.frame = pixelAligned(floatFrame)
        }

        // --- Landing spot ghost: grayed-out / masked representation ---
        if let r = landingRect {
            if let ghost = landingGhostView {
                // Size the ghost slightly inset so the highlight can sit around it.
                let inset: CGFloat = 1
                ghost.frame = pixelAligned(NSRect(
                    x: r.minX + inset,
                    y: r.minY + inset,
                    width: r.width - inset * 2,
                    height: r.height - inset * 2
                ))
                ghost.isHidden = false

                // Do not show full faded content in the ghost to avoid masking the tiles underneath.
                // The container's border + bg serves as the "where it would land" highlight.
                // (The full snapshot is only used for the dragged overlay itself.)
                for sub in ghost.subviews where sub is NSImageView {
                    sub.removeFromSuperview()
                }
            }

            // Accent highlight ring around the ghost/landing spot.
            if let hv = highlightView {
                let pad: CGFloat = 4
                hv.frame = pixelAligned(NSRect(
                    x: r.minX - pad,
                    y: r.minY - pad,
                    width: r.width + pad * 2,
                    height: r.height + pad * 2
                ))
                hv.isHidden = false

                if let hl = hv.layer {
                    let accent = NSColor.controlAccentColor
                    hl.cornerRadius = HudRadius.card
                    hl.borderWidth = 3
                    hl.borderColor = accent.withAlphaComponent(0.9).cgColor
                    hl.backgroundColor = NSColor.clear.cgColor   // keep clean so the ghost shows through
                    hl.shadowColor = NSColor.black.cgColor
                    hl.shadowOpacity = 0.15
                    hl.shadowRadius = 3
                    hl.shadowOffset = .zero
                }
            }
        } else {
            landingGhostView?.isHidden = true
            highlightView?.isHidden = true
        }
    }

    private func ensureLandingGhost() {
        if landingGhostView == nil {
            let container = NSView()
            container.wantsLayer = true
            container.layer?.cornerRadius = HudRadius.card
            container.layer?.masksToBounds = true
            container.layer?.borderWidth = 2.5
            container.layer?.borderColor = NSColor.controlAccentColor.withAlphaComponent(0.8).cgColor
            // Clear background so original tile content remains visible underneath the drop zone highlight.
            // This is a "mask filter" / overlay indicator rather than an opaque ghost.
            container.layer?.backgroundColor = NSColor.clear.cgColor

            addSubview(container)
            landingGhostView = container
        }
    }

    private func ensureHighlightView() {
        guard highlightView == nil else { return }
        let v = NSView()
        v.wantsLayer = true
        v.layer?.masksToBounds = true
        addSubview(v)
        highlightView = v
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
            let reconciled = reconciledOrder(current: order, items: items.map(\.id))
            let keysForLayout = reconciled.isEmpty ? items.map { AnyHashable($0.id) } : reconciled.map(AnyHashable.init)
            let layouts = computeTilingLayout(
                keys: keysForLayout,
                containerWidth: geo.size.width,
                containerHeight: geo.size.height,
                constraints: constraints
            )

            let ordered = reconciled.isEmpty ? items : reconciled.compactMap { id in items.first(where: { $0.id == id }) }

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
