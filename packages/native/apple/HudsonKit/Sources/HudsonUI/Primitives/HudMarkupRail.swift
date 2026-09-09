import HudsonMarkup
import SwiftUI

/// A control the rail draws in its own voice.
///
/// Hosts want a button here — "Keep", "Done", "Save" — and the temptation is a
/// trailing `@ViewBuilder` slot. That would hand every host the ability to set
/// its button in a different font, and to break the rail's one behavioural law
/// by putting something in it that changes size mid-interaction. What is being
/// shared between projects is not only the code, it is the idiom: a rail that
/// reads the same everywhere. So hosts pass what the button *says* and what it
/// *does*, and the rail decides how it looks.
public struct HudMarkupRailAction: Identifiable {
    public let id: String
    public let label: String
    public let isEnabled: Bool
    public let action: @MainActor () -> Void

    public init(
        id: String? = nil,
        label: String,
        isEnabled: Bool = true,
        action: @escaping @MainActor () -> Void
    ) {
        self.id = id ?? label
        self.label = label
        self.isEnabled = isEnabled
        self.action = action
    }
}

/// The markup tools, as one control.
///
/// Projects grow these one at a time: a rail in one surface, a stripped-down
/// band in another that offers no tool or colour at all and silently draws with
/// whatever the first one was last set to. Same tools, several implementations,
/// several behaviours — which is not a design so much as an accident of sharing
/// one state object.
///
/// This is the control. It is given a tool, an ink, and what can be undone, and
/// it says nothing about what is being drawn on: a page, a figure, a chart, a
/// photograph, a screenshot. That is the point.
///
/// The tools sit in one flat row rather than behind a shapes button that reveals
/// four more. A rail is usually already only shown when the pointer is on the
/// artwork; hiding tools behind a second hover inside that would make an arrow
/// two discoveries deep.
public struct HudMarkupRail: View {
    /// How the rail sits in its host.
    public enum Layout: Sendable {
        /// Floating on the artwork it marks: a capsule with its own ground.
        case capsule
        /// In a band that already has a ground of its own.
        case bare
    }

    @Binding public var tool: HudMarkupToolKind
    @Binding public var pigment: Int
    public let layout: Layout
    public let palette: HudMarkupPalette
    public let canUndo: Bool
    public let canRedo: Bool
    public let onUndo: () -> Void
    public let onRedo: () -> Void
    public let actions: [HudMarkupRailAction]

    public init(
        tool: Binding<HudMarkupToolKind>,
        pigment: Binding<Int>,
        layout: Layout = .capsule,
        palette: HudMarkupPalette = .standard,
        canUndo: Bool,
        canRedo: Bool,
        onUndo: @escaping () -> Void,
        onRedo: @escaping () -> Void,
        actions: [HudMarkupRailAction] = []
    ) {
        _tool = tool
        _pigment = pigment
        self.layout = layout
        self.palette = palette
        self.canUndo = canUndo
        self.canRedo = canRedo
        self.onUndo = onUndo
        self.onRedo = onRedo
        self.actions = actions
    }

    /// Freehand, then shapes, then the eraser — the hand's own marks first, the
    /// ruled ones next, and the one that takes things away last, kept apart from
    /// everything that puts them down.
    private static let groups: [[HudMarkupToolKind]] = [
        [.pen, .marker],
        [.line, .arrow, .rectangle, .ellipse],
        [.eraser]
    ]

    public var body: some View {
        HStack(spacing: HudSpacing.sm) {
            ForEach(Array(Self.groups.enumerated()), id: \.offset) { index, group in
                if index > 0 { rule }
                tools(group)
            }
            rule
            inks
            rule
            history
            // Always present, disabled when there is nothing to do. A control
            // that appears with the first mark resizes the rail while the
            // pointer is next to it, and moves the button out from under the
            // hand reaching for it.
            ForEach(actions) { action in
                Button(action.label) { action.action() }
                    .buttonStyle(.plain)
                    .font(HudFont.mono(HudTextSize.xxs, weight: .semibold))
                    .foregroundStyle(action.isEnabled ? HudPalette.ink : HudPalette.dim.opacity(0.5))
                    .disabled(!action.isEnabled)
            }
        }
        .padding(.horizontal, layout == .capsule ? HudSpacing.md : 0)
        .padding(.vertical, layout == .capsule ? HudSpacing.sm : 0)
        .background(ground)
        .overlay(border)
    }

    @ViewBuilder private var ground: some View {
        if layout == .capsule {
            Capsule().fill(HudSurface.raised.opacity(0.96))
        }
    }

    @ViewBuilder private var border: some View {
        if layout == .capsule {
            Capsule().stroke(HudHairline.standard, lineWidth: 1)
        }
    }

    private var rule: some View {
        Rectangle()
            .fill(HudHairline.subtle)
            .frame(width: 1, height: 14)
    }

    private func tools(_ group: [HudMarkupToolKind]) -> some View {
        HStack(spacing: HudSpacing.xs) {
            ForEach(group) { kind in
                Button { tool = kind } label: {
                    Image(systemName: kind.iconName)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(kind == tool ? HudPalette.ink : HudPalette.dim)
                        .frame(width: 22, height: 20)
                        .background(
                            RoundedRectangle(cornerRadius: HudRadius.tight, style: .continuous)
                                .fill(kind == tool ? HudSurface.control : .clear)
                        )
                }
                .buttonStyle(.plain)
                .help(kind.label)
            }
        }
    }

    /// The eraser takes no colour, so the inks step back rather than vanish — the
    /// row keeps its shape and the reason is legible.
    private var inks: some View {
        HStack(spacing: HudSpacing.sm) {
            ForEach(0..<HudMarkup.pigmentSlots, id: \.self) { slot in
                Button { pigment = slot } label: {
                    Circle()
                        .fill(palette.color(slot))
                        .frame(width: 14, height: 14)
                        .overlay(
                            Circle().stroke(
                                slot == pigment ? HudPalette.ink : HudHairline.standard,
                                lineWidth: slot == pigment ? 1.5 : 1
                            )
                        )
                }
                .buttonStyle(.plain)
                .help(slot == 0 ? "Graphite" : "Ink \(slot)")
            }
        }
        .opacity(tool == .eraser ? 0.35 : 1)
        .disabled(tool == .eraser)
        .animation(.easeOut(duration: 0.12), value: tool)
    }

    private var history: some View {
        HStack(spacing: HudSpacing.xs) {
            historyButton("arrow.uturn.backward", enabled: canUndo, help: "Undo", action: onUndo)
            historyButton("arrow.uturn.forward", enabled: canRedo, help: "Redo", action: onRedo)
        }
    }

    private func historyButton(
        _ glyph: String,
        enabled: Bool,
        help: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: glyph)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(enabled ? HudPalette.dim : HudPalette.dim.opacity(0.35))
                .frame(width: 20, height: 20)
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .help(help)
    }
}

/// Naming lives on this side of the boundary, not in the record: the format is
/// meant to be read by a web renderer and by anything else that can draw, and
/// none of them should inherit a dependency on Apple's symbol set to know what a
/// rectangle is.
public extension HudMarkupToolKind {
    var iconName: String {
        switch self {
        case .pen: return "pencil.tip"
        case .marker: return "highlighter"
        case .line: return "line.diagonal"
        case .arrow: return "arrow.up.right"
        case .rectangle: return "rectangle"
        case .ellipse: return "circle"
        case .eraser: return "eraser"
        }
    }

    var label: String {
        switch self {
        case .pen: return "Pen"
        case .marker: return "Marker"
        case .line: return "Line"
        case .arrow: return "Arrow"
        case .rectangle: return "Rectangle"
        case .ellipse: return "Ellipse"
        case .eraser: return "Eraser"
        }
    }
}
