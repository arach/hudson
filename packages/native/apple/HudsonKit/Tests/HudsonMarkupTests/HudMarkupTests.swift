import Foundation
import Testing
import HudsonMarkup

@Suite("Hud markup trace")
struct HudMarkupTests {

    private func scribble(
        _ points: [(Double, Double)],
        instrument: HudMarkInstrument = .pen,
        pigment: Int = 0
    ) -> HudMark {
        HudMark(
            shape: .freehand(points.map { HudMarkPoint(x: $0.0, y: $0.1) }),
            instrument: instrument,
            pigment: pigment,
            width: instrument.width(onSurfaceWidth: 600)
        )
    }

    @Test("A trace round-trips through JSON with its shapes, tools and inks intact")
    func testRoundTrip() throws {
        let markup = HudMarkup(marks: [
            scribble([(0, 0), (0.5, 0.5)], instrument: .pen, pigment: 0),
            scribble([(0.2, 0.9), (0.8, 0.9)], instrument: .marker, pigment: 3),
            HudMark(
                shape: .rectangle(HudMarkPoint(x: 0.1, y: 0.1), HudMarkPoint(x: 0.6, y: 0.4)),
                instrument: .pen,
                pigment: 2,
                width: 0.004
            ),
            HudMark(
                shape: .arrow(HudMarkPoint(x: 0, y: 0), HudMarkPoint(x: 1, y: 1)),
                instrument: .pen,
                pigment: 1,
                width: 0.004
            )
        ])
        let data = try JSONEncoder().encode(markup)
        let decoded = try JSONDecoder().decode(HudMarkup.self, from: data)
        #expect(decoded == markup)
        #expect(decoded.marks[1].instrument == .marker)
        #expect(decoded.marks[2].shape.kind == .rectangle)
        #expect(decoded.marks[3].shape.kind == .arrow)
    }

    /// The shape written when a trace could only hold freehand, with a tool on
    /// each stroke. Those are real marks and must not be dropped by the field
    /// that arrived after them.
    @Test("The freehand-only format still decodes")
    func testStrokeEraDecode() throws {
        let json = """
        {"strokes":[{"points":[{"x":0.1,"y":0.2},{"x":0.3,"y":0.4}],
        "tool":"marker","pigment":2,"width":0.02}]}
        """.data(using: .utf8)!
        let decoded = try JSONDecoder().decode(HudMarkup.self, from: json)
        #expect(decoded.marks.count == 1)
        #expect(decoded.marks[0].instrument == .marker)
        #expect(decoded.marks[0].pigment == 2)
        #expect(decoded.marks[0].width == 0.02)
        #expect(decoded.marks[0].shape.kind == .freehand)
    }

    /// And the one before that: bare point-lists with a single pigment for the
    /// lot, no tool at all.
    @Test("The oldest format, with no tool on a stroke, still decodes")
    func testBareDecode() throws {
        let json = """
        {"strokes":[[{"x":0.1,"y":0.2},{"x":0.3,"y":0.4}]],"pigmentIndex":2}
        """.data(using: .utf8)!
        let decoded = try JSONDecoder().decode(HudMarkup.self, from: json)
        #expect(decoded.marks.count == 1)
        #expect(decoded.marks[0].pigment == 2)
        #expect(decoded.marks[0].instrument == .pen)
        #expect(decoded.marks[0].shape.outline().count == 2)
    }

    @Test("A marker is wider than a pen and does not cover what it crosses")
    func testToolWeights() {
        #expect(HudMarkInstrument.marker.points > HudMarkInstrument.pen.points)
        #expect(HudMarkInstrument.marker.opacity < 1)
        #expect(HudMarkInstrument.pen.opacity == 1)
    }

    /// A constant fraction is a pen that thickens with the window. The stored
    /// fraction has to fall as the surface grows so the line drawn stays 2.4pt.
    @Test("A pen is the same weight of line on a small surface and a large one")
    func testWidthIsCaptureRelative() {
        let small = HudMarkInstrument.pen.width(onSurfaceWidth: 200)
        let large = HudMarkInstrument.pen.width(onSurfaceWidth: 1_180)
        #expect(small > large)
        #expect(abs(small * 200 - HudMarkInstrument.pen.points) < 0.001)
        #expect(abs(large * 1_180 - HudMarkInstrument.pen.points) < 0.001)
    }

    @Test("A mouse or finger stroke stores no pressure rather than an invented one")
    func testPointsCarryOptionalWidth() throws {
        let markup = HudMarkup(marks: [scribble([(0, 0), (1, 1)])])
        let json = String(data: try JSONEncoder().encode(markup), encoding: .utf8)!
        #expect(!json.contains("\"w\""))
    }

    @Test("A pen that varied under the hand keeps that variation")
    func testPressureRoundTrips() throws {
        let pressed = HudMark(
            shape: .freehand([HudMarkPoint(x: 0, y: 0, w: 0.6), HudMarkPoint(x: 1, y: 1, w: 1.9)]),
            instrument: .pen,
            pigment: 0,
            width: HudMarkInstrument.pen.width(onSurfaceWidth: 600)
        )
        let data = try JSONEncoder().encode(HudMarkup(marks: [pressed]))
        let decoded = try JSONDecoder().decode(HudMarkup.self, from: data)
        guard case let .freehand(points) = decoded.marks[0].shape else {
            Issue.record("expected freehand")
            return
        }
        #expect(points[1].w == 1.9)
    }
}

@Suite("Hud markup tools")
struct HudHudMarkupToolKindTests {

    /// The picker offers seven things; the record knows two. Fusing them would
    /// put "rectangle" in a field that also means "pen", and make a translucent
    /// box a migration rather than a menu item.
    @Test("Every tool resolves to a geometry and a character, and only the eraser has neither")
    func testToolsResolve() {
        for tool in HudMarkupToolKind.allCases where tool != .eraser {
            #expect(tool.shapeKind != nil)
            #expect(tool.marks)
        }
        #expect(HudMarkupToolKind.eraser.shapeKind == nil)
        #expect(!HudMarkupToolKind.eraser.marks)
    }

    @Test("Only the pen and the marker draw the hand's own path")
    func testFreehandTools() {
        #expect(HudMarkupToolKind.pen.isFreehand)
        #expect(HudMarkupToolKind.marker.isFreehand)
        for ruled in [HudMarkupToolKind.line, .arrow, .rectangle, .ellipse] {
            #expect(!ruled.isFreehand)
        }
    }

    @Test("Ruled shapes are drawn with the pen's character, not the marker's")
    func testRuledShapesArePen() {
        #expect(HudMarkupToolKind.marker.instrument == .marker)
        for ruled in [HudMarkupToolKind.line, .arrow, .rectangle, .ellipse] {
            #expect(ruled.instrument == .pen)
        }
    }
}

@Suite("Hud markup geometry")
struct HudMarkGeometryTests {

    @Test("A rectangle drawn from any corner is the same rectangle")
    func testRectangleNormalizes() {
        let downhill = HudMarkShape.rectangle(HudMarkPoint(x: 0.2, y: 0.3), HudMarkPoint(x: 0.8, y: 0.7))
        let uphill = HudMarkShape.rectangle(HudMarkPoint(x: 0.8, y: 0.7), HudMarkPoint(x: 0.2, y: 0.3))
        #expect(downhill.outline() == uphill.outline())
        #expect(downhill.box?.from.x == 0.2)
        #expect(downhill.box?.to.y == 0.7)
    }

    @Test("A rectangle's outline closes back on itself")
    func testRectangleCloses() {
        let shape = HudMarkShape.rectangle(HudMarkPoint(x: 0, y: 0), HudMarkPoint(x: 1, y: 1))
        let outline = shape.outline()
        #expect(shape.isClosed)
        #expect(outline.first == outline.last)
        #expect(outline.count == 5)
    }

    @Test("An ellipse is inscribed in the box that was dragged")
    func testEllipseFillsItsBox() {
        let shape = HudMarkShape.ellipse(HudMarkPoint(x: 0.2, y: 0.4), HudMarkPoint(x: 0.8, y: 0.6))
        let outline = shape.outline()
        let xs = outline.map(\.x)
        let ys = outline.map(\.y)
        #expect(abs(xs.min()! - 0.2) < 0.001)
        #expect(abs(xs.max()! - 0.8) < 0.001)
        #expect(abs(ys.min()! - 0.4) < 0.001)
        #expect(abs(ys.max()! - 0.6) < 0.001)
        // Every sampled point is on the ellipse, not merely inside its box.
        for point in outline {
            let nx = (point.x - 0.5) / 0.3
            let ny = (point.y - 0.5) / 0.1
            #expect(abs(nx * nx + ny * ny - 1) < 0.001)
        }
    }

    @Test("Only an arrow has a head, and it sits at the end it points to")
    func testArrowhead() {
        let arrow = HudMarkShape.arrow(HudMarkPoint(x: 0.1, y: 0.5), HudMarkPoint(x: 0.9, y: 0.5))
        let head = arrow.arrowhead(aspect: 1, length: 0.05)
        #expect(head?.count == 3)
        #expect(head?[1] == HudMarkPoint(x: 0.9, y: 0.5))
        // The barbs trail behind the tip, back along the shaft.
        #expect(head![0].x < 0.9)
        #expect(head![2].x < 0.9)
        #expect(HudMarkShape.line(HudMarkPoint(x: 0, y: 0), HudMarkPoint(x: 1, y: 1))
            .arrowhead(aspect: 1, length: 0.05) == nil)
    }

    /// A head turned in unit coordinates on a wide, short figure comes out
    /// sheared: both barbs on one side, or a head longer than the shaft.
    @Test("An arrowhead is not sheared by a surface that is not square")
    func testArrowheadCorrectsForAspect() {
        let arrow = HudMarkShape.arrow(HudMarkPoint(x: 0.2, y: 0.5), HudMarkPoint(x: 0.8, y: 0.5))
        let aspect = 0.25   // four times wider than tall
        let head = arrow.arrowhead(aspect: aspect, length: 0.05)!
        // In real distance the two barbs are the same length and symmetric
        // about the shaft, which on a flat surface means they are further apart
        // in y than a naive turn would put them.
        let above = (head[0].y - 0.5) * aspect
        let below = (head[2].y - 0.5) * aspect
        #expect(abs(above + below) < 0.0001)
        #expect(abs(above) > 0.0001)
    }

    @Test("A head never overruns the shaft it belongs to")
    func testArrowheadIsClampedToItsShaft() {
        let stub = HudMarkShape.arrow(HudMarkPoint(x: 0.5, y: 0.5), HudMarkPoint(x: 0.51, y: 0.5))
        let head = stub.arrowhead(aspect: 1, length: 0.4)!
        #expect(head[0].x >= 0.5 - 0.0001)
    }

    @Test("A drag with no length has no head to draw")
    func testDegenerateArrow() {
        let nothing = HudMarkShape.arrow(HudMarkPoint(x: 0.5, y: 0.5), HudMarkPoint(x: 0.5, y: 0.5))
        #expect(nothing.arrowhead(aspect: 1, length: 0.05) == nil)
    }
}

@Suite("Hud markup history")
struct HudMarkupHistoryTests {

    private func scribble(_ x: Double) -> HudMark {
        HudMark(
            shape: .freehand([HudMarkPoint(x: x, y: 0), HudMarkPoint(x: x, y: 1)]),
            instrument: .pen,
            pigment: 0,
            width: HudMarkInstrument.pen.width(onSurfaceWidth: 600)
        )
    }

    @Test("Undo takes back the last mark and redo puts it back")
    func testUndoRedo() {
        var history = HudMarkupHistory()
        history.add(scribble(0.1))
        history.add(scribble(0.2))
        #expect(history.canUndo)
        #expect(!history.canRedo)

        history.undo()
        #expect(history.markup.marks.count == 1)
        #expect(history.canRedo)

        history.redo()
        #expect(history.markup.marks.count == 2)
        #expect(!history.canRedo)
    }

    /// A redo that survived new work would insert a mark into a drawing it was
    /// never part of.
    @Test("Drawing again spends the redo")
    func testNewMarkClearsRedo() {
        var history = HudMarkupHistory()
        history.add(scribble(0.1))
        history.undo()
        #expect(history.canRedo)
        history.add(scribble(0.5))
        #expect(!history.canRedo)
    }

    @Test("Clearing is one act to undo, not one per mark")
    func testClearIsOneAct() {
        var history = HudMarkupHistory()
        history.add(scribble(0.1))
        history.add(scribble(0.2))
        history.add(scribble(0.3))
        history.clear()
        #expect(history.isEmpty)
        history.undo()
        #expect(history.markup.marks.count == 3)
    }

    @Test("Undo on an empty history reports that it did nothing")
    func testUndoEmpty() {
        var history = HudMarkupHistory()
        #expect(history.undo() == false)
        #expect(history.redo() == false)
    }

    @Test("The eraser takes the mark it was put on")
    func testEraseNearest() {
        var history = HudMarkupHistory()
        history.add(scribble(0.1))
        history.add(scribble(0.9))
        let erased = history.erase(
            from: HudMarkPoint(x: 0.9, y: 0.4),
            to: HudMarkPoint(x: 0.9, y: 0.6),
            reach: 0.02
        )
        #expect(erased)
        #expect(history.markup.marks.count == 1)
        #expect(history.markup.marks[0].shape.outline()[0].x == 0.1)
    }

    /// A hand moving quickly reports its positions far apart. An eraser that
    /// only takes the nearest leaves the rest standing mid-swipe.
    @Test("One swipe lifts every mark it crossed, not just the nearest")
    func testEraseTakesEverythingCrossed() {
        var history = HudMarkupHistory()
        history.add(scribble(0.2))
        history.add(scribble(0.5))
        history.add(scribble(0.8))
        let erased = history.erase(
            from: HudMarkPoint(x: 0.1, y: 0.5),
            to: HudMarkPoint(x: 0.9, y: 0.5),
            reach: 0.01
        )
        #expect(erased)
        #expect(history.markup.marks.isEmpty)
    }

    @Test("A shape is rubbed out by its own line")
    func testEraseCatchesAShapesEdge() {
        var history = HudMarkupHistory()
        history.add(
            HudMark(
                shape: .rectangle(HudMarkPoint(x: 0.2, y: 0.2), HudMarkPoint(x: 0.8, y: 0.8)),
                instrument: .pen,
                pigment: 0,
                width: 0.004
            )
        )
        let erased = history.erase(
            from: HudMarkPoint(x: 0.5, y: 0.195),
            to: HudMarkPoint(x: 0.5, y: 0.205),
            reach: 0.015
        )
        #expect(erased)
        #expect(history.isEmpty)
    }

    /// Not a bug: if the interior counted, a scribble inside a box could never
    /// be erased without taking the box, and boxing a region to annotate inside
    /// it is most of what rectangles are for.
    @Test("A swipe through a rectangle's hollow middle leaves it standing")
    func testEraseSparesAShapesInterior() {
        var history = HudMarkupHistory()
        history.add(
            HudMark(
                shape: .rectangle(HudMarkPoint(x: 0.2, y: 0.2), HudMarkPoint(x: 0.8, y: 0.8)),
                instrument: .pen,
                pigment: 0,
                width: 0.004
            )
        )
        history.add(scribble(0.5))
        let erased = history.erase(
            from: HudMarkPoint(x: 0.45, y: 0.5),
            to: HudMarkPoint(x: 0.55, y: 0.5),
            reach: 0.015
        )
        #expect(erased)
        #expect(history.markup.marks.count == 1)
        #expect(history.markup.marks[0].shape.kind == .rectangle)
    }

    /// Unit coordinates are not distances. On a wide, short figure, 0.02 down
    /// the page is a fraction of what 0.02 across it is.
    @Test("The eraser reaches the same distance in both directions")
    func testEraseIsNotStretchedByAspect() {
        let flat = 0.25   // a figure four times wider than it is tall
        var history = HudMarkupHistory()
        history.add(
            HudMark(
                shape: .freehand([HudMarkPoint(x: 0.5, y: 0.5), HudMarkPoint(x: 0.6, y: 0.5)]),
                instrument: .pen,
                pigment: 0,
                width: 0.004
            )
        )
        // A pass this far below the mark is well outside reach in real terms
        // once the surface's shape is accounted for.
        let erased = history.erase(
            from: HudMarkPoint(x: 0.55, y: 0.62),
            to: HudMarkPoint(x: 0.55, y: 0.62),
            reach: 0.02,
            aspect: flat
        )
        #expect(!erased)
    }

    @Test("A swipe across several marks is one thing to undo")
    func testStintIsOneAct() {
        var history = HudMarkupHistory()
        history.add(scribble(0.2))
        history.add(scribble(0.5))
        history.beginStint()
        history.erase(from: HudMarkPoint(x: 0.2, y: 0.5), to: HudMarkPoint(x: 0.2, y: 0.5), reach: 0.02)
        history.erase(from: HudMarkPoint(x: 0.5, y: 0.5), to: HudMarkPoint(x: 0.5, y: 0.5), reach: 0.02)
        history.endStint()
        #expect(history.isEmpty)
        history.undo()
        #expect(history.markup.marks.count == 2)
    }

    @Test("The hand is remembered to a depth, not for ever")
    func testHistoryIsCapped() {
        var history = HudMarkupHistory()
        for step in 0..<(HudMarkupHistory.depth + 40) {
            history.add(scribble(Double(step) / 1_000))
        }
        for _ in 0..<(HudMarkupHistory.depth + 40) { history.undo() }
        // Everything past the cap is beyond recall, and the oldest states are
        // the ones let go of.
        #expect(history.markup.marks.count == 40)
    }

    /// An eraser that finds something wherever it is put deletes work nobody was
    /// aiming at.
    @Test("The eraser passing nothing takes nothing")
    func testEraseOutOfReach() {
        var history = HudMarkupHistory()
        history.add(scribble(0.1))
        let erased = history.erase(
            from: HudMarkPoint(x: 0.8, y: 0.4),
            to: HudMarkPoint(x: 0.8, y: 0.6),
            reach: 0.02
        )
        #expect(!erased)
        #expect(history.markup.marks.count == 1)
    }

    @Test("An erased mark can be brought back")
    func testEraseIsUndoable() {
        var history = HudMarkupHistory()
        history.add(scribble(0.4))
        history.erase(
            from: HudMarkPoint(x: 0.4, y: 0.2),
            to: HudMarkPoint(x: 0.4, y: 0.3),
            reach: 0.5
        )
        #expect(history.isEmpty)
        history.undo()
        #expect(history.markup.marks.count == 1)
    }
}

@Suite("Hud markup pigments")
struct HudMarkupPigmentTests {

    private func mark(pigment: Int) -> HudMark {
        HudMark(
            shape: .freehand([HudMarkPoint(x: 0, y: 0), HudMarkPoint(x: 1, y: 1)]),
            instrument: .pen,
            pigment: pigment,
            width: 0.004
        )
    }

    /// The trap this closes: draw in slot 7, ship a build with five inks, and the
    /// mark silently changes colour. A slot that does not exist cannot be written.
    @Test("A slot outside the format is clamped rather than stored")
    func testCaptureClamps() {
        #expect(mark(pigment: 7).pigment == HudMarkup.pigmentSlots - 1)
        #expect(mark(pigment: -3).pigment == 0)
        #expect(mark(pigment: 2).pigment == 2)
    }

    /// Including a markup written by hand, or by a future version with more inks.
    @Test("A slot outside the format is clamped on the way in from disk too")
    func testDecodeClamps() throws {
        let json = """
        {"marks":[{"shape":{"kind":"freehand","points":[{"x":0,"y":0},{"x":1,"y":1}]},
        "instrument":"pen","pigment":9,"width":0.004}]}
        """.data(using: .utf8)!
        let decoded = try JSONDecoder().decode(HudMarkup.self, from: json)
        #expect(decoded.marks[0].pigment == HudMarkup.pigmentSlots - 1)
    }

    @Test("The format names as many inks as a rail can offer")
    func testSlotCount() {
        #expect(HudMarkup.pigmentSlots == 5)
    }
}
