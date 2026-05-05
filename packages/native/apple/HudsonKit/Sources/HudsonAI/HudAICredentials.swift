import Foundation
import HudsonUI

public protocol HudAICredentialSource: Sendable {
    func get(_ key: String) async throws -> Data?
}

public struct HudVaultCredentialSource: HudAICredentialSource {
    public var vault: HudVault

    public init(vault: HudVault) {
        self.vault = vault
    }

    public func get(_ key: String) async throws -> Data? {
        try vault.get(key)
    }
}
