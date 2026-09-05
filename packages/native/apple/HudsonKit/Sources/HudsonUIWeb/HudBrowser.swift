import SwiftUI
import WebKit

/// Where a navigation came from, carried so a host can decide differently for
/// a link a person clicked than for one a page redirected itself to.
public enum HudBrowserOrigin: Equatable, Sendable {
    /// The host asked for this page directly.
    case host
    /// Something inside the current page asked for it.
    case page
}

/// What a browser is allowed to load, and what happens to everything else.
///
/// The default is deliberately narrow. A pane like this is usually pointed at
/// links that came out of *content* — a PDF, a feed, a document someone else
/// wrote — and content is not trusted to name a scheme. `mailto:`, `tel:` and
/// friends are perfectly reasonable destinations, but they are the system's to
/// open, not an embedded web view's, so they arrive at `onBlocked` rather than
/// being silently swallowed.
public struct HudBrowserPolicy: Sendable {
    public var allowedSchemes: Set<String>
    /// Called when a navigation is refused. The host decides whether that means
    /// hand it to the system browser, show a notice, or drop it.
    public var onBlocked: (@MainActor @Sendable (URL, HudBrowserOrigin) -> Void)?

    public init(
        allowedSchemes: Set<String> = ["http", "https"],
        onBlocked: (@MainActor @Sendable (URL, HudBrowserOrigin) -> Void)? = nil
    ) {
        self.allowedSchemes = allowedSchemes
        self.onBlocked = onBlocked
    }

    public func allows(_ url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased() else { return false }
        return allowedSchemes.contains(scheme)
    }

    public static let web = HudBrowserPolicy()
}

/// A browsing surface a host can drive.
///
/// The browser owns one long-lived `WKWebView`: closing and reopening its pane
/// must preserve the page and history, and replacing its document must not
/// briefly attach one web session to two SwiftUI trees. WebKit state is mirrored
/// here only at the chrome boundary, where Observation needs stable values.
@MainActor
@Observable
public final class HudBrowser {
    /// The most recent failure, cleared by the next successful navigation.
    public private(set) var failure: String?
    public private(set) var url: URL?
    public private(set) var title = ""
    public private(set) var isLoading = false
    public private(set) var progress = 0.0
    public private(set) var canGoBack = false
    public private(set) var canGoForward = false

    @ObservationIgnored let platformView: WKWebView
    @ObservationIgnored private let driver: Driver

    public init(policy: HudBrowserPolicy = .web) {
        let driver = Driver(policy: policy)
        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.allowsBackForwardNavigationGestures = true

        self.driver = driver
        self.platformView = webView
        driver.browser = self
        driver.attach(to: webView)
        publish(webView)
    }

    public var policy: HudBrowserPolicy {
        get { driver.policy }
        set { driver.policy = newValue }
    }

    /// A short, human name for where we are — the host, without `www.`. What a
    /// tab strip shows before a title arrives.
    public var displayHost: String? {
        guard let host = url?.host() else { return nil }
        return host.hasPrefix("www.") ? String(host.dropFirst(4)) : host
    }

    /// Point the browser somewhere. Refused schemes never reach WebKit; they
    /// go to the policy's `onBlocked` so the host can hand them on.
    public func open(_ url: URL) {
        guard policy.allows(url) else {
            policy.onBlocked?(url, .host)
            return
        }
        failure = nil
        platformView.load(URLRequest(url: url))
    }

    public func goBack() {
        guard platformView.canGoBack else { return }
        failure = nil
        platformView.goBack()
    }

    public func goForward() {
        guard platformView.canGoForward else { return }
        failure = nil
        platformView.goForward()
    }

    public func reload() {
        guard platformView.url != nil else { return }
        failure = nil
        platformView.reload()
    }

    public func stop() {
        platformView.stopLoading()
        publish(platformView)
    }

    public func note(failure message: String?) {
        failure = message
    }

    fileprivate func publish(_ webView: WKWebView) {
        url = webView.url
        title = webView.title ?? ""
        isLoading = webView.isLoading
        progress = webView.estimatedProgress
        canGoBack = webView.canGoBack
        canGoForward = webView.canGoForward
    }

    /// Owns WebKit's imperative callbacks while the browser remains a small,
    /// observable command surface for SwiftUI.
    private final class Driver: NSObject, WKNavigationDelegate {
        var policy: HudBrowserPolicy
        weak var browser: HudBrowser?

        private var progressObservation: NSKeyValueObservation?
        private var titleObservation: NSKeyValueObservation?
        private var urlObservation: NSKeyValueObservation?
        private var loadingObservation: NSKeyValueObservation?

        init(policy: HudBrowserPolicy) {
            self.policy = policy
        }

        /// Schemes a sub-frame may use without being a *destination*.
        ///
        /// An ordinary page embeds `about:blank`, `data:` and `blob:` frames as
        /// part of rendering itself. Judging those by the same rule as a
        /// top-level navigation cancels them and breaks pages that have nothing
        /// wrong with them.
        private static let frameSchemes: Set<String> = ["about", "data", "blob"]

        func attach(to webView: WKWebView) {
            webView.navigationDelegate = self
            progressObservation = webView.observe(\.estimatedProgress, options: [.new]) { [weak self, weak webView] _, _ in
                guard let webView else { return }
                Task { @MainActor in self?.browser?.publish(webView) }
            }
            titleObservation = webView.observe(\.title, options: [.new]) { [weak self, weak webView] _, _ in
                guard let webView else { return }
                Task { @MainActor in self?.browser?.publish(webView) }
            }
            urlObservation = webView.observe(\.url, options: [.new]) { [weak self, weak webView] _, _ in
                guard let webView else { return }
                Task { @MainActor in self?.browser?.publish(webView) }
            }
            loadingObservation = webView.observe(\.isLoading, options: [.new]) { [weak self, weak webView] _, _ in
                guard let webView else { return }
                Task { @MainActor in self?.browser?.publish(webView) }
            }
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor action: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = action.request.url else {
                decisionHandler(.cancel)
                return
            }
            let policy = self.policy

            // The policy is about where the *reader* ends up, so it judges
            // top-level navigations. A sub-frame is part of how a page draws
            // itself: it may use the allowed schemes or the inert ones, and
            // nothing else — but it never reaches `onBlocked`, because a hidden
            // iframe must not be able to make the host act.
            let isMainFrame = action.targetFrame?.isMainFrame ?? true
            guard isMainFrame else {
                let scheme = url.scheme?.lowercased() ?? ""
                decisionHandler(policy.allows(url) || Self.frameSchemes.contains(scheme) ? .allow : .cancel)
                return
            }

            guard policy.allows(url) else {
                policy.onBlocked?(url, .page)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            browser?.failure = nil
            browser?.publish(webView)
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            fail(error, in: webView)
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            fail(error, in: webView)
        }

        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            browser?.failure = "Page stopped responding"
            browser?.publish(webView)
        }

        private func fail(_ error: Error, in webView: WKWebView) {
            let nsError = error as NSError
            if nsError.domain == NSURLErrorDomain, nsError.code == NSURLErrorCancelled {
                browser?.publish(webView)
                return
            }
            browser?.failure = error.localizedDescription
            browser?.publish(webView)
        }
    }
}
