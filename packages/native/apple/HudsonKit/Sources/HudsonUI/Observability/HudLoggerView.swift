import SwiftUI
import HudsonObservability

/// Live log inspector backed by `HudLogStore`. Extracted from the HudsonKit demo
/// `LogsTab` and shaped after Lattices' `DiagnosticOverlayView`: filter pills,
/// auto-follow tail, copy/clear, and row engage for full message + metadata.
@MainActor
public struct HudLoggerView: View {
    @ObservedObject private var store: HudLogStore
    public var title: String
    public var showHeader: Bool
    public var showDemoControls: Bool
    public var emptySubtitle: String?

    @State private var levelFilter: HudLogLevel?
    @State private var selectedEntryID: UUID?
    @State private var copiedMessage: String?
    @State private var followLatest = true

    private let demoLogger = HudLogger(category: "demo")

    public init(
        store: HudLogStore,
        title: String = "Diagnostics",
        showHeader: Bool = true,
        showDemoControls: Bool = false,
        emptySubtitle: String? = nil
    ) {
        self._store = ObservedObject(wrappedValue: store)
        self.title = title
        self.showHeader = showHeader
        self.showDemoControls = showDemoControls
        self.emptySubtitle = emptySubtitle
    }

    public init(
        title: String = "Diagnostics",
        showHeader: Bool = true,
        showDemoControls: Bool = false,
        emptySubtitle: String? = nil
    ) {
        self.init(
            store: .shared,
            title: title,
            showHeader: showHeader,
            showDemoControls: showDemoControls,
            emptySubtitle: emptySubtitle
        )
    }

    public var body: some View {
        VStack(spacing: 0) {
            if showHeader {
                controls
                    .padding(.horizontal, HudSpacing.xl)
                    .padding(.vertical, HudSpacing.md)
                    .background(HudPalette.surface)
                    .overlay(Rectangle().fill(HudHairline.subtle).frame(height: HudStrokeWidth.thin), alignment: .bottom)
            }

            if filteredEntries.isEmpty {
                HudEmptyState(
                    title: "No log entries",
                    subtitle: emptySubtitle ?? "Activity will appear here as the app runs.",
                    icon: "list.bullet.rectangle"
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                logList
            }
        }
    }

    private var filteredEntries: [HudLogEntry] {
        guard let level = levelFilter else { return store.entries }
        return store.entries.filter { $0.level == level }
    }

    private var controls: some View {
        VStack(alignment: .leading, spacing: HudSpacing.sm) {
            statusLine

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: HudSpacing.sm) {
                    filterButton(nil, "All")
                    filterButton(.debug, "Debug")
                    filterButton(.info, "Info")
                    filterButton(.notice, "Notice")
                    filterButton(.warning, "Warn")
                    filterButton(.error, "Error")
                }
            }
        }
    }

    private var statusLine: some View {
        HStack(spacing: HudSpacing.sm) {
            Text(title)
                .font(HudFont.ui(HudTextSize.sm, weight: .semibold))
                .foregroundStyle(HudPalette.ink)

            Text("LIVE")
                .font(HudFont.mono(HudTextSize.xxs, weight: .bold))
                .foregroundStyle(HudPalette.statusOk)

            Spacer(minLength: HudSpacing.sm)

            if let copiedMessage {
                Text(copiedMessage)
                    .font(HudFont.mono(HudTextSize.xxs))
                    .foregroundStyle(HudPalette.statusOk)
                    .transition(.opacity)
            } else {
                Text("\(filteredEntries.count)/\(store.entries.count)")
                    .font(HudFont.mono(HudTextSize.xxs))
                    .foregroundStyle(HudPalette.dim)
                if warningCount > 0 {
                    countChip("W", warningCount, tint: HudPalette.statusWarn)
                }
                if errorCount > 0 {
                    countChip("E", errorCount, tint: HudPalette.statusError)
                }
            }

            compactIconButton("Copy all", icon: "doc.on.doc", tint: HudPalette.muted, action: copyAllVisible)
            if showDemoControls {
                compactIconButton("Emit burst", icon: "plus", tint: HudPalette.muted, action: emitDemoBurst)
            }
            compactIconButton("Clear", icon: "trash", tint: HudPalette.statusError) {
                store.clear()
                selectedEntryID = nil
            }
        }
    }

    private var logList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: HudSpacing.xs) {
                    ForEach(filteredEntries.reversed()) { entry in
                        entryRow(entry)
                            .id(entry.id)
                    }
                }
                .padding(HudSpacing.md)
            }
            .onChange(of: store.entries.count) { _, _ in
                guard followLatest, let newest = filteredEntries.last else { return }
                withAnimation(.easeOut(duration: 0.12)) {
                    proxy.scrollTo(newest.id, anchor: .bottom)
                }
            }
        }
    }

    private var warningCount: Int {
        store.entries.filter { $0.level == .warning }.count
    }

    private var errorCount: Int {
        store.entries.filter { $0.level == .error || $0.level == .fault }.count
    }

    private func filterButton(_ level: HudLogLevel?, _ label: String) -> some View {
        let active = levelFilter == level
        let tint = filterTint(for: level)
        return Button {
            levelFilter = level
        } label: {
            Text(label)
                .font(HudFont.ui(HudTextSize.xs, weight: .semibold))
                .foregroundStyle(active ? HudPalette.bg : tint)
                .padding(.horizontal, HudSpacing.sm)
                .padding(.vertical, HudSpacing.xs)
                .background(Capsule().fill(active ? tint : HudSurface.tintFill(tint)))
                .overlay(Capsule().stroke(HudSurface.tintBorder(tint), lineWidth: HudStrokeWidth.thin))
        }
        .buttonStyle(.plain)
    }

    private func compactIconButton(
        _ accessibilityLabel: String,
        icon: String,
        tint: Color,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(HudFont.ui(HudTextSize.xs, weight: .bold))
                .foregroundStyle(tint)
                .frame(width: HudIconSize.small, height: HudIconSize.small)
                .background(Circle().fill(HudSurface.tintFill(tint)))
                .overlay(Circle().stroke(HudHairline.subtle, lineWidth: HudStrokeWidth.thin))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
    }

    private func countChip(_ label: String, _ count: Int, tint: Color) -> some View {
        Text("\(label) \(count)")
            .font(HudFont.mono(HudTextSize.xxs, weight: .bold))
            .foregroundStyle(tint)
    }

    private func entryRow(_ entry: HudLogEntry) -> some View {
        let tint = severityTint(for: entry.level)
        let engaged = selectedEntryID == entry.id
        return VStack(alignment: .leading, spacing: HudSpacing.sm) {
            Button {
                withAnimation(.easeOut(duration: 0.12)) {
                    selectedEntryID = engaged ? nil : entry.id
                }
            } label: {
                HStack(alignment: .top, spacing: HudSpacing.md) {
                    RoundedRectangle(cornerRadius: HudRadius.tight)
                        .fill(tint)
                        .frame(width: HudStrokeWidth.bold)

                    VStack(alignment: .leading, spacing: HudSpacing.sm) {
                        HStack(spacing: HudSpacing.sm) {
                            Text(entry.level.rawValue.uppercased())
                                .font(HudFont.mono(HudTextSize.xxs, weight: .bold))
                                .foregroundStyle(tint)

                            Text(entry.category)
                                .font(HudFont.mono(HudTextSize.xxs, weight: .bold))
                                .foregroundStyle(HudPalette.muted)

                            Spacer(minLength: 0)

                            Text(entry.formattedTime)
                                .font(HudFont.mono(HudTextSize.xxs))
                                .foregroundStyle(HudPalette.dim)

                            Button {
                                copy(entry)
                            } label: {
                                Image(systemName: "doc.on.doc")
                                    .font(HudFont.ui(HudTextSize.xs, weight: .semibold))
                                    .foregroundStyle(HudPalette.dim)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Copy log entry")
                        }

                        Text(compactMessage(for: entry))
                            .font(HudFont.mono(HudTextSize.xs, weight: .semibold))
                            .foregroundStyle(HudPalette.ink)
                            .lineLimit(engaged ? nil : 2)
                            .multilineTextAlignment(.leading)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }
            .buttonStyle(.plain)

            if engaged {
                entryDetail(entry)
            }
        }
        .padding(.horizontal, HudSpacing.md)
        .padding(.vertical, HudSpacing.sm)
        .background(RoundedRectangle(cornerRadius: HudRadius.standard).fill(HudPalette.surface))
        .overlay(
            RoundedRectangle(cornerRadius: HudRadius.standard)
                .stroke(engaged ? HudSurface.tintBorder(tint) : HudHairline.subtle, lineWidth: engaged ? HudStrokeWidth.standard : 0.5)
        )
    }

    private func entryDetail(_ entry: HudLogEntry) -> some View {
        VStack(alignment: .leading, spacing: HudSpacing.xs) {
            HudKVRow("subsystem", value: entry.subsystem, valueLineLimit: nil)
            HudKVRow("category", value: entry.category, valueLineLimit: nil)
            HudKVRow("level", value: entry.level.rawValue, valueColor: severityTint(for: entry.level), valueLineLimit: nil)
            HudKVRow("time", value: entry.formattedTime, valueLineLimit: nil)
            if !entry.metadata.isEmpty {
                ForEach(entry.metadata.sorted(by: { $0.key < $1.key }), id: \.key) { key, value in
                    HudKVRow(key, value: value, valueLineLimit: nil)
                }
            }
        }
        .padding(.leading, HudSpacing.xl + HudStrokeWidth.bold)
    }

    private func emitDemoBurst() {
        demoLogger.notice("Pairing handshake accepted", metadata: ["host": "macbook", "route": "tailscale"])
        demoLogger.info("Canvas snapshot restored", metadata: ["nodes": "6", "status": "ready"])
        demoLogger.warning("Terminal resize coalesced", metadata: ["reason": "drag", "changed": "true"])
    }

    private func filterTint(for level: HudLogLevel?) -> Color {
        guard let level else { return HudPalette.muted }
        switch level {
        case .warning:
            return HudPalette.statusWarn
        case .error, .fault:
            return HudPalette.statusError
        default:
            return HudPalette.muted
        }
    }

    private func severityTint(for level: HudLogLevel) -> Color {
        switch level {
        case .warning:
            return HudPalette.statusWarn
        case .error, .fault:
            return HudPalette.statusError
        default:
            return HudPalette.dim
        }
    }

    private func compactMessage(for entry: HudLogEntry) -> String {
        let metadata = metadataString(entry.metadata)
        guard !metadata.isEmpty else { return entry.message }
        return "\(entry.message)  \(metadata)"
    }

    private func serializedEntry(_ entry: HudLogEntry) -> String {
        let metadata = metadataString(entry.metadata)
        return [
            entry.formattedTime,
            entry.level.rawValue.uppercased(),
            entry.category,
            entry.message,
            metadata
        ]
        .filter { !$0.isEmpty }
        .joined(separator: " ")
    }

    private func metadataString(_ metadata: [String: String]) -> String {
        metadata
            .sorted { $0.key < $1.key }
            .map { "\($0.key)=\($0.value)" }
            .joined(separator: " ")
    }

    private func copy(_ entry: HudLogEntry) {
        copyToPasteboard(serializedEntry(entry), message: "Copied row")
    }

    private func copyAllVisible() {
        let rows = filteredEntries.reversed().map(serializedEntry).joined(separator: "\n")
        copyToPasteboard(rows, message: "Copied \(filteredEntries.count)")
    }

    private func copyToPasteboard(_ text: String, message: String) {
        guard !text.isEmpty else { return }
        HudLoggerClipboard.copy(text)

        withAnimation(.easeOut(duration: 0.12)) {
            copiedMessage = message
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 1.4) {
            withAnimation(.easeOut(duration: 0.12)) {
                copiedMessage = nil
            }
        }
    }
}
