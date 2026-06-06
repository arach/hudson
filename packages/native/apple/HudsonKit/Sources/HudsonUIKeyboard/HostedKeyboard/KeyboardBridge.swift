//
//  KeyboardBridge.swift
//  HudsonUIKeyboard
//
//  Local persistence for the hosted keyboard: last-selected mode,
//  active layout, grid-density preset, and per-mode slot configuration.
//
//  Backed by UserDefaults. Defaults to `UserDefaults.standard`; pass a
//  suite name to share state with another process via a shared container.
//

import Foundation

/// Keys for persisted keyboard state.
public enum KeyboardBridgeKey: String {
    // Keyboard mode persistence
    case lastSelectedModeId = "keyboard.lastSelectedModeId"
    case lastSelectedModeAt = "keyboard.lastSelectedModeAt"
    // Grid density preset
    case gridPreset = "keyboard.gridPreset"
    // Keyboard haptic preference
    case hapticFeedbackEnabled = "keyboard.hapticFeedbackEnabled"
    // Keyboard mode enabled preference
    case keyboardModeEnabled = "keyboard.modeEnabled"
}

/// Local persistence layer for the hosted keyboard.
public final class KeyboardBridge {

    /// Shared instance backed by `UserDefaults.standard`.
    public static let shared = KeyboardBridge()

    private let defaults: UserDefaults?
    private let log = Log(.keyboard)

    /// Whether the backing store is accessible.
    public var isAvailable: Bool {
        return defaults != nil
    }

    /// Create a bridge backed by the given defaults suite.
    /// - Parameter suiteName: Optional `UserDefaults` suite name (e.g. a shared
    ///   App Group container). When `nil`, uses `UserDefaults.standard`.
    public init(suiteName: String? = nil) {
        if let suiteName, let suite = UserDefaults(suiteName: suiteName) {
            defaults = suite
        } else {
            defaults = UserDefaults.standard
        }
    }

    // MARK: - Active Layout Persistence

    /// Get the persisted active layout ID
    public func getActiveLayout() -> String? {
        return defaults?.string(forKey: "keyboard.activeLayout")
    }

    /// Persist the active layout ID
    public func setActiveLayout(_ layoutId: String) {
        defaults?.set(layoutId, forKey: "keyboard.activeLayout")
        log.info("Active layout persisted: \(layoutId)")
    }

    // MARK: - Model Warmth & Transcription Readiness

    /// Whether an external dictation/transcription model is loaded and warmed up.
    public func isModelWarm() -> Bool {
        return defaults?.bool(forKey: "keyboard.modelWarm") ?? false
    }

    /// Set model warmth status (called by the host when warmup completes).
    public func setModelWarm(_ warm: Bool) {
        defaults?.set(warm, forKey: "keyboard.modelWarm")
        log.debug("Model warm: \(warm)")
    }

    // MARK: - Slot Configuration (User Customizable)

    private func slotKey(_ slot: Int, forApp appId: String? = nil) -> String {
        if let appId = appId {
            return "keyboard.slot.\(slot).app.\(appId)"
        }
        return "keyboard.slot.\(slot)"
    }

    /// Get slot configuration (JSON data)
    /// - Parameters:
    ///   - slot: Slot number (1-12)
    ///   - appId: Optional app bundle ID for app-specific config
    /// - Returns: JSON data of SlotConfig, or nil if not configured
    public func getSlotConfig(_ slot: Int, forApp appId: String? = nil) -> Data? {
        return defaults?.data(forKey: slotKey(slot, forApp: appId))
    }

    /// Set slot configuration
    /// - Parameters:
    ///   - slot: Slot number (1-12)
    ///   - config: JSON-encoded SlotConfig data
    ///   - appId: Optional app bundle ID for app-specific config
    public func setSlotConfig(_ slot: Int, config: Data, forApp appId: String? = nil) {
        defaults?.set(config, forKey: slotKey(slot, forApp: appId))
        log.info("Slot \(slot) config updated\(appId != nil ? " for \(appId!)" : "")")
    }

    /// Clear slot configuration (revert to default)
    public func clearSlotConfig(_ slot: Int, forApp appId: String? = nil) {
        defaults?.removeObject(forKey: slotKey(slot, forApp: appId))
    }

    /// Get all configured app IDs that have custom slot configs
    public func getAppsWithCustomSlots() -> [String] {
        guard let defaults = defaults else { return [] }
        let allKeys = defaults.dictionaryRepresentation().keys
        var appIds = Set<String>()

        for key in allKeys where key.hasPrefix("keyboard.slot.") && key.contains(".app.") {
            // Extract app ID from key like "keyboard.slot.9.app.com.apple.mobilenotes"
            if let range = key.range(of: ".app.") {
                let appId = String(key[range.upperBound...])
                appIds.insert(appId)
            }
        }

        return Array(appIds).sorted()
    }

    // MARK: - Mode-Specific Slot Configuration

    private func modeSlotKey(_ slot: Int, forMode modeId: String) -> String {
        return "keyboard.mode.\(modeId).slot.\(slot)"
    }

    /// Get slot configuration for a specific mode (JSON data)
    /// - Parameters:
    ///   - slot: Slot number (1-12)
    ///   - modeId: Mode identifier (e.g., "shortcuts", "numbers", "symbols")
    /// - Returns: JSON data of SlotConfig, or nil if not configured
    public func getSlotConfig(_ slot: Int, forMode modeId: String) -> Data? {
        return defaults?.data(forKey: modeSlotKey(slot, forMode: modeId))
    }

    /// Set slot configuration for a specific mode
    /// - Parameters:
    ///   - slot: Slot number (1-12)
    ///   - config: JSON-encoded SlotConfig data
    ///   - modeId: Mode identifier (e.g., "shortcuts", "numbers", "symbols")
    public func setSlotConfig(_ slot: Int, config: Data, forMode modeId: String) {
        defaults?.set(config, forKey: modeSlotKey(slot, forMode: modeId))
        log.info("Slot \(slot) config updated for mode: \(modeId)")
    }

    /// Clear slot configuration for a specific mode (revert to default)
    public func clearSlotConfig(_ slot: Int, forMode modeId: String) {
        defaults?.removeObject(forKey: modeSlotKey(slot, forMode: modeId))
        log.info("Slot \(slot) config cleared for mode: \(modeId)")
    }

    /// Clear all custom slot configurations for a mode (reset to defaults)
    /// - Parameter modeId: Mode identifier to reset
    public func resetModeToDefaults(_ modeId: String) {
        for slot in 1...12 {
            defaults?.removeObject(forKey: modeSlotKey(slot, forMode: modeId))
        }
        log.info("Mode '\(modeId)' reset to defaults")
    }

    /// Get all custom slot configurations for a mode
    /// - Parameter modeId: Mode identifier
    /// - Returns: Dictionary of slot number to JSON-encoded SlotConfig
    public func getAllSlotConfigs(forMode modeId: String) -> [Int: Data] {
        var configs: [Int: Data] = [:]
        for slot in 1...12 {
            if let data = getSlotConfig(slot, forMode: modeId) {
                configs[slot] = data
            }
        }
        return configs
    }

    /// Check if a mode has any custom configurations
    public func hasModeCustomizations(_ modeId: String) -> Bool {
        for slot in 1...12 {
            if getSlotConfig(slot, forMode: modeId) != nil {
                return true
            }
        }
        return false
    }

    // MARK: - Keyboard Mode Persistence

    /// Persist the last mode selected in the keyboard.
    public func setLastSelectedModeId(_ modeId: String) {
        defaults?.set(modeId, forKey: KeyboardBridgeKey.lastSelectedModeId.rawValue)
        defaults?.set(Date().timeIntervalSince1970, forKey: KeyboardBridgeKey.lastSelectedModeAt.rawValue)
    }

    /// Read the last selected mode id.
    /// - Parameter maxAge: Optional age limit in seconds.
    /// - Returns: Mode id if present (and fresh when maxAge is provided).
    public func getLastSelectedModeId(maxAge: TimeInterval? = nil) -> String? {
        guard let modeId = defaults?.string(forKey: KeyboardBridgeKey.lastSelectedModeId.rawValue),
              !modeId.isEmpty else {
            return nil
        }

        if let maxAge {
            let savedAt = defaults?.double(forKey: KeyboardBridgeKey.lastSelectedModeAt.rawValue) ?? 0
            guard savedAt > 0 else { return nil }
            let age = Date().timeIntervalSince1970 - savedAt
            guard age <= maxAge else { return nil }
        }

        return modeId
    }

    // MARK: - Grid Density Preset

    public func getGridPreset() -> KeyboardGridPreset {
        guard let raw = defaults?.string(forKey: KeyboardBridgeKey.gridPreset.rawValue),
              let preset = KeyboardGridPreset(rawValue: raw) else {
            return .sixteen
        }
        return preset
    }

    public func setGridPreset(_ preset: KeyboardGridPreset) {
        defaults?.set(preset.rawValue, forKey: KeyboardBridgeKey.gridPreset.rawValue)
        log.info("Grid preset updated: \(preset.rawValue)")
    }

    // MARK: - Keyboard Preferences

    public func getKeyboardModeEnabled() -> Bool {
        defaults?.bool(forKey: KeyboardBridgeKey.keyboardModeEnabled.rawValue) ?? false
    }

    public func setKeyboardModeEnabled(_ enabled: Bool) {
        defaults?.set(enabled, forKey: KeyboardBridgeKey.keyboardModeEnabled.rawValue)
        log.info("Keyboard mode preference updated: \(enabled)")
    }

    public func getHapticFeedbackEnabled() -> Bool {
        guard let defaults else { return true }
        if defaults.object(forKey: KeyboardBridgeKey.hapticFeedbackEnabled.rawValue) == nil {
            return true
        }
        return defaults.bool(forKey: KeyboardBridgeKey.hapticFeedbackEnabled.rawValue)
    }

    public func setHapticFeedbackEnabled(_ enabled: Bool) {
        defaults?.set(enabled, forKey: KeyboardBridgeKey.hapticFeedbackEnabled.rawValue)
        log.info("Haptic feedback updated: \(enabled)")
    }
}
