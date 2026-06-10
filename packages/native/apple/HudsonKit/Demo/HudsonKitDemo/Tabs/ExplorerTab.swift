import SwiftUI
import HudsonUI
import HudsonUIWeb

struct ExplorerTab: View {
    @State private var model = HudFileExplorerModel(rootURL: DemoResources.defaultExplorerRoot)

    var body: some View {
        VStack(spacing: 0) {
            explorerToolbar
            if model.document != nil {
                HudDivider()
                fileToolbar
            }
            HudDivider()

            HudFileExplorer(model: model) { doc in
                do {
                    try model.save(doc)
                } catch {
                    model.loadError = "Cannot save \(doc.title)"
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var explorerToolbar: some View {
        HStack(spacing: HudSpacing.lg) {
            HudSectionLabel("Explorer", tint: HudPalette.statusInfo)

            HStack(spacing: HudSpacing.xs) {
                rootButton("Hudson", icon: "folder", root: DemoResources.repositoryRoot)
                rootButton("HudsonKit", icon: "folder.fill", root: DemoResources.kitRoot)
                rootButton("HudsonUI", icon: "square.stack.3d.up", root: DemoResources.hudsonUIRoot)
            }

            Spacer(minLength: HudSpacing.xl)

            Text(model.browser.rootURL.path)
                .font(HudFont.mono(HudTextSize.xxs))
                .foregroundStyle(HudPalette.dim)
                .lineLimit(1)
                .truncationMode(.middle)

            HudButton("Refresh", icon: "arrow.clockwise", style: .ghost) {
                model.browser.refresh()
            }
        }
        .padding(.horizontal, HudSpacing.xxl)
        .padding(.vertical, HudSpacing.lg)
    }

    @ViewBuilder
    private var fileToolbar: some View {
        if let document = model.document {
            HStack(spacing: HudSpacing.xl) {
                VStack(alignment: .leading, spacing: HudSpacing.xs) {
                    Text(document.title)
                        .font(HudFont.ui(HudTextSize.base, weight: .semibold))
                        .foregroundStyle(HudPalette.ink)
                        .lineLimit(1)

                    if let uri = document.uri {
                        Text(model.relativePath(for: uri))
                            .font(HudFont.mono(HudTextSize.xxs))
                            .foregroundStyle(HudPalette.dim)
                            .lineLimit(1)
                    }
                }

                Spacer(minLength: HudSpacing.xl)

                HudBadge(document.kind.label, tint: HudPalette.statusInfo)
                modePicker(for: document)

                HudButton("Save", icon: "square.and.arrow.down", style: .ghost) {
                    do {
                        try model.saveDocument()
                    } catch {
                        model.loadError = "Cannot save \(document.title)"
                    }
                }
                .disabled(model.documentMode != .edit || document.isReadOnly)
            }
            .padding(.horizontal, HudSpacing.xxl)
            .padding(.vertical, HudSpacing.lg)
            .background(HudSurface.chrome)
        }
    }

    private func rootButton(_ title: String, icon: String, root: URL) -> some View {
        let isActive = model.browser.rootURL.standardizedFileURL == root.standardizedFileURL
        return HudButton(title, icon: icon, style: isActive ? .secondary : .ghost) {
            model.setRoot(root)
        }
    }

    private func modePicker(for document: HudTextDocument) -> some View {
        HStack(spacing: HudSpacing.xs) {
            ForEach([HudTextDocumentMode.read, .edit]) { candidate in
                Button {
                    model.documentMode = candidate
                } label: {
                    Text(candidate.label)
                        .font(HudFont.mono(HudTextSize.xxs, weight: .semibold))
                        .foregroundStyle(model.documentMode == candidate ? HudPalette.ink : HudPalette.muted)
                        .padding(.horizontal, HudSpacing.md)
                        .frame(height: HudLayout.textDocumentModeButtonHeight)
                        .background(
                            RoundedRectangle(cornerRadius: HudRadius.tight)
                                .fill(model.documentMode == candidate ? HudSurface.tintFill(HudPalette.statusInfo) : .clear)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: HudRadius.tight)
                                .stroke(model.documentMode == candidate ? HudSurface.tintBorder(HudPalette.statusInfo) : HudHairline.subtle, lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
                .disabled(candidate == .edit && document.isReadOnly)
            }
        }
        .padding(HudSpacing.xs)
        .background(RoundedRectangle(cornerRadius: HudRadius.standard).fill(HudSurface.control))
        .overlay(RoundedRectangle(cornerRadius: HudRadius.standard).stroke(HudHairline.subtle, lineWidth: 1))
    }
}