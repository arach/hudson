import SwiftUI
import HudsonUI

/// Full-viewport blocking surface that overlays the entire shell.
///
/// Native counterpart to the web SDK's takeover slot
/// (`packages/hudson-sdk/src/components/AppShell.tsx`). Use a takeover for
/// flows that need the user's full attention — connection setup, onboarding,
/// destructive confirmations, terminal sessions launched from a target.
///
/// Usage:
///
/// ```swift
/// HudsonAppShell { ... }
///     .hudsonTakeover(isPresented: $isConnecting) {
///         HudsonTakeover(isPresented: $isConnecting) {
///             Text("Connecting to arach-laptop")
///         } content: {
///             ConnectFlow(...)
///         }
///     }
/// ```
public struct HudsonTakeover<Header: View, Content: View>: View {
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
            HudsonDivider(color: HudsonHairline.standard)
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .background(HudsonPalette.bg)
        #if os(iOS)
        .ignoresSafeArea()
        #endif
    }

    private var headerBar: some View {
        HStack(spacing: HudsonSpacing.lg) {
            header
                .frame(maxWidth: .infinity, alignment: .leading)

            Button(action: close) {
                Image(systemName: "xmark")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(HudsonPalette.muted)
                    .frame(width: 32, height: 32)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close")
        }
        .padding(.horizontal, HudsonSpacing.xxl)
        .frame(height: HudsonLayout.navHeight)
        .background(HudsonPalette.chrome)
    }

    private func close() {
        HudsonInstrumentation.event("Takeover.close")
        if reduceMotion {
            isPresented = false
        } else {
            withAnimation(HudsonMotion.overlaySpring) {
                isPresented = false
            }
        }
    }
}

// MARK: - View modifier

extension View {
    /// Mount a takeover on top of any view (typically `HudsonAppShell`).
    /// The takeover fades + slides up from the bottom; dismissing reverses
    /// the transition.
    public func hudsonTakeover<Takeover: View>(
        isPresented: Binding<Bool>,
        @ViewBuilder content: @escaping () -> Takeover
    ) -> some View {
        modifier(HudsonTakeoverPresenter(isPresented: isPresented, takeover: content))
    }
}

private struct HudsonTakeoverPresenter<Takeover: View>: ViewModifier {
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
        .animation(HudsonMotion.ifAllowed(HudsonMotion.overlaySpring, reduceMotion: reduceMotion), value: isPresented)
        .onChange(of: isPresented) { _, presented in
            if presented {
                HudsonInstrumentation.event("Takeover.open")
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
