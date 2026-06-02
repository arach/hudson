import SwiftUI
import HudsonUI
import HudsonUIKeyboard

struct KeyboardTab: View {
    @State private var selectedPresetID = HudMiniKeyboardPreset.terminal.id
    @State private var transportBuffer = "$ hudson\n"
    @State private var events: [KeyboardEvent] = [
        .init(keyLabel: "ESC", outputLabel: "sequence ESC", preset: "Terminal"),
        .init(keyLabel: "FIT", outputLabel: "command canvas.fit", preset: "Canvas"),
        .init(keyLabel: "TAB", outputLabel: "text TAB", preset: "Code"),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: HudSpacing.xxl) {
                summaryCard
                HudMiniKeyboard(
                    presets: HudMiniKeyboardPreset.defaultPresets,
                    selectedPresetID: $selectedPresetID,
                    presentation: .minimal,
                    onPress: handleKeyboardPress
                )
                previewCard
            }
            .padding(HudSpacing.xxl)
        }
        .background(HudPalette.bg.ignoresSafeArea())
    }

    private var summaryCard: some View {
        HudCard {
            VStack(alignment: .leading, spacing: HudSpacing.lg) {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: HudSpacing.xs) {
                        HudSectionLabel("MINI KEYBOARD", tint: HudPalette.accent)
                        Text("Mode slots, minimal row, compact grid, and a central dictate affordance for phone-sized hosts.")
                            .font(HudFont.ui(HudTextSize.sm))
                            .foregroundStyle(HudPalette.muted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer()
                    HudBadge(selectedPreset.title, tint: HudPalette.accent, dot: true)
                }

                HStack(spacing: HudSpacing.sm) {
                    HudBadge("Slots", tint: HudPalette.statusInfo)
                    HudBadge("Modes", tint: HudPalette.accent)
                    HudBadge("Minimal", tint: HudPalette.statusOk)
                }
            }
        }
    }

    private var previewCard: some View {
        HudCard {
            VStack(alignment: .leading, spacing: HudSpacing.lg) {
                HStack {
                    HudSectionLabel("HOST FEEDBACK")
                    Spacer()
                    Button("Clear") {
                        transportBuffer = "$ hudson\n"
                        events.removeAll()
                    }
                    .font(HudFont.mono(HudTextSize.xs, weight: .semibold))
                    .foregroundStyle(HudPalette.muted)
                    .buttonStyle(.plain)
                }

                Text(transportBuffer)
                    .font(HudFont.mono(HudTextSize.xs))
                    .foregroundStyle(HudPalette.ink)
                    .frame(maxWidth: .infinity, minHeight: 92, alignment: .topLeading)
                    .padding(HudSpacing.lg)
                    .background(RoundedRectangle(cornerRadius: HudRadius.standard).fill(HudSurface.inset))
                    .overlay(RoundedRectangle(cornerRadius: HudRadius.standard).stroke(HudHairline.subtle, lineWidth: HudStrokeWidth.standard))

                VStack(spacing: HudSpacing.sm) {
                    ForEach(events.prefix(5)) { event in
                        eventRow(event)
                    }
                }

                HStack(spacing: HudSpacing.sm) {
                    transportBadge("text")
                    transportBadge("sequence")
                    transportBadge("command")
                }
            }
        }
    }

    private func eventRow(_ event: KeyboardEvent) -> some View {
        HStack(spacing: HudSpacing.md) {
            Text(event.keyLabel)
                .font(HudFont.mono(HudTextSize.xs, weight: .bold))
                .foregroundStyle(HudPalette.ink)
                .frame(width: KeyboardTabMetrics.eventKeyWidth, alignment: .leading)
            Text(event.outputLabel)
                .font(HudFont.mono(HudTextSize.xs))
                .foregroundStyle(HudPalette.muted)
                .lineLimit(1)
                .truncationMode(.middle)
            Spacer(minLength: HudSpacing.md)
            Text(event.preset)
                .font(HudFont.mono(HudTextSize.micro, weight: .semibold))
                .foregroundStyle(HudPalette.dim)
        }
        .padding(.horizontal, HudSpacing.lg)
        .frame(height: HudLayout.rowHeightCompact)
        .background(RoundedRectangle(cornerRadius: HudRadius.standard).fill(HudSurface.inset))
        .overlay(RoundedRectangle(cornerRadius: HudRadius.standard).stroke(HudHairline.subtle, lineWidth: HudStrokeWidth.thin))
    }

    private func transportBadge(_ label: String) -> some View {
        Text(label)
            .font(HudFont.mono(HudTextSize.micro, weight: .semibold))
            .foregroundStyle(HudPalette.dim)
            .padding(.horizontal, HudSpacing.md)
            .frame(height: HudLayout.rowHeightCompact - HudSpacing.xs)
            .background(RoundedRectangle(cornerRadius: HudRadius.standard).fill(HudSurface.inset))
            .overlay(RoundedRectangle(cornerRadius: HudRadius.standard).stroke(HudHairline.subtle, lineWidth: HudStrokeWidth.thin))
    }

    private func handleKeyboardPress(_ output: HudMiniKeyboardOutput, key: HudMiniKeyboardKey) {
        let outputLabel = describe(output)
        events.insert(
            .init(
                keyLabel: key.label.isEmpty ? key.id.components(separatedBy: ".").last?.uppercased() ?? key.id : key.label,
                outputLabel: outputLabel,
                preset: selectedPreset.title
            ),
            at: 0
        )
        if events.count > 20 {
            events.removeLast(events.count - 20)
        }

        switch output {
        case .text(let value), .sequence(let value):
            appendTransport(value, key: key)
        case .command(let value):
            transportBuffer += "# \(value)\n"
        }
    }

    private func appendTransport(_ value: String, key: HudMiniKeyboardKey) {
        switch value {
        case "\r":
            transportBuffer += "\n$ hudson\n"
        case "\t":
            transportBuffer += "    "
        case "\u{1B}":
            transportBuffer += "^ESC "
        case "\u{3}":
            transportBuffer += "^C\n$ hudson\n"
        case "\u{4}":
            transportBuffer += "^D "
        case "\u{7F}":
            if transportBuffer.count > "$ hudson\n".count {
                transportBuffer.removeLast()
            }
        default:
            if value.hasPrefix("\u{1B}[") {
                transportBuffer += "[\(key.accessibleDisplay)] "
            } else {
                transportBuffer += value
            }
        }

        if transportBuffer.count > 360 {
            transportBuffer = String(transportBuffer.suffix(360))
        }
    }

    private var selectedPreset: HudMiniKeyboardPreset {
        HudMiniKeyboardPreset.defaultPresets.first(where: { $0.id == selectedPresetID }) ?? .terminal
    }

    private func describe(_ output: HudMiniKeyboardOutput) -> String {
        switch output {
        case .text(let value):
            return "text \(visible(value))"
        case .sequence(let value):
            return "sequence \(visible(value))"
        case .command(let value):
            return "command \(value)"
        }
    }

    private func visible(_ value: String) -> String {
        switch value {
        case "\u{1B}": return "ESC"
        case "\u{1B}[A": return "UP"
        case "\u{1B}[B": return "DOWN"
        case "\u{1B}[C": return "RIGHT"
        case "\u{1B}[D": return "LEFT"
        case "\u{1B}[H": return "HOME"
        case "\u{1B}[F": return "END"
        case "\u{3}": return "CTRL-C"
        case "\u{4}": return "CTRL-D"
        case "\u{7F}": return "DEL"
        case "\t": return "TAB"
        case "\r": return "RET"
        default: return value
        }
    }
}

private struct KeyboardEvent: Identifiable {
    let id = UUID()
    let keyLabel: String
    let outputLabel: String
    let preset: String
}

private enum KeyboardTabMetrics {
    static let eventKeyWidth = HudIconSize.hero
}

private extension HudMiniKeyboardKey {
    var accessibleDisplay: String {
        if !label.isEmpty { return label }
        return id.components(separatedBy: ".").last?.uppercased() ?? id
    }
}
