import SwiftUI
import HudsonUI
import HudsonObservability

/// Tunable defaults for `HudEdgeSheet`. Kept non-generic so they can seed the
/// `.hudEdgeSheet(...)` modifier's default arguments.
public enum HudEdgeSheetDefaults {
    /// Black scrim opacity. Mirrors `HudSurface.scrim` (0.45) — heavy enough to
    /// recede the canvas without fully blacking it out.
    public static var scrimDim: Double { 0.45 }
    /// Default container fraction for `.leading` / `.trailing` sheets — a tall
    /// reading column.
    public static var horizontalFraction: CGFloat { 0.65 }
    /// Default container fraction for `.top` / `.bottom` sheets — a wide drawer.
    public static var verticalFraction: CGFloat { 0.76 }
}

/// Edge-switchable modal sheet: the *same* content slides in from a chosen
/// screen edge over a dimmed scrim. The macOS/iOS analog of a design study
/// where one diff sheet can enter from the right (a tall reading column) or the
/// bottom (a wide drawer) by flipping a single `edge` parameter.
///
/// Unlike `HudTerminalDrawer` (bottom-only, docked in a shell slot) and
/// `HudSidebarPanel` (leading/trailing, docked, resizable), `HudEdgeSheet` is a
/// *modal* overlay: it owns a full-bleed scrim, blocks the canvas while open,
/// and dismisses on scrim tap or Escape.
///
/// The sheet sizes to a fraction of its container (trailing/leading ≈ 65% width,
/// top/bottom ≈ 76% height) but the caller can override via `fraction`. Content
/// is arbitrary (`@ViewBuilder`).
///
/// Presentation reuses `HudMotion.drawerSpring` — the same spring
/// `HudTerminalDrawer` rides — and honors `accessibilityReduceMotion` by
/// cross-fading instead of sliding.
///
/// Usage — either drop it in a `ZStack`, or (preferred) use the
/// `.hudEdgeSheet(...)` modifier on any view:
///
/// ```swift
/// content
///     .hudEdgeSheet(isPresented: $showingDiff, edge: .bottom) {
///         ScoutBranchDiffSheet(...)
///     }
/// ```
public struct HudEdgeSheet<Content: View>: View {
    @Binding public var isPresented: Bool
    public let edge: Edge
    public let scrimDim: Double
    public let fraction: CGFloat?
    public let onDismiss: (() -> Void)?
    public let content: () -> Content

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// - Parameters:
    ///   - isPresented: Drives the sheet in/out. Set false to dismiss.
    ///   - edge: Screen edge the sheet anchors to and slides from.
    ///   - scrimDim: Black scrim opacity behind the sheet (0...1).
    ///   - fraction: Container fraction for the sheet's variable dimension
    ///     (width for leading/trailing, height for top/bottom). `nil` uses the
    ///     per-orientation default in `HudEdgeSheetDefaults`.
    ///   - onDismiss: Invoked after a scrim-tap or Escape dismissal.
    ///   - content: The sheet body.
    public init(
        isPresented: Binding<Bool>,
        edge: Edge = .trailing,
        scrimDim: Double = HudEdgeSheetDefaults.scrimDim,
        fraction: CGFloat? = nil,
        onDismiss: (() -> Void)? = nil,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self._isPresented = isPresented
        self.edge = edge
        self.scrimDim = scrimDim
        self.fraction = fraction
        self.onDismiss = onDismiss
        self.content = content
    }

    public var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: contentAlignment) {
                if isPresented {
                    scrim
                        .transition(.opacity)
                    surface(in: proxy.size)
                        .transition(slideTransition)
                    keyboardLayer
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .animation(resolvedAnimation, value: isPresented)
        }
        .ignoresSafeArea()
        .allowsHitTesting(isPresented)
        .onChange(of: isPresented) { _, presented in
            if presented {
                HudInstrumentation.ui.event("EdgeSheet.open", metadata: metadata)
            } else {
                HudInstrumentation.ui.event("EdgeSheet.dismiss", metadata: metadata)
            }
        }
    }

    // MARK: Layers

    private var scrim: some View {
        Color(white: 0, opacity: scrimDim)
            .ignoresSafeArea()
            .contentShape(Rectangle())
            .onTapGesture { dismiss() }
            .accessibilityLabel("Dismiss")
            .accessibilityAddTraits(.isButton)
    }

    @ViewBuilder
    private func surface(in size: CGSize) -> some View {
        let panel = content()
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(HudPalette.chrome)
            .overlay(alignment: hairlineAlignment) {
                HudDivider(color: HudHairline.standard, axis: hairlineAxis)
            }

        Group {
            if isHorizontal {
                panel.frame(width: size.width * resolvedFraction)
            } else {
                panel.frame(height: size.height * resolvedFraction)
            }
        }
        .shadow(color: HudSurface.scrim, radius: 24, x: 0, y: 0)
    }

    /// Hidden Escape sink — mirrors `HudCommandPalette`'s keyboard layer so the
    /// shortcut routes only while the sheet is presented.
    private var keyboardLayer: some View {
        Button("Dismiss sheet") { dismiss() }
            .keyboardShortcut(.escape, modifiers: [])
            .opacity(0)
            // Invisible keyboard sink — zero-size shape that still routes shortcuts.
            // hudlint:disable next-line geometry
            .frame(width: 0, height: 0)
            .accessibilityHidden(true)
    }

    // MARK: Dismissal

    private func dismiss() {
        guard isPresented else { return }
        isPresented = false
        onDismiss?()
    }

    // MARK: Geometry & motion

    private var isHorizontal: Bool {
        edge == .leading || edge == .trailing
    }

    private var resolvedFraction: CGFloat {
        let fallback = isHorizontal
            ? HudEdgeSheetDefaults.horizontalFraction
            : HudEdgeSheetDefaults.verticalFraction
        guard let fraction else { return fallback }
        return min(max(fraction, 0.1), 1.0)
    }

    private var contentAlignment: Alignment {
        switch edge {
        case .leading:  return .leading
        case .trailing: return .trailing
        case .top:      return .top
        case .bottom:   return .bottom
        }
    }

    /// Hairline sits on the panel's *inner* edge, the one facing the canvas.
    private var hairlineAlignment: Alignment {
        switch edge {
        case .leading:  return .trailing
        case .trailing: return .leading
        case .top:      return .bottom
        case .bottom:   return .top
        }
    }

    private var hairlineAxis: Axis {
        isHorizontal ? .vertical : .horizontal
    }

    private var slideTransition: AnyTransition {
        reduceMotion ? .opacity : .move(edge: edge)
    }

    private var resolvedAnimation: Animation? {
        reduceMotion ? HudMotion.quickFade : HudMotion.drawerSpring
    }

    private var metadata: [String: String] {
        [
            "edge": edgeLabel,
            "fractionPct": "\(Int((resolvedFraction * 100).rounded()))",
            "reduceMotion": reduceMotion ? "true" : "false",
        ]
    }

    private var edgeLabel: String {
        switch edge {
        case .leading:  return "leading"
        case .trailing: return "trailing"
        case .top:      return "top"
        case .bottom:   return "bottom"
        }
    }
}

// MARK: - View modifier

extension View {
    /// Mount an edge-switchable modal sheet on any view. Flip `isPresented` to
    /// present; the sheet slides in from `edge` over a scrim and dismisses on
    /// scrim tap or Escape.
    public func hudEdgeSheet<SheetContent: View>(
        isPresented: Binding<Bool>,
        edge: Edge = .trailing,
        scrimDim: Double = HudEdgeSheetDefaults.scrimDim,
        fraction: CGFloat? = nil,
        onDismiss: (() -> Void)? = nil,
        @ViewBuilder content: @escaping () -> SheetContent
    ) -> some View {
        modifier(
            HudEdgeSheetPresenter(
                isPresented: isPresented,
                edge: edge,
                scrimDim: scrimDim,
                fraction: fraction,
                onDismiss: onDismiss,
                sheetContent: content
            )
        )
    }
}

private struct HudEdgeSheetPresenter<SheetContent: View>: ViewModifier {
    @Binding var isPresented: Bool
    let edge: Edge
    let scrimDim: Double
    let fraction: CGFloat?
    let onDismiss: (() -> Void)?
    @ViewBuilder let sheetContent: () -> SheetContent

    func body(content: Content) -> some View {
        ZStack {
            content
            HudEdgeSheet(
                isPresented: $isPresented,
                edge: edge,
                scrimDim: scrimDim,
                fraction: fraction,
                onDismiss: onDismiss,
                content: sheetContent
            )
            .zIndex(1)
        }
    }
}

// MARK: - Preview

#if DEBUG
private struct HudEdgeSheetPreviewHost: View {
    @State private var trailingShown = false
    @State private var bottomShown = false

    var body: some View {
        ZStack {
            HudPalette.bg.ignoresSafeArea()

            VStack(spacing: HudSpacing.xl) {
                Text("HudEdgeSheet")
                    .font(HudFont.mono(HudTextSize.lg, weight: .bold))
                    .foregroundStyle(HudPalette.ink)

                Button("Open trailing — reading column") { trailingShown = true }
                Button("Open bottom — wide drawer") { bottomShown = true }
            }
            .buttonStyle(.plain)
            .font(HudFont.mono(HudTextSize.sm, weight: .semibold))
            .foregroundStyle(HudPalette.accent)
        }
        .frame(width: HudLayout.readableWidth, height: HudLayout.dialogWidth)
        .hudEdgeSheet(isPresented: $trailingShown, edge: .trailing) {
            previewPanel(title: "DIFF · TRAILING", detail: "≈65% width · tall reading column")
        }
        .hudEdgeSheet(isPresented: $bottomShown, edge: .bottom) {
            previewPanel(title: "DIFF · BOTTOM", detail: "≈76% height · wide drawer")
        }
    }

    private func previewPanel(title: String, detail: String) -> some View {
        VStack(alignment: .leading, spacing: HudSpacing.lg) {
            Text(title)
                .font(HudFont.mono(HudTextSize.xxs, weight: .bold))
                .tracking(1.2)
                .foregroundStyle(HudPalette.ink)
            Text(detail)
                .font(HudFont.mono(HudTextSize.xs))
                .foregroundStyle(HudPalette.muted)
            Text("- removed line\n+ added line")
                .font(HudFont.mono(HudTextSize.xs))
                .foregroundStyle(HudPalette.dim)
            Spacer(minLength: 0)
        }
        .padding(HudSpacing.huge)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

private struct HudEdgeSheetPreviewHost_Previews: PreviewProvider {
    static var previews: some View {
        HudEdgeSheetPreviewHost()
    }
}
#endif
