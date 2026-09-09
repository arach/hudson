// HudRuntimePicker — the runtime a message will run on (harness · model ·
// effort) as ONE control, and the panel that opens out of it.
//
// `HudComposer` has carried `HudComposerModelInfo` and an `onTapModel` hook
// since it shipped — "the hook for a model/effort picker" — with nothing on the
// other end of it. This is that picker. It arrives from Scout, where the shape
// was worked out on a phone; the grammar is unchanged and the Scout-specific
// palette, brand artwork and catalog have been lifted out into tokens, an
// injected mark, and host-supplied data.
//
// The resting shape is `HudRuntimeChip`: `✳ Opus 5 | AUTO ⌄`. Tapping it does
// NOT replace the composer with a sheet — the chip stays exactly where it is
// and the panel GROWS out of it, upward, over a light scrim that keeps the
// draft you were writing visible behind it. That is the whole point: you are
// changing a setting on the message in front of you, not leaving to a modal and
// coming back.
//
//   ╭ panel ─────────────────────────────────╮
//   │ ▌Claude │ ● Opus   5        DEFAULT    │  rail · one travelling marker
//   │  Codex  │   Sonnet 4.6                 │  models · beside the rail
//   │         │   Fable  alpha               │
//   ├────────────────────────────────────────┤
//   │  AUTO      LOW      MEDIUM      HIGH   │  effort · ordinal footer ladder
//   ╰────────────────────────────────────────╯
//                              ▲ grows from the chip, which stays lit below
//
// Grammar the phone taught it, kept on every platform:
//   · The ladder is the FOOTER, so on an upward-opening panel it lands nearest
//     the hand that just opened it — the setting you retune most often is the
//     one you can reach without moving. On a pointer surface the same rule
//     keeps the ladder next to the chip the cursor is already on.
//   · The panel is clamped to the surface and to the room above the chip, so a
//     raised keyboard shortens it rather than hiding it.
//
// Picks COMMIT LIVE. The chip below IS the summary and it updates under your
// finger, so there is no draft, no running summary and no Done button. Ways
// out: scrim tap, swipe down (touch), Escape (keyboard), or tap the chip again.
//
// Platform: one source, two densities. `HudRuntimeMetrics` resolves the row
// height, scrim weight and input affordances — 44pt rows, a real scrim and
// swipe-to-dismiss on iOS; 30pt rows with hover, a lighter scrim, and the
// keyboard (Escape · ↑↓ model · ←→ effort · ⌥↑↓ harness) on macOS — so neither
// platform inherits the other's ergonomics.
//
// The catalog is the HOST's: pass the harnesses, models and efforts the surface
// actually supports. Hudson owns the grammar, not the model list, and never the
// brand artwork — supply a mark with `.hudRuntimeMark { … }` or let the
// monogram stand in.

import SwiftUI
#if canImport(UIKit) && !os(watchOS)
import UIKit
#endif

// MARK: - Catalog (host-supplied)

/// One selectable model — a single flat pick, no separate version row.
/// `label` is the family ("Opus"), `sublabel` the version ("5"); a host with
/// one-piece names leaves `sublabel` empty.
public struct HudRuntimeModel: Identifiable, Hashable, Codable, Sendable {
    public let id: String
    public let label: String
    public let sublabel: String
    public let isDefault: Bool

    public init(id: String, label: String, sublabel: String = "", isDefault: Bool = false) {
        self.id = id
        self.label = label
        self.sublabel = sublabel
        self.isDefault = isDefault
    }

    /// Token/summary rendering, e.g. "Opus 5" or "5.6 sol".
    public var displayName: String { sublabel.isEmpty ? label : "\(label) \(sublabel)" }
}

/// One harness on the rail: a one-word rail label, a monogram to fall back on
/// when the host supplies no mark, and its model list with at most one default.
public struct HudRuntimeHarness: Identifiable, Hashable, Codable, Sendable {
    public let id: String
    /// Full label — results, menus, accessibility.
    public let label: String
    /// One word, for the rail.
    public let short: String
    /// Typographic stand-in used when no mark is provided for this harness.
    public let monogram: String
    public let models: [HudRuntimeModel]
    /// A harness the host knows about but cannot reach right now (offline
    /// runtime, missing binary). It stays on the rail and stays pickable — a
    /// selection can be staged for when it comes back — but it renders dimmed
    /// and says so to assistive tech.
    public let isAvailable: Bool

    public init(
        id: String,
        label: String,
        short: String? = nil,
        monogram: String? = nil,
        models: [HudRuntimeModel],
        isAvailable: Bool = true
    ) {
        self.id = id
        self.label = label
        self.short = short ?? label.split(separator: " ").first.map(String.init) ?? label
        self.monogram = monogram ?? HudRuntimeMark.fallbackMonogram(for: id)
        self.models = models
        self.isAvailable = isAvailable
    }

    public var defaultModel: HudRuntimeModel? {
        models.first(where: \.isDefault) ?? models.first
    }
}

/// One reasoning-effort stop. `harnesses` empty means every harness; `models`
/// nil means every model of those harnesses. Hosts with no effort concept pass
/// an empty array and the ladder does not render.
///
/// `isDefault` marks the rung a pick lands on when the effort it had is not
/// supported by the new harness/model pair. Without one, the first supported
/// rung (usually Auto) is used.
public struct HudRuntimeEffort: Identifiable, Hashable, Codable, Sendable {
    public let id: String
    public let label: String
    public let harnesses: Set<String>
    public var models: Set<String>?
    public let isDefault: Bool

    public static let autoId = "auto"

    public init(
        id: String,
        label: String,
        harnesses: Set<String> = [],
        models: Set<String>? = nil,
        isDefault: Bool = false
    ) {
        self.id = id
        self.label = label
        self.harnesses = harnesses
        self.models = models
        self.isDefault = isDefault
    }

    /// "Let the harness decide" — the ladder's first rung, which fills nothing.
    public static var auto: HudRuntimeEffort { HudRuntimeEffort(id: autoId, label: "Auto") }
}

// MARK: - Mark injection

/// How a harness draws itself. Hudson ships no brand artwork: a host with marks
/// (Scout's `HarnessMark`) installs them with `.hudRuntimeMark { id, size in … }`,
/// and anything it declines to draw falls back to the harness monogram.
public struct HudRuntimeMarkProvider: Sendable {
    public let make: @Sendable (String?, CGFloat) -> AnyView?

    public init(make: @escaping @Sendable (String?, CGFloat) -> AnyView?) {
        self.make = make
    }

    /// Monogram only.
    public static var monogram: HudRuntimeMarkProvider {
        HudRuntimeMarkProvider { _, _ in nil }
    }
}

private struct HudRuntimeMarkKey: EnvironmentKey {
    static let defaultValue = HudRuntimeMarkProvider.monogram
}

/// True inside a container whose `.hudRuntimePicker` is presented. The chip
/// reads it to take its lit state, so a host that routes the chip through
/// `HudComposer` — or any other slot — never has to thread `isPicking` down by
/// hand. The presenter sets it; hosts never do.
private struct HudRuntimeIsPickingKey: EnvironmentKey {
    static let defaultValue = false
}

public extension EnvironmentValues {
    var hudRuntimeMark: HudRuntimeMarkProvider {
        get { self[HudRuntimeMarkKey.self] }
        set { self[HudRuntimeMarkKey.self] = newValue }
    }

    var hudRuntimeIsPicking: Bool {
        get { self[HudRuntimeIsPickingKey.self] }
        set { self[HudRuntimeIsPickingKey.self] = newValue }
    }
}

public extension View {
    /// Install host brand artwork for harness marks. Return nil for a harness
    /// you have no mark for and its monogram is used instead.
    func hudRuntimeMark(
        _ make: @escaping @Sendable (String?, CGFloat) -> AnyView?
    ) -> some View {
        environment(\.hudRuntimeMark, HudRuntimeMarkProvider(make: make))
    }
}

/// The harness mark at a given size — host artwork when there is any, the
/// monogram when there is not.
public struct HudRuntimeMark: View {
    let harness: String?
    let monogram: String
    var size: CGFloat = 13

    @Environment(\.hudRuntimeMark) private var provider

    public init(harness: String?, monogram: String = "", size: CGFloat = 13) {
        self.harness = harness
        self.monogram = monogram
        self.size = size
    }

    /// The initial of the harness id, so a host that names a harness but no
    /// monogram still gets a glyph rather than an empty seat.
    public static func fallbackMonogram(for harness: String?) -> String {
        (harness ?? "").prefix(1).uppercased()
    }

    private var glyph: String {
        monogram.isEmpty ? Self.fallbackMonogram(for: harness) : monogram
    }

    public var body: some View {
        Group {
            if let mark = provider.make(harness, size) {
                mark
            } else {
                Text(glyph)
                    .font(HudFont.mono(size * 0.78, weight: .semibold))
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

// MARK: - Metrics

/// Row height, scrim weight and input affordances, per platform. The panel's
/// geometry is arithmetic off this rather than something measured and chased.
public enum HudRuntimeMetrics {
    /// One touch target, everywhere in the panel.
    public static var row: CGFloat {
        #if os(macOS)
        30
        #else
        44
        #endif
    }

    public static var railWidth: CGFloat {
        #if os(macOS)
        92
        #else
        100
        #endif
    }

    /// Chip height — a capsule at this height reads as a capsule at radius/2.
    public static var chipHeight: CGFloat {
        #if os(macOS)
        22
        #else
        24
        #endif
    }

    public static var pointerHover: Bool {
        #if os(macOS)
        true
        #else
        false
        #endif
    }

    /// The scrim's job is the same everywhere — catch the tap that means "put
    /// this away" before it lands in the draft — but its weight is not. On a
    /// phone the panel is the only thing on screen and a real dim says so; on
    /// a Mac the window keeps working around it and a heavy scrim reads as a
    /// modal alert, so it drops to a whisper that still hit-tests.
    public static var scrimOpacity: Double {
        #if os(macOS)
        0.12
        #else
        0.34
        #endif
    }

    /// Swipe-down-to-dismiss is a touch gesture. A pointer dragging across the
    /// panel is selecting text or missing a row, not asking it to leave.
    public static var dismissesOnSwipe: Bool {
        #if os(macOS)
        false
        #else
        true
        #endif
    }

    /// On a keyboard surface the open panel takes key focus, so Escape and the
    /// arrows land on it and not on the draft field behind the scrim.
    public static var takesKeyFocus: Bool {
        #if os(macOS)
        true
        #else
        false
        #endif
    }
}

// MARK: - Selection

/// The triplet a composer runs on. Ids are the host's own; the panel resolves
/// them tolerantly (see `HudRuntimePanel`). `effortId` is ignored where the
/// host passes no efforts. Codable so a host can persist it as one value.
public struct HudRuntimeSelection: Hashable, Codable, Sendable {
    public var harnessId: String
    public var modelId: String
    public var effortId: String

    public init(harnessId: String, modelId: String, effortId: String = HudRuntimeEffort.autoId) {
        self.harnessId = harnessId
        self.modelId = modelId
        self.effortId = effortId
    }
}

/// What a selection currently names, resolved against the catalog with the
/// same tolerance the panel uses: an unknown harness settles on the first, an
/// unknown model on that harness's default, an unknown effort on the first
/// rung. Both the chip's readout and the panel's lit rows come from here, so
/// they can never disagree.
public struct HudRuntimeResolved: Equatable, Sendable {
    public let harness: HudRuntimeHarness?
    public let model: HudRuntimeModel?
    public let effort: HudRuntimeEffort?

    public init(selection: HudRuntimeSelection, harnesses: [HudRuntimeHarness], efforts: [HudRuntimeEffort] = []) {
        let harness = harnesses.first { $0.id == selection.harnessId } ?? harnesses.first
        self.harness = harness
        self.model = harness?.models.first { $0.id == selection.modelId } ?? harness?.defaultModel
        self.effort = efforts.isEmpty ? nil : (efforts.first { $0.id == selection.effortId } ?? efforts.first)
    }
}

public extension HudComposerModelInfo {
    /// The composer's runtime readout straight from a selection and the host
    /// catalog, so a host does not resolve display strings by hand and drift
    /// from what the panel shows as picked.
    init(selection: HudRuntimeSelection, harnesses: [HudRuntimeHarness], efforts: [HudRuntimeEffort] = []) {
        let resolved = HudRuntimeResolved(selection: selection, harnesses: harnesses, efforts: efforts)
        self.init(
            model: resolved.model?.displayName ?? "",
            effort: resolved.effort?.label,
            harness: resolved.harness?.id,
            monogram: resolved.harness?.monogram ?? ""
        )
    }
}

// MARK: - Anchor

/// What the panel needs to know about the composer underneath it.
///
///   chip — the trigger. The panel GROWS out of this rectangle, and sits a hair
///          above its top edge, which is what makes the opening legible.
///   lane — the composer the chip belongs to. The panel takes its left and
///          right edges from this, because the composer's own lane is the only
///          horizontal alignment that reads as deliberate: matched to it, the
///          panel is that composer's drawer. Aligned to the chip alone, its far
///          edge lands in the middle of the toolbar — over the mic, aligned to
///          nothing — which reads as a near miss even when the arithmetic is
///          exact.
public struct HudRuntimeAnchors {
    public var chip: Anchor<CGRect>?
    public var lane: Anchor<CGRect>?

    public init(chip: Anchor<CGRect>? = nil, lane: Anchor<CGRect>? = nil) {
        self.chip = chip
        self.lane = lane
    }
}

/// Anchors rather than a shared `@Namespace`: the chip is usually handed to the
/// composer through a generic view-builder slot several layers down, and an
/// anchor travels up that tree on its own without every intermediate view
/// having to carry a namespace it has no other use for. They also survive the
/// composer relaying under a raised keyboard, because both are re-read every
/// layout pass.
public struct HudRuntimeAnchorKey: PreferenceKey {
    public static let defaultValue = HudRuntimeAnchors()

    public static func reduce(value: inout HudRuntimeAnchors, nextValue: () -> HudRuntimeAnchors) {
        let next = nextValue()
        if let chip = next.chip { value.chip = chip }
        if let lane = next.lane { value.lane = lane }
    }
}

public extension View {
    /// Mark this view as the runtime panel's origin. Applied by the chip itself
    /// when it is a picker trigger; hosts never call it.
    ///
    /// `transform`, not `anchorPreference`: the lane is published by an ancestor
    /// of this view, and a plain `anchorPreference` up there would REPLACE its
    /// whole subtree's value — taking the chip anchor with it. Transforming
    /// leaves each contribution to fill in its own field.
    func hudRuntimeAnchor() -> some View {
        transformAnchorPreference(key: HudRuntimeAnchorKey.self, value: .bounds) { anchors, anchor in
            anchors.chip = anchor
        }
    }

    /// Mark the composer the chip lives in. The panel takes its width and its
    /// left/right edges from this, so the two line up exactly. Optional — with
    /// no lane the panel falls back to hugging the chip's trailing edge.
    func hudRuntimeLane() -> some View {
        transformAnchorPreference(key: HudRuntimeAnchorKey.self, value: .bounds) { anchors, anchor in
            anchors.lane = anchor
        }
    }

    /// Host side: overlay the anchored runtime panel on this container.
    ///
    /// The container has to be the one the chip lives in — that is what gives
    /// the panel something to grow out of — and it has to be tall enough to
    /// hold the panel above the chip: the scrim and the panel are clipped to
    /// this view, so apply it to the column or page the composer sits at the
    /// bottom of, not to the composer itself.
    ///
    /// On a keyboard surface the open panel takes key focus (Escape closes it,
    /// arrows move the picks). SwiftUI does not hand focus back on its own, so
    /// a host that wants the draft field focused again after a pick should
    /// re-assert its own focus state when `isPresented` turns false.
    func hudRuntimePicker(
        isPresented: Binding<Bool>,
        harnesses: [HudRuntimeHarness],
        efforts: [HudRuntimeEffort] = [],
        selection: Binding<HudRuntimeSelection>
    ) -> some View {
        modifier(
            HudRuntimePickerPresenter(
                isPresented: isPresented,
                harnesses: harnesses,
                effortOptions: efforts,
                selection: selection
            )
        )
    }
}

// MARK: - Chip

/// The runtime as ONE chip — the harness is a MARK, not a word, because once
/// the mark is sitting there writing "claude" beside it is redundant.
///
/// Where the pick is not a real operation — a live session whose runtime cannot
/// be re-pointed — the host passes no `onPick` and the chip renders as IDENTITY
/// rather than a switcher, with no chevron. `effort` is likewise shown only
/// where it is a real choice; a host with no effort concept leaves it nil and
/// the segment disappears. Nothing renders at all when the runtime names
/// neither a harness nor a model.
public struct HudRuntimeChip: View {
    let harness: String?
    let monogram: String
    let model: String?
    /// Reasoning effort — the third of the triplet. Nil where nothing can
    /// change it, and the segment is dropped.
    var effort: String?
    /// The panel is open on this chip. The chip does NOT go away while it is —
    /// the panel grows out of it and it stays as the live readout — so it takes
    /// an active state instead: a rimmed seat and a flipped chevron. A chip
    /// inside a presented `.hudRuntimePicker` container learns this from the
    /// environment; the parameter is for a chip driven by hand.
    var isPicking: Bool
    /// Non-nil only where the pick genuinely takes effect.
    var onPick: (() -> Void)?

    @Environment(\.hudTheme) private var theme
    @Environment(\.hudRuntimeIsPicking) private var environmentPicking
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    #if os(macOS)
    @State private var isHovering = false
    #endif

    public init(
        harness: String?,
        monogram: String = "",
        model: String?,
        effort: String? = nil,
        isPicking: Bool = false,
        onPick: (() -> Void)? = nil
    ) {
        self.harness = harness
        self.monogram = monogram
        self.model = model
        self.effort = effort
        self.isPicking = isPicking
        self.onPick = onPick
    }

    /// A runtime that names itself has something to say. One that names neither
    /// a harness nor a model does not, and the chip renders nothing at all.
    private var identifies: Bool {
        !(harness ?? "").isEmpty || !(model ?? "").isEmpty
    }

    /// Lit when driven by hand OR when the picker this chip triggers is up.
    /// Identity chips never light: there is no panel for them to belong to.
    private var lit: Bool {
        isPicking || (onPick != nil && environmentPicking)
    }

    private var readout: String {
        [model, effort].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: ", ")
    }

    public var body: some View {
        if identifies {
            if let onPick {
                Button(action: onPick) { chip }
                    .buttonStyle(.plain)
                    // Publish the chip's bounds so the panel can grow out of
                    // exactly this rectangle, wherever the composer has laid it
                    // out (keyboard up or down, any density).
                    .hudRuntimeAnchor()
                    .accessibilityLabel("Runtime: \(readout)")
                    .accessibilityHint(lit ? "Closes the runtime picker" : "Opens the runtime picker")
                    .accessibilityAddTraits(lit ? .isSelected : [])
                    #if os(macOS)
                    .onHover { isHovering = $0 }
                    #endif
            } else {
                chip
                    .accessibilityElement(children: .combine)
                    .accessibilityLabel("Runtime: \(readout)")
            }
        }
    }

    /// A capsule at rest, squaring toward the panel's corner radius while the
    /// panel is up. Half the chip height IS the capsule, so this is a real
    /// capsule at rest and an interpolable radius on the way to the panel.
    private var chipShape: RoundedRectangle {
        RoundedRectangle(
            cornerRadius: lit ? theme.radius.card : HudRuntimeMetrics.chipHeight / 2,
            style: .continuous
        )
    }

    /// Hugs its content — no minimum, no stretch. The whole point of the chip is
    /// that the toolbar spends its width on the message, not on config.
    private var chip: some View {
        HStack(spacing: HudSpacing.sm) {
            HudRuntimeMark(harness: harness, monogram: monogram, size: 13)
                .foregroundStyle(lit ? theme.palette.accent : theme.palette.muted)
            if let model, !model.isEmpty {
                Text(model)
                    .font(HudFont.mono(HudTextSize.xxs, weight: .medium))
                    .foregroundStyle(theme.palette.ink)
                    .lineLimit(1)
                    .fixedSize()
            }
            if let effort, !effort.isEmpty {
                // A hairline rule, not a middot — it separates the two runs
                // without adding a third piece of punctuation.
                Rectangle()
                    .fill(theme.hairline.standard)
                    .frame(width: HudStrokeWidth.thin, height: 10)
                Text(effort.uppercased())
                    .font(HudFont.mono(HudTextSize.micro, weight: .semibold))
                    .tracking(HudTracking.wide)
                    .foregroundStyle(theme.palette.dim)
                    .fixedSize()
            }
            if onPick != nil {
                chevron
            }
        }
        .padding(.horizontal, HudSpacing.lg)
        .frame(height: HudRuntimeMetrics.chipHeight)
        // Opening changes the chip's MATERIAL and its SHAPE, not its size. A few
        // points of extra width is the one reaction a toolbar control cannot
        // afford — the eye reads it as the row failing to hold still. Every
        // layer shares one `chipShape`, so the radius interpolates rather than
        // cutting between two rectangles.
        .background {
            chipShape.fill(seatFill)
        }
        .overlay {
            chipShape.strokeBorder(
                lit ? theme.palette.accent.opacity(0.45) : theme.hairline.subtle,
                lineWidth: HudStrokeWidth.thin
            )
        }
        .contentShape(chipShape)
        .animation(HudMotion.ifAllowed(HudMotion.chromeResize, reduceMotion: reduceMotion), value: lit)
    }

    private var seatFill: Color {
        if lit { return theme.palette.accentSoft }
        #if os(macOS)
        if isHovering { return HudSurface.hover }
        #endif
        return HudSurface.control
    }

    /// Points at the panel while the panel is up: the caret is the one part of
    /// the chip that says which way the thing it opened went.
    private var chevron: some View {
        Image(systemName: "chevron.down")
            .font(.system(size: HudTextSize.micro, weight: .semibold))
            .foregroundStyle(lit ? theme.palette.accent : theme.palette.dim)
            .rotationEffect(.degrees(lit ? 180 : 0))
            .animation(HudMotion.ifAllowed(HudMotion.chromeResize, reduceMotion: reduceMotion), value: lit)
    }
}

// MARK: - Presenter

/// Places the panel against the chip and runs the grow/collapse.
///
/// Geometry, in the host's own coordinate space:
///   · the panel's BOTTOM edge sits a hair above the chip's top edge, so it
///     always opens upward — above the composer, and above the keyboard when
///     one is raised, because the chip is itself above it;
///   · its LEFT and RIGHT edges are the composer's, so the panel and the thing
///     it configures are one column (falling back to the chip's trailing edge
///     where no lane is published);
///   · the panel is clamped to the surface and to the room above the chip, so a
///     raised keyboard shortens it rather than hiding it.
private struct HudRuntimePickerPresenter: ViewModifier {
    @Binding var isPresented: Bool
    let harnesses: [HudRuntimeHarness]
    let effortOptions: [HudRuntimeEffort]
    @Binding var selection: HudRuntimeSelection

    @Environment(\.hudTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// Side margin the panel keeps from the surface edges.
    private let margin: CGFloat = 12
    /// Air between the chip's top edge and the panel's bottom edge.
    private let gap: CGFloat = 10
    /// Fallback width where no composer lane is published — wide enough to hold
    /// the rail and a model list, narrow enough that its trailing edge can still
    /// land on the chip's rather than clamping to the surface.
    private let maxPanelWidth: CGFloat = 288
    /// Headroom kept above the panel so it never butts into the chrome.
    private let headroom: CGFloat = 8

    func body(content: Content) -> some View {
        content
            // The chip inside learns it is the open one from here — see
            // `hudRuntimeIsPicking`.
            .environment(\.hudRuntimeIsPicking, isPresented)
            .overlayPreferenceValue(HudRuntimeAnchorKey.self) { anchors in
                GeometryReader { proxy in
                    if let anchor = anchors.chip {
                        let chip = proxy[anchor]
                        let lane = anchors.lane.map { proxy[$0] }
                        // The composer's own column when there is one; otherwise hug
                        // the chip's trailing edge and clamp to the surface.
                        let rawLeft = lane?.minX ?? (chip.maxX - maxPanelWidth)
                        let rawWidth = lane.map { $0.width } ?? maxPanelWidth
                        let width = min(rawWidth, max(0, proxy.size.width - margin * 2))
                        let x = min(
                            max(margin, rawLeft),
                            max(margin, proxy.size.width - margin - width)
                        )
                        let floorY = max(0, chip.minY - gap)
                        let ceiling = max(140, floorY - headroom)

                        ZStack(alignment: .topLeading) {
                            if isPresented {
                                // The scrim covers the WHOLE surface, including the
                                // composer it is dimming — otherwise a tap meant for
                                // "put this away" lands in the draft field instead.
                                scrim
                                ZStack(alignment: .bottomLeading) {
                                    // Pure geometry: it gives the stack the height
                                    // that puts the panel's floor above the chip, and
                                    // nothing else. Hit testing OFF — a clear colour
                                    // is still a hit target, and this one spans
                                    // everything above the panel, which is most of
                                    // the scrim the operator is aiming at when they
                                    // tap to dismiss.
                                    Color.clear.allowsHitTesting(false)
                                    HudRuntimePanel(
                                        harnesses: harnesses,
                                        effortOptions: effortOptions,
                                        selection: $selection,
                                        maxHeight: ceiling,
                                        onDismiss: close
                                    )
                                    .frame(width: width)
                                    // The growth origin is the chip's centre,
                                    // expressed in the panel's own space: the panel
                                    // scales out of the point the finger touched and
                                    // collapses back into it, so "where did this come
                                    // from" is never a question. Declared INSIDE the
                                    // leading padding — outside it, the unit point
                                    // would be measured against the panel plus its
                                    // offset, and the origin would drift the further
                                    // the lane sits from the surface edge.
                                    .transition(panelTransition(origin: UnitPoint(
                                        x: width > 0 ? min(max((chip.midX - x) / width, 0), 1) : 1,
                                        y: 1
                                    )))
                                    .padding(.leading, x)
                                }
                                // The stack's floor IS the panel's bottom edge — one
                                // frame does the anchoring, so there is no measured
                                // panel height to chase and nothing to re-layout when
                                // the model list changes under it.
                                .frame(width: proxy.size.width, height: floorY, alignment: .bottomLeading)
                                // A harness with more models makes the panel taller,
                                // and its TOP edge is the one that moves. That edge is
                                // placed by this container, not by the panel, so the
                                // animation has to live here too — inside the panel
                                // alone it animated its own height while its origin
                                // snapped, which is the jump you could see.
                                .animation(
                                    HudMotion.ifAllowed(HudMotion.drawerSpring, reduceMotion: reduceMotion),
                                    value: selection.harnessId
                                )
                            }
                        }
                        .frame(width: proxy.size.width, height: proxy.size.height, alignment: .topLeading)
                    }
                }
                .animation(HudMotion.ifAllowed(HudMotion.overlaySpring, reduceMotion: reduceMotion), value: isPresented)
            }
    }

    /// Light enough to keep the draft and the chip readable underneath — this is
    /// a panel on top of your message, not a modal instead of it.
    private var scrim: some View {
        Rectangle()
            .fill(Color.black.opacity(HudRuntimeMetrics.scrimOpacity))
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(Rectangle())
            .onTapGesture { close() }
            .transition(.opacity.animation(HudMotion.quickFade))
            .accessibilityLabel("Close runtime picker")
            .accessibilityAddTraits(.isButton)
    }

    /// Reduce Motion keeps the EVENT and drops the travel: the panel still
    /// appears where it belongs, it just crossfades in instead of growing.
    private func panelTransition(origin: UnitPoint) -> AnyTransition {
        reduceMotion
            ? .opacity
            : .scale(scale: 0.88, anchor: origin).combined(with: .opacity)
    }

    private func close() {
        isPresented = false
    }
}

// MARK: - Panel

/// The panel itself: harness rail · model list · effort ladder. Every pick is
/// live — the chip under the scrim updates as you go.
public struct HudRuntimePanel: View {
    let harnesses: [HudRuntimeHarness]
    let effortOptions: [HudRuntimeEffort]
    @Binding var selection: HudRuntimeSelection
    /// The room the host has above the chip. The panel HUGS its rows and only
    /// consults this when there aren't enough of them to go round — a settings
    /// panel that stretched to fill whatever space it was offered would read as
    /// a sheet again, which is the thing being fixed.
    var maxHeight: CGFloat = .infinity
    var onDismiss: () -> Void

    @Namespace private var railMarker
    @Environment(\.hudTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @FocusState private var isKeyTarget: Bool

    public init(
        harnesses: [HudRuntimeHarness],
        effortOptions: [HudRuntimeEffort] = [],
        selection: Binding<HudRuntimeSelection>,
        maxHeight: CGFloat = .infinity,
        onDismiss: @escaping () -> Void
    ) {
        self.harnesses = harnesses
        self.effortOptions = effortOptions
        self._selection = selection
        self.maxHeight = maxHeight
        self.onDismiss = onDismiss
    }

    private var row: CGFloat { HudRuntimeMetrics.row }
    private var railWidth: CGFloat { HudRuntimeMetrics.railWidth }
    /// Air above and below each column's rows.
    private let columnPad: CGFloat = HudSpacing.sm

    private var shape: RoundedRectangle {
        RoundedRectangle(cornerRadius: 14, style: .continuous)
    }

    /// Rows are a known height, so the body's natural size is arithmetic rather
    /// than something to measure and chase.
    private var bodyHeight: CGFloat {
        let natural = CGFloat(max(harnesses.count, models.count)) * row + columnPad * 2
        let ladder = showsLadder ? row + HudSpacing.xs + HudStrokeWidth.thin : 0
        let available = maxHeight.isFinite ? max(row * 2, maxHeight - ladder) : natural
        return min(natural, available)
    }

    /// Resolution is tolerant: a stale or unknown id settles onto the first
    /// entry and that harness's default model rather than trapping the panel.
    private var harness: HudRuntimeHarness? {
        harnesses.first { $0.id == selection.harnessId } ?? harnesses.first
    }

    private var models: [HudRuntimeModel] { harness?.models ?? [] }

    /// A host with no effort concept passes none, and the footer disappears
    /// rather than rendering a ladder with one dead rung.
    private var showsLadder: Bool { efforts.count > 1 }

    private var efforts: [HudRuntimeEffort] {
        guard let harness else { return [] }
        return supportedEfforts(harnessId: harness.id, model: resolvedModelId)
    }

    private func supportedEfforts(harnessId: String, model: String?) -> [HudRuntimeEffort] {
        effortOptions.filter { option in
            guard option.harnesses.isEmpty || option.harnesses.contains(harnessId) else { return false }
            guard let models = option.models, !models.isEmpty, let model else { return true }
            return models.contains(model)
        }
    }

    private var effortIndex: Int {
        max(0, efforts.firstIndex { $0.id == selection.effortId } ?? 0)
    }

    public var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                rail
                Rectangle()
                    .fill(theme.hairline.standard)
                    .frame(width: HudStrokeWidth.thin)
                modelColumn
            }
            .frame(height: bodyHeight)
            // The invariant, stated once: nothing in the two columns may reach
            // the effort ladder. Both of them clip already — this is the frame
            // that actually owns the promise.
            .clipped()
            if showsLadder {
                Rectangle()
                    .fill(theme.hairline.standard)
                    .frame(height: HudStrokeWidth.thin)
                effortLadder
            }
        }
        // Switching harness changes how many models there are, so the panel
        // changes height. Its floor is pinned to the chip, so it grows and
        // shrinks UPWARD, from the control it belongs to — but only if the
        // change is animated. Unanimated it was a full-row jump, which reads as
        // a glitch rather than as the panel making room.
        .animation(HudMotion.ifAllowed(HudMotion.drawerSpring, reduceMotion: reduceMotion), value: selection.harnessId)
        .background {
            shape
                .fill(theme.palette.surface)
                .shadow(color: .black.opacity(0.55), radius: 22, y: 10)
                .shadow(color: .black.opacity(0.4), radius: 4, y: 2)
        }
        .overlay {
            shape.strokeBorder(theme.hairline.standard, lineWidth: HudStrokeWidth.thin)
        }
        .clipShape(shape)
        // Swipe down = the reverse of the way it opened. Simultaneous so the
        // model column keeps its own scrolling when a short surface makes it
        // scroll at all; the threshold is deliberately decisive. Touch only —
        // `.subviews` keeps the rows' own buttons and drops this gesture.
        .simultaneousGesture(swipeDown, including: HudRuntimeMetrics.dismissesOnSwipe ? .all : .subviews)
        // Keyboard: the open panel is the key target on a pointer surface, so
        // Escape and the arrows land here and not in the draft field behind
        // the scrim (whose own Escape would stop a streaming turn).
        .focusable(HudRuntimeMetrics.takesKeyFocus)
        .focusEffectDisabled()
        .focused($isKeyTarget)
        .onAppear {
            guard HudRuntimeMetrics.takesKeyFocus else { return }
            // Focus is not accepted until the view is in the hierarchy; one
            // hop of the run loop is what that costs.
            DispatchQueue.main.async { isKeyTarget = true }
        }
        .onKeyPress(keys: [.escape, .upArrow, .downArrow, .leftArrow, .rightArrow]) { press in
            handle(press)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Runtime")
        .accessibilityAddTraits(.isModal)
    }

    private var swipeDown: some Gesture {
        DragGesture(minimumDistance: 16)
            .onEnded { value in
                guard value.translation.height > 64,
                      value.translation.height > abs(value.translation.width) * 1.5 else { return }
                onDismiss()
            }
    }

    // MARK: Keyboard

    /// ↑↓ walk the models, ←→ the ladder, ⌥↑↓ the rail; Escape puts the panel
    /// away. Each step is the same live pick a tap would be.
    private func handle(_ press: KeyPress) -> KeyPress.Result {
        switch press.key {
        case .escape:
            onDismiss()
            return .handled
        case .upArrow, .downArrow:
            let delta = press.key == .upArrow ? -1 : 1
            if press.modifiers.contains(.option) {
                stepHarness(delta)
            } else {
                stepModel(delta)
            }
            return .handled
        case .leftArrow:
            stepEffort(-1)
            return .handled
        case .rightArrow:
            stepEffort(1)
            return .handled
        default:
            return .ignored
        }
    }

    private func stepHarness(_ delta: Int) {
        guard !harnesses.isEmpty else { return }
        let current = harnesses.firstIndex { $0.id == harness?.id } ?? 0
        let next = min(max(0, current + delta), harnesses.count - 1)
        guard next != current else { return }
        pickHarness(harnesses[next])
    }

    private func stepModel(_ delta: Int) {
        guard !models.isEmpty else { return }
        let current = models.firstIndex { $0.id == resolvedModelId } ?? 0
        let next = min(max(0, current + delta), models.count - 1)
        guard next != current else { return }
        pickModel(models[next])
    }

    private func stepEffort(_ delta: Int) {
        guard showsLadder else { return }
        let next = min(max(0, effortIndex + delta), efforts.count - 1)
        guard next != effortIndex else { return }
        pick { selection.effortId = efforts[next].id }
    }

    // MARK: Harness rail

    /// One marker travels between rows instead of every row growing an edge —
    /// the reason the rail reads as a single control.
    ///
    /// Scrolls and clips on the same terms as the model column. A plain stack
    /// here is fine only while the panel always has room for every harness:
    /// once `bodyHeight` clamps — a chip lower down the surface, or simply more
    /// harnesses than rungs — an unclipped stack overdraws the frame it was
    /// given and the last rail rows land ON TOP of the effort ladder.
    private var rail: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 0) {
                ForEach(harnesses) { entry in
                    let on = entry.id == harness?.id
                    Button {
                        pickHarness(entry)
                    } label: {
                        HStack(spacing: HudSpacing.md) {
                            HudRuntimeMark(harness: entry.id, monogram: entry.monogram, size: 14)
                                .foregroundStyle(on ? theme.palette.accent : theme.palette.dim)
                            Text(entry.short)
                                .font(HudFont.mono(HudTextSize.xs, weight: on ? .semibold : .medium))
                                .foregroundStyle(on ? theme.palette.ink : theme.palette.muted)
                                .lineLimit(1)
                                .minimumScaleFactor(0.8)
                            Spacer(minLength: 0)
                        }
                        // Unreachable harnesses stay on the rail, pickable,
                        // but dimmed: the row says "not now", not "not here".
                        .opacity(entry.isAvailable ? 1 : HudOpacity.soft)
                        .padding(.leading, HudSpacing.lg)
                        .padding(.trailing, HudSpacing.md)
                        .frame(height: row)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(alignment: .leading) {
                            if on {
                                Capsule()
                                    .fill(theme.palette.accent)
                                    .frame(width: 2, height: 18)
                                    .matchedGeometryEffect(id: "rail-marker", in: railMarker)
                            }
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(HudRuntimeRowStyle())
                    .accessibilityLabel(entry.label)
                    .accessibilityValue(entry.isAvailable ? "" : "Unavailable")
                    .accessibilityAddTraits(on ? .isSelected : [])
                }
                // No trailing Spacer: a scroll view proposes nil height, so one
                // would collapse to nothing anyway. Scroll content is
                // top-aligned, which is the alignment the Spacer was buying.
            }
            .padding(.vertical, columnPad)
            .animation(HudMotion.ifAllowed(HudMotion.drawerSpring, reduceMotion: reduceMotion), value: harness?.id)
        }
        .scrollBounceBehavior(.basedOnSize)
        .frame(width: railWidth)
        .clipped()
    }

    // MARK: Models

    private var modelColumn: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 0) {
                ForEach(models) { model in
                    let on = model.id == resolvedModelId
                    Button {
                        pickModel(model)
                    } label: {
                        HStack(alignment: .firstTextBaseline, spacing: HudSpacing.sm) {
                            Circle()
                                .fill(on ? theme.palette.accent : .clear)
                                .frame(width: 5, height: 5)
                                .alignmentGuide(.firstTextBaseline) { $0[.bottom] - 1 }
                            Text(model.label)
                                .font(HudFont.mono(HudTextSize.sm, weight: on ? .semibold : .medium))
                                .foregroundStyle(on ? theme.palette.ink : theme.palette.muted)
                                .lineLimit(1)
                            if !model.sublabel.isEmpty {
                                Text(model.sublabel)
                                    .font(HudFont.mono(HudTextSize.xxs))
                                    .foregroundStyle(theme.palette.dim)
                            }
                            Spacer(minLength: HudSpacing.sm)
                            if model.isDefault {
                                Text("DEFAULT")
                                    .font(HudFont.mono(HudTextSize.micro))
                                    .tracking(HudTracking.wide)
                                    .foregroundStyle(theme.palette.dim.opacity(0.75))
                                    .fixedSize()
                            }
                        }
                        .padding(.horizontal, HudSpacing.xl)
                        .frame(height: row)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(HudRuntimeRowStyle())
                    .accessibilityLabel(model.displayName)
                    .accessibilityAddTraits(on ? .isSelected : [])
                }
            }
            .padding(.vertical, columnPad)
            // A different harness is a different LIST, not the same list with
            // its rows rewritten. Re-keyed, it leaves and a new one arrives —
            // rising the short distance the panel is growing, so the swap and
            // the height change are one movement instead of two.
            .id(harness?.id ?? "")
            .transition(
                reduceMotion
                    ? .opacity
                    : .opacity.combined(with: .offset(y: 10))
            )
        }
        .scrollBounceBehavior(.basedOnSize)
        .frame(maxWidth: .infinity)
        .clipped()
    }

    /// What the model column is actually showing as picked — the tolerant
    /// resolution, so a model id left over from another harness doesn't leave
    /// the list with nothing lit.
    private var resolvedModelId: String {
        (models.first { $0.id == selection.modelId } ?? harness?.defaultModel)?.id ?? ""
    }

    // MARK: Effort

    /// Ordinal, so it reads as a ladder rather than a list: everything up to the
    /// pick is filled, the pick itself is lit. Auto is the exception it looks
    /// like — it is "let the harness decide", not a rung below Low, so selecting
    /// it fills nothing.
    private var effortLadder: some View {
        HStack(spacing: HudSpacing.xs) {
            ForEach(Array(efforts.enumerated()), id: \.element.id) { index, option in
                let current = index == effortIndex
                let filled = index > 0 && index < effortIndex
                Button {
                    pick { selection.effortId = option.id }
                } label: {
                    VStack(spacing: HudSpacing.sm) {
                        Capsule()
                            .fill(
                                current
                                    ? theme.palette.accent
                                    : (filled ? theme.palette.accent.opacity(0.34) : theme.hairline.standard)
                            )
                            .frame(height: 3)
                        Text(option.label.uppercased())
                            .font(HudFont.mono(HudTextSize.micro, weight: current ? .bold : .medium))
                            .tracking(HudTracking.wide)
                            .foregroundStyle(current ? theme.palette.ink : theme.palette.dim)
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: row)
                    .contentShape(Rectangle())
                }
                .buttonStyle(HudRuntimeRowStyle())
                .accessibilityLabel("\(option.label) effort")
                .accessibilityAddTraits(current ? .isSelected : [])
            }
        }
        .padding(.horizontal, HudSpacing.xl)
        .padding(.bottom, HudSpacing.xs)
        .animation(HudMotion.ifAllowed(HudMotion.drawerSpring, reduceMotion: reduceMotion), value: effortIndex)
    }

    // MARK: Picking

    private func pickHarness(_ entry: HudRuntimeHarness) {
        pick {
            selection.harnessId = entry.id
            selection.modelId = entry.defaultModel?.id ?? ""
            reconcileEffort(harnessId: entry.id, model: entry.defaultModel?.id)
        }
    }

    private func pickModel(_ model: HudRuntimeModel) {
        pick {
            selection.modelId = model.id
            reconcileEffort(harnessId: harness?.id ?? selection.harnessId, model: model.id)
        }
    }

    /// A pick that leaves the current effort unsupported moves it to the rung
    /// the host marked default, else the first supported rung, rather than
    /// leaving a dead rung lit.
    private func reconcileEffort(harnessId: String, model: String?) {
        let supported = supportedEfforts(harnessId: harnessId, model: model)
        guard !supported.contains(where: { $0.id == selection.effortId }) else { return }
        selection.effortId = supported.first(where: \.isDefault)?.id
            ?? supported.first?.id
            ?? HudRuntimeEffort.autoId
    }

    /// Every pick is live and reports itself in the hand — the chip under the
    /// scrim is the readout, so nothing here waits for a commit.
    private func pick(_ change: () -> Void) {
        change()
        #if canImport(UIKit) && !os(watchOS)
        UISelectionFeedbackGenerator().selectionChanged()
        #endif
    }
}

// MARK: - Row style

/// Pointer surfaces get a hover seat; touch surfaces get a press seat. Both are
/// the same token, so the row reads the same either way.
private struct HudRuntimeRowStyle: ButtonStyle {
    @Environment(\.hudTheme) private var theme
    @State private var isHovering = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(background(pressed: configuration.isPressed))
            #if os(macOS)
            .onHover { isHovering = $0 }
            #endif
    }

    private func background(pressed: Bool) -> Color {
        if pressed { return HudSurface.press }
        #if os(macOS)
        if isHovering { return HudSurface.hover }
        #endif
        return .clear
    }
}
