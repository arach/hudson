import SwiftUI
import HudsonUI

/// Chromeless CodeMirror editor backed by a warm WKWebView.
///
/// Explorer text surfaces use CodeMirror only — no native syntax-coloring
/// fallback while the bridge loads. Ships without cards or bundled HTML chrome
/// (`embedded: true`). Mount file title, path, and save controls in the host
/// above this view.
public struct HudCodeMirror: View {
    public var document: HudTextDocument?
    public var documentRevision: UInt64
    @Binding public var mode: HudTextDocumentMode

    public var emptyStateTitle: String
    public var emptyStateSubtitle: String
    public var emptyStateIcon: String
    public var tintHex: String
    public var onChange: (String) -> Void
    public var onSave: (String) throws -> Void

    @State private var bridgeReady = false

    public init(
        document: HudTextDocument?,
        documentRevision: UInt64 = 0,
        mode: Binding<HudTextDocumentMode>,
        emptyStateTitle: String = "No file selected",
        emptyStateSubtitle: String = "Choose a file from the file tree.",
        emptyStateIcon: String = "doc.text.magnifyingglass",
        tintHex: String = "#5eead4",
        onChange: @escaping (String) -> Void = { _ in },
        onSave: @escaping (String) throws -> Void = { _ in }
    ) {
        self.document = document
        self.documentRevision = documentRevision
        self._mode = mode
        self.emptyStateTitle = emptyStateTitle
        self.emptyStateSubtitle = emptyStateSubtitle
        self.emptyStateIcon = emptyStateIcon
        self.tintHex = tintHex
        self.onChange = onChange
        self.onSave = onSave
    }

    public var body: some View {
        ZStack(alignment: .topLeading) {
            HudCodeMirrorWebView(
                document: activeWebDocument,
                onChange: onChange,
                onSave: onSave,
                onBridgeState: { state in
                    if state == "rendered" {
                        bridgeReady = true
                    }
                }
            )
            .opacity(document != nil ? 1 : 0)
            .allowsHitTesting(document != nil)

            if document != nil, !bridgeReady {
                loadingSkeleton
            }

            if document == nil {
                HudEmptyState(
                    title: emptyStateTitle,
                    subtitle: emptyStateSubtitle,
                    icon: emptyStateIcon
                )
                .padding(HudSpacing.xxl)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .frame(minHeight: HudLayout.textDocumentPreviewHeight)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(HudSurface.base)
    }

    private var loadingSkeleton: some View {
        ZStack {
            HudSurface.base
            ProgressView()
                .controlSize(.small)
        }
        .allowsHitTesting(false)
    }

    private var activeWebDocument: HudCodeMirrorDocument {
        if let document {
            return HudCodeMirrorDocument(
                id: document.id,
                title: document.title,
                path: document.uri,
                language: document.language,
                text: document.value,
                readOnly: mode != .edit || document.isReadOnly,
                tintHex: tintHex,
                embedded: true,
                revision: documentRevision
            )
        }
        return HudCodeMirrorDocument(
            id: "code-mirror-idle",
            text: "",
            readOnly: true,
            embedded: true,
            revision: 0
        )
    }
}