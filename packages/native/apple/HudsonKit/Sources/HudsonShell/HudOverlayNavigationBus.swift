#if os(macOS)
import Combine
import Foundation

/// Main-actor action bus for overlay keyboard navigation.
///
/// Overlay panels often own their key monitor outside the SwiftUI view graph,
/// while the currently visible view owns row selection. This bus lets a shell
/// dispatch standard HUD navigation commands without knowing the active view's
/// model.
@MainActor
public final class HudOverlayNavigationBus: ObservableObject {
    private static let sharedStorage = HudOverlayNavigationBus()
    public static var shared: HudOverlayNavigationBus { sharedStorage }

    public var cycleNext: (() -> Void)?
    public var cyclePrev: (() -> Void)?
    public var jumpTop: (() -> Void)?
    public var jumpBottom: (() -> Void)?
    public var engageSelected: (() -> Void)?
    public var unengageSelected: (() -> Bool)?
    public var toggleFollow: (() -> Void)?

    public init() {}

    public func clear() {
        cycleNext = nil
        cyclePrev = nil
        jumpTop = nil
        jumpBottom = nil
        engageSelected = nil
        unengageSelected = nil
        toggleFollow = nil
    }
}
#endif
