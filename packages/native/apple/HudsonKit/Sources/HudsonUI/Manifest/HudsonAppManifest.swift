import SwiftUI

/// Per-app customization surface. Native counterpart to `AppManifest` in
/// `packages/web/hudsonkit/src/types/app.ts:76` — apps declare identity (name,
/// version, target vocabulary) and brand customization (accent override).
///
/// Defaults stay opinionated. Apps that pass nothing get the full Hudson
/// chassis with the emerald accent. Apps that want to brand override only
/// what they need.
public struct HudsonAppManifest: Sendable {
    public var name: String
    public var version: String
    public var accent: Color
    public var accentSoft: Color
    /// Vocabulary for the primary entity in the app's dashboard. Scout uses
    /// "Agent", Lattices uses "Machine", Linea will use "Device". Cards and
    /// list rows read this label so the same chassis adapts to different
    /// problem domains.
    public var targetLabel: String

    public init(
        name: String,
        version: String = "0.1.0",
        accent: Color = HudsonPalette.accent,
        accentSoft: Color = HudsonPalette.accentSoft,
        targetLabel: String = "Target"
    ) {
        self.name = name
        self.version = version
        self.accent = accent
        self.accentSoft = accentSoft
        self.targetLabel = targetLabel
    }

    /// Convenience init that derives `accent` and `accentSoft` from a named
    /// HudsonTint. Most apps brand by tint name rather than raw color.
    public init(
        name: String,
        version: String = "0.1.0",
        tint: HudsonTint,
        targetLabel: String = "Target"
    ) {
        self.name = name
        self.version = version
        self.accent = tint.color
        self.accentSoft = tint.color.opacity(0.10)
        self.targetLabel = targetLabel
    }
}

// MARK: - Environment integration

private struct HudsonAppManifestKey: EnvironmentKey {
    static let defaultValue = HudsonAppManifest(name: "Hudson")
}

extension EnvironmentValues {
    /// Read the active manifest from any view inside a `.hudsonAppManifest(...)`
    /// scope. Primitives that need the brand accent (e.g., a primary button
    /// driven by manifest, not a hard-coded tint) read this.
    public var hudsonAppManifest: HudsonAppManifest {
        get { self[HudsonAppManifestKey.self] }
        set { self[HudsonAppManifestKey.self] = newValue }
    }
}

extension View {
    /// Bind a manifest into the environment for everything beneath this view.
    /// Top-level shells call this once at app root.
    public func hudsonAppManifest(_ manifest: HudsonAppManifest) -> some View {
        environment(\.hudsonAppManifest, manifest)
    }
}
