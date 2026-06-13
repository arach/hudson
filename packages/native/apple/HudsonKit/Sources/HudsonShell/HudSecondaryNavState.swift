import Combine
import CoreGraphics
import Foundation

/// Collapse state for `HudSecondaryNav`.
///
/// Uses `ObservableObject` instead of `@Observable` — the Observation macro's
/// synthesized `columnWidth` setter recursed infinitely when resize drag ended.
@MainActor
public final class HudSecondaryNavState: ObservableObject {
    public enum RenderMode: Equatable, Sendable {
        case compact
        case expanded
    }

    @Published public private(set) var iconsOnly: Bool
    @Published public private(set) var columnWidth: CGFloat

    private let iconsOnlyStorageKey: String
    private let columnWidthStorageKey: String

    public var renderMode: RenderMode { iconsOnly ? .compact : .expanded }
    public var isCompact: Bool { iconsOnly }
    public var labelsVisible: Bool { !iconsOnly }
    public var sectionHeadersVisible: Bool { !iconsOnly }

    public var layoutWidth: CGFloat {
        isCompact ? HudSecondaryNavLayout.compactWidth : columnWidth
    }

    public var desiredColumnWidth: (min: CGFloat, ideal: CGFloat, max: CGFloat) {
        if isCompact {
            return HudSecondaryNavLayout.compactColumnWidth
        }
        return (HudSecondaryNavLayout.minExpandedWidth, columnWidth, HudSecondaryNavLayout.maxExpandedWidth)
    }

    public init(
        storageKey: String = "hudson.settings.secondaryNav",
        iconsOnly: Bool? = nil,
        columnWidth: CGFloat? = nil
    ) {
        self.iconsOnlyStorageKey = "\(storageKey).iconsOnly"
        self.columnWidthStorageKey = "\(storageKey).columnWidth"

        if let iconsOnly {
            self.iconsOnly = iconsOnly
        } else if UserDefaults.standard.object(forKey: iconsOnlyStorageKey) != nil {
            self.iconsOnly = UserDefaults.standard.bool(forKey: iconsOnlyStorageKey)
        } else {
            self.iconsOnly = false
        }

        if let columnWidth {
            self.columnWidth = Self.clampedExpandedWidth(columnWidth)
        } else if UserDefaults.standard.object(forKey: columnWidthStorageKey) != nil {
            self.columnWidth = Self.clampedExpandedWidth(
                CGFloat(UserDefaults.standard.double(forKey: columnWidthStorageKey))
            )
        } else {
            self.columnWidth = HudSecondaryNavLayout.defaultExpandedWidth
        }
    }

    public func toggle() {
        setCompact(!iconsOnly)
    }

    public func setCompact(_ compact: Bool) {
        guard compact != iconsOnly else { return }
        iconsOnly = compact
        persist()
    }

    public func setColumnWidth(_ width: CGFloat) {
        guard width.isFinite else { return }
        let clamped = Self.clampedExpandedWidth(width)
        guard clamped != columnWidth else { return }
        columnWidth = clamped
        persist()
    }

    /// Ensures the column is visible when a settings workspace is presented.
    public func prepareForPresentation() {
        if isCompact {
            setCompact(false)
        }
    }

    private func persist() {
        UserDefaults.standard.set(iconsOnly, forKey: iconsOnlyStorageKey)
        UserDefaults.standard.set(Double(columnWidth), forKey: columnWidthStorageKey)
    }

    private static func clampedExpandedWidth(_ width: CGFloat) -> CGFloat {
        guard width.isFinite else {
            return HudSecondaryNavLayout.defaultExpandedWidth
        }
        return min(
            HudSecondaryNavLayout.maxExpandedWidth,
            max(HudSecondaryNavLayout.minExpandedWidth, width)
        )
    }
}