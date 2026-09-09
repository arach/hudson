import HudsonMarkup
import SwiftUI

/// The inks a markup can be drawn in.
///
/// Exactly `HudMarkup.pigmentSlots` of them, as a fixed shape rather than an
/// array with a documented minimum: a mark stores which slot it was drawn in, so
/// a host that supplies four colours for a five-slot format would silently
/// change somebody's mark. This cannot be under-filled.
///
/// Graphite first — the default, the one most marks are — then four accents.
public struct HudMarkupPalette: Sendable {
    public let graphite: Color
    public let accents: (Color, Color, Color, Color)

    public init(graphite: Color, accents: (Color, Color, Color, Color)) {
        self.graphite = graphite
        self.accents = accents
    }

    /// For hosts with no opinion. Reads from the kit's own palette, so a markup
    /// drawn in a Hudson app looks like the app it was drawn in.
    public static var standard: HudMarkupPalette {
        HudMarkupPalette(
            graphite: HudPalette.ink,
            accents: (
                HudPalette.statusWarn,
                HudPalette.statusError,
                HudPalette.accent,
                HudPalette.statusInfo
            )
        )
    }

    public func color(_ slot: Int) -> Color {
        switch min(max(slot, 0), HudMarkup.pigmentSlots - 1) {
        case 0: return graphite
        case 1: return accents.0
        case 2: return accents.1
        case 3: return accents.2
        default: return accents.3
        }
    }

    public var colors: [Color] {
        (0..<HudMarkup.pigmentSlots).map(color)
    }
}

/// Draws a markup. Once, for everybody.
///
/// Every surface that can be marked draws marks the same way, because they are
/// the same marks — a document, a figure, a screenshot, a photograph, a frame of
/// video. A renderer per surface is how a kit ends up with single-colour
/// toolless scribbles in one place and pens in another: the drawing code is
/// where the decisions accidentally live.
///
/// It takes geometry and a palette and knows nothing else. Not what is under it,
/// not what document it belongs to, not which platform is asking.
public enum HudMarkupRenderer {
    public static func draw(
        _ markup: HudMarkup,
        in canvas: inout GraphicsContext,
        size: CGSize,
        palette: HudMarkupPalette = .standard
    ) {
        for mark in markup.marks {
            draw(mark, in: &canvas, size: size, palette: palette)
        }
    }

    public static func draw(
        _ mark: HudMark,
        in canvas: inout GraphicsContext,
        size: CGSize,
        palette: HudMarkupPalette = .standard
    ) {
        draw(
            shape: mark.shape,
            instrument: mark.instrument,
            pigment: mark.pigment,
            width: mark.width,
            in: &canvas,
            size: size,
            palette: palette
        )
    }

    /// Draws a mark that does not exist yet — the one under the hand right now.
    /// Same call the finished mark goes through, so what is shown while drawing
    /// and what is kept afterwards cannot drift apart.
    public static func draw(
        shape: HudMarkShape,
        instrument: HudMarkInstrument,
        pigment: Int,
        width: Double,
        in canvas: inout GraphicsContext,
        size: CGSize,
        palette: HudMarkupPalette = .standard
    ) {
        guard let drawn = path(shape, in: size) else { return }
        let style = StrokeStyle(
            lineWidth: width * size.width,
            lineCap: .round,
            lineJoin: .round
        )
        let paint = GraphicsContext.Shading.color(
            palette.color(pigment).opacity(instrument.opacity)
        )
        canvas.stroke(drawn, with: paint, style: style)

        let aspect = size.width > 0 ? size.height / size.width : 1
        // The head is sized off the line's own weight, so a thick arrow gets a
        // head to match, with a floor so a hairline arrow still points at
        // something.
        if let head = shape.arrowhead(aspect: aspect, length: max(width * 4, 0.022)) {
            canvas.stroke(path(head, closed: false, in: size), with: paint, style: style)
        }
    }

    /// The exact curve where the platform has one, the portable polyline where it
    /// does not. A 48-gon standing in for an ellipse is invisible on a thumbnail
    /// and visibly faceted on a figure blown up to fill a large display, and
    /// CoreGraphics has known how to draw an ellipse for forty years.
    private static func path(_ shape: HudMarkShape, in size: CGSize) -> Path? {
        if let box = shape.box {
            let origin = point(box.from, in: size)
            let far = point(box.to, in: size)
            let rect = CGRect(
                x: origin.x,
                y: origin.y,
                width: far.x - origin.x,
                height: far.y - origin.y
            )
            return shape.kind == .ellipse ? Path(ellipseIn: rect) : Path(rect)
        }
        let outline = shape.outline()
        guard outline.count > 1 else { return nil }
        return path(outline, closed: false, in: size)
    }

    private static func path(_ points: [HudMarkPoint], closed: Bool, in size: CGSize) -> Path {
        var path = Path()
        guard let first = points.first else { return path }
        path.move(to: point(first, in: size))
        for unit in points.dropFirst() {
            path.addLine(to: point(unit, in: size))
        }
        if closed { path.closeSubpath() }
        return path
    }

    private static func point(_ unit: HudMarkPoint, in size: CGSize) -> CGPoint {
        CGPoint(x: unit.x * size.width, y: unit.y * size.height)
    }
}

/// A markup, drawn. No input, no tools — for the places something marked up is
/// shown rather than worked on: a list row, a thumbnail, a printout, a preview.
public struct HudMarkupLayer: View {
    private let markup: HudMarkup
    private let palette: HudMarkupPalette

    public init(_ markup: HudMarkup, palette: HudMarkupPalette = .standard) {
        self.markup = markup
        self.palette = palette
    }

    public var body: some View {
        Canvas { canvas, size in
            HudMarkupRenderer.draw(markup, in: &canvas, size: size, palette: palette)
        }
        .allowsHitTesting(false)
    }
}
