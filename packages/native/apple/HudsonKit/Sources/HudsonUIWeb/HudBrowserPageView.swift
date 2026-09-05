import SwiftUI
import WebKit

/// Hosts the one platform web view owned by `HudBrowser`. The representable
/// deliberately does not tear the view down when the pane closes: navigation,
/// scroll position, and history are workspace state and must survive reopening.
#if os(macOS)
struct HudBrowserPageView: NSViewRepresentable {
    let browser: HudBrowser

    init(_ browser: HudBrowser) {
        self.browser = browser
    }

    func makeNSView(context: Context) -> WKWebView {
        browser.platformView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {}
}
#elseif os(iOS)
struct HudBrowserPageView: UIViewRepresentable {
    let browser: HudBrowser

    init(_ browser: HudBrowser) {
        self.browser = browser
    }

    func makeUIView(context: Context) -> WKWebView {
        browser.platformView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}
}
#endif
