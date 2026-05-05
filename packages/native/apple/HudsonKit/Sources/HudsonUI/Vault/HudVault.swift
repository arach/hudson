import Foundation
import Security

/// Encrypted opaque-secret store backed by the Apple Keychain. Each `HudVault`
/// instance is namespaced by a `service` string so consuming apps don't collide
/// (`HudVault(service: "com.talkie.api-keys")` is a different bucket from
/// `HudVault(service: "com.scout.tokens")`).
///
/// **Threat model.** Items are written with `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`,
/// which means: encrypted at rest by the OS, available after the user has
/// unlocked the device once per boot, never synced to iCloud or backed up to
/// another device. This defends against casual device theft and cross-app
/// snooping. It does **not** defend against local malware running as the user
/// — anything with the entitlement and bundle id can read the same items.
///
/// Lifted from OpenScout's `apps/ios/Scout/Security/Identity.swift` keychain
/// helpers (already battle-tested in production), generalized into a flat
/// service-namespaced KV store.
public struct HudVault: Sendable {
    public let service: String

    public init(service: String) {
        self.service = service
    }

    // MARK: - Primary API

    /// Store opaque bytes under `key`. Replaces any existing item.
    public func set(_ key: String, _ value: Data) throws {
        let deleteQuery: [String: Any] = [
            kSecClass as String:       kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(deleteQuery as CFDictionary)

        let addQuery: [String: Any] = [
            kSecClass as String:       kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String:   value,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        let status = SecItemAdd(addQuery as CFDictionary, nil)
        guard status == errSecSuccess else { throw HudVaultError.saveFailed(status) }
    }

    /// Read opaque bytes for `key`. Returns nil when the key isn't set.
    public func get(_ key: String) throws -> Data? {
        let query: [String: Any] = [
            kSecClass as String:       kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String:  true,
            kSecMatchLimit as String:  kSecMatchLimitOne,
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess else { throw HudVaultError.loadFailed(status) }
        return result as? Data
    }

    /// Delete a single key. No-op when the key isn't set.
    public func delete(_ key: String) throws {
        let query: [String: Any] = [
            kSecClass as String:       kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw HudVaultError.deleteFailed(status)
        }
    }

    /// All keys currently stored under this service. Sorted alphabetically.
    public func list() throws -> [String] {
        let query: [String: Any] = [
            kSecClass as String:           kSecClassGenericPassword,
            kSecAttrService as String:     service,
            kSecReturnAttributes as String: true,
            kSecMatchLimit as String:      kSecMatchLimitAll,
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return [] }
        guard status == errSecSuccess else { throw HudVaultError.loadFailed(status) }
        guard let items = result as? [[String: Any]] else { return [] }
        return items
            .compactMap { $0[kSecAttrAccount as String] as? String }
            .sorted()
    }

    /// Wipe every item in this service namespace. Other services are
    /// untouched.
    public func clear() throws {
        let query: [String: Any] = [
            kSecClass as String:       kSecClassGenericPassword,
            kSecAttrService as String: service,
        ]
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw HudVaultError.deleteFailed(status)
        }
    }

    // MARK: - String convenience

    /// Store a UTF-8 string.
    public func setString(_ key: String, _ value: String) throws {
        guard let data = value.data(using: .utf8) else { throw HudVaultError.encodingFailed }
        try set(key, data)
    }

    /// Read a UTF-8 string. Returns nil when the key isn't set or the data
    /// can't be decoded as UTF-8.
    public func getString(_ key: String) throws -> String? {
        guard let data = try get(key) else { return nil }
        return String(data: data, encoding: .utf8)
    }
}

public enum HudVaultError: Error, LocalizedError {
    case saveFailed(OSStatus)
    case loadFailed(OSStatus)
    case deleteFailed(OSStatus)
    case encodingFailed

    public var errorDescription: String? {
        switch self {
        case .saveFailed(let s):  return "Vault save failed (OSStatus \(s))"
        case .loadFailed(let s):  return "Vault load failed (OSStatus \(s))"
        case .deleteFailed(let s): return "Vault delete failed (OSStatus \(s))"
        case .encodingFailed:     return "Vault could not encode value as UTF-8"
        }
    }
}
