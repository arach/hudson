#if os(iOS)
import SwiftUI

/// Horizontal capsule scroller that jump-scrolls to anchored
/// `HudSettingsSection` blocks. Pass a `ScrollViewProxy` from the enclosing
/// `ScrollViewReader`; each item's `anchor` must match a section `title`
/// (which `HudSettingsSection` already uses as `.id`).
///
/// iOS-only: the capsule strip is the iOS settings affordance. macOS settings
/// surfaces use sidebar/list navigation, which is already covered by the chrome.
public struct HudSettingsQuickNav: View {
    public struct Item: Identifiable {
        public let id: String
        public let icon: String
        public let label: String
        public let anchor: String

        public init(icon: String, label: String, anchor: String) {
            self.id = anchor
            self.icon = icon
            self.label = label
            self.anchor = anchor
        }
    }

    public let items: [Item]
    public let proxy: ScrollViewProxy

    public init(items: [Item], proxy: ScrollViewProxy) {
        self.items = items
        self.proxy = proxy
    }

    public var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: HudSpacing.md) {
                ForEach(items) { item in
                    Button {
                        withAnimation(.easeInOut(duration: 0.3)) {
                            proxy.scrollTo(item.anchor, anchor: .top)
                        }
                    } label: {
                        HStack(spacing: HudSpacing.sm) {
                            Image(systemName: item.icon)
                                .font(.system(size: 11, weight: .medium))
                            Text(item.label)
                                .font(HudFont.ui(HudTextSize.sm, weight: .medium))
                        }
                        .foregroundStyle(HudPalette.muted)
                        .padding(.horizontal, HudSpacing.xl)
                        .padding(.vertical, 7)
                        .background(Capsule().fill(HudPalette.surface))
                        .overlay(Capsule().stroke(HudHairline.standard, lineWidth: 0.5))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, HudSpacing.xl)
        }
    }
}
#endif
