#if os(macOS)
import AppKit
import HudsonNotchCore
import SwiftUI

/// Host content for the notch, in place of the activity stage: views on the
/// two wings, and below them a body of whatever height the host asks for.
///
/// A height of 0 is the wings alone. A short body (one line under the
/// notch) is a chin. A taller one opens the notch as far as the content
/// needs. Every size is the same silhouette, so moving between scenes is one
/// continuous morph. Changing `id` cross-fades the body while the shape
/// resizes; the wings stay put, so a mark on them carries across.
///
/// Present one with `HudNotchController.present(_:)`. An activity that asks
/// for attention still opens over the scene, and the scene comes back when
/// that card folds.
public struct HudNotchScene {
    public struct Size: Hashable, Sendable {
        /// The silhouette's full width, wings included.
        public var width: CGFloat
        /// The body's height below the shell. 0 shows the wings only.
        public var contentHeight: CGFloat
        /// The bottom corners, once there is a body.
        public var bottomRadius: CGFloat

        public init(width: CGFloat, contentHeight: CGFloat = 0, bottomRadius: CGFloat = 14) {
            self.width = width
            self.contentHeight = max(0, contentHeight)
            self.bottomRadius = bottomRadius
        }
    }

    /// Identifies the body. A new id cross-fades it.
    public var id: String
    public var size: Size
    /// How far the wing content sits in from the silhouette's sides.
    public var wingInset: CGFloat
    public var leading: AnyView
    public var trailing: AnyView
    public var content: AnyView
    public var accessibilityLabel: String

    /// A click on the silhouette that no view inside took.
    public var onTap: (@MainActor () -> Void)?
    /// The pointer entering or leaving the notch.
    public var onHover: (@MainActor (Bool) -> Void)?
    /// Key presses while the notch is key (after `focusScene()` or a click
    /// into it). Return true to consume the event.
    public var onKeyDown: (@MainActor (NSEvent) -> Bool)?
    /// Modifier changes while the notch is key. Return true to consume.
    public var onFlagsChanged: (@MainActor (NSEvent) -> Bool)?

    public init<Leading: View, Trailing: View, Content: View>(
        id: String,
        size: Size,
        wingInset: CGFloat = 16,
        accessibilityLabel: String = "",
        onTap: (@MainActor () -> Void)? = nil,
        onHover: (@MainActor (Bool) -> Void)? = nil,
        onKeyDown: (@MainActor (NSEvent) -> Bool)? = nil,
        onFlagsChanged: (@MainActor (NSEvent) -> Bool)? = nil,
        @ViewBuilder leading: () -> Leading,
        @ViewBuilder trailing: () -> Trailing,
        @ViewBuilder content: () -> Content
    ) {
        self.id = id
        self.size = size
        self.wingInset = wingInset
        self.accessibilityLabel = accessibilityLabel
        self.onTap = onTap
        self.onHover = onHover
        self.onKeyDown = onKeyDown
        self.onFlagsChanged = onFlagsChanged
        self.leading = AnyView(leading())
        self.trailing = AnyView(trailing())
        self.content = AnyView(content())
    }

    /// Takes keys: the controller listens for them while the notch is key.
    public var takesKeys: Bool { onKeyDown != nil || onFlagsChanged != nil }
}

// MARK: - Keycaps

/// Colors for keycaps. `init(theme:)` derives them from a notch theme.
public struct HudNotchKeycapStyle {
    /// A key's label.
    public var text: Color
    /// The key just pressed: its label and its edge.
    public var lit: Color
    public var litEdge: Color
    /// A hairline edge, and the dashes of a slot still to fill.
    public var edge: Color
    public var slot: Color
    /// The flat fill behind the key just pressed.
    public var wash: Color

    public init(text: Color, lit: Color, litEdge: Color, edge: Color, slot: Color, wash: Color = Color.white.opacity(0.06)) {
        self.text = text
        self.lit = lit
        self.litEdge = litEdge
        self.edge = edge
        self.slot = slot
        self.wash = wash
    }

    public init(theme: HudNotchTheme) {
        self.init(text: theme.muted, lit: theme.ink, litEdge: theme.muted, edge: Color.white.opacity(0.14), slot: theme.dim)
    }
}

/// One key on the notch: a hairline cap; lit with a flat wash for the key
/// just pressed; a dashed slot for a key still to come.
public struct HudNotchKeycap: View {
    public enum Look: Sendable { case idle, lit, slot }

    public var key: String
    public var look: Look
    public var large: Bool
    public var style: HudNotchKeycapStyle

    public init(_ key: String, look: Look = .idle, large: Bool = false, style: HudNotchKeycapStyle) {
        self.key = key
        self.look = look
        self.large = large
        self.style = style
    }

    public var body: some View {
        let side: CGFloat = large ? 24 : 18
        let shape = RoundedRectangle(cornerRadius: 4, style: .continuous)
        let modifier = HudNotchKeys.isModifier(key)
        Text(look == .slot ? " " : key)
            // Modifier glyphs are tiny in a mono face: they get the UI face; letters stay mono.
            .font(modifier
                ? .system(size: large ? 13.5 : 12, weight: .light)
                : .system(size: large ? 12 : 10.5, weight: .light, design: .monospaced))
            .foregroundStyle(look == .lit ? style.lit : style.text)
            .padding(.horizontal, 5)
            .frame(minWidth: side, minHeight: side, maxHeight: side)
            .background(shape.fill(look == .lit ? style.wash : .clear))
            .overlay {
                if look == .slot {
                    shape.strokeBorder(style.slot, style: StrokeStyle(lineWidth: 1, dash: [2, 2]))
                } else {
                    shape.strokeBorder(look == .lit ? style.litEdge : style.edge, lineWidth: 1)
                }
            }
            .animation(.easeOut(duration: 0.12), value: look)
            .accessibilityHidden(look == .slot)
    }
}

/// A chord as keycaps, with dashed slots after it for keys still to come.
/// The last key is lit while the chord is being pressed.
public struct HudNotchKeycaps: View {
    public var keys: [String]
    public var slots: Int
    public var litLast: Bool
    public var large: Bool
    public var style: HudNotchKeycapStyle

    public init(_ keys: [String], slots: Int = 0, litLast: Bool = false, large: Bool = false, style: HudNotchKeycapStyle) {
        self.keys = keys
        self.slots = slots
        self.litLast = litLast
        self.large = large
        self.style = style
    }

    public var body: some View {
        HStack(spacing: 3) {
            ForEach(Array(keys.enumerated()), id: \.offset) { index, key in
                HudNotchKeycap(key, look: litLast && index == keys.count - 1 ? .lit : .idle, large: large, style: style)
            }
            ForEach(0..<max(0, slots), id: \.self) { _ in
                HudNotchKeycap("", look: .slot, large: large, style: style)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(keys.joined(separator: " ")))
    }
}

// MARK: - Layout

/// A scene's views in place: the wings either side of the gap the hardware
/// takes, the body below at the scene's size.
struct HudNotchSceneLayout: View {
    var scene: HudNotchScene
    var notchGap: CGFloat
    var shellHeight: CGFloat
    var reduceMotion: Bool

    var body: some View {
        let size = scene.size
        let wingWidth = max(0, (size.width - notchGap) / 2)
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                scene.leading
                    .padding(.leading, scene.wingInset)
                    .frame(width: wingWidth, alignment: .leading)
                Color.clear.frame(width: notchGap)
                scene.trailing
                    .padding(.trailing, scene.wingInset)
                    .frame(width: wingWidth, alignment: .trailing)
            }
            .frame(height: shellHeight)
            .clipped()

            ZStack(alignment: .top) {
                scene.content
                    .id(scene.id)
                    .transition(.notchReveal(insertion: HudNotchMotion.contentIn, reduceMotion: reduceMotion))
            }
            .frame(width: size.width, height: size.contentHeight, alignment: .top)
            .clipped()
        }
        .frame(width: size.width, height: shellHeight + size.contentHeight, alignment: .top)
        .accessibilityElement(children: .contain)
    }
}

// MARK: - Preview

/// A scene drawn still, on its silhouette in the theme's body, with no
/// panel or controller. For snapshots, design reviews and tests.
public struct HudNotchScenePreview: View {
    public var scene: HudNotchScene
    public var theme: HudNotchTheme
    public var configuration: HudNotchConfiguration
    public var notchWidth: CGFloat
    public var notchHeight: CGFloat

    public init(
        scene: HudNotchScene,
        theme: HudNotchTheme = .hudson,
        configuration: HudNotchConfiguration = .default,
        notchWidth: CGFloat = 185,
        notchHeight: CGFloat = 32
    ) {
        self.scene = scene
        self.theme = theme
        self.configuration = configuration
        self.notchWidth = notchWidth
        self.notchHeight = notchHeight
    }

    public var body: some View {
        let shellHeight = max(notchHeight, configuration.shellHeight)
        let open = scene.size.contentHeight > 0
        let outline = HudNotchSilhouetteShape(
            shoulder: configuration.topOuterRadius,
            bottomRadius: open ? scene.size.bottomRadius : configuration.bottomRadius
        )
        let look = open ? configuration.appearance.card : configuration.appearance.pill
        HudNotchSceneLayout(
            scene: scene,
            notchGap: HudNotchMetrics.notchGap(notchWidth: notchWidth),
            shellHeight: shellHeight,
            reduceMotion: true
        )
        .background {
            outline
                .fill(theme.body)
                .shadow(color: Color.black.opacity(look.shadowOpacity), radius: look.shadowRadius, y: look.shadowY)
        }
    }
}
#endif
