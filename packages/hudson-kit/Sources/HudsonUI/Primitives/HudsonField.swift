import SwiftUI

/// Hairline-bordered text input with mono content. Cross-platform — apps that
/// need iOS-specific keyboard config (numeric, email, etc.) can wrap this with
/// `.keyboardType(...)` at the call site.
public struct HudsonField: View {
    public let placeholder: String
    @Binding public var text: String

    public init(_ placeholder: String, text: Binding<String>) {
        self.placeholder = placeholder
        self._text = text
    }

    public var body: some View {
        TextField(placeholder, text: $text)
            .textFieldStyle(.plain)
            .font(HudsonFont.mono(12))
            .foregroundStyle(HudsonPalette.ink)
            .tint(HudsonPalette.accent)
            .padding(.horizontal, HudsonSpacing.xl)
            .frame(height: 36)
            .background(RoundedRectangle(cornerRadius: HudsonRadius.standard).fill(Color.black.opacity(0.25)))
            .overlay(RoundedRectangle(cornerRadius: HudsonRadius.standard).stroke(HudsonHairline.standard, lineWidth: 1))
    }
}
