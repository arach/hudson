import Foundation
import HudsonUI
import Observation

/// Chooses how a phone shell presents route-published complications.
///
/// `.alwaysVisible` is the historical behavior. `.summonOnDemand` keeps the
/// chrome in the shell: a compact pivot summons the active route's five slots,
/// and the shell dismisses them after an action, an explicit dismissal, or an
/// optional idle timeout.
public enum HudPhoneComplicationsPresentation: Equatable, Sendable {
    case alwaysVisible
    case summonOnDemand(HudPhoneControlDeckPolicy = .standard)

    var controlDeckPolicy: HudPhoneControlDeckPolicy? {
        guard case let .summonOnDemand(policy) = self else { return nil }
        return policy
    }
}

/// Timing policy for a summon-on-demand phone control deck.
///
/// The shell suppresses the timeout while an assistive control mode is active
/// so controls do not disappear while a person is exploring them.
public struct HudPhoneControlDeckPolicy: Equatable, Sendable {
    public var idleTimeout: Duration?

    public init(idleTimeout: Duration? = .seconds(6)) {
        self.idleTimeout = idleTimeout
    }

    public static let standard = HudPhoneControlDeckPolicy()
}

enum HudPhoneControlDeckState: Equatable {
    case resting
    case expanded
}

enum HudPhoneControlDeckEvent: Equatable {
    case pivotTapped
    case dismissed
    case slotActivated
    case timedOut
    case complicationsChanged(isEmpty: Bool)
}

/// Pure transition policy. Keeping it separate from scheduling makes every
/// shell state transition deterministic in tests.
enum HudPhoneControlDeckReducer {
    static func reduce(
        state: HudPhoneControlDeckState,
        event: HudPhoneControlDeckEvent
    ) -> HudPhoneControlDeckState {
        switch (state, event) {
        case (.resting, .pivotTapped):
            return .expanded
        case (.resting, _):
            return .resting
        case (.expanded, .pivotTapped),
             (.expanded, .dismissed),
             (.expanded, .slotActivated),
             (.expanded, .timedOut),
             (.expanded, .complicationsChanged(isEmpty: true)):
            return .resting
        case (.expanded, .complicationsChanged(isEmpty: false)):
            return .expanded
        }
    }

    static func timeout(
        policy: HudPhoneControlDeckPolicy,
        assistiveControlEnabled: Bool,
        activeModePickerCount: Int
    ) -> Duration? {
        (assistiveControlEnabled || activeModePickerCount > 0) ? nil : policy.idleTimeout
    }
}

enum HudPhoneControlDeckEligibility {
    static func hasRenderableComplications(
        _ complications: HudPhoneComplications,
        style: HudPhoneComplicationsStyle
    ) -> Bool {
        let positions = renderablePositions(for: style)
        return complications.slots.keys.contains { positions.contains($0) }
    }

    static func hasBottomComplications(
        _ complications: HudPhoneComplications,
        style: HudPhoneComplicationsStyle
    ) -> Bool {
        let positions = bottomPositions(for: style)
        return complications.slots.keys.contains { positions.contains($0) }
    }

    private static func renderablePositions(
        for style: HudPhoneComplicationsStyle
    ) -> Set<HudPhoneComplications.Position> {
        switch style {
        case .tray, .scattered:
            return Set(HudPhoneComplications.Position.allCases)
        case .minimal:
            return [.center]
        }
    }

    private static func bottomPositions(
        for style: HudPhoneComplicationsStyle
    ) -> Set<HudPhoneComplications.Position> {
        switch style {
        case .tray, .scattered:
            return [.bottomLeft, .bottomRight, .center]
        case .minimal:
            return [.center]
        }
    }
}

/// Pure layout policy for the space occupied by shell-owned deck chrome.
/// Keeping this decision beside the state reducer makes the resting/expanded
/// contract deterministic without exposing shell state to product screens.
enum HudPhoneControlDeckLayoutPolicy {
    static func reservesTopLane(state: HudPhoneControlDeckState) -> Bool {
        state == .expanded
    }
}

/// Runtime owner for the shell's control-deck state. Products cannot mutate
/// this object; they only publish complications and supply their actions.
@MainActor
@Observable
final class HudPhoneControlDeckRuntime {
    private(set) var state: HudPhoneControlDeckState = .resting

    @ObservationIgnored private var policy: HudPhoneControlDeckPolicy?
    @ObservationIgnored private var timeoutTask: Task<Void, Never>?
    @ObservationIgnored private var assistiveControlEnabled = false
    @ObservationIgnored private(set) var activeModePickerPositions: Set<HudPhoneComplications.Position> = []

    init(policy: HudPhoneControlDeckPolicy?) {
        self.policy = policy
    }

    deinit {
        timeoutTask?.cancel()
    }

    func synchronize(hasComplications: Bool, assistiveControlEnabled: Bool) {
        let assistiveControlChanged = self.assistiveControlEnabled != assistiveControlEnabled
        self.assistiveControlEnabled = assistiveControlEnabled
        apply(
            .complicationsChanged(isEmpty: !hasComplications),
            refreshTimeout: assistiveControlChanged
        )
    }

    /// SwiftUI may preserve this `@State` object while the shell receives a
    /// new presentation value. Reset to a safe resting state so no prior
    /// timer or expanded chrome survives a policy change.
    func reconfigure(policy: HudPhoneControlDeckPolicy?) {
        timeoutTask?.cancel()
        timeoutTask = nil
        self.policy = policy
        activeModePickerPositions.removeAll()
        state = .resting
    }

    func pivotTapped() {
        apply(.pivotTapped)
    }

    func dismiss() {
        apply(.dismissed)
    }

    func slotActivated() {
        apply(.slotActivated)
    }

    /// A long-press mode picker is an active interaction, not idle time.
    /// Pause dismissal while it is open and start a fresh timeout after it
    /// closes if the deck is still expanded.
    func setModePickerPresented(
        _ isPresented: Bool,
        at position: HudPhoneComplications.Position
    ) {
        let changed: Bool
        if isPresented {
            changed = activeModePickerPositions.insert(position).inserted
        } else {
            changed = activeModePickerPositions.remove(position) != nil
        }
        guard changed else { return }
        rescheduleTimeout()
    }

    private func apply(_ event: HudPhoneControlDeckEvent, refreshTimeout: Bool = false) {
        guard policy != nil else { return }

        let previous = state
        state = HudPhoneControlDeckReducer.reduce(state: state, event: event)
        guard previous != state || refreshTimeout else { return }

        rescheduleTimeout()
    }

    private func rescheduleTimeout() {
        timeoutTask?.cancel()
        timeoutTask = nil

        guard state == .expanded, let policy,
              let timeout = HudPhoneControlDeckReducer.timeout(
                policy: policy,
                assistiveControlEnabled: assistiveControlEnabled,
                activeModePickerCount: activeModePickerPositions.count
              )
        else { return }

        timeoutTask = Task { @MainActor [weak self] in
            do {
                try await Task.sleep(for: timeout)
            } catch {
                return
            }
            guard !Task.isCancelled else { return }
            self?.apply(.timedOut)
        }
    }
}
