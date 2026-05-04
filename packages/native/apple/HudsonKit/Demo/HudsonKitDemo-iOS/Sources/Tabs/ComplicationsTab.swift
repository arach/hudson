import SwiftUI
import HudsonUI

struct ComplicationsTab: View {
    @Binding var custom: HudPhoneComplications?
    @Binding var style: HudPhoneComplicationsStyle

    @State private var slotEnabled: [HudPhoneComplications.Position: Bool] = [
        .topLeft: true, .topRight: true, .bottomLeft: true, .bottomRight: true, .center: true
    ]
    @State private var counters: [HudPhoneComplications.Position: Int] = [:]
    @State private var lastTapped: String = "—"

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: HudSpacing.xxl) {
                introCard

                HudCard {
                    VStack(alignment: .leading, spacing: HudSpacing.lg) {
                        HudSectionLabel("RENDER STYLE", tint: HudPalette.accent)
                        Picker("Style", selection: $style) {
                            Text("Tray").tag(HudPhoneComplicationsStyle.tray)
                            Text("Scattered").tag(HudPhoneComplicationsStyle.scattered)
                            Text("Minimal").tag(HudPhoneComplicationsStyle.minimal)
                        }
                        .pickerStyle(.segmented)
                        Text(styleDescription)
                            .font(HudFont.ui(HudTextSize.sm))
                            .foregroundStyle(HudPalette.muted)
                    }
                }

                HudCard {
                    VStack(alignment: .leading, spacing: HudSpacing.lg) {
                        HudSectionLabel("SLOTS")
                        ForEach(HudPhoneComplications.Position.allCases, id: \.self) { pos in
                            slotToggle(pos)
                        }
                    }
                }

                HudCard {
                    VStack(alignment: .leading, spacing: HudSpacing.md) {
                        HudSectionLabel("LAST INTERACTION")
                        Text(lastTapped)
                            .font(HudFont.mono(HudTextSize.base))
                            .foregroundStyle(HudPalette.ink)
                    }
                }
            }
            .padding(HudSpacing.xxl)
        }
        .onAppear { rebuild() }
        .onChange(of: slotEnabled) { _, _ in rebuild() }
    }

    private var introCard: some View {
        HudCard {
            VStack(alignment: .leading, spacing: HudSpacing.md) {
                Text("Five HUD-coordinated slots")
                    .font(HudFont.ui(HudTextSize.lg, weight: .semibold))
                    .foregroundStyle(HudPalette.ink)
                Text("The data model is the truth — five sparse slots, route-published. The tray is one renderer; swap it to redistribute the same five actions.")
                    .font(HudFont.ui(HudTextSize.sm))
                    .foregroundStyle(HudPalette.muted)
            }
        }
    }

    private var styleDescription: String {
        switch style {
        case .tray:      return ".tray — bottom three grouped in a glass tray, top two attached to chrome."
        case .scattered: return ".scattered — all five as floating affordances at their corner positions."
        case .minimal:   return ".minimal — center only; other slots ignored. Focus / takeover mode."
        }
    }

    @ViewBuilder
    private func slotToggle(_ pos: HudPhoneComplications.Position) -> some View {
        Toggle(isOn: Binding(
            get: { slotEnabled[pos] ?? false },
            set: { slotEnabled[pos] = $0 }
        )) {
            HStack(spacing: HudSpacing.md) {
                Image(systemName: positionIcon(pos))
                    .foregroundStyle(HudPalette.muted)
                    .frame(width: 24)
                Text(positionLabel(pos))
                    .font(HudFont.ui(HudTextSize.base))
                    .foregroundStyle(HudPalette.ink)
                Spacer()
                if let count = counters[pos], count > 0 {
                    Text("\(count)")
                        .font(HudFont.mono(HudTextSize.sm))
                        .foregroundStyle(HudPalette.accent)
                }
            }
        }
        .tint(HudPalette.accent)
    }

    private func positionLabel(_ p: HudPhoneComplications.Position) -> String {
        switch p {
        case .topLeft:     return "Top-left"
        case .topRight:    return "Top-right"
        case .bottomLeft:  return "Bottom-left"
        case .bottomRight: return "Bottom-right"
        case .center:      return "Center"
        }
    }

    private func positionIcon(_ p: HudPhoneComplications.Position) -> String {
        switch p {
        case .topLeft:     return "arrow.up.left"
        case .topRight:    return "arrow.up.right"
        case .bottomLeft:  return "arrow.down.left"
        case .bottomRight: return "arrow.down.right"
        case .center:      return "scope"
        }
    }

    private func rebuild() {
        custom = HudPhoneComplications(slots: Dictionary(
            uniqueKeysWithValues: HudPhoneComplications.Position.allCases.compactMap { pos -> (HudPhoneComplications.Position, HudPhoneComplications.Slot)? in
                guard slotEnabled[pos] == true else { return nil }
                return (pos, slot(for: pos))
            }
        ))
    }

    private func slot(for pos: HudPhoneComplications.Position) -> HudPhoneComplications.Slot {
        let icon: String = {
            switch pos {
            case .center:       return "bolt.fill"
            case .topLeft:      return "sparkle"
            case .topRight:     return "moon.stars"
            case .bottomLeft:   return "leaf"
            case .bottomRight:  return "flame"
            }
        }()
        let role: HudPhoneComplications.Role = pos == .center ? .accent : .standard
        return .init(icon: icon, role: role) {
            counters[pos, default: 0] += 1
            lastTapped = "\(positionLabel(pos)) → \(counters[pos] ?? 0)"
        }
    }
}
