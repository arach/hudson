import SwiftUI
import HudsonUI

/// Chromeless CodeMirror editor backed by a warm WKWebView.
///
/// While CodeMirror loads or swaps files, native `HudCodeBlock` provides instant
/// syntax coloring. Ships without cards or bundled HTML chrome (`embedded: true`).
/// Mount file title, path, and save controls in the host above this view.
public struct HudCodeMirror: View {
    public var document: HudTextDocument?
    @Binding public var mode: HudTextDocumentMode

    public var emptyStateTitle: String
    public var emptyStateSubtitle: String
    public var emptyStateIcon: String
    public var tintHex: String
    public var onChange: (String) -> Void
    public var onSave: (String) throws -> Void

    @State private var editorReady = false

    public init(
        document: HudTextDocument?,
        mode: Binding<HudTextDocumentMode>,
        emptyStateTitle: String = "No file selected",
        emptyStateSubtitle: String = "Choose a file from the file tree.",
        emptyStateIcon: String = "doc.text.magnifyingglass",
        tintHex: String = "#5eead4",
        onChange: @escaping (String) -> Void = { _ in },
        onSave: @escaping (String) throws -> Void = { _ in }
    ) {
        self.document = document
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
            if let document, !editorReady {
                ScrollView {
                    HudCodeBlock(
                        language: document.language,
                        source: document.value
                    )
                    .frame(maxWidth: CGFloat.infinity, alignment: Alignment.leading)
                    .padding(HudSpacing.md)
                }
            }

            HudCodeMirrorWebView(
                document: activeWebDocument,
                onChange: onChange,
                onSave: onSave,
                onBridgeState: { state in
                    editorReady = state == "rendered"
                }
            )
            .opacity(document != nil && editorReady ? 1 : 0)
            .allowsHitTesting(document != nil && editorReady)

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
        .onChange(of: document?.id) { _, _ in
            editorReady = false
        }
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
                embedded: true
            )
        }
        return HudCodeMirrorDocument(
            id: "code-mirror-idle",
            text: "",
            readOnly: true,
            embedded: true
        )
    }
}
