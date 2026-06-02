import SwiftUI

#if os(macOS)
import AppKit
#endif

/// Drag handle for resizable shell columns. Renders a single hairline on the
/// panel-facing edge and keeps a wider hit target for comfortable resizing.
public struct HudResizableDivider: View {
    public enum Placement: Sendable {
        case leading
        case trailing
    }

    public enum HairlinePlacement: Sendable {
        case automatic
        case leading
        case center
        case trailing
    }

    @Binding private var width: CGFloat
    private let placement: Placement
    private let range: ClosedRange<CGFloat>
    private let hitWidth: CGFloat
    private let hairlinePlacement: HairlinePlacement
    private let showsHairline: Bool

    @State private var dragOrigin: CGFloat?
    @State private var isHovering = false
    @Environment(\.hudTheme) private var theme

    public init(
        width: Binding<CGFloat>,
        placement: Placement,
        range: ClosedRange<CGFloat>,
        hitWidth: CGFloat = 8,
        hairlinePlacement: HairlinePlacement = .automatic,
        showsHairline: Bool = true
    ) {
        self._width = width
        self.placement = placement
        self.range = range
        self.hitWidth = hitWidth
        self.hairlinePlacement = hairlinePlacement
        self.showsHairline = showsHairline
    }

    public var body: some View {
        #if os(macOS)
        handleSurface
            .frame(width: hitWidth)
            .accessibilityLabel("Resize panel")
            .accessibilityAddTraits(.isButton)
        #else
        handleSurface
            .frame(width: hitWidth)
            .contentShape(Rectangle())
            .onHover { hovering in
                isHovering = hovering
            }
            .gesture(
                DragGesture(minimumDistance: 1, coordinateSpace: .global)
                    .onChanged { value in
                        if dragOrigin == nil {
                            dragOrigin = width
                        }
                        guard let origin = dragOrigin else { return }
                        let signedDelta = placement == .trailing
                            ? value.translation.width
                            : -value.translation.width
                        width = min(max(origin + signedDelta, range.lowerBound), range.upperBound)
                    }
                    .onEnded { _ in
                        dragOrigin = nil
                    }
            )
            .accessibilityLabel("Resize panel")
            .accessibilityAddTraits(.isButton)
        #endif
    }

    private var handleSurface: some View {
        ZStack(alignment: hairlineAlignment) {
            Color.clear
            if showsHairline {
                Rectangle()
                    .fill(isActive ? theme.hairline.standard : theme.hairline.subtle)
                    .frame(width: HudStrokeWidth.thin)
                    .frame(maxHeight: .infinity, alignment: .center)
            }
            #if os(macOS)
            HudResizeHandleRegion(
                width: $width,
                placement: placement,
                range: range,
                isActive: $isHovering
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            #endif
        }
    }

    private var isActive: Bool {
        isHovering || dragOrigin != nil
    }

    private var hairlineAlignment: Alignment {
        switch hairlinePlacement {
        case .automatic:
            placement == .leading ? .trailing : .leading
        case .leading:
            .leading
        case .center:
            .center
        case .trailing:
            .trailing
        }
    }
}

#if os(macOS)
private struct HudResizeHandleRegion: NSViewRepresentable {
    @Binding var width: CGFloat
    let placement: HudResizableDivider.Placement
    let range: ClosedRange<CGFloat>
    @Binding var isActive: Bool

    func makeCoordinator() -> Coordinator {
        Coordinator(width: $width, isActive: $isActive)
    }

    func makeNSView(context: Context) -> CursorView {
        let view = CursorView()
        view.coordinator = context.coordinator
        return view
    }

    func updateNSView(_ view: CursorView, context: Context) {
        context.coordinator.width = $width
        context.coordinator.isActive = $isActive
        view.coordinator = context.coordinator
        view.currentWidth = width
        view.placement = placement
        view.range = range
        view.window?.invalidateCursorRects(for: view)
    }

    final class Coordinator {
        var width: Binding<CGFloat>
        var isActive: Binding<Bool>

        init(width: Binding<CGFloat>, isActive: Binding<Bool>) {
            self.width = width
            self.isActive = isActive
        }
    }
}

private final class CursorView: NSView {
    var coordinator: HudResizeHandleRegion.Coordinator?
    var currentWidth: CGFloat = 0
    var placement: HudResizableDivider.Placement = .leading
    var range: ClosedRange<CGFloat> = 0...0

    private var dragOrigin: CGFloat?
    private var dragOriginX: CGFloat = 0
    private var trackingArea: NSTrackingArea?
    private var isMouseInside = false
    private var isDragging = false

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        wantsLayer = false
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        nil
    }

    override func acceptsFirstMouse(for event: NSEvent?) -> Bool {
        true
    }

    override func updateTrackingAreas() {
        if let trackingArea {
            removeTrackingArea(trackingArea)
        }

        let options: NSTrackingArea.Options = [
            .activeInActiveApp,
            .cursorUpdate,
            .inVisibleRect,
            .mouseEnteredAndExited,
        ]
        let nextTrackingArea = NSTrackingArea(rect: .zero, options: options, owner: self)
        addTrackingArea(nextTrackingArea)
        trackingArea = nextTrackingArea
        super.updateTrackingAreas()
    }

    override func resetCursorRects() {
        addCursorRect(bounds, cursor: .resizeLeftRight)
    }

    override func mouseEntered(with event: NSEvent) {
        isMouseInside = true
        setActive(true)
    }

    override func mouseExited(with event: NSEvent) {
        isMouseInside = false
        if !isDragging {
            setActive(false)
        }
    }

    override func cursorUpdate(with event: NSEvent) {
        NSCursor.resizeLeftRight.set()
    }

    override func mouseDown(with event: NSEvent) {
        isDragging = true
        dragOrigin = currentWidth
        dragOriginX = event.locationInWindow.x
        setActive(true)
        NSCursor.resizeLeftRight.set()
    }

    override func mouseDragged(with event: NSEvent) {
        guard let dragOrigin else { return }
        let delta = event.locationInWindow.x - dragOriginX
        let signedDelta = placement == .trailing ? delta : -delta
        let nextWidth = min(max(dragOrigin + signedDelta, range.lowerBound), range.upperBound)
        currentWidth = nextWidth
        coordinator?.width.wrappedValue = nextWidth
        NSCursor.resizeLeftRight.set()
    }

    override func mouseUp(with event: NSEvent) {
        dragOrigin = nil
        isDragging = false
        let localPoint = convert(event.locationInWindow, from: nil)
        isMouseInside = bounds.contains(localPoint)
        setActive(isMouseInside)
        if isMouseInside {
            NSCursor.resizeLeftRight.set()
        }
    }

    private func setActive(_ active: Bool) {
        coordinator?.isActive.wrappedValue = active
    }
}
#endif
