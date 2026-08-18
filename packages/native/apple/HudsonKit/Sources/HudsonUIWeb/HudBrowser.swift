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
/// `WebPage` already publishes everything worth reading — url, title, loading,
/// progress, history — and it is `@Observable`, so this deliberately mirrors
/// none of it. Duplicated state is the part that goes stale. What it adds is
/// the two things `WebPage` leaves to every caller: navigation *commands* in
/// the vocabulary a chrome bar actually needs (`goBack`, not "load the last
/// item of the back list"), and a scheme policy applied before the load rather
/// than after it.
@MainActor
@Observable
public final class HudBrowser {
    public let page: WebPage

    /// The most recent failure, cleared by the next successful navigation.
    public private(set) var failure: String?

    private let decider: Decider

    public init(policy: HudBrowserPolicy = .web) {
        let decider = Decider(policy: policy)
        self.decider = decider
        self.page = WebPage(navigationDecider: decider)
    }

    public var policy: HudBrowserPolicy {
        get { decider.policy }
        set { decider.policy = newValue }
    }

    public var url: URL? { page.url }
    public var title: String { page.title }
    public var isLoading: Bool { page.isLoading }
    public var progress: Double { page.estimatedProgress }
    public var canGoBack: Bool { !page.backForwardList.backList.isEmpty }
    public var canGoForward: Bool { !page.backForwardList.forwardList.isEmpty }

    /// A short, human name for where we are — the host, without `www.`. What a
    /// tab strip shows before a title arrives.
    public var displayHost: String? {
        guard let host = page.url?.host() else { return nil }
        return host.hasPrefix("www.") ? String(host.dropFirst(4)) : host
    }

    /// Point the browser somewhere. Refused schemes never reach `WebPage`; they
    /// go to the policy's `onBlocked` so the host can hand them on.
    public func open(_ url: URL) {
        guard policy.allows(url) else {
            policy.onBlocked?(url, .host)
            return
        }
        failure = nil
        page.load(URLRequest(url: url))
    }

    public func goBack() {
        guard let item = page.backForwardList.backList.last else { return }
        page.load(item)
    }

    public func goForward() {
        guard let item = page.backForwardList.forwardList.first else { return }
        page.load(item)
    }

    public func reload() {
        failure = nil
        page.reload()
    }

    public func stop() {
        page.stopLoading()
    }

    public func note(failure message: String?) {
        failure = message
    }

    /// Holds the policy so it can change without rebuilding the `WebPage` — a
    /// new page would lose the history the chrome is showing.
    private final class Decider: WebPage.NavigationDeciding {
        var policy: HudBrowserPolicy

        init(policy: HudBrowserPolicy) {
            self.policy = policy
        }

        func decidePolicy(
            for action: WebPage.NavigationAction,
            preferences: inout WebPage.NavigationPreferences
        ) async -> WKNavigationActionPolicy {
            guard let url = action.request.url else { return .cancel }
            let policy = self.policy
            guard policy.allows(url) else {
                await MainActor.run { policy.onBlocked?(url, .page) }
                return .cancel
            }
            return .allow
        }
    }
}
