#if canImport(PencilKit)
import HudsonMarkup
import PencilKit
import SwiftUI

public extension HudMarkup {
    /// Reads a `PKDrawing` into marks — a one-way door out of PencilKit's format
    /// and into one that can be opened anywhere.
    ///
    /// This exists so nobody's saved drawing is lost on the way. `PKDrawing`
    /// bytes and a markup's JSON are both `Data`, which means a host that
    /// switched storage without converting would not crash — it would decode
    /// nothing and show an empty canvas where somebody's work was. That is the
    /// worst kind of breakage, so the converter ships with the change rather
    /// than after it.
    ///
    /// `bounds` is the rectangle the drawing was made in — the canvas's own size
    /// at the time, not the drawing's tight bounds, because points are stored
    /// relative to the surface and a tight box would rescale everything to fill
    /// it. Hosts that never recorded a canvas size can pass the drawing's own
    /// `bounds` and accept that the marks will be normalized to their extent.
    ///
    /// What is kept: the path, the ink's width, whether it was a marker, and the
    /// pressure at each point. What is lost: PencilKit's exact ink texture and
    /// its colour, which becomes a palette slot — a pen is graphite and anything
    /// marker-like is the first accent, since a literal colour is precisely what
    /// this format refuses to store.
    init(pkDrawingData data: Data, bounds: CGRect) {
        guard !data.isEmpty,
              let drawing = try? PKDrawing(data: data),
              bounds.width > 0, bounds.height > 0 else {
            self.init()
            return
        }
        self.init(pkDrawing: drawing, bounds: bounds)
    }

    init(pkDrawing drawing: PKDrawing, bounds: CGRect) {
        let width = Double(bounds.width)
        let height = Double(bounds.height)
        guard width > 0, height > 0 else {
            self.init()
            return
        }

        let marks: [HudMark] = drawing.strokes.compactMap { stroke in
            let isMarker = stroke.ink.inkType == .marker
            let instrument: HudMarkInstrument = isMarker ? .marker : .pen
            // PencilKit reports a stroke as a parametric path; walking it at its
            // own control points is the closest thing to what the hand did.
            let path = stroke.path
            guard !path.isEmpty else { return nil }

            // The nib width PencilKit actually drew with, made relative to the
            // surface the same way a mark captured here would be.
            let nib = Double(path.first?.size.width ?? CGFloat(instrument.points))
            let points: [HudMarkPoint] = path.map { element in
                let located = element.location.applying(
                    CGAffineTransform(translationX: -bounds.minX, y: -bounds.minY)
                )
                return HudMarkPoint(
                    x: min(max(Double(located.x) / width, 0), 1),
                    y: min(max(Double(located.y) / height, 0), 1),
                    // Pressure as a multiple of the nib, matching what `w` means
                    // here — absent when the stroke was drawn at a flat width.
                    w: nib > 0 ? Double(element.size.width) / nib : nil
                )
            }
            guard points.count > 1 else { return nil }

            return HudMark(
                shape: .freehand(points),
                instrument: instrument,
                pigment: isMarker ? 1 : 0,
                width: nib / width
            )
        }

        self.init(
            marks: marks,
            capture: HudMarkupExtent(width: width, height: height)
        )
    }
}
#endif
