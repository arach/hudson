import Foundation
import os
import SwiftUI
import WebKit

private let codeMirrorLogger = Logger(subsystem: "HudsonKit", category: "CodeMirrorWebView")

/// Document payload for the bundled CodeMirror editor.
public struct HudCodeMirrorDocument: Codable, Equatable, Sendable {
    public var id: String
    public var title: String?
    public var path: String?
    public var language: String?
    public var text: String
    public var readOnly: Bool
    public var tintHex: String
    /// When true, the bundled HTML header is hidden because native chrome owns it.
    public var embedded: Bool
    /// Host-owned open counter; native only re-pushes when this changes.
    public var revision: UInt64

    public init(
        id: String,
        title: String? = nil,
        path: String? = nil,
        language: String? = nil,
        text: String,
        readOnly: Bool = false,
        tintHex: String = "#5eead4",
        embedded: Bool = false,
        revision: UInt64 = 0
    ) {
        self.id = id
        self.title = title
        self.path = path
        self.language = language
        self.text = text
        self.readOnly = readOnly
        self.tintHex = tintHex
        self.embedded = embedded
        self.revision = revision
    }
}

public enum HudCodeMirrorWebBundle {
    public static let messageHandlerName = "hudsonCodeMirror"

    public static var indexURL: URL? {
        Bundle.module.url(
            forResource: "index",
            withExtension: "html",
            subdirectory: "HudsonCodeMirror"
        )
        ?? Bundle.module.url(forResource: "index", withExtension: "html")
    }

    public static var editorScriptURL: URL? {
        guard let indexURL else { return nil }
        let named = indexURL.deletingLastPathComponent().appendingPathComponent("editor.js")
        if FileManager.default.fileExists(atPath: named.path) {
            return named
        }
        return Bundle.module.url(forResource: "editor", withExtension: "js")
    }

    public static var editorScriptSource: String? {
        guard let editorScriptURL else { return nil }
        return try? String(contentsOf: editorScriptURL, encoding: .utf8)
    }

    /// HTML shell without the external script tag. Pair with `editorScriptSource`
    /// injected via `WKUserScript` — WKWebView won't fetch `./editor.js` from
    /// `loadHTMLString` pages.
    public static func shellPageHTML() -> String? {
        guard let indexURL,
              let html = try? String(contentsOf: indexURL, encoding: .utf8)
        else { return nil }

        let markers = [
            "<script src=\"./editor.js\"></script>",
            "<script src='./editor.js'></script>",
        ]
        var shell = html
        for marker in markers {
            shell = shell.replacingOccurrences(of: marker, with: "")
        }
        return shell
    }

    /// Fallback when user-script injection is unavailable in tests.
    public static func inlinedPageHTML() -> String? {
        guard let shell = shellPageHTML(),
              let script = editorScriptSource
        else { return shellPageHTML() }

        let inlined = script.replacingOccurrences(of: "</script>", with: "<\\/script>")
        return shell.replacingOccurrences(
            of: "</body>",
            with: "<script>\(inlined)</script></body>"
        )
    }

    public static func configuration(
        handler: WKScriptMessageHandler,
        injectBundledScript: Bool = false
    ) -> WKWebViewConfiguration {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.userContentController.add(handler, name: messageHandlerName)
        if injectBundledScript, let script = editorScriptSource {
            let userScript = WKUserScript(
                source: script,
                injectionTime: .atDocumentEnd,
                forMainFrameOnly: true
            )
            configuration.userContentController.addUserScript(userScript)
        }
        return configuration
    }

    public static func tearDown(_ webView: WKWebView) {
        webView.stopLoading()
        webView.navigationDelegate = nil
        webView.uiDelegate = nil
        webView.configuration.userContentController.removeScriptMessageHandler(
            forName: messageHandlerName
        )
        webView.configuration.userContentController.removeAllUserScripts()
        webView.loadHTMLString(
            "<!doctype html><meta charset='utf-8'><body style='background:#0a0f12'></body>",
            baseURL: nil
        )
    }
}

private struct HudCodeMirrorSaveResult: Codable {
    var id: String?
    var success: Bool
    var text: String?
    var error: String?
}

#if os(iOS)
public struct HudCodeMirrorWebView: UIViewRepresentable {
    public let document: HudCodeMirrorDocument
    public let onChange: (String) -> Void
    public let onSave: (String) throws -> Void
    public let onBridgeState: (String) -> Void

    public init(
        document: HudCodeMirrorDocument,
        onChange: @escaping (String) -> Void = { _ in },
        onSave: @escaping (String) throws -> Void = { _ in },
        onBridgeState: @escaping (String) -> Void = { _ in }
    ) {
        self.document = document
        self.onChange = onChange
        self.onSave = onSave
        self.onBridgeState = onBridgeState
    }

    public func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView(
            frame: .zero,
            configuration: HudCodeMirrorWebBundle.configuration(handler: context.coordinator)
        )
        webView.navigationDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        context.coordinator.attach(to: webView)
        loadBundle(into: webView)
        return webView
    }

    public func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.attach(to: webView)
        context.coordinator.document = document
        context.coordinator.onChange = onChange
        context.coordinator.onSave = onSave
        context.coordinator.onBridgeState = onBridgeState
        context.coordinator.renderDocumentIfReady(in: webView)
    }

    public static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        coordinator.tearDown()
        HudCodeMirrorWebBundle.tearDown(webView)
    }

    public func makeCoordinator() -> Coordinator {
        Coordinator(
            document: document,
            onChange: onChange,
            onSave: onSave,
            onBridgeState: onBridgeState
        )
    }
}
#elseif os(macOS)
public struct HudCodeMirrorWebView: NSViewRepresentable {
    final class Container: NSView {
        let webView: WKWebView

        init(webView: WKWebView) {
            self.webView = webView
            super.init(frame: .zero)
            webView.autoresizingMask = [.width, .height]
            addSubview(webView)
        }

        override func layout() {
            super.layout()
            webView.frame = bounds
        }

        @available(*, unavailable)
        required init?(coder: NSCoder) {
            nil
        }
    }
    public let document: HudCodeMirrorDocument
    public let onChange: (String) -> Void
    public let onSave: (String) throws -> Void
    public let onBridgeState: (String) -> Void

    public init(
        document: HudCodeMirrorDocument,
        onChange: @escaping (String) -> Void = { _ in },
        onSave: @escaping (String) throws -> Void = { _ in },
        onBridgeState: @escaping (String) -> Void = { _ in }
    ) {
        self.document = document
        self.onChange = onChange
        self.onSave = onSave
        self.onBridgeState = onBridgeState
    }

    public func makeNSView(context: Context) -> NSView {
        let webView = WKWebView(
            frame: .zero,
            configuration: HudCodeMirrorWebBundle.configuration(handler: context.coordinator)
        )
        webView.navigationDelegate = context.coordinator
        if #available(macOS 13.3, *) {
            webView.isInspectable = true
        }
        context.coordinator.attach(to: webView)
        loadBundle(into: webView)
        return Container(webView: webView)
    }

    public func updateNSView(_ nsView: NSView, context: Context) {
        guard let container = nsView as? Container else { return }
        context.coordinator.attach(to: container.webView)
        context.coordinator.document = document
        context.coordinator.onChange = onChange
        context.coordinator.onSave = onSave
        context.coordinator.onBridgeState = onBridgeState
        context.coordinator.renderDocumentIfReady(in: container.webView)
    }

    public static func dismantleNSView(_ nsView: NSView, coordinator: Coordinator) {
        guard let container = nsView as? Container else { return }
        coordinator.tearDown()
        HudCodeMirrorWebBundle.tearDown(container.webView)
    }

    public func makeCoordinator() -> Coordinator {
        Coordinator(
            document: document,
            onChange: onChange,
            onSave: onSave,
            onBridgeState: onBridgeState
        )
    }
}
#endif

extension HudCodeMirrorWebView {
    public final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        var document: HudCodeMirrorDocument
        var onChange: (String) -> Void
        var onSave: (String) throws -> Void
        var onBridgeState: (String) -> Void
        private weak var webView: WKWebView?
        private var isReady = false
        private var renderedDocument: HudCodeMirrorDocument?
        private var renderedRevision: UInt64?
        private var isTornDown = false
        private var pendingDeliveryToken: UInt64 = 0
        private let encoder = JSONEncoder()

        func attach(to webView: WKWebView) {
            self.webView = webView
        }

        public init(
            document: HudCodeMirrorDocument,
            onChange: @escaping (String) -> Void,
            onSave: @escaping (String) throws -> Void,
            onBridgeState: @escaping (String) -> Void = { _ in }
        ) {
            self.document = document
            self.onChange = onChange
            self.onSave = onSave
            self.onBridgeState = onBridgeState
        }

        public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            guard !isTornDown else { return }
            reportBridgeState("loading")
            waitForEditorAPI(in: webView, attempt: 0)
        }

        public func webView(
            _ webView: WKWebView,
            didFail navigation: WKNavigation!,
            withError error: Error
        ) {
            guard !isTornDown else { return }
            reportBridgeState("nav-failed: \(error.localizedDescription)")
            codeMirrorLogger.error("navigation failed: \(error.localizedDescription, privacy: .public)")
        }

        public func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            guard !isTornDown else { return }
            reportBridgeState("load-failed: \(error.localizedDescription)")
            codeMirrorLogger.error("provisional navigation failed: \(error.localizedDescription, privacy: .public)")
        }

        public func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            guard !isTornDown else { return }
            guard message.name == HudCodeMirrorWebBundle.messageHandlerName,
                  let body = message.body as? [String: Any],
                  let type = body["type"] as? String
            else { return }

            switch type {
            case "ready":
                if let webView = webView ?? message.webView {
                    markReady(in: webView)
                }
            case "change":
                guard let text = body["text"] as? String else { return }
                guard document.id == renderedDocument?.id else { return }
                onChange(text)
            case "save":
                guard let text = body["text"] as? String else { return }
                let id = body["id"] as? String
                do {
                    try onSave(text)
                    if let webView = message.webView {
                        renderSaveResult(
                            HudCodeMirrorSaveResult(
                                id: id,
                                success: true,
                                text: text,
                                error: nil
                            ),
                            in: webView
                        )
                    }
                } catch {
                    if let webView = message.webView {
                        renderSaveResult(
                            HudCodeMirrorSaveResult(
                                id: id,
                                success: false,
                                text: nil,
                                error: error.localizedDescription
                            ),
                            in: webView
                        )
                    }
                }
            default:
                break
            }
        }

        func renderDocumentIfReady(in webView: WKWebView, force: Bool = false) {
            guard !isTornDown else { return }
            guard isReady else { return }
            guard force || shouldPushDocument() else { return }
            guard let data = try? encoder.encode(document) else {
                reportBridgeState("encode-failed")
                return
            }

            pendingDeliveryToken &+= 1
            let deliveryToken = pendingDeliveryToken
            deliverPayload(
                function: "setDocument",
                data: data,
                matching: document,
                deliveryToken: deliveryToken,
                in: webView
            )
        }

        private func shouldPushDocument() -> Bool {
            guard let renderedDocument else { return true }
            if renderedDocument.id != document.id { return true }
            if renderedRevision != document.revision { return true }
            if renderedDocument.readOnly != document.readOnly { return true }
            if renderedDocument.language != document.language { return true }
            if renderedDocument.tintHex != document.tintHex { return true }
            if renderedDocument.embedded != document.embedded { return true }
            return false
        }

        private func markReady(in webView: WKWebView) {
            guard !isReady else {
                renderDocumentIfReady(in: webView, force: true)
                return
            }
            isReady = true
            reportBridgeState("ready")
            renderDocumentIfReady(in: webView, force: true)
        }

        private func waitForEditorAPI(in webView: WKWebView, attempt: Int) {
            webView.evaluateJavaScript("typeof window.__hudsonCodeMirror !== 'undefined'") { result, error in
                guard !self.isTornDown else { return }
                if (result as? Bool) == true {
                    self.markReady(in: webView)
                    return
                }
                if let error {
                    self.reportBridgeState("probe-error: \(error.localizedDescription)")
                    codeMirrorLogger.error("editor probe failed: \(error.localizedDescription, privacy: .public)")
                }
                guard attempt < 60 else {
                    self.reportBridgeState("timeout")
                    codeMirrorLogger.error("editor API never appeared")
                    return
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                    self.waitForEditorAPI(in: webView, attempt: attempt + 1)
                }
            }
        }

        private func reportBridgeState(_ state: String) {
            codeMirrorLogger.info("bridge: \(state, privacy: .public)")
            onBridgeState(state)
        }

        private func renderSaveResult(_ result: HudCodeMirrorSaveResult, in webView: WKWebView) {
            guard !isTornDown else { return }
            guard let data = try? encoder.encode(result) else { return }

            deliverPayload(
                function: "saveResult",
                data: data,
                matching: nil,
                in: webView
            )
        }

        private func deliverPayload(
            function: String,
            data: Data,
            matching document: HudCodeMirrorDocument?,
            deliveryToken: UInt64 = 0,
            in webView: WKWebView,
            attempt: Int = 0
        ) {
            let base64 = data.base64EncodedString()
            let script = """
            (function () {
              try {
                var payload = JSON.parse(atob('\(base64)'));
                if (!window.__hudsonCodeMirror) return 'missing-api';
                window.__hudsonCodeMirror.\(function)(payload);
                return 'ok';
              } catch (error) {
                return String(error);
              }
            })();
            """
            webView.evaluateJavaScript(script) { result, error in
                guard !self.isTornDown else { return }
                if function == "setDocument", deliveryToken != self.pendingDeliveryToken {
                    return
                }
                if let error {
                    if attempt < 2 {
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                            self.deliverPayload(
                                function: function,
                                data: data,
                                matching: document,
                                deliveryToken: deliveryToken,
                                in: webView,
                                attempt: attempt + 1
                            )
                        }
                        return
                    }
                    self.reportBridgeState("\(function)-error: \(error.localizedDescription)")
                    return
                }
                let status = result as? String ?? "unknown"
                guard status == "ok" else {
                    if attempt < 2 {
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                            self.deliverPayload(
                                function: function,
                                data: data,
                                matching: document,
                                deliveryToken: deliveryToken,
                                in: webView,
                                attempt: attempt + 1
                            )
                        }
                        return
                    }
                    self.reportBridgeState("\(function)-status: \(status)")
                    return
                }
                if function == "setDocument", let document {
                    self.renderedDocument = document
                    self.renderedRevision = document.revision
                    self.reportBridgeState("rendered")
                }
            }
        }

        func tearDown() {
            isTornDown = true
            isReady = false
            pendingDeliveryToken &+= 1
            webView = nil
            renderedDocument = nil
            renderedRevision = nil
            onChange = { _ in }
            onSave = { _ in }
            onBridgeState = { _ in }
        }
    }
}

private func loadBundle(into webView: WKWebView) {
    if let indexURL = HudCodeMirrorWebBundle.indexURL {
        let bundleRoot = indexURL.deletingLastPathComponent()
        codeMirrorLogger.info("loading editor from \(indexURL.path, privacy: .public)")
        webView.loadFileURL(indexURL, allowingReadAccessTo: bundleRoot)
        return
    }

    if let html = HudCodeMirrorWebBundle.inlinedPageHTML() {
        codeMirrorLogger.warning("editor index missing; using inlined HTML fallback")
        webView.loadHTMLString(html, baseURL: nil)
        return
    }

    codeMirrorLogger.error("editor bundle missing")
    webView.loadHTMLString(
        "<html><body style='background:#0a0f12;color:#94a3b8;font:12px monospace'>Hudson CodeMirror bundle missing.</body></html>",
        baseURL: nil
    )
}