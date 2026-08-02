import SwiftUI

#if canImport(AppKit)
import AppKit
#elseif canImport(UIKit)
import UIKit
#endif

enum HudSecretClipboard {
    struct Snapshot: Equatable, Sendable {
        let changeCount: Int
    }

    static func copy(_ text: String) -> Snapshot? {
        #if canImport(AppKit)
        copy(text, to: .general)
        #elseif canImport(UIKit)
        copy(text, to: .general)
        #else
        return nil
        #endif
    }

    static func clear(ifMatching snapshot: Snapshot) {
        #if canImport(AppKit)
        clear(ifMatching: snapshot, from: .general)
        #elseif canImport(UIKit)
        clear(ifMatching: snapshot, from: .general)
        #endif
    }

    #if canImport(AppKit)
    static func copy(_ text: String, to pasteboard: NSPasteboard) -> Snapshot? {
        pasteboard.clearContents()
        guard pasteboard.setString(text, forType: .string) else { return nil }
        let changeCount = pasteboard.changeCount
        guard pasteboard.string(forType: .string) == text else { return nil }
        return Snapshot(changeCount: changeCount)
    }

    static func clear(ifMatching snapshot: Snapshot, from pasteboard: NSPasteboard) {
        guard pasteboard.changeCount == snapshot.changeCount else { return }
        pasteboard.clearContents()
    }
    #elseif canImport(UIKit)
    static func copy(_ text: String, to pasteboard: UIPasteboard) -> Snapshot? {
        pasteboard.string = text
        let changeCount = pasteboard.changeCount
        guard pasteboard.string == text else { return nil }
        return Snapshot(changeCount: changeCount)
    }

    static func clear(ifMatching snapshot: Snapshot, from pasteboard: UIPasteboard) {
        guard pasteboard.changeCount == snapshot.changeCount else { return }
        pasteboard.items = []
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
    @State private var copyGeneration: UInt = 0

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
                .accessibilityLabel(isRevealed ? "Hide secret" : "Reveal secret")

                Button {
                    copy()
                } label: {
                    Image(systemName: didCopy ? "checkmark" : "doc.on.doc")
                        .font(HudFont.ui(HudTextSize.sm))
                        .foregroundStyle(didCopy ? HudPalette.statusOk : HudPalette.muted)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Copy secret")
                .accessibilityValue(didCopy ? "Copied" : "")
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
        copyGeneration &+= 1
        let generation = copyGeneration
        guard let snapshot = HudSecretClipboard.copy(text) else {
            didCopy = false
            return
        }

        // Clear the pasteboard after 30s so the secret doesn't linger.
        DispatchQueue.main.asyncAfter(deadline: .now() + 30) {
            HudSecretClipboard.clear(ifMatching: snapshot)
        }

        didCopy = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            guard copyGeneration == generation else { return }
            didCopy = false
        }
    }
}
