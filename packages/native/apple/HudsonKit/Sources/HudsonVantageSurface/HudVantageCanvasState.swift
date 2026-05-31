import CoreGraphics
import Foundation

public struct HudVantageCanvasState: Equatable, Sendable {
    public var pan: CGSize
    public var scale: CGFloat
    public var viewportSize: CGSize
    public var minimumScale: CGFloat
    public var maximumScale: CGFloat

    public init(
        pan: CGSize = .zero,
        scale: CGFloat = 1,
        viewportSize: CGSize = CGSize(width: 920, height: 560),
        minimumScale: CGFloat = 0.002,
        maximumScale: CGFloat = 64
    ) {
        self.minimumScale = minimumScale
        self.maximumScale = maximumScale
        self.viewportSize = viewportSize
        self.pan = pan
        self.scale = Self.clamp(scale, minimum: minimumScale, maximum: maximumScale)
    }

    public var viewportCenter: CGPoint {
        CGPoint(x: viewportSize.width / 2, y: viewportSize.height / 2)
    }

    public var visibleWorldRect: CGRect {
        worldRect(
            fromViewportRect: CGRect(origin: .zero, size: viewportSize)
        )
    }

    public func clampedScale(_ value: CGFloat) -> CGFloat {
        Self.clamp(value, minimum: minimumScale, maximum: maximumScale)
    }

    public func worldPoint(fromViewportPoint point: CGPoint) -> CGPoint {
        guard scale != 0 else { return .zero }
        return CGPoint(
            x: (point.x - pan.width) / scale,
            y: (point.y - pan.height) / scale
        )
    }

    public func viewportPoint(fromWorldPoint point: CGPoint) -> CGPoint {
        CGPoint(
            x: pan.width + point.x * scale,
            y: pan.height + point.y * scale
        )
    }

    public func worldRect(fromViewportRect rect: CGRect) -> CGRect {
        let topLeft = worldPoint(fromViewportPoint: rect.origin)
        let bottomRight = worldPoint(
            fromViewportPoint: CGPoint(x: rect.maxX, y: rect.maxY)
        )
        return CGRect(
            x: min(topLeft.x, bottomRight.x),
            y: min(topLeft.y, bottomRight.y),
            width: abs(bottomRight.x - topLeft.x),
            height: abs(bottomRight.y - topLeft.y)
        )
    }

    public func panned(by delta: CGSize) -> Self {
        replacing(
            pan: CGSize(
                width: pan.width + delta.width,
                height: pan.height + delta.height
            )
        )
    }

    public func zoomed(to proposedScale: CGFloat, around viewportPoint: CGPoint) -> Self {
        let nextScale = clampedScale(proposedScale)
        guard nextScale != scale else { return self }

        let anchor = worldPoint(fromViewportPoint: viewportPoint)
        return replacing(
            pan: CGSize(
                width: viewportPoint.x - anchor.x * nextScale,
                height: viewportPoint.y - anchor.y * nextScale
            ),
            scale: nextScale
        )
    }

    public func centered(on worldPoint: CGPoint) -> Self {
        replacing(
            pan: CGSize(
                width: viewportCenter.x - worldPoint.x * scale,
                height: viewportCenter.y - worldPoint.y * scale
            )
        )
    }

    public func reset() -> Self {
        replacing(pan: .zero, scale: 1)
    }

    public func replaying(panX: CGFloat?, panY: CGFloat?, scale proposedScale: CGFloat?) -> Self {
        replacing(
            pan: CGSize(width: panX ?? pan.width, height: panY ?? pan.height),
            scale: proposedScale.map(clampedScale) ?? scale
        )
    }

    public func fitting(_ rect: CGRect, padding: CGFloat = 32) -> Self {
        guard viewportSize.width > padding * 2,
              viewportSize.height > padding * 2,
              rect.width > 0,
              rect.height > 0
        else {
            return self
        }

        let availableWidth = viewportSize.width - padding * 2
        let availableHeight = viewportSize.height - padding * 2
        let nextScale = clampedScale(
            min(availableWidth / rect.width, availableHeight / rect.height)
        )
        let nextPan = CGSize(
            width: padding + (availableWidth - rect.width * nextScale) / 2 - rect.minX * nextScale,
            height: padding + (availableHeight - rect.height * nextScale) / 2 - rect.minY * nextScale
        )
        return replacing(pan: nextPan, scale: nextScale)
    }

    public func withViewportSize(_ size: CGSize) -> Self {
        replacing(viewportSize: size)
    }

    private func replacing(
        pan: CGSize? = nil,
        scale: CGFloat? = nil,
        viewportSize: CGSize? = nil
    ) -> Self {
        Self(
            pan: pan ?? self.pan,
            scale: scale ?? self.scale,
            viewportSize: viewportSize ?? self.viewportSize,
            minimumScale: minimumScale,
            maximumScale: maximumScale
        )
    }

    private static func clamp(_ value: CGFloat, minimum: CGFloat, maximum: CGFloat) -> CGFloat {
        min(max(value, minimum), maximum)
    }
}
