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

            Button(action: { isPresented = false }) {
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
        .background(Color.black.opacity(0.30))
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
        ZStack {
            self
            if isPresented.wrappedValue {
                content()
                    .transition(.asymmetric(
                        insertion: .opacity.combined(with: .move(edge: .bottom)),
                        removal: .opacity
                    ))
                    .zIndex(1)
            }
        }
        .animation(.spring(response: 0.36, dampingFraction: 0.88), value: isPresented.wrappedValue)
    }
}
