#if os(macOS)
import SwiftUI

public enum HudNotchSide: Sendable {
    case left
    case right
}

public enum HudNotchInnerCurveMode: String, CaseIterable, Sendable {
    case canonicalDownward
    case hardCorner
    case mirroredUpward
}

public struct HudNotchWingShape: Shape {
    public let side: HudNotchSide
    public let cornerRadius: CGFloat
    public let topOuterRadius: CGFloat
    public let topInnerRadius: CGFloat
    public let innerCurveMode: HudNotchInnerCurveMode

    public init(
        side: HudNotchSide,
        cornerRadius: CGFloat,
        topOuterRadius: CGFloat = 8,
        topInnerRadius: CGFloat = 0,
        innerCurveMode: HudNotchInnerCurveMode = .canonicalDownward
    ) {
        self.side = side
        self.cornerRadius = cornerRadius
        self.topOuterRadius = topOuterRadius
        self.topInnerRadius = topInnerRadius
        self.innerCurveMode = innerCurveMode
    }

    public func path(in rect: CGRect) -> Path {
        var path = Path()
        let w = rect.width
        let h = rect.height
        let cr = min(cornerRadius, min(w, h) / 2)
        let maxTr = min(w, h) / 2
        let tr = max(-maxTr, min(topOuterRadius, maxTr))
        let cornerDrop = abs(tr)
        let tir = max(0, min(topInnerRadius, max(0, w - cornerDrop), h / 2))

        switch side {
        case .right:
            if tir > 0, innerCurveMode != .hardCorner {
                path.move(to: CGPoint(x: 0, y: tir))
                path.addQuadCurve(
                    to: CGPoint(x: tir, y: 0),
                    control: rightInnerControl(radius: tir)
                )
            } else {
                path.move(to: CGPoint(x: 0, y: 0))
            }

            if cornerDrop > 0 {
                let shoulderX = w + tr
                path.addLine(to: CGPoint(x: shoulderX, y: 0))
                let center = CGPoint(x: shoulderX, y: cornerDrop)
                if tr >= 0 {
                    path.addArc(center: center, radius: cornerDrop, startAngle: .degrees(-90), endAngle: .degrees(-180), clockwise: true)
                } else {
                    path.addArc(center: center, radius: cornerDrop, startAngle: .degrees(-90), endAngle: .degrees(0), clockwise: false)
                }
            } else {
                path.addLine(to: CGPoint(x: w, y: 0))
            }

            path.addLine(to: CGPoint(x: w, y: h - cr))
            path.addQuadCurve(to: CGPoint(x: w - cr, y: h), control: CGPoint(x: w, y: h))
            path.addLine(to: CGPoint(x: 0, y: h))
            path.closeSubpath()

        case .left:
            if cornerDrop > 0 {
                let shoulderX = -tr
                path.move(to: CGPoint(x: 0, y: cornerDrop))
                let center = CGPoint(x: shoulderX, y: cornerDrop)
                if tr >= 0 {
                    path.addArc(center: center, radius: cornerDrop, startAngle: .degrees(0), endAngle: .degrees(-90), clockwise: true)
                } else {
                    path.addArc(center: center, radius: cornerDrop, startAngle: .degrees(180), endAngle: .degrees(-90), clockwise: false)
                }
            } else {
                path.move(to: CGPoint(x: 0, y: 0))
            }

            if tir > 0, innerCurveMode != .hardCorner {
                path.addLine(to: CGPoint(x: w - tir, y: 0))
                path.addQuadCurve(
                    to: CGPoint(x: w, y: tir),
                    control: leftInnerControl(width: w, radius: tir)
                )
            } else {
                path.addLine(to: CGPoint(x: w, y: 0))
            }

            path.addLine(to: CGPoint(x: w, y: h))
            path.addLine(to: CGPoint(x: cr, y: h))
            path.addQuadCurve(to: CGPoint(x: 0, y: h - cr), control: CGPoint(x: 0, y: h))
            path.closeSubpath()
        }

        return path
    }

    private func rightInnerControl(radius: CGFloat) -> CGPoint {
        switch innerCurveMode {
        case .canonicalDownward:
            return CGPoint(x: 0, y: 0)
        case .mirroredUpward:
            return CGPoint(x: radius, y: radius)
        case .hardCorner:
            return CGPoint(x: 0, y: 0)
        }
    }

    private func leftInnerControl(width: CGFloat, radius: CGFloat) -> CGPoint {
        switch innerCurveMode {
        case .canonicalDownward:
            return CGPoint(x: width, y: 0)
        case .mirroredUpward:
            return CGPoint(x: width - radius, y: radius)
        case .hardCorner:
            return CGPoint(x: width, y: 0)
        }
    }
}

public struct HudNotchWingPairShape: Shape {
    public var pokeOut: CGFloat
    public let notchGap: CGFloat
    public let leftTopOuterRadius: CGFloat
    public let rightTopOuterRadius: CGFloat
    public let topInnerRadius: CGFloat
    public let bottomRadius: CGFloat
    public let notchOverlap: CGFloat
    public let minimumNotchOverlap: CGFloat
    public let innerCurveMode: HudNotchInnerCurveMode

    public init(
        pokeOut: CGFloat,
        notchGap: CGFloat,
        leftTopOuterRadius: CGFloat,
        rightTopOuterRadius: CGFloat,
        topInnerRadius: CGFloat,
        bottomRadius: CGFloat,
        notchOverlap: CGFloat,
        minimumNotchOverlap: CGFloat,
        innerCurveMode: HudNotchInnerCurveMode = .canonicalDownward
    ) {
        self.pokeOut = pokeOut
        self.notchGap = notchGap
        self.leftTopOuterRadius = leftTopOuterRadius
        self.rightTopOuterRadius = rightTopOuterRadius
        self.topInnerRadius = topInnerRadius
        self.bottomRadius = bottomRadius
        self.notchOverlap = notchOverlap
        self.minimumNotchOverlap = minimumNotchOverlap
        self.innerCurveMode = innerCurveMode
    }

    public var animatableData: CGFloat {
        get { pokeOut }
        set { pokeOut = newValue }
    }

    public func path(in rect: CGRect) -> Path {
        let w = rect.width
        let h = rect.height
        let baseWing = max(0, min(pokeOut, w / 2))
        let baseGap = max(0, min(notchGap, w - (baseWing * 2)))
        let coreWidth = (baseWing * 2) + baseGap
        let originX = snapToPixel(max(0, (w - coreWidth) / 2))
        let desiredOverlap = max(minimumNotchOverlap, notchOverlap)
        let overlap = max(0, min(desiredOverlap, baseGap / 2))

        let wing = baseWing + overlap
        let gap = max(0, baseGap - (overlap * 2))

        let maxTor = min(wing, h) / 2
        let leftTor = max(-maxTor, min(leftTopOuterRadius, maxTor))
        let rightTor = max(-maxTor, min(rightTopOuterRadius, maxTor))
        let br = min(bottomRadius, min(wing, h) / 2)
        let leftIr = max(0, min(topInnerRadius, max(0, wing - abs(leftTor)), h / 2))
        let rightIr = max(0, min(topInnerRadius, max(0, wing - abs(rightTor)), h / 2))

        var p = Path()
        addLeftWing(path: &p, wing: wing, height: h, tor: leftTor, br: br, ir: leftIr)
        addRightWing(path: &p, wing: wing, gap: gap, height: h, tor: rightTor, br: br, ir: rightIr)

        if originX > 0 {
            return p.applying(CGAffineTransform(translationX: originX, y: 0))
        }
        return p
    }

    private func snapToPixel(_ value: CGFloat) -> CGFloat {
        let pixel: CGFloat = 0.5
        return (value / pixel).rounded() * pixel
    }

    private func addLeftWing(path: inout Path, wing: CGFloat, height: CGFloat, tor: CGFloat, br: CGFloat, ir: CGFloat) {
        let cornerDrop = abs(tor)
        if cornerDrop > 0 {
            let shoulderX = -tor
            path.move(to: CGPoint(x: 0, y: cornerDrop))
            let center = CGPoint(x: shoulderX, y: cornerDrop)
            if tor >= 0 {
                path.addArc(center: center, radius: cornerDrop, startAngle: .degrees(0), endAngle: .degrees(-90), clockwise: true)
            } else {
                path.addArc(center: center, radius: cornerDrop, startAngle: .degrees(180), endAngle: .degrees(-90), clockwise: false)
            }
        } else {
            path.move(to: CGPoint(x: 0, y: 0))
        }

        if ir > 0, innerCurveMode != .hardCorner {
            path.addLine(to: CGPoint(x: wing - ir, y: 0))
            let control = innerCurveMode == .mirroredUpward
                ? CGPoint(x: wing - ir, y: ir)
                : CGPoint(x: wing, y: 0)
            path.addQuadCurve(to: CGPoint(x: wing, y: ir), control: control)
        } else {
            path.addLine(to: CGPoint(x: wing, y: 0))
        }

        path.addLine(to: CGPoint(x: wing, y: height))
        path.addLine(to: CGPoint(x: br, y: height))
        path.addQuadCurve(to: CGPoint(x: 0, y: height - br), control: CGPoint(x: 0, y: height))
        path.closeSubpath()
    }

    private func addRightWing(path: inout Path, wing: CGFloat, gap: CGFloat, height: CGFloat, tor: CGFloat, br: CGFloat, ir: CGFloat) {
        let x0 = wing + gap
        let x1 = x0 + wing

        if ir > 0, innerCurveMode != .hardCorner {
            path.move(to: CGPoint(x: x0, y: ir))
            let control = innerCurveMode == .mirroredUpward
                ? CGPoint(x: x0 + ir, y: ir)
                : CGPoint(x: x0, y: 0)
            path.addQuadCurve(to: CGPoint(x: x0 + ir, y: 0), control: control)
        } else {
            path.move(to: CGPoint(x: x0, y: 0))
        }

        let cornerDrop = abs(tor)
        if cornerDrop > 0 {
            let shoulderX = x1 + tor
            path.addLine(to: CGPoint(x: shoulderX, y: 0))
            let center = CGPoint(x: shoulderX, y: cornerDrop)
            if tor >= 0 {
                path.addArc(center: center, radius: cornerDrop, startAngle: .degrees(-90), endAngle: .degrees(-180), clockwise: true)
            } else {
                path.addArc(center: center, radius: cornerDrop, startAngle: .degrees(-90), endAngle: .degrees(0), clockwise: false)
            }
        } else {
            path.addLine(to: CGPoint(x: x1, y: 0))
        }

        path.addLine(to: CGPoint(x: x1, y: height - br))
        path.addQuadCurve(to: CGPoint(x: x1 - br, y: height), control: CGPoint(x: x1, y: height))
        path.addLine(to: CGPoint(x: x0, y: height))
        path.closeSubpath()
    }
}

public struct HudNotchPhysicalShape: Shape {
    public let bottomRadius: CGFloat

    public init(bottomRadius: CGFloat) {
        self.bottomRadius = bottomRadius
    }

    public func path(in rect: CGRect) -> Path {
        let w = rect.width
        let h = rect.height
        let br = min(bottomRadius, min(w, h) / 2)

        var p = Path()
        p.move(to: CGPoint(x: 0, y: 0))
        p.addLine(to: CGPoint(x: w, y: 0))
        p.addLine(to: CGPoint(x: w, y: h - br))
        p.addQuadCurve(to: CGPoint(x: w - br, y: h), control: CGPoint(x: w, y: h))
        p.addLine(to: CGPoint(x: br, y: h))
        p.addQuadCurve(to: CGPoint(x: 0, y: h - br), control: CGPoint(x: 0, y: h))
        p.closeSubpath()
        return p
    }
}
/// The notch's one continuous outline, from the tucked-in state through the
/// pill to the open card, so every state change is a morph rather than a swap.
///
/// A positive `shoulder` flares the top corners outward as concave ears that
/// meet the top edge of the screen, like the wing pair's shoulders. A negative
/// one rounds them convexly, for the island.
public struct HudNotchSilhouetteShape: Shape {
    public var shoulder: CGFloat
    public var bottomRadius: CGFloat

    public init(shoulder: CGFloat, bottomRadius: CGFloat) {
        self.shoulder = shoulder
        self.bottomRadius = bottomRadius
    }

    public var animatableData: AnimatablePair<CGFloat, CGFloat> {
        get { AnimatablePair(shoulder, bottomRadius) }
        set {
            shoulder = newValue.first
            bottomRadius = newValue.second
        }
    }

    public func path(in rect: CGRect) -> Path {
        let w = rect.width
        let h = rect.height
        guard w > 0, h > 0 else { return Path() }

        let maxDrop = shoulder >= 0 ? h / 2 : min(w, h) / 2
        let drop = min(abs(shoulder), maxDrop)
        let concave = shoulder > 0
        let br = max(0, min(bottomRadius, w / 2, h - drop))

        var p = Path()
        if drop > 0 {
            p.move(to: CGPoint(x: 0, y: drop))
            if concave {
                p.addArc(center: CGPoint(x: -drop, y: drop), radius: drop, startAngle: .degrees(0), endAngle: .degrees(-90), clockwise: true)
                p.addLine(to: CGPoint(x: w + drop, y: 0))
                p.addArc(center: CGPoint(x: w + drop, y: drop), radius: drop, startAngle: .degrees(-90), endAngle: .degrees(-180), clockwise: true)
            } else {
                p.addArc(center: CGPoint(x: drop, y: drop), radius: drop, startAngle: .degrees(180), endAngle: .degrees(-90), clockwise: false)
                p.addLine(to: CGPoint(x: w - drop, y: 0))
                p.addArc(center: CGPoint(x: w - drop, y: drop), radius: drop, startAngle: .degrees(-90), endAngle: .degrees(0), clockwise: false)
            }
        } else {
            p.move(to: .zero)
            p.addLine(to: CGPoint(x: w, y: 0))
        }

        p.addLine(to: CGPoint(x: w, y: h - br))
        p.addQuadCurve(to: CGPoint(x: w - br, y: h), control: CGPoint(x: w, y: h))
        p.addLine(to: CGPoint(x: br, y: h))
        p.addQuadCurve(to: CGPoint(x: 0, y: h - br), control: CGPoint(x: 0, y: h))
        p.closeSubpath()

        return p.applying(CGAffineTransform(translationX: rect.minX, y: rect.minY))
    }
}

/// The open card: small top corners that meet the menu bar, larger bottom ones.
public struct HudNotchPopoutShape: Shape {
    public var topRadius: CGFloat
    public var bottomRadius: CGFloat

    public init(topRadius: CGFloat, bottomRadius: CGFloat) {
        self.topRadius = topRadius
        self.bottomRadius = bottomRadius
    }

    public var animatableData: AnimatablePair<CGFloat, CGFloat> {
        get { AnimatablePair(topRadius, bottomRadius) }
        set {
            topRadius = newValue.first
            bottomRadius = newValue.second
        }
    }

    public func path(in rect: CGRect) -> Path {
        let top = min(max(0, topRadius), min(rect.width, rect.height) / 2)
        let bottom = min(max(0, bottomRadius), min(rect.width, rect.height) / 2)

        var path = Path()
        path.move(to: CGPoint(x: rect.minX + top, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX - top, y: rect.minY))
        path.addQuadCurve(to: CGPoint(x: rect.maxX, y: rect.minY + top), control: CGPoint(x: rect.maxX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY - bottom))
        path.addQuadCurve(to: CGPoint(x: rect.maxX - bottom, y: rect.maxY), control: CGPoint(x: rect.maxX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX + bottom, y: rect.maxY))
        path.addQuadCurve(to: CGPoint(x: rect.minX, y: rect.maxY - bottom), control: CGPoint(x: rect.minX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.minY + top))
        path.addQuadCurve(to: CGPoint(x: rect.minX + top, y: rect.minY), control: CGPoint(x: rect.minX, y: rect.minY))
        path.closeSubpath()
        return path
    }
}
#endif
