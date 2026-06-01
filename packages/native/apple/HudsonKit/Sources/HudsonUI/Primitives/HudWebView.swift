import SwiftUI
import WebKit

public enum HudWebViewSource: Equatable, Sendable {
    case url(URL)
    case html(String, baseURL: URL?)
}

public struct HudWebViewState: Equatable, Sendable {
    public var title: String?
    public var url: URL?
    public var isLoading: Bool
    public var estimatedProgress: Double
    public var canGoBack: Bool
    public var canGoForward: Bool
    public var errorMessage: String?

    public init(
        title: String? = nil,
        url: URL? = nil,
        isLoading: Bool = false,
        estimatedProgress: Double = 0,
        canGoBack: Bool = false,
        canGoForward: Bool = false,
        errorMessage: String? = nil
    ) {
        self.title = title
        self.url = url
        self.isLoading = isLoading
        self.estimatedProgress = estimatedProgress
        self.canGoBack = canGoBack
        self.canGoForward = canGoForward
        self.errorMessage = errorMessage
    }
}

public struct HudWebViewConfiguration: Equatable, Sendable {
    public var allowsBackForwardNavigationGestures: Bool
    public var allowsJavaScript: Bool
    public var customUserAgent: String?
    public var usesNonPersistentDataStore: Bool
    public var isInspectable: Bool

    public init(
        allowsBackForwardNavigationGestures: Bool = true,
        allowsJavaScript: Bool = true,
        customUserAgent: String? = nil,
        usesNonPersistentDataStore: Bool = false,
        isInspectable: Bool = false
    ) {
        self.allowsBackForwardNavigationGestures = allowsBackForwardNavigationGestures
        self.allowsJavaScript = allowsJavaScript
        self.customUserAgent = customUserAgent
        self.usesNonPersistentDataStore = usesNonPersistentDataStore
        self.isInspectable = isInspectable
    }
}

#if os(iOS)
public struct HudWebView: UIViewRepresentable {
    private let source: HudWebViewSource
    @Binding private var state: HudWebViewState
    private let configuration: HudWebViewConfiguration

    public init(
        _ source: HudWebViewSource,
        state: Binding<HudWebViewState> = .constant(HudWebViewState()),
        configuration: HudWebViewConfiguration = HudWebViewConfiguration()
    ) {
        self.source = source
        self._state = state
        self.configuration = configuration
    }

    public func makeCoordinator() -> HudWebViewCoordinator {
        HudWebViewCoordinator(state: $state)
    }

    public func makeUIView(context: Context) -> WKWebView {
        let webView = HudWebViewPlatform.makeWebView(configuration)
        context.coordinator.attach(to: webView)
        context.coordinator.load(source, in: webView)
        return webView
    }

    public func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.state = $state
        HudWebViewPlatform.apply(configuration, to: webView)
        context.coordinator.load(source, in: webView)
    }

    public static func dismantleUIView(_ webView: WKWebView, coordinator: HudWebViewCoordinator) {
        coordinator.tearDown(webView)
    }
}
#elseif os(macOS)
public struct HudWebView: NSViewRepresentable {
    private let source: HudWebViewSource
    @Binding private var state: HudWebViewState
    private let configuration: HudWebViewConfiguration

    public init(
        _ source: HudWebViewSource,
        state: Binding<HudWebViewState> = .constant(HudWebViewState()),
        configuration: HudWebViewConfiguration = HudWebViewConfiguration()
    ) {
        self.source = source
        self._state = state
        self.configuration = configuration
    }

    public func makeCoordinator() -> HudWebViewCoordinator {
        HudWebViewCoordinator(state: $state)
    }

    public func makeNSView(context: Context) -> WKWebView {
        let webView = HudWebViewPlatform.makeWebView(configuration)
        context.coordinator.attach(to: webView)
        context.coordinator.load(source, in: webView)
        return webView
    }

    public func updateNSView(_ webView: WKWebView, context: Context) {
        context.coordinator.state = $state
        HudWebViewPlatform.apply(configuration, to: webView)
        context.coordinator.load(source, in: webView)
    }

    public static func dismantleNSView(_ webView: WKWebView, coordinator: HudWebViewCoordinator) {
        coordinator.tearDown(webView)
    }
}
#endif

public final class HudWebViewCoordinator: NSObject, WKNavigationDelegate {
    var state: Binding<HudWebViewState>
    private var lastSource: HudWebViewSource?
    private var progressObservation: NSKeyValueObservation?
    private var titleObservation: NSKeyValueObservation?
    private var urlObservation: NSKeyValueObservation?
    private var loadingObservation: NSKeyValueObservation?

    init(state: Binding<HudWebViewState>) {
        self.state = state
    }

    func attach(to webView: WKWebView) {
        webView.navigationDelegate = self
        observe(webView)
        publish(webView)
    }

    func load(_ source: HudWebViewSource, in webView: WKWebView) {
        guard source != lastSource else { return }
        lastSource = source
        state.wrappedValue.errorMessage = nil

        switch source {
        case .url(let url):
            webView.load(URLRequest(url: url))
        case .html(let html, let baseURL):
            webView.loadHTMLString(html, baseURL: baseURL)
        }
    }

    func tearDown(_ webView: WKWebView) {
        progressObservation?.invalidate()
        titleObservation?.invalidate()
        urlObservation?.invalidate()
        loadingObservation?.invalidate()
        progressObservation = nil
        titleObservation = nil
        urlObservation = nil
        loadingObservation = nil
        webView.stopLoading()
        webView.navigationDelegate = nil
        webView.uiDelegate = nil
        webView.loadHTMLString("", baseURL: nil)
        lastSource = nil
    }

    public func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        publish(webView, loading: true, errorMessage: nil)
    }

    public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        publish(webView, loading: false, errorMessage: nil)
    }

    public func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        publish(webView, loading: false, errorMessage: error.localizedDescription)
    }

    public func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        publish(webView, loading: false, errorMessage: error.localizedDescription)
    }

    private func observe(_ webView: WKWebView) {
        progressObservation = webView.observe(\.estimatedProgress, options: [.new]) { [weak self, weak webView] _, _ in
            guard let webView else { return }
            Task { @MainActor in self?.publish(webView) }
        }
        titleObservation = webView.observe(\.title, options: [.new]) { [weak self, weak webView] _, _ in
            guard let webView else { return }
            Task { @MainActor in self?.publish(webView) }
        }
        urlObservation = webView.observe(\.url, options: [.new]) { [weak self, weak webView] _, _ in
            guard let webView else { return }
            Task { @MainActor in self?.publish(webView) }
        }
        loadingObservation = webView.observe(\.isLoading, options: [.new]) { [weak self, weak webView] _, _ in
            guard let webView else { return }
            Task { @MainActor in self?.publish(webView) }
        }
    }

    @MainActor
    private func publish(_ webView: WKWebView, loading: Bool? = nil, errorMessage: String? = nil) {
        state.wrappedValue = HudWebViewState(
            title: webView.title,
            url: webView.url,
            isLoading: loading ?? webView.isLoading,
            estimatedProgress: webView.estimatedProgress,
            canGoBack: webView.canGoBack,
            canGoForward: webView.canGoForward,
            errorMessage: errorMessage ?? state.wrappedValue.errorMessage
        )
    }
}

private enum HudWebViewPlatform {
    static func makeWebView(_ configuration: HudWebViewConfiguration) -> WKWebView {
        let webConfiguration = WKWebViewConfiguration()
        webConfiguration.defaultWebpagePreferences.allowsContentJavaScript = configuration.allowsJavaScript
        if configuration.usesNonPersistentDataStore {
            webConfiguration.websiteDataStore = .nonPersistent()
        }

        let webView = WKWebView(frame: .zero, configuration: webConfiguration)
        apply(configuration, to: webView)
        return webView
    }

    static func apply(_ configuration: HudWebViewConfiguration, to webView: WKWebView) {
        webView.allowsBackForwardNavigationGestures = configuration.allowsBackForwardNavigationGestures
        webView.customUserAgent = configuration.customUserAgent
        #if os(iOS)
        webView.scrollView.backgroundColor = .clear
        webView.isOpaque = false
        #elseif os(macOS)
        webView.setValue(false, forKey: "drawsBackground")
        #endif
        if #available(iOS 16.4, macOS 13.3, *) {
            webView.isInspectable = configuration.isInspectable
        }
    }
}
