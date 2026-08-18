import SwiftUI
import WebKit

/// A browser column: a chrome rail, a loading hairline, and the page.
///
/// Styling is deliberately thin — semantic colours and materials only, no
/// palette of its own — because the hosts that embed this each have a theme
/// and a browser pane that ignores it looks pasted on. Hosts tint through the
/// usual environment (`.tint`, `.foregroundStyle`) and put their own controls
/// in `accessory`, which is where "open in the real browser" and "close the
/// pane" belong: those are decisions about the *host's* layout, not about
/// browsing.
public struct HudBrowserPane<Accessory: View>: View {
    private let browser: HudBrowser
    private let accessory: Accessory

    public init(_ browser: HudBrowser, @ViewBuilder accessory: () -> Accessory) {
        self.browser = browser
        self.accessory = accessory()
    }

    public var body: some View {
        VStack(spacing: 0) {
            chrome
            Divider()
            ZStack(alignment: .top) {
                WebView(browser.page)
                progressHairline
            }
        }
        .background(.background)
    }

    private var chrome: some View {
        HStack(spacing: 8) {
            control("chevron.left", "Back", enabled: browser.canGoBack) { browser.goBack() }
            control("chevron.right", "Forward", enabled: browser.canGoForward) { browser.goForward() }

            if browser.isLoading {
                control("xmark", "Stop") { browser.stop() }
            } else {
                control("arrow.clockwise", "Reload", enabled: browser.url != nil) { browser.reload() }
            }

            caption

            Spacer(minLength: 8)

            accessory
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .background(.bar)
    }

    /// Host first, title underneath. The host is the part that answers "where
    /// did this link actually take me", which is the question a pane opened
    /// from someone else's document most needs to answer.
    @ViewBuilder
    private var caption: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(browser.displayHost ?? "—")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.primary)

            if let failure = browser.failure {
                Text(failure)
                    .font(.system(size: 10))
                    .foregroundStyle(.red)
            } else if !browser.title.isEmpty {
                Text(browser.title)
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
            }
        }
        .lineLimit(1)
        .truncationMode(.tail)
        .padding(.leading, 4)
    }

    @ViewBuilder
    private var progressHairline: some View {
        if browser.isLoading {
            GeometryReader { geometry in
                Rectangle()
                    .fill(.tint)
                    .frame(width: geometry.size.width * browser.progress)
            }
            .frame(height: 2)
            .animation(.linear(duration: 0.15), value: browser.progress)
            .transition(.opacity)
        }
    }

    private func control(
        _ symbol: String,
        _ label: String,
        enabled: Bool = true,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 11, weight: .semibold))
                .frame(width: 20, height: 18)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .opacity(enabled ? 1 : 0.3)
        .help(label)
        .accessibilityLabel(label)
    }
}

extension HudBrowserPane where Accessory == EmptyView {
    public init(_ browser: HudBrowser) {
        self.init(browser) { EmptyView() }
    }
}
