import SwiftUI
import HudsonUI

// Dogfood model for the tiling primitive demo
struct DemoTile: Identifiable {
    let id: String
    let title: String
    let kind: String
    let status: String
}

// Persistence for the interactive tiled layout demo
private struct SavedTilingState: Codable {
    var order: [String]
    var positions: [String: CodableRect]
    var sizes: [String: CodableSize]
    var maxCols: Int?
    var gap: Double
}

private struct CodableRect: Codable {
    var x, y, w, h: Double
}

private struct CodableSize: Codable {
    var w, h: Double
}

private let tilingPersistenceKey = "hudsonkit.demo.tiling.v1"

struct PrimitivesTab: View {
    @State private var fieldText: String = ""
    @State private var selectedRow: String? = "alpha"
    @State private var documentMode: HudTextDocumentMode = .preview
    @State private var document = HudTextDocumentDetector.makeDocument(
        id: "demo-document",
        title: "AgentProvider.swift",
        uri: "Sources/AgentProvider.swift",
        mediaType: "text/x-swift",
        value: """
        import SwiftUI
        import HudsonUI

        public struct AgentProvider: View {
            let title: String
            @State private var isConnected = true

            public var body: some View {
                HudCard {
                    Text(title)
                        .font(HudFont.mono(HudTextSize.base))
                }
            }
        }
        """
    )

    // Dogfooding state for HudTiling (native AppKit)
    @State private var tilingItems: [DemoTile] = [
        DemoTile(id: "lead", title: "codex.lead", kind: "agent", status: "running"),
        DemoTile(id: "w1", title: "worker-01", kind: "agent", status: "idle"),
        DemoTile(id: "w2", title: "worker-02", kind: "agent", status: "running"),
        DemoTile(id: "logs", title: "project.logs", kind: "terminal", status: "tailing"),
        DemoTile(id: "chat", title: "scribe.chat", kind: "chat", status: "active"),
        DemoTile(id: "diff", title: "hudson.diff", kind: "diff", status: "review"),
        DemoTile(id: "term3", title: "shell-03", kind: "terminal", status: "idle"),
        DemoTile(id: "notes", title: "scratch.notes", kind: "note", status: "open"),
    ]
    @State private var tilingMaxCols: Int? = nil
    @State private var tilingGap: CGFloat = 12

    // Interactive grid drag + resize state
    @State private var itemOrder: [String] = []
    @State private var basePositions: [String: CGRect] = [:]
    @State private var customSizes: [String: CGSize] = [:]
    @State private var draggingID: String? = nil
    @State private var dragTranslation: CGSize = .zero
    @State private var dragTargetIndex: Int? = nil

    private let defaultTilingItems: [DemoTile] = [
        DemoTile(id: "lead", title: "codex.lead", kind: "agent", status: "running"),
        DemoTile(id: "w1", title: "worker-01", kind: "agent", status: "idle"),
        DemoTile(id: "w2", title: "worker-02", kind: "agent", status: "running"),
        DemoTile(id: "logs", title: "project.logs", kind: "terminal", status: "tailing"),
        DemoTile(id: "chat", title: "scribe.chat", kind: "chat", status: "active"),
        DemoTile(id: "diff", title: "hudson.diff", kind: "diff", status: "review"),
        DemoTile(id: "term3", title: "shell-03", kind: "terminal", status: "idle"),
        DemoTile(id: "notes", title: "scratch.notes", kind: "note", status: "open"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: HudSpacing.xxxl) {
            tilingSection   // <- dogfood grid: drag the items, tweak cols/gap, watch it re-tile
            buttons
            fieldsAndBadges
            textDocuments
            listRows
            kvRows
            emptyState
            cardsSection
        }
    }

    private var buttons: some View {
        VStack(alignment: .leading, spacing: HudSpacing.xl) {
            HudSectionLabel("Buttons")
            HudCard {
                HStack(spacing: HudSpacing.xl) {
                    HudButton("Primary",   icon: "play.fill", style: .primary(.green)) {}
                    HudButton("Secondary", icon: "gear",      style: .secondary)       {}
                    HudButton("Ghost",                          style: .ghost)          {}
                }
            }
        }
    }

    private var fieldsAndBadges: some View {
        VStack(alignment: .leading, spacing: HudSpacing.xl) {
            HudSectionLabel("Field & badges")
            HudCard {
                VStack(alignment: .leading, spacing: HudSpacing.xl) {
                    HudField("Search agents…", text: $fieldText)
                    HStack(spacing: HudSpacing.md) {
                        HudBadge("ONLINE",  tint: HudPalette.statusOk,    dot: true)
                        HudBadge("WARN",    tint: HudPalette.statusWarn,  dot: true)
                        HudBadge("ERROR",   tint: HudPalette.statusError, dot: true)
                        HudBadge("BETA",    tint: HudTint.violet.color)
                        HudBadge("12 RUNS", tint: HudPalette.muted)
                    }
                }
            }
        }
    }

    private var textDocuments: some View {
        VStack(alignment: .leading, spacing: HudSpacing.xl) {
            HudSectionLabel("Text documents")
            HudTextDocumentSurface(document: $document, mode: $documentMode)
                .frame(height: HudLayout.textDocumentPreviewHeight)
        }
    }

    private var listRows: some View {
        VStack(alignment: .leading, spacing: HudSpacing.xl) {
            HudSectionLabel("List rows")
            HudCard(padding: HudSpacing.md) {
                VStack(spacing: HudSpacing.md) {
                    HudListRow(
                        title: "alpha.main.mini",
                        subtitle: "agent · idle · 3 flights",
                        icon: "circle.grid.2x2.fill",
                        iconTint: .green,
                        isSelected: selectedRow == "alpha"
                    ) { selectedRow = "alpha" } trailing: {
                        HudBadge("3", tint: HudPalette.muted)
                    }
                    HudListRow(
                        title: "beta.main.mini",
                        subtitle: "agent · running",
                        icon: "waveform.circle.fill",
                        iconTint: .cyan,
                        isSelected: selectedRow == "beta"
                    ) { selectedRow = "beta" } trailing: {
                        HudStatusDot(color: HudPalette.statusOk, pulses: true)
                    }
                    HudListRow(
                        title: "gamma.main.mini",
                        subtitle: "agent · offline",
                        icon: "exclamationmark.triangle.fill",
                        iconTint: .amber,
                        isSelected: selectedRow == "gamma"
                    ) { selectedRow = "gamma" }
                }
            }
        }
    }

    private var kvRows: some View {
        VStack(alignment: .leading, spacing: HudSpacing.xl) {
            HudSectionLabel("KV rows · telemetry")
            HudCard {
                VStack(spacing: HudSpacing.lg) {
                    HudKVRow("cpu",    value: "32%")
                    HudKVRow("mem",    value: "68%")
                    HudKVRow("flights", value: "12")
                    HudKVRow("uptime", value: "4h 22m", valueColor: HudPalette.statusOk)
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: HudSpacing.xl) {
            HudSectionLabel("Empty state")
            HudEmptyState(
                title: "No agents online",
                subtitle: "Pair your first device to start a session.",
                icon: "antenna.radiowaves.left.and.right"
            )
        }
    }

    private var cardsSection: some View {
        VStack(alignment: .leading, spacing: HudSpacing.xl) {
            HudSectionLabel("Cards & insets")
            HudCard {
                VStack(alignment: .leading, spacing: HudSpacing.lg) {
                    Text("alpha.main.mini")
                        .font(HudFont.mono(HudTextSize.base, weight: .semibold))
                        .foregroundStyle(HudPalette.ink)
                    HudInset {
                        VStack(spacing: HudSpacing.md) {
                            HudKVRow("status", value: "online", valueColor: HudPalette.statusOk)
                            HudKVRow("agent",  value: "claude")
                            HudKVRow("branch", value: "main")
                        }
                    }
                    HudDivider()
                    HStack {
                        Text("Last activity 22:14")
                            .font(HudFont.mono(HudTextSize.xxs))
                            .foregroundStyle(HudPalette.dim)
                        Spacer()
                        HudBadge("LIVE", tint: HudPalette.statusOk, dot: true)
                    }
                }
            }
        }
    }

    // MARK: - Dogfooding: HudTiling (the new universal space-filling tiler)
    // This is the place to look at the native tiling capability in action.
    // macOS path = AppKit (HudTilingView NSView + mouse drag-to-reorder + computeTilingLayout).
    // Drop any Identifiable items + a renderItem. It maximizes space, respects constraints,
    // and lets you drag to rebalance while keeping the "never lose an inch" guarantee.

    private func setupOrderIfNeeded() {
        if itemOrder.isEmpty {
            itemOrder = tilingItems.map { $0.id }
        }
    }

    private func updateGridPositions() {
        setupOrderIfNeeded()
        let containerW: CGFloat = 620
        let containerH: CGFloat = 480

        let keys = itemOrder.map { AnyHashable($0) }
        let constraints = TilingConstraints(
            maxColumns: tilingMaxCols,
            gap: tilingGap,
            minItemWidth: 140,
            minItemHeight: 88,
            maxFill: 1.0,
            fillStrategy: .maximize,
            preferMoreColumns: true
        )

        let layouts = computeTilingLayout(
            keys: keys,
            containerWidth: containerW,
            containerHeight: containerH,
            constraints: constraints
        )

        basePositions = [:]
        for (i, id) in itemOrder.enumerated() {
            if i < layouts.count {
                let l = layouts[i]
                basePositions[id] = CGRect(x: l.x, y: l.y, width: l.width, height: l.height)
            }
        }
    }

    private func targetIndexFor(pointer: CGPoint, containerW: CGFloat, containerH: CGFloat) -> Int {
        setupOrderIfNeeded()
        let n = itemOrder.count
        guard n > 0 else { return 0 }

        let cols = max(1, tilingMaxCols ?? max(2, Int(ceil(sqrt(Double(n))))))
        let rows = (n + cols - 1) / cols

        let cellW = containerW / CGFloat(cols)
        let cellH = containerH / CGFloat(rows)

        let col = max(0, min(cols - 1, Int(pointer.x / cellW)))
        let row = max(0, min(rows - 1, Int(pointer.y / cellH)))

        var idx = row * cols + col
        idx = min(idx, n - 1)
        return idx
    }

    private func cellRect(for index: Int, containerW: CGFloat, containerH: CGFloat) -> CGRect {
        setupOrderIfNeeded()
        let n = itemOrder.count
        guard n > 0 else { return .zero }

        let cols = max(1, tilingMaxCols ?? max(2, Int(ceil(sqrt(Double(n))))))
        let rows = (n + cols - 1) / cols

        let cellW = containerW / CGFloat(cols)
        let cellH = containerH / CGFloat(rows)

        let col = index % cols
        let row = index / cols

        return CGRect(x: CGFloat(col) * cellW, y: CGFloat(row) * cellH, width: cellW, height: cellH)
    }

    private func saveTilingLayout() {
        let positionsData = basePositions.mapValues { CodableRect(x: Double($0.minX), y: Double($0.minY), w: Double($0.width), h: Double($0.height)) }
        let sizesData = customSizes.mapValues { CodableSize(w: Double($0.width), h: Double($0.height)) }

        let state = SavedTilingState(
            order: itemOrder,
            positions: positionsData,
            sizes: sizesData,
            maxCols: tilingMaxCols,
            gap: Double(tilingGap)
        )

        if let data = try? JSONEncoder().encode(state) {
            UserDefaults.standard.set(data, forKey: tilingPersistenceKey)
        }
    }

    private func loadTilingLayout() {
        guard let data = UserDefaults.standard.data(forKey: tilingPersistenceKey),
              let saved = try? JSONDecoder().decode(SavedTilingState.self, from: data) else {
            return
        }

        // Only restore if the order matches our current items (same demo set)
        let currentIDs = Set(tilingItems.map { $0.id })
        let savedIDs = Set(saved.order)
        guard savedIDs == currentIDs else { return }

        itemOrder = saved.order

        basePositions = saved.positions.mapValues { CGRect(x: $0.x, y: $0.y, width: $0.w, height: $0.h) }
        customSizes = saved.sizes.mapValues { CGSize(width: $0.w, height: $0.h) }

        if let mc = saved.maxCols { tilingMaxCols = mc }
        tilingGap = CGFloat(saved.gap)
    }

    @ViewBuilder
    private func tilingCard(for item: DemoTile) -> some View {
        let id = item.id
        let isDragging = draggingID == id
        let base = basePositions[id] ?? CGRect(x: 0, y: 0, width: 160, height: 100)

        let (displayOrigin, displaySize) = {
            let sz = customSizes[id] ?? base.size
            if isDragging {
                let startCenter = CGPoint(x: base.midX, y: base.midY)
                let currentCenter = CGPoint(
                    x: startCenter.x + dragTranslation.width,
                    y: startCenter.y + dragTranslation.height
                )
                return (CGPoint(x: currentCenter.x - sz.width / 2, y: currentCenter.y - sz.height / 2), sz)
            } else {
                return (base.origin, sz)
            }
        }()

        HudCard {
            Group {
                if item.id == "notes" {
                    // Example: "code tree" / file tree
                    VStack(alignment: .leading, spacing: 2) {
                        Text("project/").font(HudFont.mono(HudTextSize.xxs, weight: .semibold))
                        Text(" ├─ Sources/").font(HudFont.mono(HudTextSize.xxs))
                        Text(" │  └─ main.swift").font(HudFont.mono(HudTextSize.xxs))
                        Text(" └─ README.md").font(HudFont.mono(HudTextSize.xxs))
                    }
                } else if item.id == "diff" {
                    // Example: code diff view
                    VStack(alignment: .leading, spacing: 1) {
                        Text("- old line").font(HudFont.mono(HudTextSize.xxs)).foregroundStyle(.red)
                        Text("+ new line").font(HudFont.mono(HudTextSize.xxs)).foregroundStyle(.green)
                        Text("  context").font(HudFont.mono(HudTextSize.xxs)).foregroundStyle(HudPalette.dim)
                    }
                } else if item.id == "chat" {
                    // Example: chat / message view
                    VStack(alignment: .leading, spacing: 4) {
                        Text("You: How does the tiler work?").font(HudFont.mono(HudTextSize.xxs))
                        Text("AI: Uses computeTilingLayout + gestures.").font(HudFont.mono(HudTextSize.xxs))
                    }
                } else if ["logs", "term3"].contains(item.id) {
                    // Example: terminal / log output
                    VStack(alignment: .leading, spacing: 1) {
                        Text("$ tail -f app.log").font(HudFont.mono(HudTextSize.xxs)).foregroundStyle(.green)
                        Text("[info] server ready").font(HudFont.mono(HudTextSize.xxs)).foregroundStyle(HudPalette.dim)
                        Text("[debug] 3 workers active").font(HudFont.mono(HudTextSize.xxs)).foregroundStyle(HudPalette.dim)
                    }
                } else {
                    // Default agent-style content
                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: 6) {
                            Text(item.title)
                                .font(HudFont.mono(HudTextSize.sm, weight: .semibold))
                                .foregroundStyle(HudPalette.ink)
                                .lineLimit(1)
                            Spacer(minLength: 2)
                            HudStatusDot(
                                color: (item.status == "running" || item.status == "active" || item.status == "tailing") ? HudPalette.statusOk : HudPalette.muted,
                                size: 5
                            )
                        }
                        Text("\(item.kind) · \(item.status)")
                            .font(HudFont.mono(HudTextSize.xxs))
                            .foregroundStyle(HudPalette.dim)
                        if item.kind == "agent" {
                            HudKVRow("flights", value: "12")
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .frame(width: displaySize.width, height: displaySize.height)
        .offset(x: displayOrigin.x, y: displayOrigin.y)
        .zIndex(isDragging ? 10 : 0)
        .scaleEffect(isDragging ? 1.03 : 1.0)
        .animation(.spring(response: 0.2), value: isDragging)
        // Drag to reorder within the current grid (cell-based targeting)
        .gesture(
            DragGesture(coordinateSpace: .local)
                .onChanged { value in
                    if draggingID == nil {
                        draggingID = id
                        dragTranslation = .zero
                        dragTargetIndex = nil
                    }
                    dragTranslation = value.translation

                    // Live target preview (no reordering yet)
                    let containerW: CGFloat = 620
                    let containerH: CGFloat = 480
                    let baseForCalc = basePositions[id] ?? base
                    let currentCenter = CGPoint(
                        x: baseForCalc.midX + dragTranslation.width,
                        y: baseForCalc.midY + dragTranslation.height
                    )
                    dragTargetIndex = targetIndexFor(pointer: currentCenter, containerW: containerW, containerH: containerH)
                }
                .onEnded { value in
                    let containerW: CGFloat = 620
                    let containerH: CGFloat = 480
                    let baseForCalc = basePositions[id] ?? base
                    let finalCenter = CGPoint(
                        x: baseForCalc.midX + value.translation.width,
                        y: baseForCalc.midY + value.translation.height
                    )
                    let target = targetIndexFor(pointer: finalCenter, containerW: containerW, containerH: containerH)

                    let currentIdx = itemOrder.firstIndex(of: id)!
                    if target != currentIdx {
                        let moved = itemOrder.remove(at: currentIdx)
                        itemOrder.insert(moved, at: target)
                        updateGridPositions()
                    }

                    draggingID = nil
                    dragTranslation = .zero
                    dragTargetIndex = nil
                    saveTilingLayout()
                }
        )
        // Resize handle (free resize until you rebalance)
        .overlay(alignment: .bottomTrailing) {
            Rectangle()
                .fill(Color.white.opacity(0.3))
                .frame(width: 16, height: 16)
                .offset(x: -2, y: -2)
                .gesture(
                    DragGesture()
                        .onChanged { value in
                            var newSize = customSizes[id] ?? base.size
                            newSize.width = max(120, newSize.width + value.translation.width)
                            newSize.height = max(80, newSize.height + value.translation.height)
                            let maxW = 620 - base.minX
                            let maxH = 480 - base.minY
                            newSize.width = min(newSize.width, maxW)
                            newSize.height = min(newSize.height, maxH)
                            customSizes[id] = newSize
                        }
                        .onEnded { _ in
                            saveTilingLayout()
                        }
                )
        }
    }

    private var tilingSection: some View {
        VStack(alignment: .leading, spacing: HudSpacing.xl) {
            HudSectionLabel("HudTiling — Grid Action")
            Text("Native macOS AppKit (HudTilingView + mouse drag). Drag cards to reorder. Layout always re-computes to fill the container with no wasted space. Try changing cols/gap then drag. 8 items here (multiple agents + terminals side-by-side).")
                .font(HudFont.mono(HudTextSize.xxs))
                .foregroundStyle(HudPalette.muted)

            // Live constraint dogfood controls
            HStack(spacing: HudSpacing.sm) {
                Text("cols").font(HudFont.mono(HudTextSize.micro)).foregroundStyle(HudPalette.dim)

                // Make the column choices obviously tappable + show active state
                Group {
                    Button(action: { tilingMaxCols = nil }) {
                        Text("auto")
                    }
                    .opacity(tilingMaxCols == nil ? 1.0 : 0.6)
                    .background(
                        tilingMaxCols == nil
                            ? Color.white.opacity(0.08)
                            : Color.clear
                    )

                    Button(action: { tilingMaxCols = 2 }) {
                        Text("2")
                    }
                    .opacity(tilingMaxCols == 2 ? 1.0 : 0.6)
                    .background(
                        tilingMaxCols == 2
                            ? Color.white.opacity(0.08)
                            : Color.clear
                    )

                    Button(action: { tilingMaxCols = 3 }) {
                        Text("3")
                    }
                    .opacity(tilingMaxCols == 3 ? 1.0 : 0.6)
                    .background(
                        tilingMaxCols == 3
                            ? Color.white.opacity(0.08)
                            : Color.clear
                    )

                    Button(action: { tilingMaxCols = 4 }) {
                        Text("4")
                    }
                    .opacity(tilingMaxCols == 4 ? 1.0 : 0.6)
                    .background(
                        tilingMaxCols == 4
                            ? Color.white.opacity(0.08)
                            : Color.clear
                    )
                }
                .font(HudFont.mono(HudTextSize.micro))
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(
                    RoundedRectangle(cornerRadius: 4)
                        .stroke(HudHairline.standard, lineWidth: 1)
                )
                .cornerRadius(4)

                Spacer().frame(width: HudSpacing.lg)

                Text("gap").font(HudFont.mono(HudTextSize.micro)).foregroundStyle(HudPalette.dim)
                Button(action: { tilingGap = 8 }) { Text("8").font(HudFont.mono(HudTextSize.micro)) }
                Button(action: { tilingGap = 12 }) { Text("12").font(HudFont.mono(HudTextSize.micro)) }
                Button(action: { tilingGap = 16 }) { Text("16").font(HudFont.mono(HudTextSize.micro)) }
                Button(action: { tilingGap = 24 }) { Text("24").font(HudFont.mono(HudTextSize.micro)) }

                Spacer()

                Button("Shuffle") {
                    tilingItems.shuffle()
                    itemOrder = tilingItems.map { $0.id }
                    updateGridPositions()
                    saveTilingLayout()
                }
                .font(HudFont.mono(HudTextSize.micro))

                Button("Reset") {
                    tilingItems = defaultTilingItems
                    itemOrder = []
                    customSizes = [:]
                    basePositions = [:]
                    updateGridPositions()
                    saveTilingLayout()
                }
                .font(HudFont.mono(HudTextSize.micro))
                .buttonStyle(.bordered)
            }
            .buttonStyle(.plain)
            .foregroundStyle(HudPalette.ink)

            // Interactive drag + resize area (the "make drag and resize a thing" demo)
            // + Rebalance button that uses the grid controls + computeTilingLayout
            VStack(alignment: .leading, spacing: HudSpacing.sm) {
                HStack {
                    Text("Drag to move • Drag corner to resize • Rebalance respects the cols/gap above")
                        .font(HudFont.mono(HudTextSize.xxs))
                        .foregroundStyle(HudPalette.muted)

                    Spacer()

                    Button("Rebalance") {
                        customSizes = [:]
                        updateGridPositions()
                    }
                    .font(HudFont.mono(HudTextSize.micro))
                    .buttonStyle(.borderedProminent)
                }

                ZStack(alignment: .topLeading) {
                    // container background
                    RoundedRectangle(cornerRadius: 6)
                        .fill(HudSurface.base.opacity(0.6))
                        .frame(width: 620, height: 480)
                        .overlay(
                            RoundedRectangle(cornerRadius: 6)
                                .stroke(HudHairline.standard, lineWidth: 1)
                        )

                    // Highlight for current drop target while dragging
                    if let target = dragTargetIndex {
                        let rect = cellRect(for: target, containerW: 620, containerH: 480)
                        RoundedRectangle(cornerRadius: 4)
                            .stroke(Color.blue.opacity(0.6), lineWidth: 2)
                            .background(RoundedRectangle(cornerRadius: 4).fill(Color.blue.opacity(0.1)))
                            .frame(width: rect.width - 4, height: rect.height - 4)
                            .offset(x: rect.minX + 2, y: rect.minY + 2)
                            .zIndex(5)
                    }

                    ForEach(tilingItems, id: \.id) { item in
                        tilingCard(for: item)
                    }
                }
                .frame(width: 620, height: 480)
            }
            .onAppear {
                loadTilingLayout()
                setupOrderIfNeeded()
                if basePositions.isEmpty {
                    updateGridPositions()
                }
            }
            .onChange(of: tilingMaxCols) { _ in
                updateGridPositions()
                saveTilingLayout()
            }
            .onChange(of: tilingGap) { _ in
                updateGridPositions()
                saveTilingLayout()
            }
        }
    }
}
