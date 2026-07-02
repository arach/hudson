import Testing
import SwiftUI
@testable import HudsonUI

private func keys(_ n: Int) -> [AnyHashable] {
    (0..<n).map { AnyHashable($0) }
}

private func approx(_ a: CGFloat, _ b: CGFloat, tolerance: CGFloat = 0.001) -> Bool {
    abs(a - b) <= tolerance
}

@Suite("HudTiling grid shape")
struct HudTilingGridShapeTests {
    @Test("zero items yields empty shape")
    func zeroItems() {
        let shape = computeTilingGridShape(count: 0, constraints: .default)
        #expect(shape.columns == 0)
        #expect(shape.rows == 0)
    }

    @Test("single item is a 1x1 grid")
    func singleItem() {
        let shape = computeTilingGridShape(count: 1, constraints: .default)
        #expect(shape.columns == 1)
        #expect(shape.rows == 1)
    }

    @Test("default heuristic prefers more columns")
    func defaultHeuristic() {
        // preferMoreColumns: cols = max(sqrt(n), ceil(n/2))
        let four = computeTilingGridShape(count: 4, constraints: .default)
        #expect(four.columns == 2)
        #expect(four.rows == 2)

        let five = computeTilingGridShape(count: 5, constraints: .default)
        #expect(five.columns == 3)
        #expect(five.rows == 2)
    }

    @Test("explicit maxColumns is a hard bound")
    func explicitMaxColumns() {
        let shape = computeTilingGridShape(
            count: 6,
            constraints: TilingConstraints(maxColumns: 2)
        )
        #expect(shape.columns == 2)
        #expect(shape.rows == 3)
    }

    @Test("maxRows widens the grid")
    func maxRowsWidens() {
        let shape = computeTilingGridShape(
            count: 5,
            constraints: TilingConstraints(maxRows: 1)
        )
        #expect(shape.columns == 5)
        #expect(shape.rows == 1)
    }

    @Test("shape always has capacity for all items")
    func capacity() {
        for n in 1...12 {
            let shape = computeTilingGridShape(count: n, constraints: .default)
            #expect(shape.columns * shape.rows >= n)
        }
    }

    @Test("shape matches the row structure of computeTilingLayout")
    func matchesLayoutRowStructure() {
        // The layout must be row-major with exactly `columns` tiles in the
        // first row (for n >= columns). This pins the shape function to the
        // actual layout instead of reverse-engineering columns from origins.
        for n in 1...9 {
            let shape = computeTilingGridShape(count: n, constraints: .default)
            let layouts = computeTilingLayout(
                keys: keys(n),
                containerWidth: 1200,
                containerHeight: 900,
                constraints: .default
            )
            #expect(layouts.count == n)
            guard let firstRowY = layouts.first?.y else { continue }
            let firstRowCount = layouts.prefix(while: { $0.y == firstRowY }).count
            #expect(firstRowCount == min(shape.columns, n))
        }
    }
}

@Suite("HudTiling layout geometry")
struct HudTilingLayoutTests {
    @Test("empty input yields no layouts")
    func emptyInput() {
        #expect(computeTilingLayout(keys: [], containerWidth: 800, containerHeight: 600, constraints: .default).isEmpty)
        #expect(computeTilingLayout(keys: keys(3), containerWidth: 0, containerHeight: 600, constraints: .default).isEmpty)
    }

    @Test("layout count matches item count")
    func countMatches() {
        for n in [1, 2, 3, 5, 8] {
            let layouts = computeTilingLayout(
                keys: keys(n),
                containerWidth: 800,
                containerHeight: 600,
                constraints: .default
            )
            #expect(layouts.count == n)
        }
    }

    @Test("uniform grid respects gap between columns and rows")
    func gaps() {
        let gap: CGFloat = 10
        let layouts = computeTilingLayout(
            keys: keys(4),
            containerWidth: 810,
            containerHeight: 610,
            constraints: TilingConstraints(maxColumns: 2, gap: gap)
        )
        #expect(layouts.count == 4)
        // 2x2 grid: [0][1] on row 0, [2][3] on row 1.
        #expect(approx(layouts[1].x, layouts[0].x + layouts[0].width + gap))
        #expect(approx(layouts[2].y, layouts[0].y + layouts[0].height + gap))
        #expect(approx(layouts[0].y, layouts[1].y))
        #expect(approx(layouts[0].x, layouts[2].x))
        // maximize fill: the grid spans the full container.
        #expect(approx(layouts[1].x + layouts[1].width, 810))
        #expect(approx(layouts[2].y + layouts[2].height, 610))
    }

    @Test("min item sizes hold in a tiny container")
    func minSizes() {
        let constraints = TilingConstraints(minItemWidth: 120, minItemHeight: 80)
        let layouts = computeTilingLayout(
            keys: keys(4),
            containerWidth: 100,
            containerHeight: 60,
            constraints: constraints
        )
        #expect(layouts.count == 4)
        for l in layouts {
            #expect(l.width >= 120)
            #expect(l.height >= 80)
        }
    }

    @Test("last row centers when alignLastRow == .center")
    func lastRowCentered() {
        let gap: CGFloat = 10
        let width: CGFloat = 800
        let layouts = computeTilingLayout(
            keys: keys(3),
            containerWidth: width,
            containerHeight: 600,
            constraints: TilingConstraints(maxColumns: 2, gap: gap, alignLastRow: .center)
        )
        #expect(layouts.count == 3)
        // Third tile sits alone on row 1, centered horizontally.
        let last = layouts[2]
        let expectedX = (width - last.width) / 2
        #expect(approx(last.x, expectedX))
    }

    @Test("last row starts at leading edge by default")
    func lastRowStart() {
        let layouts = computeTilingLayout(
            keys: keys(3),
            containerWidth: 800,
            containerHeight: 600,
            constraints: TilingConstraints(maxColumns: 2)
        )
        #expect(layouts.count == 3)
        #expect(approx(layouts[2].x, layouts[0].x))
    }
}

@Suite("HudTiling order reconciliation")
struct HudTilingOrderTests {
    @Test("identity when nothing changed")
    func identity() {
        #expect(reconciledOrder(current: [1, 2, 3], items: [1, 2, 3]) == [1, 2, 3])
        #expect(reconciledOrder(current: [3, 1, 2], items: [1, 2, 3]) == [3, 1, 2])
    }

    @Test("removed ids are dropped, relative order preserved")
    func dropsRemoved() {
        #expect(reconciledOrder(current: [3, 1, 2], items: [2, 3]) == [3, 2])
    }

    @Test("new ids append in items order")
    func appendsNew() {
        #expect(reconciledOrder(current: [2, 1], items: [1, 2, 4, 5]) == [2, 1, 4, 5])
    }

    @Test("drop and append combine")
    func dropAndAppend() {
        #expect(reconciledOrder(current: [3, 1, 2], items: [1, 2, 4, 5]) == [1, 2, 4, 5])
    }

    @Test("empty current adopts items order")
    func emptyCurrent() {
        #expect(reconciledOrder(current: [Int](), items: [7, 8]) == [7, 8])
    }
}

@Suite("HudTiling resize distribution")
struct HudTilingDistributionTests {
    @Test("empty desired returns empty")
    func empty() {
        #expect(distributeTilingSpans(desired: [], available: 500, gap: 10, minSpan: 50).isEmpty)
    }

    @Test("fills available space exactly when excess exists")
    func fillsExactly() {
        let spans = distributeTilingSpans(desired: [100, 300], available: 500, gap: 20, minSpan: 50)
        #expect(spans.count == 2)
        // usable = 480, minTotal = 100, excess = 380, shares 1/4 and 3/4.
        #expect(approx(spans[0], 50 + 380 * 0.25))
        #expect(approx(spans[1], 50 + 380 * 0.75))
        #expect(approx(spans.reduce(0, +) + 20, 500))
    }

    @Test("every span is at least minSpan")
    func respectsMin() {
        let spans = distributeTilingSpans(desired: [1, 999], available: 400, gap: 10, minSpan: 120)
        for s in spans {
            #expect(s >= 120)
        }
    }

    @Test("clamps to min when there is no excess")
    func noExcess() {
        let spans = distributeTilingSpans(desired: [10, 20], available: 90, gap: 10, minSpan: 50)
        #expect(spans == [50, 50])
    }

    @Test("bigger desired never gets a smaller span")
    func monotonic() {
        let spans = distributeTilingSpans(desired: [150, 450, 300], available: 1000, gap: 12, minSpan: 100)
        #expect(spans[1] > spans[2])
        #expect(spans[2] > spans[0])
    }
}

@Suite("HudTiling grid metrics")
struct HudTilingGridMetricsTests {
    @Test("nil for empty input")
    func nilForEmpty() {
        #expect(computeTilingGridMetrics(keys: [], customSizes: [:], containerWidth: 800, containerHeight: 600, constraints: .default) == nil)
        #expect(computeTilingGridMetrics(keys: keys(2), customSizes: [:], containerWidth: 0, containerHeight: 600, constraints: .default) == nil)
    }

    @Test("uniform metrics match computeTilingLayout frames")
    func uniformMatchesBase() {
        let n = 4
        let constraints = TilingConstraints(maxColumns: 2, gap: 10)
        let layouts = computeTilingLayout(keys: keys(n), containerWidth: 810, containerHeight: 610, constraints: constraints)
        let metrics = computeTilingGridMetrics(keys: keys(n), customSizes: [:], containerWidth: 810, containerHeight: 610, constraints: constraints)
        #expect(metrics != nil)
        guard let metrics else { return }
        #expect(metrics.columns == 2)
        #expect(metrics.rows == 2)
        for i in 0..<n {
            let f = metrics.frame(at: i)
            #expect(approx(f.origin.x, layouts[i].x))
            #expect(approx(f.origin.y, layouts[i].y))
            #expect(approx(f.width, layouts[i].width))
            #expect(approx(f.height, layouts[i].height))
        }
    }

    @Test("custom sizes redistribute but keep container fill, mins, and gaps")
    func customSizesRedistribute() {
        let gap: CGFloat = 10
        let constraints = TilingConstraints(maxColumns: 2, gap: gap, minItemWidth: 120, minItemHeight: 80)
        let custom: [AnyHashable: CGSize] = [AnyHashable(0): CGSize(width: 600, height: 500)]
        let metrics = computeTilingGridMetrics(keys: keys(4), customSizes: custom, containerWidth: 800, containerHeight: 600, constraints: constraints)
        #expect(metrics != nil)
        guard let metrics else { return }

        // Column 0 (holding the enlarged tile) is wider than column 1.
        #expect(metrics.columnWidths[0] > metrics.columnWidths[1])
        #expect(metrics.rowHeights[0] > metrics.rowHeights[1])
        // Everything still >= min sizes.
        for w in metrics.columnWidths { #expect(w >= 120) }
        for h in metrics.rowHeights { #expect(h >= 80) }
        // The grid exactly fills the container (spans + gaps).
        #expect(approx(metrics.columnWidths.reduce(0, +) + gap, 800))
        #expect(approx(metrics.rowHeights.reduce(0, +) + gap, 600))
        // Origins accumulate spans + gap.
        #expect(approx(metrics.columnStarts[1], metrics.columnWidths[0] + gap))
        #expect(approx(metrics.rowStarts[1], metrics.rowHeights[0] + gap))
    }

    @Test("metrics are stable across repeated computation (preview == commit)")
    func stableAcrossCalls() {
        let constraints = TilingConstraints(maxColumns: 3, gap: 8)
        let custom: [AnyHashable: CGSize] = [
            AnyHashable(1): CGSize(width: 500, height: 300),
            AnyHashable(4): CGSize(width: 200, height: 420),
        ]
        let a = computeTilingGridMetrics(keys: keys(6), customSizes: custom, containerWidth: 1200, containerHeight: 700, constraints: constraints)
        let b = computeTilingGridMetrics(keys: keys(6), customSizes: custom, containerWidth: 1200, containerHeight: 700, constraints: constraints)
        #expect(a != nil)
        #expect(a == b)
    }

    @Test("frame(at:) walks the grid row-major")
    func rowMajorFrames() {
        let metrics = computeTilingGridMetrics(keys: keys(6), customSizes: [:], containerWidth: 900, containerHeight: 600, constraints: TilingConstraints(maxColumns: 3))
        #expect(metrics != nil)
        guard let metrics else { return }
        #expect(metrics.columns == 3)
        #expect(metrics.rows == 2)
        // Same row shares y; wrapping to the next row resets x.
        #expect(approx(metrics.frame(at: 0).origin.y, metrics.frame(at: 2).origin.y))
        #expect(approx(metrics.frame(at: 3).origin.x, metrics.frame(at: 0).origin.x))
        #expect(metrics.frame(at: 3).origin.y > metrics.frame(at: 0).origin.y)
    }
}
