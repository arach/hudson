import SwiftUI
import HudsonUI
import HudsonObservability

/// Full-viewport blocking surface that overlays the entire shell.
///
/// Native counterpart to the web SDK's takeover slot
/// (`packages/web/hudsonkit/src/components/AppShell.tsx`). Use a takeover for
/// flows that need the user's full attention — connection setup, onboarding,
/// destructive confirmations, terminal sessions launched from a target.
///
/// Usage:
///
/// ```swift
/// HudAppShell { ... }
///     .hudsonTakeover(isPresented: $isConnecting) {
///         HudTakeover(isPresented: $isConnecting) {
///             Text("Connecting to arach-laptop")
///         } content: {
///             ConnectFlow(...)
///         }
///     }
/// ```
public struct HudTakeover<Header: View, Content: View>: View {
    @Binding public var isPresented: Bool
    public let header: Header
    public let content: Content
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(
        isPresented: Binding<Bool>,
        @ViewBuilder header: () -> Header,
        @ViewBuilder content: () -> Content
    ) {
        self._isPresented = isPresented
        self.header = header()
        self.content = content()
    }

    public var body: some View {
        VStack(spacing: 0) {
            headerBar
            HudDivider(color: HudHairline.standard)
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .background(HudPalette.bg)
        #if os(iOS)
        .ignoresSafeArea()
        #endif
    }

    private var headerBar: some View {
        HStack(spacing: HudSpacing.lg) {
            header
                .frame(maxWidth: .infinity, alignment: .leading)

            Button(action: close) {
                Image(systemName: "xmark")
                    .font(HudFont.ui(HudTextSize.base, weight: .semibold))
                    .foregroundStyle(HudPalette.muted)
                    .frame(width: HudIconSize.large, height: HudIconSize.large)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close")
        }
        .padding(.horizontal, HudSpacing.xxl)
        .frame(height: HudLayout.navHeight)
        .background(HudPalette.chrome)
    }

    private func close() {
        let metadata = [
            "fromPresented": hudsonBool(isPresented),
            "toPresented": "false",
        ]

        HudInstrumentation.ui.span("Takeover.close.apply", metadata: metadata) {
            if reduceMotion {
                isPresented = false
            } else {
                withAnimation(HudMotion.overlaySpring) {
                    isPresented = false
                }
            }
        }
    }
}

// MARK: - View modifier

extension View {
    /// Mount a takeover on top of any view (typically `HudAppShell`).
    /// The takeover fades + slides up from the bottom; dismissing reverses
    /// the transition.
    public func hudsonTakeover<Takeover: View>(
        isPresented: Binding<Bool>,
        @ViewBuilder content: @escaping () -> Takeover
    ) -> some View {
        modifier(HudTakeoverPresenter(isPresented: isPresented, takeover: content))
    }
}

private struct HudTakeoverPresenter<Takeover: View>: ViewModifier {
    @Binding var isPresented: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ViewBuilder let takeover: () -> Takeover

    func body(content: Content) -> some View {
        ZStack {
            content
            if isPresented {
                takeover()
                    .transition(transition)
                    .zIndex(1)
            }
        }
        .animation(HudMotion.ifAllowed(HudMotion.overlaySpring, reduceMotion: reduceMotion), value: isPresented)
        .onChange(of: isPresented) { _, presented in
            if presented {
                HudInstrumentation.ui.event("Takeover.open", metadata: ["presented": "true"])
            } else {
                HudInstrumentation.ui.event("Takeover.close", metadata: ["presented": "false"])
            }
        }
    }

    private var transition: AnyTransition {
        if reduceMotion {
            return .opacity
        }
        return .asymmetric(
            insertion: .opacity.combined(with: .move(edge: .bottom)),
            removal: .opacity
        )
    }
}

private func hudsonBool(_ value: Bool) -> String {
    value ? "true" : "false"
}
