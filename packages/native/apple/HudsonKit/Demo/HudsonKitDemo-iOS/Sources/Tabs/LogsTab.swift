import SwiftUI
import HudsonUI
import HudsonObservability

struct LogsTab: View {
    @ObservedObject private var store = HudLogStore.shared
    @State private var levelFilter: HudLogLevel? = nil

    private let demoLogger = HudLogger(category: "demo")

    var body: some View {
        VStack(spacing: 0) {
            controls
                .padding(HudSpacing.xl)
                .background(HudPalette.surface)
                .overlay(Rectangle().fill(HudHairline.subtle).frame(height: 0.5), alignment: .bottom)

            if filteredEntries.isEmpty {
                HudEmptyState(
                    title: "No log entries",
                    subtitle: "Tap a level button above to emit a test log.",
                    icon: "list.bullet.rectangle"
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: HudSpacing.sm) {
                        ForEach(filteredEntries.reversed()) { entry in
                            entryRow(entry)
                        }
                    }
                    .padding(HudSpacing.xl)
                }
            }
        }
    }

    private var filteredEntries: [HudLogEntry] {
        guard let level = levelFilter else { return store.entries }
        return store.entries.filter { $0.level == level }
    }

    private var controls: some View {
        VStack(alignment: .leading, spacing: HudSpacing.md) {
            HStack(spacing: HudSpacing.sm) {
                emitButton(.debug,   "Debug",   HudPalette.dim)
                emitButton(.info,    "Info",    HudPalette.muted)
                emitButton(.notice,  "Notice",  HudPalette.statusInfo)
                emitButton(.warning, "Warn",    HudPalette.statusWarn)
                emitButton(.error,   "Error",   HudPalette.statusError)
            }
            HStack(spacing: HudSpacing.md) {
                Text("\(filteredEntries.count) entries")
                    .font(HudFont.mono(HudTextSize.xs))
                    .foregroundStyle(HudPalette.muted)
                Spacer()
                Button("Clear") { store.clear() }
                    .font(HudFont.ui(HudTextSize.sm))
                    .foregroundStyle(HudPalette.statusError)
                    .buttonStyle(.plain)
            }
        }
    }

    private func emitButton(_ level: HudLogLevel, _ label: String, _ tint: Color) -> some View {
        Button {
            switch level {
            case .debug:   demoLogger.debug("Tap test", metadata: ["state": "debug"])
            case .info:    demoLogger.info("Tap test", metadata: ["state": "info"])
            case .notice:  demoLogger.notice("Tap test", metadata: ["state": "notice"])
            case .warning: demoLogger.warning("Tap test", metadata: ["state": "warning"])
            case .error:   demoLogger.error("Tap test", metadata: ["state": "error"])
            case .fault:   demoLogger.fault("Tap test", metadata: ["state": "fault"])
            }
        } label: {
            Text(label)
                .font(HudFont.ui(HudTextSize.xs, weight: .semibold))
                .foregroundStyle(tint)
                .padding(.horizontal, HudSpacing.md)
                .padding(.vertical, 6)
                .background(Capsule().fill(tint.opacity(0.12)))
                .overlay(Capsule().stroke(tint.opacity(0.4), lineWidth: 0.5))
        }
        .buttonStyle(.plain)
    }

    private func entryRow(_ entry: HudLogEntry) -> some View {
        HStack(alignment: .top, spacing: HudSpacing.md) {
            Text(entry.level.rawValue.uppercased())
                .font(HudFont.mono(HudTextSize.xxs, weight: .bold))
                .foregroundStyle(color(for: entry.level))
                .frame(width: 56, alignment: .leading)

            VStack(alignment: .leading, spacing: 2) {
                Text(entry.message)
                    .font(HudFont.mono(HudTextSize.sm))
                    .foregroundStyle(HudPalette.ink)
                HStack(spacing: HudSpacing.sm) {
                    Text(entry.formattedTime)
                        .font(HudFont.mono(HudTextSize.xxs))
                        .foregroundStyle(HudPalette.dim)
                    Text(entry.category)
                        .font(HudFont.mono(HudTextSize.xxs))
                        .foregroundStyle(HudPalette.muted)
                    if !entry.metadata.isEmpty {
                        Text(entry.metadata.map { "\($0.key)=\($0.value)" }.joined(separator: " "))
                            .font(HudFont.mono(HudTextSize.xxs))
                            .foregroundStyle(HudPalette.dim)
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .padding(HudSpacing.md)
        .background(RoundedRectangle(cornerRadius: HudRadius.standard).fill(HudPalette.surface))
        .overlay(RoundedRectangle(cornerRadius: HudRadius.standard).stroke(HudHairline.subtle, lineWidth: 0.5))
    }

    private func color(for level: HudLogLevel) -> Color {
        switch level {
        case .debug:   return HudPalette.dim
        case .info:    return HudPalette.muted
        case .notice:  return HudPalette.statusInfo
        case .warning: return HudPalette.statusWarn
        case .error:   return HudPalette.statusError
        case .fault:   return HudPalette.statusError
        }
    }
}
