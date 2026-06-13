import SwiftUI
import HudsonUI

#if os(macOS)
import AppKit
#endif

/// Shared trailing-edge resize handle for Hudson sidebar columns.
struct HudSidebarEdgeHandle: View {
    let isCompact: Bool
    let activationDistance: CGFloat
    let currentWidth: CGFloat
    let minWidth: CGFloat
    let maxWidth: CGFloat
    let collapseWidth: CGFloat
    let visualOffset: CGFloat
    let reduceMotion: Bool
    let accent: Color
    let accessibilityLabel: String
    @Binding var isDragging: Bool
    let onToggle: () -> Void
    let onResize: (CGFloat) -> Void
    let onResizeEnded: (CGFloat) -> Void
    let onCollapse: (CGFloat) -> Void
    let onExpand: (CGFloat) -> Void

    @State private var isHovered = false
    @State private var cursorPushed = false
    @State private var dragStartWidth: CGFloat?
    @State private var latestResizeWidth: CGFloat?
    @State private var didCommitResize = false
    @State private var lastClickTime: Date?

    private static let doubleClickInterval: TimeInterval = 0.35

    private var hitWidth: CGFloat {
        isCompact ? 26 : 16
    }

    private var activationThreshold: CGFloat {
        isCompact ? max(2, activationDistance * 0.5) : activationDistance
    }

    var body: some View {
        let isActive = isHovered || isDragging
        let handleVisualWidth: CGFloat = isCompact ? 4 : 3
        let pillHeight: CGFloat = isCompact ? (isActive ? 74 : 62) : (isActive ? 64 : 56)
        let haloWidth = handleVisualWidth + (isCompact ? 12 : 8)
        let haloHeight = pillHeight + 12
        let haloFill = HudSurface.selected(accent)
        let handleFill = isActive
            ? HudSurface.tintMuted(accent)
            : (isCompact ? HudSurface.tintFill(accent) : Color.clear)

        Rectangle()
            .fill(Color.clear)
            .frame(width: hitWidth)
            .contentShape(Rectangle())
            .overlay {
                ZStack {
                    if isActive {
                        RoundedRectangle(cornerRadius: HudRadius.standard)
                            .fill(haloFill)
                            .frame(width: haloWidth, height: haloHeight)
                            .blur(radius: 6)
                    }

                    RoundedRectangle(cornerRadius: HudRadius.tight)
                        .fill(handleFill)
                        .frame(width: handleVisualWidth, height: pillHeight)
                }
                .offset(x: visualOffset - HudStrokeWidth.thin / 2)
                .animation(HudMotion.ifAllowed(.easeOut(duration: 0.14), reduceMotion: reduceMotion), value: isActive)
            }
            .onContinuousHover { phase in
                switch phase {
                case .active:
                    if !isHovered { isHovered = true }
                    acquireResizeCursor()
                case .ended:
                    isHovered = false
                    releaseResizeCursorIfIdle()
                }
            }
            .gesture(
                DragGesture(minimumDistance: 0, coordinateSpace: .global)
                    .onChanged(handleDragChanged)
                    .onEnded(handleDragEnded)
            )
            .help(isCompact ? "Double-click to expand; drag right to size" : "Drag to resize; drag left past minimum to collapse")
            .accessibilityLabel(accessibilityLabel)
            .accessibilityHint(isCompact ? "Drag right to expand the sidebar" : "Drag horizontally to resize the sidebar")
            .accessibilityAddTraits(.isButton)
    }

    private func handleDragChanged(_ value: DragGesture.Value) {
        if dragStartWidth == nil {
            dragStartWidth = isCompact ? 0 : currentWidth
            latestResizeWidth = nil
            didCommitResize = false
        }

        let horizontalDelta = value.location.x - value.startLocation.x
        let verticalDelta = value.location.y - value.startLocation.y

        guard abs(horizontalDelta) >= activationThreshold,
              abs(horizontalDelta) > abs(verticalDelta) * 1.5
        else { return }

        if isCompact && horizontalDelta <= 0 { return }

        didCommitResize = true
        if !isDragging {
            isDragging = true
            acquireResizeCursor()
        }

        let rawProposed = (dragStartWidth ?? currentWidth) + horizontalDelta
        let proposed = clampedPreviewWidth(rawProposed)
        latestResizeWidth = proposed

        var transaction = Transaction(animation: nil)
        transaction.disablesAnimations = true
        withTransaction(transaction) {
            onResize(proposed)
        }
    }

    private func handleDragEnded(_ value: DragGesture.Value) {
        let horizontalDelta = value.location.x - value.startLocation.x
        let verticalDelta = value.location.y - value.startLocation.y

        if didCommitResize {
            let finalWidth = latestResizeWidth ?? currentWidth
            let startWidth = dragStartWidth ?? currentWidth

            if isCompact {
                onExpand(max(finalWidth, minWidth))
            } else if finalWidth <= collapseWidth, horizontalDelta < 0 {
                onCollapse(startWidth)
            } else {
                onResizeEnded(finalWidth)
            }
        } else if abs(horizontalDelta) < activationThreshold,
                  abs(verticalDelta) < activationThreshold {
            handleClick()
        }

        dragStartWidth = nil
        latestResizeWidth = nil
        didCommitResize = false
        isDragging = false
        releaseResizeCursorIfIdle()
    }

    private func handleClick() {
        let now = Date()
        if let lastClickTime,
           now.timeIntervalSince(lastClickTime) <= Self.doubleClickInterval {
            self.lastClickTime = nil
            onToggle()
        } else {
            lastClickTime = now
        }
    }

    private func clampedPreviewWidth(_ width: CGFloat) -> CGFloat {
        min(maxWidth, max(0, width))
    }

    private func acquireResizeCursor() {
        #if os(macOS)
        guard !cursorPushed else { return }
        NSCursor.resizeLeftRight.push()
        cursorPushed = true
        #endif
    }

    private func releaseResizeCursorIfIdle() {
        #if os(macOS)
        guard cursorPushed, !isHovered, !isDragging else { return }
        NSCursor.pop()
        cursorPushed = false
        #endif
    }
}