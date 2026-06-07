import SwiftUI
import HudsonUI

#if os(iOS)
import PhotosUI
import UIKit

/// Photos library primitive that returns platform images to the host app.
///
/// Hudson owns the picker and decoding lifecycle; product apps decide how the
/// selected images enter their domain model or ingestion pipeline.
public struct HudPhotoPickerButton<Label: View>: View {
    private let maxSelectionCount: Int
    private let onComplete: ([UIImage]) -> Void
    private let onFailure: (String) -> Void
    private let label: () -> Label

    @State private var selectedItems: [PhotosPickerItem] = []
    @State private var isLoading = false

    public init(
        maxSelectionCount: Int = 1,
        onComplete: @escaping ([UIImage]) -> Void,
        onFailure: @escaping (String) -> Void,
        @ViewBuilder label: @escaping () -> Label
    ) {
        self.maxSelectionCount = max(1, maxSelectionCount)
        self.onComplete = onComplete
        self.onFailure = onFailure
        self.label = label
    }

    public var body: some View {
        PhotosPicker(
            selection: $selectedItems,
            maxSelectionCount: maxSelectionCount,
            matching: .images,
            preferredItemEncoding: .automatic
        ) {
            label()
        }
        .disabled(isLoading)
        .task(id: selectedItems) {
            await loadSelection(selectedItems)
        }
    }

    @MainActor
    private func loadSelection(_ items: [PhotosPickerItem]) async {
        guard !items.isEmpty else { return }
        isLoading = true
        defer {
            isLoading = false
            selectedItems = []
        }

        var images: [UIImage] = []
        var failures: [String] = []

        for item in items {
            do {
                guard let data = try await item.loadTransferable(type: Data.self) else {
                    failures.append("A selected photo could not be loaded.")
                    continue
                }
                guard let image = UIImage(data: data) else {
                    failures.append("A selected photo could not be decoded.")
                    continue
                }
                images.append(image)
            } catch {
                failures.append(error.localizedDescription)
            }
        }

        if images.isEmpty {
            onFailure(failures.first ?? "No photos were selected.")
        } else {
            onComplete(images)
        }
    }
}
#else
public struct HudPhotoPickerButton<Label: View>: View {
    private let label: () -> Label

    public init(
        maxSelectionCount _: Int = 1,
        onComplete _: @escaping ([Never]) -> Void,
        onFailure _: @escaping (String) -> Void,
        @ViewBuilder label: @escaping () -> Label
    ) {
        self.label = label
    }

    public var body: some View {
        Button(action: {}) {
            label()
        }
        .disabled(true)
        .help("Photo picking is supported on iOS only.")
    }
}
#endif
