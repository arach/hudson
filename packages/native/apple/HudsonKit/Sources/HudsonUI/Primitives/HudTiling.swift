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
    private let externalSizes: Binding<[Item.ID: CGSize]>?

    @State private var order: [Item.ID]
    @State private var customSizes: [Item.ID: CGSize] = [:]

    /// - Parameter sizes: Optional binding for per-tile custom sizes. When
    ///   provided, the caller owns the sizes (controlled); set it to `[:]` to
    ///   rebalance back to the uniform grid. When omitted, sizes are managed
    ///   internally (uncontrolled), mirroring how `order` is handled.
    public init(
        items: [Item],
        constraints: TilingConstraints = .default,
        resizable: Bool = false,
        sizes: Binding<[Item.ID: CGSize]>? = nil,
        @ViewBuilder renderItem: @escaping (Item) -> some View
    ) {
        self.items = items
        self.constraints = constraints
        self.resizable = resizable
        self.externalSizes = sizes
        self.renderItem = { AnyView(renderItem($0)) }
        _order = State(initialValue: items.map(\.id))
    }

    public var body: some View {
        #if os(macOS)
        HudTilingRepresentable(
            items: items,
            order: $order,
            customSizes: externalSizes ?? $customSizes,
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
// Internal (not private) so it is unit-testable.
func reconciledOrder<ItemID: Hashable>(current: [ItemID], items: [ItemID]) -> [ItemID] {
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

        // Reuse cached hosting views so a SwiftUI commit (e.g. the order/sizes
        // binding writes on mouseUp) never tears down hosted content — live
        // terminals keep their state, scrollback, and first responder. Views are
        // created only for new ids, updated in place otherwise, and dropped when
        // their item disappears.
        let cache = context.coordinator
        var hostingViews: [NSView] = []
        hostingViews.reserveCapacity(orderedItems.count)
        for item in orderedItems {
            if let existing = cache.hostingViews[item.id] {
                existing.rootView = renderItem(item)
                hostingViews.append(existing)
            } else {
                let hosting = NSHostingView(rootView: renderItem(item))
                hosting.translatesAutoresizingMaskIntoConstraints = false
                cache.hostingViews[item.id] = hosting
                hostingViews.append(hosting)
            }
        }
        let liveIDs = Set(orderedItems.map(\.id))
        cache.hostingViews = cache.hostingViews.filter { liveIDs.contains($0.key) }

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
        /// Hosting views cached by item id. Keeping these alive across SwiftUI
        /// commits is what preserves heavy hosted content (live terminals)
        /// through reorder/resize binding writes.
        var hostingViews: [Item.ID: NSHostingView<AnyView>] = [:]
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
        removeDragChrome()

        // Incrementally reconcile subviews: surviving views (which may host live
        // terminal state / first responder) are kept in place, departed views are
        // removed, and only genuinely new views are added. Never tear down and
        // re-add everything — that destroys hosted view state on every update.
        for old in tileViews where !views.contains(where: { $0 === old }) {
            old.removeFromSuperview()
        }
        for view in views where view.superview !== self {
            view.wantsLayer = true
            view.layer?.masksToBounds = false
            addSubview(view)
        }

        self.tileKeys = keys
        self.tileViews = views
        self.tilingConstraints = constraints
        self.resizable = resizable
        self.customSizes = customSizes

        needsLayout = true
    }

    override func layout() {
        super.layout()
        if draggingIndex == nil {
            // Committed layout and live-resize preview share the same math
            // (customSizes already carries the in-flight resize value).
            relayoutTiles()
        } else {
            updateDragPreview()
        }
    }

    /// Lays out all tiles from the shared grid metrics. Used for the committed
    /// layout *and* the live resize preview, so mouseUp never causes a jump.
    private func relayoutTiles() {
        guard !tileViews.isEmpty, bounds.width > 0, bounds.height > 0 else { return }
        guard let metrics = currentGridMetrics() else { return }

        let resizing = resizingKey != nil
        for i in 0..<min(tileKeys.count, tileViews.count) {
            if draggingIndex == i { continue }
            let view = tileViews[i]
            // Align to pixel grid to avoid subpixel clipping on borders/buttons.
            view.frame = pixelAligned(metrics.frame(at: i))
            if !resizing {
                view.alphaValue = 1.0
            }
        }
    }

    private func currentGridMetrics() -> TilingGridMetrics? {
        computeTilingGridMetrics(
            keys: tileKeys,
            customSizes: customSizes,
            containerWidth: bounds.width,
            containerHeight: bounds.height,
            constraints: tilingConstraints
        )
    }

    private func pixelAligned(_ rect: NSRect) -> NSRect {
        let minX = floor(rect.minX)
        let minY = floor(rect.minY)
        let maxX = ceil(rect.maxX)
        let maxY = ceil(rect.maxY)
        return NSRect(x: minX, y: minY, width: maxX - minX, height: maxY - minY)
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

        // Use a lightweight NSImageView overlay (snapshot) for the dragged item
        // during the gesture. This keeps the heavy NSHostingView (with live
        // terminal) stationary → smooth drag. The snapshot is used only here;
        // the landing indicator is a clear outlined slot, not a faded copy.
        if let img = snapshot(of: tileViews[idx]) {
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
        ensureHighlightView()

        updateDragPreview()
    }

    override func mouseDragged(with event: NSEvent) {
        let location = convert(event.locationInWindow, from: nil)

        // Handle live bespoke resize (edge or corner drag for splits)
        if let key = resizingKey {
            let dx = location.x - resizeStartMouse.x
            let dy = location.y - resizeStartMouse.y

            // Clamp against the same constraint values the committed layout uses.
            let minW = tilingConstraints.minItemWidth
            let minH = tilingConstraints.minItemHeight
            let maxW = tilingConstraints.maxItemWidth ?? bounds.width
            let maxH = tilingConstraints.maxItemHeight ?? bounds.height
            let newW = min(max(minW, resizeStartSize.width + dx), maxW)
            let newH = min(max(minH, resizeStartSize.height + dy), maxH)

            customSizes[key] = CGSize(width: newW, height: newH)

            // Live preview goes through the exact same grid math as the committed
            // layout (shape + span redistribution against mins and gaps), so the
            // frames on mouseUp are identical to what the user is already seeing.
            relayoutTiles()

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
            resizingKey = nil
            resizeStartMouse = .zero
            resizeStartSize = .zero
            // The live preview already used the committed math; this is just the
            // final pass (and restores alphas).
            relayoutTiles()
            onSizesChange?(customSizes)
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

    /// Removes and nils all transient drag chrome (landing ghost, highlight ring,
    /// floating overlay) symmetrically — everything created at drag start is torn
    /// down together here.
    private func removeDragChrome() {
        landingGhostView?.removeFromSuperview()
        landingGhostView = nil
        highlightView?.removeFromSuperview()
        highlightView = nil
        dragOverlayView?.removeFromSuperview()
        dragOverlayView = nil
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

        removeDragChrome()

        if restoreFrames {
            relayoutTiles()
        }

        draggingIndex = nil
        dropTargetIndex = nil
        dragStartLocation = nil
        dragCurrentLocation = nil
        dragGrabOffset = nil
        clearPendingDrag()
    }

    private func resetInteractionState(restoreFrames: Bool) {
        resetDragState(restoreFrames: false)
        resizingKey = nil
        resizeStartMouse = .zero
        resizeStartSize = .zero
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
        guard let metrics = currentGridMetrics() else { return }

        // Dim other tiles during drag so the floating overlay stands out without "masking" everything unpleasantly
        for (i, view) in tileViews.enumerated() {
            if i == dIdx { continue }
            view.alphaValue = 0.45
        }

        // Landing rect = the target slot in the same grid math used for the
        // committed layout, so the indicator shows exactly where the tile lands.
        let targetIdx = dropTargetIndex ?? dIdx
        var landingRect: NSRect?
        if targetIdx < tileKeys.count {
            landingRect = metrics.frame(at: targetIdx)
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
                // The ghost is intentionally content-free: a clear, outlined slot
                // so the tiles underneath stay visible. The snapshot image is only
                // used for the floating drag overlay.
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
