import SwiftUI

#if canImport(AppKit)
import AppKit
#elseif canImport(UIKit)
import UIKit
#endif

enum HudSecretClipboard {
    @discardableResult
    static func copy(_ text: String) -> Bool {
        #if canImport(AppKit)
        copy(text, to: .general)
        #elseif canImport(UIKit)
        UIPasteboard.general.string = text
        return UIPasteboard.general.string == text
        #else
        return false
        #endif
    }

    static func clear(ifMatching snapshot: String) {
        #if canImport(AppKit)
        clear(ifMatching: snapshot, from: .general)
        #elseif canImport(UIKit)
        if UIPasteboard.general.string == snapshot {
            UIPasteboard.general.string = ""
        }
        #endif
    }

    #if canImport(AppKit)
    @discardableResult
    static func copy(_ text: String, to pasteboard: NSPasteboard) -> Bool {
        pasteboard.clearContents()
        return pasteboard.setString(text, forType: .string)
    }

    static func clear(ifMatching snapshot: String, from pasteboard: NSPasteboard) {
        guard pasteboard.string(forType: .string) == snapshot else { return }
        pasteboard.clearContents()
    }
    #endif
}

/// Masked input for entering a secret (API key, token, passphrase) — replaces
/// raw `TextField` usage Talkie/Scout currently lean on for credential entry.
/// Includes a reveal toggle and a copy-to-clipboard button that auto-clears
/// the pasteboard after a short delay so the secret doesn't linger.
public struct HudSecretField: View {
    private let placeholder: String
    @Binding private var text: String
    private let icon: String

    @State private var isRevealed: Bool = false
    @State private var didCopy: Bool = false

    public init(
        _ placeholder: String,
        text: Binding<String>,
        icon: String = "key.fill"
    ) {
        self.placeholder = placeholder
        self._text = text
        self.icon = icon
    }

    public var body: some View {
        HStack(spacing: HudSpacing.md) {
            Image(systemName: icon)
                .font(HudFont.ui(HudTextSize.sm))
                .foregroundStyle(HudPalette.muted)
                .frame(width: HudIconSize.medium)

            Group {
                if isRevealed {
                    plainField
                } else {
                    SecureField(placeholder, text: $text)
                }
            }
            .font(HudFont.mono(HudTextSize.sm))
            .foregroundStyle(HudPalette.ink)

            if !text.isEmpty {
                Button {
                    isRevealed.toggle()
                } label: {
                    Image(systemName: isRevealed ? "eye.slash" : "eye")
                        .font(HudFont.ui(HudTextSize.sm))
                        .foregroundStyle(HudPalette.muted)
                }
                .buttonStyle(.plain)

                Button {
                    copy()
                } label: {
                    Image(systemName: didCopy ? "checkmark" : "doc.on.doc")
                        .font(HudFont.ui(HudTextSize.sm))
                        .foregroundStyle(didCopy ? HudPalette.statusOk : HudPalette.muted)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, HudSpacing.lg)
        .frame(height: HudLayout.fieldHeight)
        .background(HudSurface.inset)
        .overlay(
            RoundedRectangle(cornerRadius: HudRadius.standard)
                .stroke(HudHairline.standard, lineWidth: HudStrokeWidth.thin)
        )
        .clipShape(RoundedRectangle(cornerRadius: HudRadius.standard))
    }

    private var plainField: some View {
        #if os(iOS)
        TextField(placeholder, text: $text)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
        #else
        TextField(placeholder, text: $text)
        #endif
    }

    private func copy() {
        guard HudSecretClipboard.copy(text) else { return }

        // Clear the pasteboard after 30s so the secret doesn't linger.
        let snapshot = text
        DispatchQueue.main.asyncAfter(deadline: .now() + 30) {
            HudSecretClipboard.clear(ifMatching: snapshot)
        }

        didCopy = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            didCopy = false
        }
    }
}
