import SwiftUI

enum HudReadableSheetPresentation: Equatable, Sendable {
    case standard
    case accessibility
}

enum HudReadableSheetPolicy {
    static func presentation(for dynamicTypeSize: DynamicTypeSize) -> HudReadableSheetPresentation {
        dynamicTypeSize.isAccessibilitySize ? .accessibility : .standard
    }
}

private struct HudReadableSheetModifier: ViewModifier {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    @ViewBuilder
    func body(content: Content) -> some View {
        switch HudReadableSheetPolicy.presentation(for: dynamicTypeSize) {
        case .standard:
            content.presentationDetents([.medium, .large])
        case .accessibility:
            content.presentationDetents([.large])
        }
    }
}

extension View {
    /// Gives a content-heavy sheet a compact default presentation while
    /// guaranteeing the full-height detent at accessibility Dynamic Type sizes.
    /// Apply this to the root view presented by `.sheet`.
    public func hudReadableSheet() -> some View {
        modifier(HudReadableSheetModifier())
    }
}
