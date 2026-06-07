import SwiftUI
import HudsonUI

#if os(iOS)
import UIKit
import VisionKit

/// Document camera primitive backed by VisionKit's page scanner.
///
/// This keeps the platform camera controller in HudsonUICapture while apps
/// decide how captured page images enter their own ingestion pipeline.
public struct HudDocumentScannerView: UIViewControllerRepresentable {
    private let onComplete: ([UIImage]) -> Void
    private let onFailure: (String) -> Void

    @Environment(\.dismiss) private var dismiss

    public init(
        onComplete: @escaping ([UIImage]) -> Void,
        onFailure: @escaping (String) -> Void
    ) {
        self.onComplete = onComplete
        self.onFailure = onFailure
    }

    public func makeCoordinator() -> Coordinator {
        Coordinator(
            onComplete: onComplete,
            onFailure: onFailure,
            dismiss: dismiss.callAsFunction
        )
    }

    public func makeUIViewController(context: Context) -> VNDocumentCameraViewController {
        let controller = VNDocumentCameraViewController()
        controller.delegate = context.coordinator
        return controller
    }

    public func updateUIViewController(_ uiViewController: VNDocumentCameraViewController, context: Context) {}

    public final class Coordinator: NSObject, VNDocumentCameraViewControllerDelegate {
        let onComplete: ([UIImage]) -> Void
        let onFailure: (String) -> Void
        let dismiss: () -> Void

        init(
            onComplete: @escaping ([UIImage]) -> Void,
            onFailure: @escaping (String) -> Void,
            dismiss: @escaping () -> Void
        ) {
            self.onComplete = onComplete
            self.onFailure = onFailure
            self.dismiss = dismiss
        }

        public func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
            dismiss()
        }

        public func documentCameraViewController(
            _ controller: VNDocumentCameraViewController,
            didFailWithError error: Error
        ) {
            onFailure(error.localizedDescription)
            dismiss()
        }

        public func documentCameraViewController(
            _ controller: VNDocumentCameraViewController,
            didFinishWith scan: VNDocumentCameraScan
        ) {
            guard scan.pageCount > 0 else {
                onFailure("No pages were captured.")
                dismiss()
                return
            }

            let images = (0..<scan.pageCount).map { scan.imageOfPage(at: $0) }
            onComplete(images)
            dismiss()
        }
    }
}
#else
public struct HudDocumentScannerView: View {
    public init(
        onComplete _: @escaping ([Never]) -> Void,
        onFailure _: @escaping (String) -> Void
    ) {}

    public var body: some View {
        HudEmptyState(
            title: "Document scanner unavailable",
            subtitle: "Document scanning is supported on iOS only.",
            icon: "doc.viewfinder"
        )
    }
}
#endif
