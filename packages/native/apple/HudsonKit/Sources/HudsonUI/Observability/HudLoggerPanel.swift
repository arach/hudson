import SwiftUI
import HudsonObservability

/// Edge-sheet body for the live log inspector. Pair with `.hudEdgeSheet` on any
/// shell surface, or present from a status-bar button.
@MainActor
public struct HudLoggerPanel: View {
    @ObservedObject private var store: HudLogStore
    public let title: String
    public let onClose: () -> Void

    public init(
        store: HudLogStore = .shared,
        title: String = "Activity Log",
        onClose: @escaping () -> Void
    ) {
        self._store = ObservedObject(wrappedValue: store)
        self.title = title
        self.onClose = onClose
    }

    public var body: some View {
        VStack(spacing: 0) {
            header
                .padding(.horizontal, HudSpacing.xl)
                .padding(.vertical, HudSpacing.md)
                .background(HudPalette.chrome)
                .overlay(Rectangle().fill(HudHairline.subtle).frame(height: HudStrokeWidth.thin), alignment: .bottom)

            HudLoggerView(store: store, title: title, showHeader: true)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(HudPalette.bg)
    }

    private var header: some View {
        HStack(spacing: HudSpacing.md) {
            Text(title.uppercased())
                .font(HudFont.mono(HudTextSize.xxs, weight: .bold))
                .tracking(1.4)
                .foregroundStyle(HudPalette.ink)

            Spacer(minLength: HudSpacing.sm)

            Button(action: onClose) {
                Image(systemName: "xmark")
                    .font(HudFont.ui(HudTextSize.xs, weight: .bold))
                    .foregroundStyle(HudPalette.muted)
                    .frame(width: HudIconSize.small, height: HudIconSize.small)
                    .background(Circle().fill(HudSurface.tintFill(HudPalette.muted)))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close activity log")
        }
    }
}