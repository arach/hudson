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

    @Binding private var width: CGFloat
    private let placement: Placement
    private let range: ClosedRange<CGFloat>
    private let hitWidth: CGFloat

    @State private var dragOrigin: CGFloat?
    @State private var isHovering = false
    @Environment(\.hudTheme) private var theme

    public init(
        width: Binding<CGFloat>,
        placement: Placement,
        range: ClosedRange<CGFloat>,
        hitWidth: CGFloat = 8
    ) {
        self._width = width
        self.placement = placement
        self.range = range
        self.hitWidth = hitWidth
    }

    public var body: some View {
        ZStack {
            Color.clear
            Rectangle()
                .fill(isActive ? theme.hairline.standard : theme.hairline.subtle)
                .frame(width: HudStrokeWidth.thin)
                .frame(maxHeight: .infinity, alignment: .center)
        }
        .frame(width: hitWidth)
        .contentShape(Rectangle())
        .onHover { hovering in
            isHovering = hovering
            updateResizeCursor(isActive: hovering || dragOrigin != nil)
        }
        .gesture(
            DragGesture(minimumDistance: 0)
                .onChanged { value in
                    let origin = dragOrigin ?? width
                    if dragOrigin == nil {
                        dragOrigin = origin
                    }
                    let signedDelta = placement == .trailing
                        ? value.translation.width
                        : -value.translation.width
                    width = min(max(origin + signedDelta, range.lowerBound), range.upperBound)
                    updateResizeCursor(isActive: true)
                }
                .onEnded { _ in
                    dragOrigin = nil
                    updateResizeCursor(isActive: isHovering)
                }
        )
        .accessibilityLabel("Resize panel")
        .accessibilityAddTraits(.isButton)
    }

    private var isActive: Bool {
        isHovering || dragOrigin != nil
    }

    private func updateResizeCursor(isActive: Bool) {
        #if os(macOS)
        if isActive {
            NSCursor.resizeLeftRight.push()
        } else {
            NSCursor.pop()
        }
        #endif
    }
}
