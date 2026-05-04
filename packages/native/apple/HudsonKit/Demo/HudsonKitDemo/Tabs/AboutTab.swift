import SwiftUI
import HudsonUI

#if HUDSON_TERMINAL
import Termini
#endif

struct AboutTab: View {
    var body: some View {
        VStack(alignment: .leading, spacing: HudSpacing.huge) {
            header
            section(title: "Terminal", rows: terminalRows)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: HudSpacing.md) {
            HudSectionLabel("About", tint: HudPalette.statusInfo)
            Text("Build stamps for the kits Hudson is wired up against. Helpful when troubleshooting which version is actually running.")
                .font(HudFont.ui(HudTextSize.sm))
                .foregroundStyle(HudPalette.muted)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: HudLayout.readableWidth, alignment: .leading)
        }
    }

    private var terminalRows: [(String, String)] {
        #if HUDSON_TERMINAL
        return [
            ("Termini", "\(TerminiVersion) · \(TerminiBuildSHA)"),
        ]
        #else
        return [
            ("Termini", "— (build without HUDSONKIT_WITH_TERMINAL=1)"),
        ]
        #endif
    }

    private func section(title: String, rows: [(String, String)]) -> some View {
        VStack(alignment: .leading, spacing: HudSpacing.md) {
            Text(title.uppercased())
                .font(HudFont.mono(HudTextSize.micro, weight: .semibold))
                .tracking(1.0)
                .foregroundStyle(HudPalette.dim)

            VStack(spacing: 0) {
                ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
                    HStack {
                        Text(row.0)
                            .font(HudFont.mono(HudTextSize.xs))
                            .foregroundStyle(HudPalette.ink)
                        Spacer()
                        Text(row.1)
                            .font(HudFont.mono(HudTextSize.xs))
                            .foregroundStyle(HudPalette.muted)
                            .textSelection(.enabled)
                    }
                    .padding(.vertical, HudSpacing.sm)
                    if index < rows.count - 1 {
                        Divider().foregroundStyle(HudSurface.tintBorder(HudPalette.dim))
                    }
                }
            }
            .padding(.horizontal, HudSpacing.lg)
            .padding(.vertical, HudSpacing.sm)
            .background(HudPalette.chrome)
            .frame(maxWidth: HudLayout.dialogWidth)
        }
    }
}
