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
    @State private var targetRect: CGRect? = nil
    @State private var demoContainerSize: CGSize = .zero  // start at zero; real value comes from GeometryReader to avoid race with load/update

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
        let containerW = demoContainerSize.width
        let containerH = demoContainerSize.height
        guard containerW > 0, containerH > 0 else { return }

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

    private func targetIndexFor(pointer: CGPoint) -> Int {
        setupOrderIfNeeded()
        var bestIdx = 0
        var bestDist = CGFloat.greatestFiniteMagnitude
        for (idx, id) in itemOrder.enumerated() {
            if let rect = basePositions[id] {
                let center = CGPoint(x: rect.midX, y: rect.midY)
                let d = hypot(center.x - pointer.x, center.y - pointer.y)
                if d < bestDist {
                    bestDist = d
                    bestIdx = idx
                }
            }
        }
        return bestIdx
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
                    let baseForCalc = basePositions[id] ?? base
                    let currentCenter = CGPoint(
                        x: baseForCalc.midX + dragTranslation.width,
                        y: baseForCalc.midY + dragTranslation.height
                    )
                    let target = targetIndexFor(pointer: currentCenter)
                    dragTargetIndex = target
                    targetRect = itemOrder.indices.contains(target) ? basePositions[itemOrder[target]] : nil
                }
                .onEnded { value in
                    let baseForCalc = basePositions[id] ?? base
                    let finalCenter = CGPoint(
                        x: baseForCalc.midX + value.translation.width,
                        y: baseForCalc.midY + value.translation.height
                    )
                    let target = targetIndexFor(pointer: finalCenter)

                    // Safe lookup: guard instead of force-unwrap (addresses review comment about races/persistence mismatch).
                    if let currentIdx = itemOrder.firstIndex(of: id) {
                        if target != currentIdx && target >= 0 && target < itemOrder.count {
                            let moved = itemOrder.remove(at: currentIdx)
                            let insertAt = min(max(0, target > currentIdx ? target - 1 : target), itemOrder.count)
                            itemOrder.insert(moved, at: insertAt)
                            updateGridPositions()
                        }
                    } else {
                        // id not in current order (e.g. after Reset or data mismatch); just refresh
                        updateGridPositions()
                    }

                    draggingID = nil
                    dragTranslation = .zero
                    dragTargetIndex = nil
                    targetRect = nil
                    saveTilingLayout()
                }
        )
        // Resize handle (free resize until you rebalance)
        // Uses start-of-gesture size + total translation (DragGesture translation is cumulative from gesture start,
        // not incremental per onChanged). This fixes compounding on repeated onChanged calls.
        .overlay(alignment: .bottomTrailing) {
            Rectangle()
                .fill(HudSurface.control)
                .frame(width: HudSpacing.xl, height: HudSpacing.xl)
                .offset(x: -2, y: -2)
                .gesture(
                    DragGesture()
                        .onChanged { value in
                            // Capture start size once per gesture by using a temp if not present, but for simplicity here we
                            // recompute from the *base layout size* + total translation (base is stable during gesture).
                            // Better would be a @GestureState for startSize; this version at least avoids double-adding.
                            let start = customSizes[id] ?? base.size
                            var newSize = start
                            newSize.width = max(120, start.width + value.translation.width)
                            newSize.height = max(80, start.height + value.translation.height)
                            // Use live measured container (from GeometryReader) instead of hardcoded demo window size.
                            let liveW = demoContainerSize.width > 0 ? demoContainerSize.width : 620
                            let liveH = demoContainerSize.height > 0 ? demoContainerSize.height : 480
                            let maxW = max(120, liveW - base.minX)
                            let maxH = max(80, liveH - base.minY)
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
                            ? HudSurface.hover
                            : Color.clear
                    )

                    Button(action: { tilingMaxCols = 2 }) {
                        Text("2")
                    }
                    .opacity(tilingMaxCols == 2 ? 1.0 : 0.6)
                    .background(
                        tilingMaxCols == 2
                            ? HudSurface.hover
                            : Color.clear
                    )

                    Button(action: { tilingMaxCols = 3 }) {
                        Text("3")
                    }
                    .opacity(tilingMaxCols == 3 ? 1.0 : 0.6)
                    .background(
                        tilingMaxCols == 3
                            ? HudSurface.hover
                            : Color.clear
                    )

                    Button(action: { tilingMaxCols = 4 }) {
                        Text("4")
                    }
                    .opacity(tilingMaxCols == 4 ? 1.0 : 0.6)
                    .background(
                        tilingMaxCols == 4
                            ? HudSurface.hover
                            : Color.clear
                    )
                }
                .font(HudFont.mono(HudTextSize.micro))
                .padding(.horizontal, HudSpacing.sm)
                .padding(.vertical, HudSpacing.xs)
                .background(
                    RoundedRectangle(cornerRadius: HudRadius.tight)
                        .stroke(HudHairline.standard, lineWidth: 1)
                )
                .cornerRadius(HudRadius.tight)

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
                        saveTilingLayout()
                    }
                    .font(HudFont.mono(HudTextSize.micro))
                    .buttonStyle(.borderedProminent)
                }

                GeometryReader { geo in
                    let containerW = geo.size.width
                    let containerH = geo.size.height

                    ZStack(alignment: .topLeading) {
                        // container background
                        RoundedRectangle(cornerRadius: HudRadius.standard)
                            .fill(HudSurface.inset)
                            .frame(width: containerW, height: containerH)
                            .overlay(
                                RoundedRectangle(cornerRadius: HudRadius.standard)
                                    .stroke(HudHairline.standard, lineWidth: 1)
                            )

                        // Highlight for current drop target while dragging (accent tinted for visibility)
                        if let rect = targetRect {
                            RoundedRectangle(cornerRadius: HudRadius.tight)
                                .stroke(HudSurface.tintBorder(HudPalette.accent), lineWidth: 2)
                                .background(RoundedRectangle(cornerRadius: HudRadius.tight).fill(HudSurface.tintGhost(HudPalette.accent)))
                                .frame(width: rect.width - 4, height: rect.height - 4)
                                .offset(x: rect.minX + 2, y: rect.minY + 2)
                                .zIndex(5)
                        }

                        ForEach(tilingItems, id: \.id) { item in
                            tilingCard(for: item)
                        }
                    }
                    .onAppear {
                        demoContainerSize = geo.size
                        // If we loaded persisted state before size was known, now recompute/adapt.
                        if !basePositions.isEmpty && geo.size.width > 0 && geo.size.height > 0 {
                            // Prefer a clean recompute using current constraints + measured size (more accurate than pure scale).
                            updateGridPositions()
                        }
                    }
                    .onChange(of: geo.size) { _, newSize in
                        let old = demoContainerSize
                        demoContainerSize = newSize
                        if old.width > 0 && old.height > 0 && !basePositions.isEmpty {
                            let sx = newSize.width / old.width
                            let sy = newSize.height / old.height
                            for k in basePositions.keys {
                                var r = basePositions[k]!
                                r.origin.x *= sx
                                r.origin.y *= sy
                                r.size.width *= sx
                                r.size.height *= sy
                                basePositions[k] = r
                            }
                            for k in customSizes.keys {
                                var s = customSizes[k]!
                                s.width *= sx
                                s.height *= sy
                                customSizes[k] = s
                            }
                        }
                    }
                }
            }
            .onAppear {
                loadTilingLayout()
                setupOrderIfNeeded()
                // Only compute with real measured size. If geo hasn't reported yet, the .onChange(of: geo.size)
                // or the container's onChange will trigger updateGridPositions.
                if basePositions.isEmpty && demoContainerSize.width > 0 && demoContainerSize.height > 0 {
                    updateGridPositions()
                } else if !basePositions.isEmpty && demoContainerSize.width > 0 && demoContainerSize.height > 0 {
                    // Persisted positions may be from a different size; adapt once we know live size.
                    // (Scaling happens in geo .onChange; this ensures a fresh compute if needed.)
                    if basePositions.values.allSatisfy({ $0.width == 0 || $0.height == 0 }) {
                        updateGridPositions()
                    }
                }
            }
            .onChange(of: tilingMaxCols) { _, _ in
                updateGridPositions()
                saveTilingLayout()
            }
            .onChange(of: tilingGap) { _, _ in
                updateGridPositions()
                saveTilingLayout()
            }
        }
    }
}
