import Foundation

/// The notch's content model, kept free of UI and timers so hosts and tests
/// can drive it directly. The controller owns one and turns its answers into
/// presentation (peek, collapse, pulse).
public struct HudNotchStage: Equatable, Sendable {
    /// Most recent attention first.
    public private(set) var activities: [HudNotchActivity] = []
    /// The activity the expanded card shows. Follows attention; falls back to
    /// the oldest waiting activity, then the most recent one.
    public private(set) var focusedID: String?
    /// How many activities to keep. Ongoing ones are never evicted.
    public var capacity: Int
    /// Activities the person put away, by id, with the state each was in.
    /// Their sender's next posts in that same state stay off the stage; a new
    /// state (working to done, say) brings the activity back.
    public private(set) var putAway: [String: HudNotchActivityState] = [:]

    public init(capacity: Int = 8) {
        self.capacity = max(1, capacity)
    }

    /// What a change means for presentation.
    public struct Change: Equatable, Sendable {
        /// The notch should open to show this activity.
        public var wantsAttention: Bool
        /// The activity was new to the stage.
        public var isNew: Bool
        /// The state moved (for example working → waiting); hosts animate this.
        public var stateChanged: Bool
        /// The person put this activity away and it hasn't moved on: the
        /// stage kept it off.
        public var isPutAway: Bool = false
    }

    // MARK: Queries

    public var focused: HudNotchActivity? {
        if let focusedID, let match = activity(id: focusedID) { return match }
        return waiting.last ?? activities.first
    }

    /// Activities blocked on the person, oldest first.
    public var waiting: [HudNotchActivity] {
        activities.filter { $0.state == .waiting }.reversed()
    }

    public var working: [HudNotchActivity] {
        activities.filter { $0.state == .working }
    }

    /// The single activity the collapsed notch should reflect: waiting beats
    /// working, and nothing ongoing means a quiet notch.
    public var headline: HudNotchActivity? {
        waiting.first ?? working.first
    }

    public func activity(id: String) -> HudNotchActivity? {
        activities.first { $0.id == id }
    }

    // MARK: Mutations

    /// Add or update. Updates that only move progress or detail keep their
    /// place and do not ask for attention, so a working job can stream
    /// updates without re-opening the notch every time.
    @discardableResult
    public mutating func post(_ incoming: HudNotchActivity, now: Date = Date()) -> Change {
        var activity = incoming
        activity.updatedAt = now

        if let state = putAway[activity.id] {
            if state == activity.state {
                return Change(wantsAttention: false, isNew: false, stateChanged: false, isPutAway: true)
            }
            putAway[activity.id] = nil
        }

        guard let index = activities.firstIndex(where: { $0.id == activity.id }) else {
            activities.insert(activity, at: 0)
            focusedID = activity.id
            trim()
            return Change(wantsAttention: true, isNew: true, stateChanged: false)
        }

        let previous = activities[index]
        let stateChanged = previous.state != activity.state
        let newlyAsks = activity.asksForInput && !previous.asksForInput
        let retitled = previous.title != activity.title
        let wantsAttention = stateChanged || newlyAsks || retitled

        if wantsAttention {
            activities.remove(at: index)
            activities.insert(activity, at: 0)
            focusedID = activity.id
        } else {
            activities[index] = activity
        }
        return Change(wantsAttention: wantsAttention, isNew: false, stateChanged: stateChanged)
    }

    /// Removes an activity for the host. It also forgets that the person put
    /// it away, so the id is fresh again.
    @discardableResult
    public mutating func dismiss(id: String) -> HudNotchActivity? {
        putAway[id] = nil
        return remove(id: id)
    }

    /// The person put an activity away (the ×, a swipe up, Escape, Dismiss).
    /// It leaves the stage, and stays off while its sender keeps posting the
    /// same state.
    @discardableResult
    public mutating func putAway(id: String) -> HudNotchActivity? {
        guard let removed = remove(id: id) else { return nil }
        putAway[id] = removed.state
        return removed
    }

    private mutating func remove(id: String) -> HudNotchActivity? {
        guard let index = activities.firstIndex(where: { $0.id == id }) else { return nil }
        let removed = activities.remove(at: index)
        if focusedID == id { focusedID = nil }
        return removed
    }

    /// Records the person's answer locally: the activity stops asking and goes
    /// back to working until its sender posts the next state.
    @discardableResult
    public mutating func answer(_ reply: HudNotchReply, now: Date = Date()) -> HudNotchActivity? {
        guard let index = activities.firstIndex(where: { $0.id == reply.id }) else { return nil }
        var activity = activities[index]
        guard activity.state == .waiting else { return nil }

        let chosen = reply.choice.flatMap { id in activity.choices.first { $0.id == id }?.title }
        activity.detail = chosen.map { "You chose \($0)" } ?? (reply.text?.nonEmpty.map { "You replied: \($0)" } ?? "Answered")
        activity.state = .working
        activity.tone = .default(for: .working)
        activity.choices = []
        activity.replyPrompt = nil
        activity.updatedAt = now
        activities[index] = activity
        return activity
    }

    /// Moves focus to the next activity, for cycling through several.
    public mutating func focusNext() {
        guard activities.count > 1, let current = focused,
              let index = activities.firstIndex(where: { $0.id == current.id }) else { return }
        focusedID = activities[(index + 1) % activities.count].id
    }

    public mutating func clearSettled() {
        activities.removeAll { !$0.state.isOngoing }
        if let focusedID, activity(id: focusedID) == nil { self.focusedID = nil }
    }

    private mutating func trim() {
        while activities.count > capacity,
              let evict = activities.lastIndex(where: { !$0.state.isOngoing }) {
            let removed = activities.remove(at: evict)
            if focusedID == removed.id { focusedID = nil }
        }
    }
}
