import HudsonMarkup
import SwiftUI

/// A layer that takes marks and draws them, over whatever it is put on.
///
/// The thing this replaces drew a placeholder on macOS that said "Ink canvas
/// unavailable", because it was PencilKit and PencilKit has no canvas there. A
/// drag is a drag on every platform, so this works on all of them: a mouse, a
/// trackpad, a finger, and a pencil all report where they are and where they
/// went, which is the whole of what marking something up needs.
///
/// It is transparent and owns no chrome. Put it over an image, a document, a
/// chart, a screenshot; give it a history to draw into; put a ``HudMarkupRail``
/// somewhere the hand can reach. What it draws on, where the markup is stored,
/// and when it is saved are all the host's business.
///
/// One gesture, and what it means depends only on the tool: a pen keeps the
/// whole path, a rectangle keeps where the drag started and where it is now, an
/// eraser keeps nothing and rubs as it goes.
public struct HudMarkupSurface: View {
    @Binding private var history: HudMarkupHistory
    private let tool: HudMarkupToolKind
    private let pigment: Int
    private let palette: HudMarkupPalette
    private let isEnabled: Bool

    /// Where the current drag began — nil when nothing is being drawn.
    @State private var dragOrigin: HudMarkPoint?
    /// Every point the hand has passed through in this drag. The whole of it is
    /// the mark when the tool is freehand; only its last point matters when the
    /// tool is ruled.
    @State private var dragPath: [HudMarkPoint] = []
    @State private var surfaceSize: CGSize = .zero
    /// Whether this drag is an erasing one, so its whole sweep is one act.
    @State private var erasing = false

    public init(
        history: Binding<HudMarkupHistory>,
        tool: HudMarkupToolKind,
        pigment: Int = 0,
        palette: HudMarkupPalette = .standard,
        isEnabled: Bool = true
    ) {
        _history = history
        self.tool = tool
        self.pigment = pigment
        self.palette = palette
        self.isEnabled = isEnabled
    }

    /// How near the eraser has to pass a mark to take it, as a fraction of the
    /// surface's width. Generous enough to catch a hairline, tight enough that it
    /// cannot reach across the picture to something nobody was aiming at.
    public static let eraserReach = 0.015

    public var body: some View {
        Canvas { canvas, size in
            HudMarkupRenderer.draw(history.markup, in: &canvas, size: size, palette: palette)
            // The mark in progress is drawn exactly as it will be kept, so a
            // rubber-banded ellipse is the ellipse, not a preview of one.
            if let shape = liveShape {
                HudMarkupRenderer.draw(
                    shape: shape,
                    instrument: tool.instrument,
                    pigment: pigment,
                    width: tool.instrument.width(onSurfaceWidth: size.width),
                    in: &canvas,
                    size: size,
                    palette: palette
                )
            }
        }
        .contentShape(Rectangle())
        .gesture(drawing, isEnabled: isEnabled)
        .background {
            // The gesture works in the canvas's own space; its size has to be
            // read from the same place so a point lands where it was drawn.
            GeometryReader { geo in
                Color.clear
                    .onAppear { surfaceSize = geo.size }
                    .onChange(of: geo.size) { _, size in surfaceSize = size }
            }
        }
    }

    private var drawing: some Gesture {
        DragGesture(minimumDistance: 2, coordinateSpace: .local)
            .onChanged { value in
                guard surfaceSize.width > 0, surfaceSize.height > 0 else { return }
                let unit = HudMarkPoint(
                    x: min(max(value.location.x / surfaceSize.width, 0), 1),
                    y: min(max(value.location.y / surfaceSize.height, 0), 1)
                )
                // The eraser rubs out as it is dragged rather than waiting for
                // the hand to lift, which is what an eraser does — and the whole
                // drag is one act, so taking back a sweep that caught too much
                // costs one keystroke rather than one per mark it caught.
                if tool == .eraser {
                    if !erasing {
                        erasing = true
                        history.beginStint()
                    }
                    history.erase(
                        from: dragPath.last ?? unit,
                        to: unit,
                        reach: Self.eraserReach,
                        aspect: surfaceSize.width > 0 ? surfaceSize.height / surfaceSize.width : 1
                    )
                    dragPath = [unit]
                } else {
                    if dragOrigin == nil { dragOrigin = unit }
                    dragPath.append(unit)
                }
            }
            .onEnded { _ in
                if let shape = liveShape {
                    history.add(
                        HudMark(
                            shape: shape,
                            instrument: tool.instrument,
                            pigment: pigment,
                            // Measured against the surface as drawn, so a pen is
                            // 2.4pt here and 2.4pt on a copy half this size
                            // rather than thickening with the window.
                            width: tool.instrument.width(onSurfaceWidth: surfaceSize.width)
                        )
                    )
                }
                if erasing {
                    history.endStint()
                    erasing = false
                }
                dragOrigin = nil
                dragPath = []
            }
    }

    /// The mark the current drag would leave if the hand lifted now — the same
    /// value used to draw it live and to keep it, so what is shown and what is
    /// stored cannot drift.
    private var liveShape: HudMarkShape? {
        guard let kind = tool.shapeKind,
              let origin = dragOrigin,
              let last = dragPath.last,
              dragPath.count > 1 else { return nil }
        return .drawn(kind, from: origin, to: last, path: dragPath)
    }
}

public extension View {
    /// Puts a markup layer over this view, sized to it.
    ///
    /// The common case: something is on screen and should be drawable on without
    /// rearranging the view that draws it.
    func hudMarkup(
        _ history: Binding<HudMarkupHistory>,
        tool: HudMarkupToolKind,
        pigment: Int = 0,
        palette: HudMarkupPalette = .standard,
        isEnabled: Bool = true
    ) -> some View {
        overlay {
            HudMarkupSurface(
                history: history,
                tool: tool,
                pigment: pigment,
                palette: palette,
                isEnabled: isEnabled
            )
        }
    }
}
