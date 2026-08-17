import Foundation

/// What somebody drew on something, in a form that outlives the thing it was
/// drawn on and the framework that captured it.
///
/// This started as ink, and ink was too small a word. Marking something up is a
/// scribble *and* a circle round the outlier *and* an arrow at the peak *and* a
/// box round the panel that matters — one act, one record, one undo stack. A
/// record that could only hold freehand would push shapes into some second
/// system, and then there would be two things to render, two things to store,
/// two things to erase, and someone who drew a box and a squiggle would find
/// that only one of them could be taken back.
///
/// The format this replaces was `PKDrawing` bytes. PencilKit is the best pen on
/// iPad and is welcome as a *capture* engine, but what it produces is an opaque
/// blob only Apple's framework can open: `PKCanvasView` does not exist on macOS,
/// and nothing outside an Apple runtime can read the bytes at all. A kit that
/// ships on more than one platform cannot base a document format on that.
///
/// So: geometry, in the unit rectangle of whatever was marked — a page, a
/// figure, a chart, a photograph, a screenshot, a video frame — so a markup
/// redraws at any size that thing is ever shown at, and nothing in here assumes
/// a framework, a platform, an input device, or a document type. A finger, a
/// mouse, and a pencil all put down the same marks; a pencil just knows how hard
/// it was pressed.
///
/// This target is Foundation only, deliberately. Reading, writing, hit-testing
/// and undoing a markup needs no UI framework, so a test, a CLI, a server, or a
/// document pipeline can all handle one without importing SwiftUI. Drawing it is
/// `HudsonUIMarkup`'s job.
public struct HudMarkup: Hashable, Sendable {
    public var marks: [HudMark]
    /// How large the surface was, in points, when this was drawn. Kept for
    /// measuring in the reader's terms rather than the rectangle's — a distance
    /// that is 0.02 across a wide, short figure is a much shorter distance down
    /// it, and an eraser that ignores that reaches further one way than the
    /// other.
    public var capture: HudMarkupExtent?

    public init(marks: [HudMark] = [], capture: HudMarkupExtent? = nil) {
        self.marks = marks
        self.capture = capture
    }

    public var isEmpty: Bool { marks.isEmpty }

    /// How many inks a markup can name.
    ///
    /// Fixed by the format rather than left to the host, and that is the point. A
    /// mark stores which *slot* it was drawn in, not a colour, so it re-inks when
    /// the host's theme changes — which is what somebody choosing "the gold one"
    /// meant. But an index into a palette the host never declared is a trap: draw
    /// in slot 3, ship a build with three colours, and the mark silently changes
    /// colour. Documenting a minimum would not help, because nobody reads it.
    ///
    /// So the count is part of the format. Capture clamps to it, and the palette
    /// a host supplies is a fixed five rather than an array that can be
    /// under-filled. Graphite plus four accents is what every rail that has
    /// wanted this has settled on; a sixth is a version bump and a migration,
    /// made on purpose, rather than a drift found in production.
    public static let pigmentSlots = 5
}

/// The size of a marked surface, in points.
public struct HudMarkupExtent: Codable, Hashable, Sendable {
    public var width: Double
    public var height: Double

    public init(width: Double, height: Double) {
        self.width = width
        self.height = height
    }

    /// Height over width. 1 when the extent is unknown or nonsense, which
    /// measures as though the surface were square — wrong, but never wildly.
    public var aspect: Double {
        guard width > 0, height > 0 else { return 1 }
        return height / width
    }
}

/// One thing the reader drew: its geometry, what drew it, and in which ink.
public struct HudMark: Codable, Hashable, Sendable {
    public var shape: HudMarkShape
    public var instrument: HudMarkInstrument
    /// Which ink, as a slot in `HudMarkup.pigmentSlots` rather than a colour.
    ///
    /// Nobody picks `#C9A227`; they pick "the gold one". Storing the choice keeps
    /// it true when the host restyles, and keeps one authority in the record — a
    /// mark carrying both an index and a literal colour would need a precedence
    /// rule, and two facts that can disagree is the exact thing this format
    /// exists to stop. Somewhere that needs a self-describing copy — an export,
    /// a hand-off to another app — snapshots the palette once beside the markup,
    /// as how it looked, not inside every mark as what it is.
    ///
    /// Clamped on the way in, so a slot that does not exist cannot be written.
    public var pigment: Int
    /// Stroke width as a fraction of the marked rectangle's width, for the same
    /// reason the points are: a width in absolute points would be a different
    /// line on every surface that redraws it.
    ///
    /// Set *at capture* from the instrument's point size and how wide the
    /// surface was then — never a constant. A constant fraction is a pen that
    /// thickens with the window: 0.004 is 2.4pt on a 600pt page and 4.7pt on a
    /// 1180pt card, which is the same tool drawing a different line depending on
    /// how much room it had.
    public var width: Double

    public init(shape: HudMarkShape, instrument: HudMarkInstrument, pigment: Int, width: Double) {
        self.shape = shape
        self.instrument = instrument
        self.pigment = min(max(pigment, 0), HudMarkup.pigmentSlots - 1)
        self.width = width
    }

    private enum CodingKeys: String, CodingKey {
        case shape, instrument, pigment, width
    }

    /// Decoding goes through the same clamp as capture, so a markup written by a
    /// future version with more slots — or by hand — cannot hand a host an index
    /// into a palette it does not have.
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            shape: try container.decode(HudMarkShape.self, forKey: .shape),
            instrument: try container.decode(HudMarkInstrument.self, forKey: .instrument),
            pigment: try container.decode(Int.self, forKey: .pigment),
            width: try container.decode(Double.self, forKey: .width)
        )
    }
}

/// What laid a mark down — its weight and its translucency, and nothing about
/// its geometry.
///
/// Deliberately not the same thing as the seven-item row of tools the reader
/// picks from. That row is what is *in the hand*; this is what the hand *is
/// holding*, and only two things have ever been true of a mark on a picture: a
/// line drawn on top of it, or a translucent one drawn over it.
///
/// Keeping these apart is the difference between a schema and a menu. Fuse them
/// and a mark's instrument means "pen or marker" for a scribble and "rectangle"
/// for a box — one field with two meanings, redundant with the shape in half the
/// cases, and a translucent rectangle around a region of a chart, which is the
/// obvious next gesture, becomes a migration instead of a menu item.
public enum HudMarkInstrument: String, Codable, CaseIterable, Sendable {
    case pen
    case marker

    /// What it puts down, in points, so a pen is the same pen on every surface
    /// at the moment it is used.
    public var points: Double { self == .marker ? 14 : 2.4 }

    /// The instrument's weight on a surface of this width, as the fraction a
    /// mark stores. Fraction of the width rather than the diagonal: a surface
    /// keeps its aspect when it is redrawn, so width alone is a stable basis and
    /// an easier one to read.
    public func width(onSurfaceWidth surfaceWidth: Double) -> Double {
        guard surfaceWidth > 0 else { return points / 600 }
        return points / surfaceWidth
    }

    /// Marker is translucent, the way a highlighter is: it goes over the artwork
    /// rather than on top of it.
    public var opacity: Double { self == .marker ? 0.45 : 1 }
}

/// What is in the reader's hand.
///
/// A menu, not a record: nothing here is ever written to disk. It exists so a
/// picker can offer one flat row instead of asking for a shape and then a pen,
/// and so the capture layer has one thing to switch on. Each tool resolves to a
/// geometry and a character; the reader never sees that seam.
///
/// The eraser is here, and only here, because it is genuinely what you are
/// holding — and it is not in `HudMarkInstrument` because it never becomes a
/// mark.
public enum HudMarkupToolKind: String, Codable, CaseIterable, Sendable, Identifiable {
    case pen
    case marker
    case line
    case arrow
    case rectangle
    case ellipse
    case eraser

    public var id: String { rawValue }

    /// The geometry a drag with this tool produces — nothing, for the eraser.
    public var shapeKind: HudMarkShape.Kind? {
        switch self {
        case .pen, .marker: return .freehand
        case .line: return .line
        case .arrow: return .arrow
        case .rectangle: return .rectangle
        case .ellipse: return .ellipse
        case .eraser: return nil
        }
    }

    /// The character the mark is drawn with. Every ruled shape is a pen for now:
    /// a translucent box is a real gesture, but it wants its own control rather
    /// than being smuggled in as the marker's side effect.
    public var instrument: HudMarkInstrument {
        self == .marker ? .marker : .pen
    }

    /// Whether the hand's whole path is the mark, rather than just where it
    /// started and where it stopped.
    public var isFreehand: Bool { shapeKind == .freehand }

    /// Whether using it leaves anything behind.
    public var marks: Bool { self != .eraser }
}

/// Where a mark went.
///
/// Unit coordinates throughout, and deliberately only five cases: these are the
/// marks people actually make on a picture. Anything more expressive is a
/// drawing program, and a reader annotating a paper is not opening a drawing
/// program.
public enum HudMarkShape: Hashable, Sendable {
    /// The hand's own path.
    case freehand([HudMarkPoint])
    case line(HudMarkPoint, HudMarkPoint)
    /// A line that says which end it means.
    case arrow(HudMarkPoint, HudMarkPoint)
    /// Two opposite corners, in either order.
    case rectangle(HudMarkPoint, HudMarkPoint)
    /// Inscribed in the rectangle of these two corners.
    case ellipse(HudMarkPoint, HudMarkPoint)

    public enum Kind: String, Codable, Sendable {
        case freehand, line, arrow, rectangle, ellipse
    }

    public var kind: Kind {
        switch self {
        case .freehand: return .freehand
        case .line: return .line
        case .arrow: return .arrow
        case .rectangle: return .rectangle
        case .ellipse: return .ellipse
        }
    }

    /// Builds the shape a drag from `from` to `to` produces.
    public static func drawn(_ kind: Kind, from: HudMarkPoint, to: HudMarkPoint, path: [HudMarkPoint]) -> HudMarkShape {
        switch kind {
        case .freehand: return .freehand(path)
        case .line: return .line(from, to)
        case .arrow: return .arrow(from, to)
        case .rectangle: return .rectangle(from, to)
        case .ellipse: return .ellipse(from, to)
        }
    }

    /// The two opposite corners of the box this shape is inscribed in, with the
    /// smaller coordinates first — nothing, for the shapes that are not defined
    /// by a box. Lets a renderer with native rectangles and ellipses reach for
    /// them without unpicking the polyline.
    public var box: (from: HudMarkPoint, to: HudMarkPoint)? {
        switch self {
        case let .rectangle(a, b), let .ellipse(a, b):
            let corners = HudMarkShape.bounds(a, b)
            return (
                HudMarkPoint(x: corners.minX, y: corners.minY),
                HudMarkPoint(x: corners.maxX, y: corners.maxY)
            )
        case .freehand, .line, .arrow:
            return nil
        }
    }

    /// Whether the last point joins back to the first.
    public var isClosed: Bool {
        switch self {
        case .rectangle, .ellipse: return true
        case .freehand, .line, .arrow: return false
        }
    }

    /// The mark as a single open or closed polyline, in unit space.
    ///
    /// This is the hit geometry — the one true answer to "how near did the
    /// eraser pass" — and a portable fallback for any renderer that has never
    /// heard of ellipses. It is not a ceiling on drawing: the parametric case is
    /// canonical, so a renderer with a native conic should use it and get an
    /// exact curve at any size rather than a polygon that facets as the figure
    /// grows.
    public func outline(samples: Int = 48) -> [HudMarkPoint] {
        switch self {
        case let .freehand(points):
            return points
        case let .line(from, to), let .arrow(from, to):
            return [from, to]
        case let .rectangle(a, b):
            let box = HudMarkShape.bounds(a, b)
            return [
                HudMarkPoint(x: box.minX, y: box.minY),
                HudMarkPoint(x: box.maxX, y: box.minY),
                HudMarkPoint(x: box.maxX, y: box.maxY),
                HudMarkPoint(x: box.minX, y: box.maxY),
                HudMarkPoint(x: box.minX, y: box.minY)
            ]
        case let .ellipse(a, b):
            let box = HudMarkShape.bounds(a, b)
            let cx = (box.minX + box.maxX) / 2
            let cy = (box.minY + box.maxY) / 2
            let rx = (box.maxX - box.minX) / 2
            let ry = (box.maxY - box.minY) / 2
            let steps = max(samples, 8)
            return (0...steps).map { step in
                let angle = 2 * Double.pi * Double(step) / Double(steps)
                return HudMarkPoint(x: cx + rx * cos(angle), y: cy + ry * sin(angle))
            }
        }
    }

    /// The two barbs and the tip, as a polyline to stroke — nothing, unless this
    /// is an arrow.
    ///
    /// `aspect` is the surface's height over its width: without it the head is
    /// sheared, because a 30-degree angle in unit coordinates is not 30 degrees
    /// on anything that is not square.
    public func arrowhead(aspect: Double, length: Double) -> [HudMarkPoint]? {
        guard case let .arrow(from, to) = self else { return nil }
        // Measure in a space where the surface is square, turn the head there,
        // then put it back.
        let dx = to.x - from.x
        let dy = (to.y - from.y) * aspect
        let reach = (dx * dx + dy * dy).squareRoot()
        guard reach > 0 else { return nil }
        let angle = atan2(dy, dx)
        let spread = 26 * Double.pi / 180
        let barb = min(length, reach)
        return [
            HudMarkPoint(
                x: to.x - barb * cos(angle - spread),
                y: to.y - barb * sin(angle - spread) / (aspect == 0 ? 1 : aspect)
            ),
            to,
            HudMarkPoint(
                x: to.x - barb * cos(angle + spread),
                y: to.y - barb * sin(angle + spread) / (aspect == 0 ? 1 : aspect)
            )
        ]
    }

    private static func bounds(
        _ a: HudMarkPoint,
        _ b: HudMarkPoint
    ) -> (minX: Double, minY: Double, maxX: Double, maxY: Double) {
        (min(a.x, b.x), min(a.y, b.y), max(a.x, b.x), max(a.y, b.y))
    }
}

public struct HudMarkPoint: Codable, Hashable, Sendable {
    public var x: Double
    public var y: Double
    /// How much wider the mark was here than the instrument's baseline — a pen
    /// pressed harder, or tilted. Absent means "exactly the instrument", which is
    /// what a mouse and a finger draw, honestly: neither has pressure, and
    /// inventing some from speed would be handwriting the reader never did.
    public var w: Double?

    public init(x: Double, y: Double, w: Double? = nil) {
        self.x = x
        self.y = y
        self.w = w
    }
}

// MARK: - Coding

extension HudMarkShape: Codable {
    private enum CodingKeys: String, CodingKey {
        case kind, points, from, to
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let kind = try container.decode(Kind.self, forKey: .kind)
        switch kind {
        case .freehand:
            self = .freehand(try container.decode([HudMarkPoint].self, forKey: .points))
        case .line, .arrow, .rectangle, .ellipse:
            let from = try container.decode(HudMarkPoint.self, forKey: .from)
            let to = try container.decode(HudMarkPoint.self, forKey: .to)
            self = HudMarkShape.drawn(kind, from: from, to: to, path: [from, to])
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(kind, forKey: .kind)
        switch self {
        case let .freehand(points):
            try container.encode(points, forKey: .points)
        case let .line(from, to), let .arrow(from, to),
             let .rectangle(from, to), let .ellipse(from, to):
            try container.encode(from, forKey: .from)
            try container.encode(to, forKey: .to)
        }
    }
}

extension HudMarkup: Codable {
    private enum CodingKeys: String, CodingKey {
        case marks
        case capture
        // Written when a markup could only hold freehand.
        case strokes
        case pigmentIndex
    }

    /// Reads the two formats written before this one: a list of strokes carrying
    /// a tool, and before that a list of bare point-lists with one pigment for
    /// the lot. Those are real marks somebody made and are not worth losing over
    /// a field name.
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let capture = try container.decodeIfPresent(HudMarkupExtent.self, forKey: .capture)
        self.capture = capture

        if let marks = try? container.decode([HudMark].self, forKey: .marks) {
            self.marks = marks
            return
        }
        if let strokes = try? container.decode([LegacyStroke].self, forKey: .strokes) {
            self.marks = strokes.map {
                HudMark(
                    shape: .freehand($0.points),
                    instrument: $0.tool == "marker" ? .marker : .pen,
                    pigment: $0.pigment,
                    width: $0.width
                )
            }
            return
        }
        let bare = try container.decode([[HudMarkPoint]].self, forKey: .strokes)
        let pigment = try container.decodeIfPresent(Int.self, forKey: .pigmentIndex) ?? 0
        let width = HudMarkInstrument.pen.width(onSurfaceWidth: capture?.width ?? 0)
        self.marks = bare.map {
            HudMark(shape: .freehand($0), instrument: .pen, pigment: pigment, width: width)
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(marks, forKey: .marks)
        try container.encodeIfPresent(capture, forKey: .capture)
    }

    /// The middle format: freehand only, but already carrying a tool and a
    /// capture-relative width.
    private struct LegacyStroke: Decodable {
        var points: [HudMarkPoint]
        var tool: String
        var pigment: Int
        var width: Double
    }
}

// MARK: - History

/// A markup, and the ability to take back what was just done to it.
///
/// Undo is the first thing every drawing surface reinvents and the first thing
/// each one gets subtly differently — a stack per surface, hand-rolled, usually
/// without a redo. Marking something up is a conversation with your own hand:
/// you draw, you dislike it, you take it back, and often you want it back again.
/// That is one behaviour, so it is one type, and it is a value rather than a
/// controller so any surface can hold one without inheriting a lifetime.
public struct HudMarkupHistory: Hashable, Sendable {
    public private(set) var markup: HudMarkup
    /// States, not marks. Undo that pops marks cannot express "I cleared the
    /// whole thing" as one act — clearing a drawing by mistake would cost one
    /// keystroke per mark to put right, and erasing would be worse, since the
    /// mark has to go back where it was rather than on the end.
    private var past: [HudMarkup] = []
    /// Cleared the moment new work lands: a redo that survived it would put a
    /// mark back into a drawing it was never part of.
    private var future: [HudMarkup] = []
    /// Whether a stint is open, and whether it has already taken its snapshot.
    /// An eraser dragged across five marks is one act of erasing, not five —
    /// without this, putting it right costs five keystrokes.
    private var stintOpen = false
    private var stintRecorded = false

    /// How far back the hand is remembered. A handwritten page is a long
    /// session, and a snapshot costs one array of mark structs — the points
    /// themselves are shared, not copied — but unbounded is still unbounded.
    public static let depth = 100

    public init(markup: HudMarkup = HudMarkup()) {
        self.markup = markup
    }

    public var canUndo: Bool { !past.isEmpty }
    public var canRedo: Bool { !future.isEmpty }
    public var isEmpty: Bool { markup.isEmpty }

    public mutating func add(_ mark: HudMark) {
        commit { $0.marks.append(mark) }
    }

    /// Brackets one gesture, so everything it does is one thing to undo.
    public mutating func beginStint() {
        stintOpen = true
        stintRecorded = false
    }

    public mutating func endStint() {
        stintOpen = false
        stintRecorded = false
    }

    /// Everything at once, and one act to take back.
    public mutating func clear() {
        guard !markup.marks.isEmpty else { return }
        commit { $0.marks.removeAll() }
    }

    /// Lifts every mark the eraser passed over on its way from `from` to `to`.
    ///
    /// Every mark, not the nearest one: a hand moving quickly reports its
    /// positions far apart, and an eraser that takes only the closest leaves the
    /// others standing in the middle of the swipe. And measured along the path
    /// rather than at the point it happened to be sampled at, for the same
    /// reason.
    ///
    /// Whole marks, never parts of them. A half-erased rectangle is not a shape
    /// anybody drew. The consequence worth knowing: a mark is caught by its
    /// outline, so an eraser dragged through the empty middle of a large
    /// rectangle does not take it — you rub out the line you can see, which is
    /// the same rule for every mark and the only one that stays true when the
    /// shape is a squiggle.
    ///
    /// `aspect` is the surface's height over its width, because these are unit
    /// coordinates: without it the eraser reaches further sideways than down on
    /// anything that is not square.
    ///
    /// Nothing is lifted by a pass that came no nearer than `reach` — an eraser
    /// that finds something wherever it is put deletes work nobody aimed at.
    @discardableResult
    public mutating func erase(
        from: HudMarkPoint,
        to: HudMarkPoint,
        reach: Double,
        aspect: Double = 1
    ) -> Bool {
        let hits = markup.marks.indices.filter { index in
            let mark = markup.marks[index]
            // A thick mark is as easy to lift as it was to lay down.
            let bite = max(reach, mark.width / 2)
            let outline = mark.shape.outline()
            return Self.distance(from: from, to: to, outline: outline, aspect: aspect) <= bite
        }
        guard !hits.isEmpty else { return false }
        commit { markup in
            for index in hits.reversed() { markup.marks.remove(at: index) }
        }
        return true
    }

    @discardableResult
    public mutating func undo() -> Bool {
        guard let previous = past.popLast() else { return false }
        future.append(markup)
        markup = previous
        return true
    }

    @discardableResult
    public mutating func redo() -> Bool {
        guard let next = future.popLast() else { return false }
        past.append(markup)
        markup = next
        return true
    }

    private mutating func commit(_ change: (inout HudMarkup) -> Void) {
        if !stintOpen || !stintRecorded {
            past.append(markup)
            if past.count > Self.depth { past.removeFirst(past.count - Self.depth) }
            stintRecorded = stintOpen
        }
        change(&markup)
        future.removeAll()
    }

    /// Nearest approach between the eraser's path and the line the reader drew.
    /// Sampled along the eraser's segment: exact enough at any reach worth
    /// having, and it keeps the geometry to one primitive.
    private static func distance(
        from: HudMarkPoint,
        to: HudMarkPoint,
        outline: [HudMarkPoint],
        aspect: Double
    ) -> Double {
        guard let first = outline.first else { return .greatestFiniteMagnitude }
        guard outline.count > 1 else { return distance(from, first, aspect: aspect) }
        var nearest = Double.greatestFiniteMagnitude
        let steps = 8
        for step in 0...steps {
            let t = Double(step) / Double(steps)
            let probe = HudMarkPoint(
                x: from.x + (to.x - from.x) * t,
                y: from.y + (to.y - from.y) * t
            )
            for (start, end) in zip(outline, outline.dropFirst()) {
                nearest = min(nearest, distance(probe, from: start, to: end, aspect: aspect))
            }
        }
        return nearest
    }

    private static func distance(_ a: HudMarkPoint, _ b: HudMarkPoint, aspect: Double) -> Double {
        let dx = a.x - b.x
        let dy = (a.y - b.y) * aspect
        return (dx * dx + dy * dy).squareRoot()
    }

    private static func distance(
        _ point: HudMarkPoint,
        from start: HudMarkPoint,
        to end: HudMarkPoint,
        aspect: Double
    ) -> Double {
        let dx = end.x - start.x
        let dy = end.y - start.y
        let lengthSquared = dx * dx + dy * dy * aspect * aspect
        guard lengthSquared > 0 else { return distance(point, start, aspect: aspect) }
        let t = ((point.x - start.x) * dx + (point.y - start.y) * dy * aspect * aspect) / lengthSquared
        let clamped = min(max(t, 0), 1)
        return distance(
            point,
            HudMarkPoint(x: start.x + clamped * dx, y: start.y + clamped * dy),
            aspect: aspect
        )
    }
}
