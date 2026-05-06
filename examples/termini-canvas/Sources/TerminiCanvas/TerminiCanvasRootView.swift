import Darwin
import Foundation
import SwiftUI
import AppKit
import HudsonUI
import HudsonShell
import HudsonTerminal
import Termini

@MainActor
private final class TerminalNode: ObservableObject, Identifiable {
    let id = UUID()
    let workspace: TerminiLocalPTYWorkspace
    let title: String
    let subtitle: String
    let tint: HudTint

    @Published var origin: CGPoint
    @Published var size: CGSize
    @Published var zIndex: Double

    init(index: Int, origin: CGPoint, size: CGSize, tint: HudTint, zIndex: Double) {
        let controller = TerminiTerminalController()
        self.workspace = TerminiLocalPTYWorkspace(
            processSpec: Self.localShellSpec(),
            controller: controller
        )
        self.title = "Termini \(index)"
        self.subtitle = "zsh · local PTY"
        self.origin = origin
        self.size = size
        self.tint = tint
        self.zIndex = zIndex
        workspace.start()
    }

    var controller: TerminiTerminalController {
        workspace.controller
    }

    func move(by delta: CGSize) {
        origin.x += delta.width
        origin.y += delta.height
    }

    func resize(by delta: CGSize) {
        size.width = max(340, size.width + delta.width)
        size.height = max(220, size.height + delta.height)
    }

    func stop() {
        workspace.stop()
    }

    private static func localShellSpec() -> TerminiProcessSpec {
        let environment = ProcessInfo.processInfo.environment
        let shellPath = environment["SHELL"].flatMap { $0.isEmpty ? nil : $0 } ?? "/bin/zsh"
        return TerminiProcessSpec(
            executableURL: URL(fileURLWithPath: shellPath),
            arguments: ["-l"],
            environment: [
                "TERM": "xterm-256color",
                "HUDSON_TERMINI_CANVAS": "1",
            ],
            workingDirectoryURL: hudsonRepoRoot
        )
    }

    private static var hudsonRepoRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
    }
}

private enum CanvasTool {
    case select
    case hand

    var statusLabel: String {
        switch self {
        case .select: "select"
        case .hand: "hand"
        }
    }
}

private enum CanvasNavigationFilter: String, CaseIterable, Identifiable {
    case all
    case selected
    case live

    var id: String { rawValue }

    var label: String {
        switch self {
        case .all: "All"
        case .selected: "Selected"
        case .live: "Live"
        }
    }
}

private struct SelectionDrag {
    var start: CGPoint
    var current: CGPoint

    var viewportRect: CGRect {
        CGRect(
            x: min(start.x, current.x),
            y: min(start.y, current.y),
            width: abs(current.x - start.x),
            height: abs(current.y - start.y)
        )
    }
}

private func formattedZoom(_ scale: CGFloat) -> String {
    let percent = scale * 100

    if percent < 1 {
        return String(format: "%.2f%%", Double(percent))
    }
    if percent < 10 {
        return String(format: "%.1f%%", Double(percent))
    }
    if percent >= 10_000 {
        return String(format: "%.1fk%%", Double(percent / 1_000))
    }
    return "\(Int(percent.rounded()))%"
}

struct TerminiCanvasRootView: View {
    private static let tileLimit = 128
    private static let largeTileLimit = 512
    private static let minimumCanvasScale: CGFloat = 0.002
    private static let maximumCanvasScale: CGFloat = 64

    @State private var nodes: [TerminalNode] = []
    @State private var selectedIDs: Set<UUID> = []
    @State private var navigationFilter: CanvasNavigationFilter = .all
    @State private var navigationCollapsed = false
    @State private var navigationWidth: CGFloat = 254
    @State private var inspectorCollapsed = false
    @State private var inspectorWidth: CGFloat = 300
    @State private var nextIndex = 3
    @State private var nextZIndex: Double = 3
    @StateObject private var controlAPI = TerminiCanvasControlAPI()
    @State private var controlStatus = "API ready"
    @State private var didBootstrap = false
    @State private var canvasTool: CanvasTool = .select
    @State private var canvasPan: CGSize = .zero
    @State private var canvasScale: CGFloat = 1
    @State private var panStart: CGSize?
    @State private var zoomStart: CGFloat = 1
    @State private var lastViewportSize = CGSize(width: 920, height: 560)
    @State private var selectionDrag: SelectionDrag?

    var body: some View {
        HudAppShell {
            navigationPanel
        } trailing: {
            inspectorPanel
        } content: {
            terminalCanvasShell
        } statusBar: {
            statusBar
        }
        .onAppear {
            bootstrapIfNeeded()
            startControlAPI()
        }
        .onDisappear {
            controlAPI.stop()
            stopAllNodes()
            didBootstrap = false
        }
    }

    @ViewBuilder
    private var navigationPanel: some View {
        if !navigationCollapsed {
            CanvasNavigationPanel(
                width: $navigationWidth,
                nodes: navigationNodes,
                minimapNodes: nodes,
                totalCount: nodes.count,
                selectedCount: selectedIDs.count,
                filter: $navigationFilter,
                selectedIDs: selectedIDs,
                viewportWorldRect: viewportWorldRect,
                canvasContentSize: canvasContentSize,
                canvasPan: canvasPan,
                canvasScale: canvasScale,
                viewportSize: lastViewportSize,
                onSelectNode: selectNode,
                onCenterWorldPoint: centerCanvas(on:),
                onFit: fitCanvasToViewport,
                onCollapse: { navigationCollapsed = true }
            )
        }
    }

    @ViewBuilder
    private var inspectorPanel: some View {
        if !inspectorCollapsed {
            CanvasInspectorPanel(
                width: $inspectorWidth,
                selectedNodes: selectedNodes,
                totalCount: nodes.count,
                onCenterNode: { node in
                    centerCanvas(on: CGPoint(x: node.origin.x + node.size.width / 2, y: node.origin.y + node.size.height / 2))
                },
                onCloseNode: close,
                onCollapse: { inspectorCollapsed = true }
            )
        }
    }

    private var selectedNodes: [TerminalNode] {
        nodes.filter { selectedIDs.contains($0.id) }
    }

    private func showCommandPlaceholder() {
        controlStatus = "Command palette placeholder"
    }

    private var canvasHeader: some View {
        HStack(spacing: HudSpacing.lg) {
            HudStatusDot(color: HudPalette.statusOk, size: 7)
            Text("TERMINI CANVAS")
                .font(HudFont.mono(10, weight: .bold))
                .tracking(1.4)
                .foregroundStyle(HudPalette.ink)
            Text("native macOS HudsonKit instantiation")
                .font(HudFont.mono(10))
                .foregroundStyle(HudPalette.muted)
            Spacer()
            if navigationCollapsed {
                CanvasIconButton(
                    systemName: "sidebar.left",
                    help: "Show navigator",
                    action: { navigationCollapsed = false }
                )
            }
            if inspectorCollapsed {
                CanvasIconButton(
                    systemName: "sidebar.right",
                    help: "Show inspector",
                    action: { inspectorCollapsed = false }
                )
            }
            CanvasToolSwitch(
                tool: canvasTool,
                onSelect: { canvasTool = .select },
                onHand: { canvasTool = .hand }
            )
            CommandKeyButton(action: showCommandPlaceholder)

            HudButton("New", icon: "plus", style: .primary(.cyan)) {
                spawnTerminal()
            }
        }
    }

    private var terminalCanvasShell: some View {
        VStack(spacing: 0) {
            canvasHeader
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, HudSpacing.xxl)
                .frame(height: HudLayout.navHeight)
                .background(HudPalette.chrome)
            HudDivider(color: HudHairline.standard)
            canvasViewport
        }
    }

    private var canvasViewport: some View {
        GeometryReader { proxy in
            ZStack(alignment: .topLeading) {
                HudPalette.bg
                InfiniteCanvasBackground(
                    pan: canvasPan,
                    scale: canvasScale
                )
                .allowsHitTesting(false)

                ZStack(alignment: .topLeading) {
                    terminalCanvas
                        .frame(
                            width: canvasContentSize.width,
                            height: canvasContentSize.height,
                            alignment: .topLeading
                        )
                }
                .scaleEffect(canvasScale, anchor: .topLeading)
                .offset(canvasPan)
                .allowsHitTesting(canvasTool == .select)

                if let rect = selectionDrag?.viewportRect {
                    SelectionMarquee(rect: rect)
                }

            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .clipped()
            .contentShape(Rectangle())
            .background(
                CanvasInputBridge(
                    onScroll: { delta, location in
                        handleCanvasScroll(delta: delta, at: location)
                    },
                    onMagnify: { magnification, location in
                        handleCanvasMagnify(magnification, at: location)
                    }
                )
            )
            .gesture(canvasInteractionGesture)
            .simultaneousGesture(canvasZoomGesture)
            .onAppear {
                lastViewportSize = proxy.size
            }
            .onChange(of: proxy.size) { _, size in
                lastViewportSize = size
            }
            .overlay(alignment: .bottomTrailing) {
                CanvasZoomTool(
                    scale: canvasScale,
                    onZoomOut: { zoom(by: 0.5) },
                    onZoomIn: { zoom(by: 2) },
                    onFit: { fitCanvasToViewport() }
                )
                .padding(HudSpacing.xl)
            }
        }
    }

    private var canvasInteractionGesture: some Gesture {
        DragGesture(minimumDistance: 2)
            .onChanged { value in
                switch canvasTool {
                case .hand:
                    let start = panStart ?? canvasPan
                    panStart = start
                    canvasPan = CGSize(
                        width: start.width + value.translation.width,
                        height: start.height + value.translation.height
                    )
                case .select:
                    selectionDrag = SelectionDrag(
                        start: value.startLocation,
                        current: value.location
                    )
                    updateMarqueeSelection()
                }
            }
            .onEnded { _ in
                panStart = nil
                selectionDrag = nil
            }
    }

    private var canvasZoomGesture: some Gesture {
        MagnificationGesture()
            .onChanged { value in
                setCanvasScale(zoomStart * value, around: viewportCenter)
            }
            .onEnded { _ in
                zoomStart = canvasScale
            }
    }

    private func zoom(by factor: CGFloat) {
        setCanvasScale(canvasScale * factor, around: viewportCenter)
    }

    private func handleCanvasScroll(delta: CGSize, at viewportPoint: CGPoint) {
        if abs(delta.height) >= abs(delta.width) {
            let factor = min(max(exp(delta.height * 0.004), 0.82), 1.22)
            setCanvasScale(canvasScale * factor, around: viewportPoint)
        } else {
            canvasPan.width += delta.width
        }
    }

    private func handleCanvasMagnify(_ magnification: CGFloat, at viewportPoint: CGPoint) {
        let factor = min(max(1 + magnification, 0.75), 1.35)
        setCanvasScale(canvasScale * factor, around: viewportPoint)
    }

    private func setCanvasScale(_ proposedScale: CGFloat, around screenPoint: CGPoint) {
        let oldScale = canvasScale
        let newScale = clampedScale(proposedScale)
        guard newScale != oldScale else { return }

        let worldPoint = CGPoint(
            x: (screenPoint.x - canvasPan.width) / oldScale,
            y: (screenPoint.y - canvasPan.height) / oldScale
        )

        canvasScale = newScale
        zoomStart = newScale
        canvasPan = CGSize(
            width: screenPoint.x - worldPoint.x * newScale,
            height: screenPoint.y - worldPoint.y * newScale
        )
    }

    private func fitCanvasToViewport() {
        let viewport = lastViewportSize
        guard viewport.width > 80, viewport.height > 80 else { return }

        let horizontalScale = (viewport.width - 64) / canvasContentSize.width
        let verticalScale = (viewport.height - 64) / canvasContentSize.height
        let scale = clampedScale(min(horizontalScale, verticalScale))

        canvasScale = scale
        zoomStart = scale
        canvasPan = CGSize(
            width: max(32, (viewport.width - canvasContentSize.width * scale) / 2),
            height: max(32, (viewport.height - canvasContentSize.height * scale) / 2)
        )
    }

    private func clampedScale(_ value: CGFloat) -> CGFloat {
        min(max(value, Self.minimumCanvasScale), Self.maximumCanvasScale)
    }

    private var viewportCenter: CGPoint {
        CGPoint(
            x: lastViewportSize.width / 2,
            y: lastViewportSize.height / 2
        )
    }

    private func updateMarqueeSelection() {
        guard let selectionDrag else { return }
        let rect = worldRect(fromViewportRect: selectionDrag.viewportRect)
        selectedIDs = Set(
            nodes
                .filter { node in
                    rect.intersects(nodeFrame(node))
                }
                .map(\.id)
        )
    }

    private func worldRect(fromViewportRect rect: CGRect) -> CGRect {
        let topLeft = worldPoint(fromViewportPoint: rect.origin)
        let bottomRight = worldPoint(
            fromViewportPoint: CGPoint(x: rect.maxX, y: rect.maxY)
        )
        return CGRect(
            x: min(topLeft.x, bottomRight.x),
            y: min(topLeft.y, bottomRight.y),
            width: abs(bottomRight.x - topLeft.x),
            height: abs(bottomRight.y - topLeft.y)
        )
    }

    private func worldPoint(fromViewportPoint point: CGPoint) -> CGPoint {
        CGPoint(
            x: (point.x - canvasPan.width) / canvasScale,
            y: (point.y - canvasPan.height) / canvasScale
        )
    }

    private var viewportWorldRect: CGRect {
        worldRect(
            fromViewportRect: CGRect(
                origin: .zero,
                size: lastViewportSize
            )
        )
    }

    private func centerCanvas(on worldPoint: CGPoint) {
        canvasPan = CGSize(
            width: viewportCenter.x - worldPoint.x * canvasScale,
            height: viewportCenter.y - worldPoint.y * canvasScale
        )
    }

    private func nodeFrame(_ node: TerminalNode) -> CGRect {
        CGRect(origin: node.origin, size: node.size)
    }

    private var navigationNodes: [TerminalNode] {
        switch navigationFilter {
        case .all:
            nodes
        case .selected:
            nodes.filter { selectedIDs.contains($0.id) }
        case .live:
            nodes.filter { rendersLiveSurface(for: $0) }
        }
    }

    private func rendersLiveSurface(for node: TerminalNode) -> Bool {
        if nodes.count <= 24 {
            return true
        }

        return canvasScale >= 0.58
            && selectedIDs.count == 1
            && selectedIDs.contains(node.id)
    }

    private var terminalCanvas: some View {
        ZStack(alignment: .topLeading) {
            ForEach(nodes) { node in
                TerminalNodeView(
                    node: node,
                    isSelected: selectedIDs.contains(node.id),
                    rendersLiveSurface: rendersLiveSurface(for: node),
                    onSelect: { selectNode(node.id) },
                    onClose: { close(node.id) },
                    onMove: { delta in move(node.id, delta: worldDelta(delta)) },
                    onResize: { delta in resize(node.id, delta: worldDelta(delta)) }
                )
            }
        }
        .coordinateSpace(name: "termini-canvas")
        .contentShape(Rectangle())
        .onTapGesture {
            selectedIDs.removeAll()
        }
    }

    private var inspector: some View {
        VStack(alignment: .leading, spacing: HudSpacing.xl) {
            HudButton("Create terminal", icon: "plus", style: .primary(.cyan)) {
                spawnTerminal()
            }

            ForEach(nodes) { node in
                TerminalInspectorRow(
                    node: node,
                    isSelected: selectedIDs.contains(node.id),
                    onSelect: { selectNode(node.id) }
                )
            }

            Spacer()
        }
        .padding(HudSpacing.xxl)
    }

    private var statusBar: some View {
        ZStack {
            HStack(spacing: HudSpacing.xl) {
                HudStatusDot(color: HudPalette.statusOk)
                Text("HUDSONKIT MACOS")
                    .font(HudFont.mono(10, weight: .bold))
                    .tracking(1.4)
                    .foregroundStyle(HudPalette.muted)
                Text("·")
                    .font(HudFont.mono(10))
                    .foregroundStyle(HudPalette.dim)
                Text("\(nodes.count) nodes")
                    .font(HudFont.mono(10))
                    .foregroundStyle(HudPalette.muted)
                Text("·")
                    .font(HudFont.mono(10))
                    .foregroundStyle(HudPalette.dim)
                Text("\(selectedIDs.count) selected")
                    .font(HudFont.mono(10))
                    .foregroundStyle(HudPalette.muted)
                Text("·")
                    .font(HudFont.mono(10))
                    .foregroundStyle(HudPalette.dim)
                Text(controlStatus.uppercased())
                    .font(HudFont.mono(10))
                    .foregroundStyle(HudPalette.muted)
                Spacer()
            }
            .padding(.horizontal, HudSpacing.xxl)

            ViewportStatusChip(
                rect: viewportWorldRect,
                scale: canvasScale,
                tool: canvasTool
            )
        }
        .frame(height: HudLayout.statusBarHeight)
    }

    private func spawnTerminal() {
        let offset = CGFloat((nextIndex - 1) % 5) * 36
        let node = TerminalNode(
            index: nextIndex,
            origin: CGPoint(x: 130 + offset, y: 120 + offset),
            size: CGSize(width: 500, height: 316),
            tint: tint(for: nextIndex),
            zIndex: nextZIndex
        )
        nodes.append(node)
        selectedIDs = [node.id]
        nextIndex += 1
        nextZIndex += 1
    }

    private func startControlAPI() {
        controlAPI.start { command in
            let response = handleControlCommand(command)
            controlStatus = response.message
            return response
        }
    }

    private func bootstrapIfNeeded() {
        guard !didBootstrap else { return }
        didBootstrap = true
        resetTerminals()
    }

    private func handleControlCommand(
        _ command: TerminiCanvasControlCommand
    ) -> TerminiCanvasControlResponse {
        switch command.normalizedAction {
        case "tile", "grid":
            return tileTerminals(command)
        case "spawn", "new":
            return spawnTerminals(command)
        case "clear":
            stopAllNodes()
            return controlResponse(
                command,
                ok: true,
                message: "cleared terminals"
            )
        case "reset":
            resetTerminals()
            return controlResponse(
                command,
                ok: true,
                message: "reset terminals"
            )
        case "status":
            return controlResponse(
                command,
                ok: true,
                message: "\(nodes.count) terminals"
            )
        default:
            return controlResponse(
                command,
                ok: false,
                message: "unknown action \(command.action)"
            )
        }
    }

    private func tileTerminals(
        _ command: TerminiCanvasControlCommand
    ) -> TerminiCanvasControlResponse {
        let columns = clamp(command.columns ?? 4, lower: 1, upper: 32)
        let rows = clamp(command.rows ?? 4, lower: 1, upper: 32)
        let total = columns * rows
        let limit = command.allowLarge == true ? Self.largeTileLimit : Self.tileLimit

        guard total <= limit else {
            return controlResponse(
                command,
                ok: false,
                message: "requested \(total); limit is \(limit)"
            )
        }

        let shouldReset = command.reset ?? true
        let reusableNodes = shouldReset ? nodes : []
        var reusableIndex = 0

        if shouldReset {
            nextIndex = 1
            nextZIndex = 1
            canvasPan = .zero
        }

        let size = CGSize(
            width: CGFloat(max(240.0, command.width ?? 300.0)),
            height: CGFloat(max(160.0, command.height ?? 200.0))
        )
        let gap = CGFloat(max(0.0, command.gap ?? 18.0))
        let originX = CGFloat(command.originX ?? 64.0)
        let originY = CGFloat(command.originY ?? 70.0)

        var tiledNodes: [TerminalNode] = []
        tiledNodes.reserveCapacity(total)

        for row in 0..<rows {
            for column in 0..<columns {
                let origin = CGPoint(
                    x: originX + CGFloat(column) * (size.width + gap),
                    y: originY + CGFloat(row) * (size.height + gap)
                )

                let node: TerminalNode
                if shouldReset && reusableIndex < reusableNodes.count {
                    node = reusableNodes[reusableIndex]
                    node.origin = origin
                    node.size = size
                    node.zIndex = nextZIndex
                    reusableIndex += 1
                } else {
                    node = TerminalNode(
                        index: nextIndex,
                        origin: origin,
                        size: size,
                        tint: tint(for: nextIndex),
                        zIndex: nextZIndex
                    )
                }
                tiledNodes.append(node)
                nextIndex += 1
                nextZIndex += 1
            }
        }

        if shouldReset {
            reusableNodes.dropFirst(reusableIndex).forEach { $0.stop() }
            nodes = tiledNodes
        } else {
            nodes.append(contentsOf: tiledNodes)
        }
        selectedIDs.removeAll()
        fitCanvasToViewport()

        return controlResponse(
            command,
            ok: true,
            message: "tiled \(columns)x\(rows)"
        )
    }

    private func spawnTerminals(
        _ command: TerminiCanvasControlCommand
    ) -> TerminiCanvasControlResponse {
        let count = clamp(command.count ?? 1, lower: 1, upper: 32)
        let size = CGSize(
            width: CGFloat(max(240.0, command.width ?? 500.0)),
            height: CGFloat(max(160.0, command.height ?? 316.0))
        )
        let gap = CGFloat(max(8.0, command.gap ?? 36.0))
        let originX = CGFloat(command.originX ?? 130.0)
        let originY = CGFloat(command.originY ?? 120.0)

        for index in 0..<count {
            let offset = CGFloat(index) * gap
            let node = TerminalNode(
                index: nextIndex,
                origin: CGPoint(x: originX + offset, y: originY + offset),
                size: size,
                tint: tint(for: nextIndex),
                zIndex: nextZIndex
            )
            nodes.append(node)
            selectedIDs = [node.id]
            nextIndex += 1
            nextZIndex += 1
        }

        return controlResponse(
            command,
            ok: true,
            message: "spawned \(count)"
        )
    }

    private func selectNode(_ id: UUID) {
        selectedIDs = [id]
        bringToFront(id)
    }

    private func bringToFront(_ id: UUID) {
        guard let node = nodes.first(where: { $0.id == id }) else { return }
        node.zIndex = nextZIndex
        nextZIndex += 1
    }

    private func close(_ id: UUID) {
        nodes.first { $0.id == id }?.stop()
        nodes.removeAll { $0.id == id }
        selectedIDs.remove(id)
    }

    private func move(_ id: UUID, delta: CGSize) {
        let idsToMove = selectedIDs.contains(id) && selectedIDs.count > 1
            ? selectedIDs
            : Set([id])

        for node in nodes where idsToMove.contains(node.id) {
            node.move(by: delta)
        }
    }

    private func resize(_ id: UUID, delta: CGSize) {
        guard let node = nodes.first(where: { $0.id == id }) else { return }
        node.resize(by: delta)
    }

    private func worldDelta(_ screenDelta: CGSize) -> CGSize {
        CGSize(
            width: screenDelta.width / canvasScale,
            height: screenDelta.height / canvasScale
        )
    }

    private func resetTerminals() {
        stopAllNodes()
        nextIndex = 1
        nextZIndex = 1

        let first = TerminalNode(
            index: nextIndex,
            origin: CGPoint(x: 88, y: 86),
            size: CGSize(width: 520, height: 330),
            tint: .cyan,
            zIndex: nextZIndex
        )
        nextIndex += 1
        nextZIndex += 1

        let second = TerminalNode(
            index: nextIndex,
            origin: CGPoint(x: 420, y: 292),
            size: CGSize(width: 470, height: 292),
            tint: .green,
            zIndex: nextZIndex
        )
        nextIndex += 1
        nextZIndex += 1

        nodes = [first, second]
        selectedIDs = [second.id]
        canvasScale = 1
        zoomStart = 1
        canvasPan = .zero
    }

    private func stopAllNodes() {
        nodes.forEach { $0.stop() }
        nodes.removeAll(keepingCapacity: true)
        selectedIDs.removeAll()
        canvasPan = .zero
    }

    private func controlResponse(
        _ command: TerminiCanvasControlCommand,
        ok: Bool,
        message: String
    ) -> TerminiCanvasControlResponse {
        TerminiCanvasControlResponse(
            id: command.id,
            action: command.normalizedAction,
            ok: ok,
            message: message,
            nodeCount: nodes.count,
            appPID: getpid(),
            childPIDs: command.includeChildren == true ? childProcessIDs() : nil,
            commandPath: controlAPI.commandURL.path,
            responsePath: controlAPI.responseURL.path
        )
    }

    private func childProcessIDs() -> [Int32] {
        let process = Process()
        let pipe = Pipe()
        process.executableURL = URL(fileURLWithPath: "/bin/ps")
        process.arguments = ["-axo", "pid=,ppid=,comm="]
        process.standardOutput = pipe

        do {
            try process.run()
        } catch {
            return []
        }

        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        process.waitUntilExit()
        guard let output = String(data: data, encoding: .utf8) else { return [] }
        let appPID = getpid()

        return output
            .split(separator: "\n")
            .compactMap { line -> Int32? in
                let parts = line.split(separator: " ", maxSplits: 2, omittingEmptySubsequences: true)
                guard parts.count >= 2,
                      let pid = Int32(parts[0]),
                      let parentPID = Int32(parts[1]),
                      parentPID == appPID
                else { return nil }
                return pid
            }
            .sorted()
    }

    private func tint(for index: Int) -> HudTint {
        [.cyan, .blue, .teal, .green][(index - 1) % 4]
    }

    private func clamp(_ value: Int, lower: Int, upper: Int) -> Int {
        min(max(value, lower), upper)
    }

    private var canvasContentSize: CGSize {
        let maxX = nodes.reduce(CGFloat(920)) { partial, node in
            max(partial, node.origin.x + node.size.width + 96)
        }
        let maxY = nodes.reduce(CGFloat(560)) { partial, node in
            max(partial, node.origin.y + node.size.height + 96)
        }
        return CGSize(width: maxX, height: maxY)
    }
}

private struct TerminalNodeView: View {
    @ObservedObject var node: TerminalNode
    let isSelected: Bool
    let rendersLiveSurface: Bool
    let onSelect: () -> Void
    let onClose: () -> Void
    let onMove: (CGSize) -> Void
    let onResize: (CGSize) -> Void

    @State private var isDragging = false
    @State private var lastDragTranslation: CGSize = .zero
    @State private var isResizing = false
    @State private var lastResizeTranslation: CGSize = .zero

    private var liveOrigin: CGPoint {
        node.origin
    }

    private var liveSize: CGSize {
        node.size
    }

    var body: some View {
        VStack(spacing: 0) {
            titleBar
            if rendersLiveSurface {
                TerminalSurfaceContainer(controller: node.controller)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(HudPalette.bg)
            } else {
                TerminalPreview(node: node)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(HudPalette.bg)
            }
        }
        .frame(width: liveSize.width, height: liveSize.height)
        .background(HudPalette.bg)
        .clipShape(RoundedRectangle(cornerRadius: HudRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: HudRadius.card)
                .stroke(isSelected ? HudSurface.tintFocus(node.tint.color) : HudHairline.standard)
        )
        .shadow(color: HudSurface.scrim, radius: isSelected ? 22 : 14, x: 0, y: 12)
        .overlay(alignment: .bottomTrailing) {
            resizeHandle
        }
        .position(
            x: liveOrigin.x + liveSize.width / 2,
            y: liveOrigin.y + liveSize.height / 2
        )
        .zIndex(node.zIndex)
        .transaction { transaction in
            transaction.animation = nil
        }
        .onTapGesture(perform: onSelect)
    }

    private var titleBar: some View {
        HStack(spacing: HudSpacing.lg) {
            HStack(spacing: HudSpacing.sm) {
                Circle()
                    .fill(HudPalette.statusError)
                    .frame(width: 11, height: 11)
                    .onTapGesture {
                        onClose()
                    }
                Circle()
                    .fill(HudPalette.statusWarn)
                    .frame(width: 11, height: 11)
                Circle()
                    .fill(node.tint.color)
                    .frame(width: 11, height: 11)
            }
            Image(systemName: "terminal")
                .font(HudFont.ui(HudTextSize.xs, weight: .semibold))
                .foregroundStyle(HudPalette.muted)
            Text(node.title)
                .font(HudFont.mono(HudTextSize.sm, weight: .semibold))
                .foregroundStyle(HudPalette.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.82)
            Spacer()
            Text(node.subtitle)
                .font(HudFont.mono(HudTextSize.xxs))
                .foregroundStyle(HudPalette.dim)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
        .padding(.horizontal, HudSpacing.xxl)
        .frame(height: 36)
        .background(HudPalette.chrome)
        .contentShape(Rectangle())
        .gesture(
            DragGesture(minimumDistance: 0, coordinateSpace: .named("termini-canvas"))
                .onChanged { value in
                    if !isDragging {
                        isDragging = true
                        lastDragTranslation = .zero
                        onSelect()
                    }

                    let delta = CGSize(
                        width: value.translation.width - lastDragTranslation.width,
                        height: value.translation.height - lastDragTranslation.height
                    )
                    lastDragTranslation = value.translation
                    onMove(delta)
                }
                .onEnded { _ in
                    isDragging = false
                    lastDragTranslation = .zero
                }
        )
    }

    private var resizeHandle: some View {
        ResizeGrip()
            .frame(width: 24, height: 24)
            .contentShape(Rectangle())
            .help("Resize")
            .accessibilityLabel("Resize terminal")
            .gesture(
                DragGesture(minimumDistance: 0, coordinateSpace: .named("termini-canvas"))
                    .onChanged { value in
                        if !isResizing {
                            isResizing = true
                            lastResizeTranslation = .zero
                            onSelect()
                        }

                        let delta = CGSize(
                            width: value.translation.width - lastResizeTranslation.width,
                            height: value.translation.height - lastResizeTranslation.height
                        )
                        lastResizeTranslation = value.translation
                        onResize(delta)
                    }
                    .onEnded { _ in
                        isResizing = false
                        lastResizeTranslation = .zero
                    }
            )
    }
}

private struct ResizeGrip: View {
    var body: some View {
        Canvas { context, size in
            var path = Path()
            for offset in stride(from: CGFloat(6), through: 18, by: 5) {
                path.move(to: CGPoint(x: size.width - offset, y: size.height - 3))
                path.addLine(to: CGPoint(x: size.width - 3, y: size.height - offset))
            }

            context.stroke(
                path,
                with: .color(HudPalette.dim),
                style: StrokeStyle(lineWidth: 1, lineCap: .round)
            )
        }
        .padding(3)
    }
}

private struct SelectionMarquee: View {
    let rect: CGRect

    var body: some View {
        RoundedRectangle(cornerRadius: HudRadius.standard)
            .fill(HudSurface.selected(HudPalette.statusInfo))
            .overlay(
                RoundedRectangle(cornerRadius: HudRadius.standard)
                    .stroke(HudSurface.tintFocus(HudPalette.statusInfo), style: StrokeStyle(lineWidth: 1, dash: [6, 4]))
            )
            .frame(width: max(1, rect.width), height: max(1, rect.height))
            .offset(x: rect.minX, y: rect.minY)
            .allowsHitTesting(false)
    }
}

private struct TerminalPreview: View {
    @ObservedObject var node: TerminalNode

    var body: some View {
        ZStack(alignment: .topLeading) {
            HudPalette.bg

            Canvas { context, size in
                let columnWidth: CGFloat = 18
                let rowHeight: CGFloat = 13
                let columns = max(1, Int(size.width / columnWidth))
                let rows = max(1, Int(size.height / rowHeight))

                for row in 0..<rows {
                    for column in 0..<columns {
                        let alpha = 0.18 + Double((row + column) % 5) * 0.035
                        let rect = CGRect(
                            x: CGFloat(column) * columnWidth + 8,
                            y: CGFloat(row) * rowHeight + 8,
                            width: columnWidth * 0.52,
                            height: 1
                        )
                        context.fill(
                            Path(roundedRect: rect, cornerRadius: 0.5),
                            with: .color(node.tint.color.opacity(alpha))
                        )
                    }
                }
            }
            .allowsHitTesting(false)

            VStack(alignment: .leading, spacing: HudSpacing.sm) {
                HudBadge("LIVE PTY", tint: node.tint.color, dot: true)
                Text("surface virtualized")
                    .font(HudFont.mono(10))
                    .foregroundStyle(HudPalette.muted)
                Text("zoom/select to attach renderer")
                    .font(HudFont.mono(10))
                    .foregroundStyle(HudPalette.dim)
            }
            .padding(HudSpacing.xl)
        }
    }
}

private struct InfiniteCanvasBackground: View {
    let pan: CGSize
    let scale: CGFloat
    var worldStep: CGFloat = 20

    var body: some View {
        Canvas { context, size in
            drawGrid(context: &context, size: size)
        }
    }

    private func drawGrid(context: inout GraphicsContext, size: CGSize) {
        let step = normalizedScreenStep
        let majorStep = step * 5

        strokeGrid(
            context: &context,
            size: size,
            step: step,
            offsetX: screenOffset(for: pan.width, step: step),
            offsetY: screenOffset(for: pan.height, step: step),
            color: HudSurface.inset.opacity(0.72),
            lineWidth: 1
        )

        strokeGrid(
            context: &context,
            size: size,
            step: majorStep,
            offsetX: screenOffset(for: pan.width, step: majorStep),
            offsetY: screenOffset(for: pan.height, step: majorStep),
            color: HudSurface.inset.opacity(0.95),
            lineWidth: 1.15
        )
    }

    private func strokeGrid(
        context: inout GraphicsContext,
        size: CGSize,
        step: CGFloat,
        offsetX: CGFloat,
        offsetY: CGFloat,
        color: Color,
        lineWidth: CGFloat
    ) {
        var path = Path()

        var x = offsetX
        while x <= size.width {
            path.move(to: CGPoint(x: x, y: 0))
            path.addLine(to: CGPoint(x: x, y: size.height))
            x += step
        }

        var y = offsetY
        while y <= size.height {
            path.move(to: CGPoint(x: 0, y: y))
            path.addLine(to: CGPoint(x: size.width, y: y))
            y += step
        }

        context.stroke(path, with: .color(color), lineWidth: lineWidth)
    }

    private var normalizedScreenStep: CGFloat {
        var step = worldStep * scale
        while step < 9 {
            step *= 2
        }
        while step > 48 {
            step /= 2
        }
        return step
    }

    private func screenOffset(for panValue: CGFloat, step: CGFloat) -> CGFloat {
        let offset = panValue.truncatingRemainder(dividingBy: step)
        return offset >= 0 ? offset : offset + step
    }
}

private struct CanvasNavigationPanel: View {
    @Binding var width: CGFloat
    let nodes: [TerminalNode]
    let minimapNodes: [TerminalNode]
    let totalCount: Int
    let selectedCount: Int
    @Binding var filter: CanvasNavigationFilter
    let selectedIDs: Set<UUID>
    let viewportWorldRect: CGRect
    let canvasContentSize: CGSize
    let canvasPan: CGSize
    let canvasScale: CGFloat
    let viewportSize: CGSize
    let onSelectNode: (UUID) -> Void
    let onCenterWorldPoint: (CGPoint) -> Void
    let onFit: () -> Void
    let onCollapse: () -> Void

    var body: some View {
        HStack(spacing: 0) {
            VStack(spacing: 0) {
                header
                HudDivider(color: HudHairline.standard)
                filters
                    .padding(.horizontal, HudSpacing.xl)
                    .padding(.vertical, HudSpacing.lg)
                HudDivider(color: HudHairline.subtle)

                ScrollView {
                    LazyVStack(spacing: HudSpacing.sm) {
                        ForEach(nodes) { node in
                            CanvasNavigationRow(
                                node: node,
                                isSelected: selectedIDs.contains(node.id),
                                action: { onSelectNode(node.id) }
                            )
                        }

                        if nodes.isEmpty {
                            Text("No terminals")
                                .font(HudFont.mono(10))
                                .foregroundStyle(HudPalette.dim)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(HudSpacing.xl)
                        }
                    }
                    .padding(HudSpacing.xl)
                }

                HudDivider(color: HudHairline.subtle)
                footer
                    .padding(HudSpacing.xl)
            }
            .frame(width: width)
            .frame(maxHeight: .infinity)
            .background(HudPalette.chrome)

            PanelResizeHandle(
                side: .right,
                width: $width,
                range: 210...360
            )
        }
    }

    private var header: some View {
        HStack(spacing: HudSpacing.lg) {
            HudStatusDot(color: HudPalette.statusInfo)
            VStack(alignment: .leading, spacing: 1) {
                Text("Termini Canvas")
                    .font(HudFont.ui(HudTextSize.base, weight: .semibold))
                    .foregroundStyle(HudPalette.ink)
                Text("Figma for shells")
                    .font(HudFont.mono(9))
                    .foregroundStyle(HudPalette.dim)
            }
            Spacer()
            CanvasIconButton(
                systemName: "sidebar.left",
                help: "Hide navigator",
                action: onCollapse
            )
        }
        .padding(.horizontal, HudSpacing.xl)
        .frame(height: HudLayout.navHeight)
    }

    private var filters: some View {
        VStack(alignment: .leading, spacing: HudSpacing.md) {
            HStack {
                HudSectionLabel("Workspace")
                Spacer()
                HudBadge("\(totalCount)", tint: HudPalette.statusInfo)
            }

            HStack(spacing: HudSpacing.sm) {
                ForEach(CanvasNavigationFilter.allCases) { option in
                    CanvasFilterButton(
                        title: option.label,
                        isActive: filter == option,
                        action: { filter = option }
                    )
                }
            }

            Text("\(selectedCount) selected")
                .font(HudFont.mono(10))
                .foregroundStyle(HudPalette.muted)
        }
    }

    private var footer: some View {
        VStack(alignment: .leading, spacing: HudSpacing.md) {
            HStack {
                HudSectionLabel("Minimap")
                Spacer()
                CanvasIconButton(
                    systemName: "viewfinder",
                    help: "Fit world",
                    action: onFit
                )
                Text(formattedZoom(canvasScale))
                    .font(HudFont.mono(10, weight: .semibold))
                    .foregroundStyle(HudPalette.muted)
            }

            CanvasMiniMap(
                nodes: minimapNodes,
                selectedIDs: selectedIDs,
                worldSize: canvasContentSize,
                viewportWorldRect: viewportWorldRect,
                onCenterWorldPoint: onCenterWorldPoint
            )
            .frame(height: 132)
        }
    }
}

private struct CanvasNavigationRow: View {
    @ObservedObject var node: TerminalNode
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: HudSpacing.md) {
                HudStatusDot(color: node.tint.color, size: 6)
                VStack(alignment: .leading, spacing: 2) {
                    Text(node.title)
                        .font(HudFont.mono(11, weight: .semibold))
                        .foregroundStyle(HudPalette.ink)
                        .lineLimit(1)
                    Text("x \(Int(node.origin.x)) · y \(Int(node.origin.y))")
                        .font(HudFont.mono(9))
                        .foregroundStyle(HudPalette.dim)
                }
                Spacer()
            }
            .padding(.horizontal, HudSpacing.lg)
            .padding(.vertical, HudSpacing.md)
            .background(
                RoundedRectangle(cornerRadius: HudRadius.standard)
                    .fill(isSelected ? HudSurface.selected(node.tint.color) : HudSurface.control)
            )
            .overlay(
                RoundedRectangle(cornerRadius: HudRadius.standard)
                    .stroke(isSelected ? HudSurface.tintStrong(node.tint.color) : HudHairline.subtle)
            )
        }
        .buttonStyle(.plain)
    }
}

private enum PanelResizeSide {
    case left
    case right
}

private struct PanelResizeHandle: View {
    let side: PanelResizeSide
    @Binding var width: CGFloat
    let range: ClosedRange<CGFloat>

    @State private var startWidth: CGFloat?

    var body: some View {
        Rectangle()
            .fill(HudHairline.subtle)
            .frame(width: 4)
            .overlay {
                RoundedRectangle(cornerRadius: 1)
                    .fill(HudPalette.dim.opacity(0.45))
                    .frame(width: 1, height: 42)
            }
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        let start = startWidth ?? width
                        startWidth = start
                        let signedDelta = side == .right
                            ? value.translation.width
                            : -value.translation.width
                        width = min(max(start + signedDelta, range.lowerBound), range.upperBound)
                    }
                    .onEnded { _ in
                        startWidth = nil
                    }
            )
            .help("Resize panel")
            .accessibilityLabel("Resize panel")
    }
}

private struct CanvasInspectorPanel: View {
    @Binding var width: CGFloat
    let selectedNodes: [TerminalNode]
    let totalCount: Int
    let onCenterNode: (TerminalNode) -> Void
    let onCloseNode: (UUID) -> Void
    let onCollapse: () -> Void

    var body: some View {
        HStack(spacing: 0) {
            PanelResizeHandle(
                side: .left,
                width: $width,
                range: 250...440
            )

            VStack(spacing: 0) {
                header
                HudDivider(color: HudHairline.standard)

                ScrollView {
                    content
                        .padding(HudSpacing.xl)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .frame(width: width)
            .frame(maxHeight: .infinity)
            .background(HudPalette.chrome)
        }
    }

    private var header: some View {
        HStack(spacing: HudSpacing.lg) {
            HudSectionLabel("Detail")
            Spacer()
            HudBadge("\(totalCount)", tint: HudPalette.statusInfo)
            CanvasIconButton(
                systemName: "sidebar.right",
                help: "Hide inspector",
                action: onCollapse
            )
        }
        .padding(.horizontal, HudSpacing.lg)
        .frame(height: HudLayout.navHeight)
    }

    @ViewBuilder
    private var content: some View {
        if let node = selectedNodes.first, selectedNodes.count == 1 {
            TerminalDetailView(
                node: node,
                onCenter: { onCenterNode(node) },
                onClose: { onCloseNode(node.id) }
            )
        } else if selectedNodes.count > 1 {
            MultiTerminalDetailView(count: selectedNodes.count)
        } else {
            EmptyInspectorState()
        }
    }
}

private struct TerminalDetailView: View {
    @ObservedObject var node: TerminalNode
    let onCenter: () -> Void
    let onClose: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: HudSpacing.xl) {
            HStack(spacing: HudSpacing.md) {
                HudStatusDot(color: node.tint.color, size: 8)
                VStack(alignment: .leading, spacing: 2) {
                    Text(node.title)
                        .font(HudFont.mono(13, weight: .semibold))
                        .foregroundStyle(HudPalette.ink)
                    Text(node.subtitle)
                        .font(HudFont.mono(10))
                        .foregroundStyle(HudPalette.dim)
                }
                Spacer()
            }

            InspectorMetricGrid(metrics: [
                ("X", "\(Int(node.origin.x))"),
                ("Y", "\(Int(node.origin.y))"),
                ("W", "\(Int(node.size.width))"),
                ("H", "\(Int(node.size.height))"),
                ("Z", "\(Int(node.zIndex))"),
                ("ID", String(node.id.uuidString.prefix(8))),
            ])

            VStack(alignment: .leading, spacing: HudSpacing.md) {
                HudSectionLabel("Runtime")
                HudBadge("LOCAL PTY", tint: node.tint.color, dot: true)
                Text("tmux target pending")
                    .font(HudFont.mono(10))
                    .foregroundStyle(HudPalette.muted)
            }

            HStack(spacing: HudSpacing.md) {
                HudButton("Center", icon: "scope", style: .secondary, action: onCenter)
                HudButton("Close", icon: "xmark", style: .ghost, action: onClose)
            }

            Spacer(minLength: 0)
        }
    }
}

private struct InspectorMetricGrid: View {
    let metrics: [(String, String)]

    var body: some View {
        LazyVGrid(
            columns: [
                GridItem(.flexible(), spacing: HudSpacing.md),
                GridItem(.flexible(), spacing: HudSpacing.md),
            ],
            spacing: HudSpacing.md
        ) {
            ForEach(metrics, id: \.0) { metric in
                VStack(alignment: .leading, spacing: 2) {
                    Text(metric.0)
                        .font(HudFont.mono(9, weight: .semibold))
                        .foregroundStyle(HudPalette.dim)
                    Text(metric.1)
                        .font(HudFont.mono(12, weight: .semibold))
                        .foregroundStyle(HudPalette.ink)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
                .padding(HudSpacing.md)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: HudRadius.standard).fill(HudSurface.control))
                .overlay(RoundedRectangle(cornerRadius: HudRadius.standard).stroke(HudHairline.subtle))
            }
        }
    }
}

private struct MultiTerminalDetailView: View {
    let count: Int

    var body: some View {
        VStack(alignment: .leading, spacing: HudSpacing.lg) {
            HudBadge("\(count) SELECTED", tint: HudPalette.statusInfo, dot: true)
            Text("Group detail actions land here: tile, move, send, capture, fork workspace.")
                .font(HudFont.mono(10))
                .foregroundStyle(HudPalette.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

private struct EmptyInspectorState: View {
    var body: some View {
        VStack(alignment: .leading, spacing: HudSpacing.lg) {
            HudBadge("NO SELECTION", tint: HudPalette.dim)
            Text("Select a terminal to inspect its canvas placement and runtime identity.")
                .font(HudFont.mono(10))
                .foregroundStyle(HudPalette.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

private struct CanvasFilterButton: View {
    let title: String
    let isActive: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(HudFont.mono(9, weight: .semibold))
                .foregroundStyle(isActive ? HudPalette.statusInfo : HudPalette.muted)
                .padding(.horizontal, HudSpacing.md)
                .frame(height: 24)
                .background(
                    RoundedRectangle(cornerRadius: HudRadius.tight)
                        .fill(isActive ? HudSurface.selected(HudPalette.statusInfo) : HudSurface.control)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: HudRadius.tight)
                        .stroke(isActive ? HudSurface.tintStrong(HudPalette.statusInfo) : HudHairline.subtle)
                )
        }
        .buttonStyle(.plain)
    }
}

private struct CommandKeyButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: HudSpacing.xs) {
                Image(systemName: "command")
                    .font(HudFont.ui(10, weight: .semibold))
                Text("K")
                    .font(HudFont.mono(10, weight: .semibold))
            }
            .foregroundStyle(HudPalette.muted)
            .frame(width: 44, height: 28)
            .background(RoundedRectangle(cornerRadius: HudRadius.standard).fill(HudSurface.control))
            .overlay(RoundedRectangle(cornerRadius: HudRadius.standard).stroke(HudHairline.subtle))
        }
        .buttonStyle(.plain)
        .help("Command palette")
        .accessibilityLabel("Command palette")
    }
}

private struct CanvasMiniMap: View {
    let nodes: [TerminalNode]
    let selectedIDs: Set<UUID>
    let worldSize: CGSize
    let viewportWorldRect: CGRect
    let onCenterWorldPoint: (CGPoint) -> Void

    var body: some View {
        GeometryReader { proxy in
            Canvas { context, size in
                draw(context: context, size: size)
            }
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        onCenterWorldPoint(worldPoint(for: value.location, in: proxy.size))
                    }
            )
            .background(
                RoundedRectangle(cornerRadius: HudRadius.card)
                    .fill(HudSurface.control)
            )
            .overlay(
                RoundedRectangle(cornerRadius: HudRadius.card)
                    .stroke(HudHairline.standard)
            )
        }
    }

    private func draw(context: GraphicsContext, size: CGSize) {
        let scale = minimapScale(in: size)
        let inset = minimapInset(in: size, scale: scale)

        var worldPath = Path(
            roundedRect: CGRect(
                x: inset.width,
                y: inset.height,
                width: worldSize.width * scale,
                height: worldSize.height * scale
            ),
            cornerRadius: 5
        )
        context.stroke(worldPath, with: .color(HudHairline.subtle), lineWidth: 1)

        for node in nodes {
            let rect = CGRect(
                x: inset.width + node.origin.x * scale,
                y: inset.height + node.origin.y * scale,
                width: max(2, node.size.width * scale),
                height: max(2, node.size.height * scale)
            )
            let path = Path(roundedRect: rect, cornerRadius: 2)
            let selected = selectedIDs.contains(node.id)
            context.fill(path, with: .color(node.tint.color.opacity(selected ? 0.52 : 0.28)))
            context.stroke(
                path,
                with: .color(selected ? HudPalette.ink : HudSurface.tintMuted(node.tint.color)),
                lineWidth: selected ? 1.2 : 0.7
            )
        }

        let viewport = CGRect(
            x: inset.width + viewportWorldRect.minX * scale,
            y: inset.height + viewportWorldRect.minY * scale,
            width: viewportWorldRect.width * scale,
            height: viewportWorldRect.height * scale
        )
        worldPath = Path(roundedRect: viewport, cornerRadius: 3)
        context.stroke(worldPath, with: .color(HudPalette.statusInfo), lineWidth: 1.4)
    }

    private func worldPoint(for location: CGPoint, in size: CGSize) -> CGPoint {
        let scale = minimapScale(in: size)
        let inset = minimapInset(in: size, scale: scale)
        return CGPoint(
            x: min(max((location.x - inset.width) / scale, 0), worldSize.width),
            y: min(max((location.y - inset.height) / scale, 0), worldSize.height)
        )
    }

    private func minimapScale(in size: CGSize) -> CGFloat {
        guard worldSize.width > 0, worldSize.height > 0 else { return 1 }
        return min(
            (size.width - 16) / worldSize.width,
            (size.height - 16) / worldSize.height
        )
    }

    private func minimapInset(in size: CGSize, scale: CGFloat) -> CGSize {
        CGSize(
            width: max(8, (size.width - worldSize.width * scale) / 2),
            height: max(8, (size.height - worldSize.height * scale) / 2)
        )
    }
}

private struct ViewportStatusChip: View {
    let rect: CGRect
    let scale: CGFloat
    let tool: CanvasTool

    var body: some View {
        HStack(spacing: HudSpacing.md) {
            Image(systemName: "viewfinder")
                .font(HudFont.ui(10, weight: .semibold))
            Text(
                "VIEW x \(Int(rect.minX)) y \(Int(rect.minY)) · \(Int(rect.width)) x \(Int(rect.height)) · \(tool.statusLabel) · \(formattedZoom(scale))"
            )
            .font(HudFont.mono(10, weight: .semibold))
        }
        .foregroundStyle(HudPalette.muted)
        .padding(.horizontal, HudSpacing.lg)
        .frame(height: 26)
        .background(RoundedRectangle(cornerRadius: HudRadius.standard).fill(HudSurface.control))
        .overlay(RoundedRectangle(cornerRadius: HudRadius.standard).stroke(HudHairline.subtle))
    }
}

private struct CanvasInputBridge: NSViewRepresentable {
    let onScroll: (CGSize, CGPoint) -> Void
    let onMagnify: (CGFloat, CGPoint) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onScroll: onScroll, onMagnify: onMagnify)
    }

    func makeNSView(context: Context) -> EventView {
        let view = EventView()
        view.coordinator = context.coordinator
        context.coordinator.view = view
        context.coordinator.installMonitor()
        return view
    }

    func updateNSView(_ nsView: EventView, context: Context) {
        context.coordinator.onScroll = onScroll
        context.coordinator.onMagnify = onMagnify
        context.coordinator.view = nsView
    }

    static func dismantleNSView(_ nsView: EventView, coordinator: Coordinator) {
        coordinator.removeMonitor()
    }

    final class EventView: NSView {
        weak var coordinator: Coordinator?

        override func hitTest(_ point: NSPoint) -> NSView? {
            nil
        }
    }

    final class Coordinator {
        var onScroll: (CGSize, CGPoint) -> Void
        var onMagnify: (CGFloat, CGPoint) -> Void
        weak var view: EventView?
        private var monitor: Any?

        init(
            onScroll: @escaping (CGSize, CGPoint) -> Void,
            onMagnify: @escaping (CGFloat, CGPoint) -> Void
        ) {
            self.onScroll = onScroll
            self.onMagnify = onMagnify
        }

        func installMonitor() {
            guard monitor == nil else { return }
            monitor = NSEvent.addLocalMonitorForEvents(matching: [.scrollWheel, .magnify]) { [weak self] event in
                guard let self,
                      let view,
                      view.window === event.window,
                      let location = self.viewportLocation(for: event)
                else { return event }

                switch event.type {
                case .scrollWheel:
                    let delta = CGSize(
                        width: event.scrollingDeltaX,
                        height: event.scrollingDeltaY
                    )
                    self.onScroll(delta, location)
                    return nil
                case .magnify:
                    self.onMagnify(event.magnification, location)
                    return nil
                default:
                    return event
                }
            }
        }

        func removeMonitor() {
            if let monitor {
                NSEvent.removeMonitor(monitor)
            }
            monitor = nil
        }

        private func viewportLocation(for event: NSEvent) -> CGPoint? {
            guard let view else { return nil }
            let local = view.convert(event.locationInWindow, from: nil)
            guard view.bounds.contains(local) else { return nil }
            return CGPoint(
                x: local.x,
                y: view.bounds.height - local.y
            )
        }

        deinit {
            removeMonitor()
        }
    }
}

private struct CanvasToolSwitch: View {
    let tool: CanvasTool
    let onSelect: () -> Void
    let onHand: () -> Void

    var body: some View {
        HStack(spacing: HudSpacing.sm) {
            CanvasIconButton(
                systemName: "cursorarrow",
                help: "Select terminals",
                isActive: tool == .select,
                action: onSelect
            )
            CanvasIconButton(
                systemName: "hand.raised",
                help: "Pan canvas",
                isActive: tool == .hand,
                action: onHand
            )
        }
    }
}

private struct CanvasZoomTool: View {
    let scale: CGFloat
    let onZoomOut: () -> Void
    let onZoomIn: () -> Void
    let onFit: () -> Void

    var body: some View {
        HStack(spacing: HudSpacing.sm) {
            CanvasIconButton(
                systemName: "minus.magnifyingglass",
                help: "Zoom out",
                action: onZoomOut
            )

            Text(formattedZoom(scale))
                .font(HudFont.mono(10, weight: .semibold))
                .foregroundStyle(HudPalette.muted)
                .frame(width: 58)

            CanvasIconButton(
                systemName: "plus.magnifyingglass",
                help: "Zoom in",
                action: onZoomIn
            )

            CanvasIconButton(
                systemName: "viewfinder",
                help: "Fit canvas",
                action: onFit
            )
        }
        .padding(.horizontal, HudSpacing.md)
        .padding(.vertical, HudSpacing.sm)
        .background(
            RoundedRectangle(cornerRadius: HudRadius.card)
                .fill(HudPalette.chrome)
        )
        .overlay(
            RoundedRectangle(cornerRadius: HudRadius.card)
                .stroke(HudHairline.standard)
        )
        .shadow(color: HudSurface.scrim, radius: 14, x: 0, y: 8)
    }
}

private struct CanvasIconButton: View {
    let systemName: String
    let help: String
    var isActive = false
    let action: () -> Void

    @State private var isHovering = false

    var body: some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(HudFont.ui(HudTextSize.xs, weight: .semibold))
                .foregroundStyle(isActive ? HudPalette.statusInfo : HudPalette.muted)
                .frame(width: 28, height: 28)
                .background(
                    RoundedRectangle(cornerRadius: HudRadius.standard)
                        .fill(background)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: HudRadius.standard)
                        .stroke(border)
                )
        }
        .buttonStyle(.plain)
        .help(help)
        .accessibilityLabel(help)
        .onHover { isHovering = $0 }
    }

    private var background: Color {
        if isActive {
            return HudSurface.selected(HudPalette.statusInfo)
        }
        return isHovering ? HudSurface.hover : HudSurface.control
    }

    private var border: Color {
        if isActive {
            return HudSurface.tintStrong(HudPalette.statusInfo)
        }
        return isHovering ? HudHairline.standard : HudHairline.subtle
    }
}

private struct TerminalSurfaceContainer: View, Equatable {
    let controller: TerminiTerminalController

    static func == (lhs: TerminalSurfaceContainer, rhs: TerminalSurfaceContainer) -> Bool {
        lhs.controller === rhs.controller
    }

    var body: some View {
        HudTerminalSurface(
            controller: controller,
            showsSystemKeyboard: true,
            appearance: HudTerminalAppearance(fontSize: 12)
        )
    }
}

private struct TerminalInspectorRow: View {
    @ObservedObject var node: TerminalNode
    let isSelected: Bool
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: HudSpacing.md) {
                HudStatusDot(color: node.tint.color, size: 6)
                VStack(alignment: .leading, spacing: HudSpacing.xs) {
                    Text(node.title)
                        .font(HudFont.mono(HudTextSize.sm, weight: .semibold))
                        .foregroundStyle(HudPalette.ink)
                    Text("\(Int(node.size.width)) x \(Int(node.size.height))")
                        .font(HudFont.mono(HudTextSize.xxs))
                        .foregroundStyle(HudPalette.muted)
                }
                Spacer()
            }
            .padding(HudSpacing.xl)
            .background(
                RoundedRectangle(cornerRadius: HudRadius.standard)
                    .fill(isSelected ? HudSurface.selected(node.tint.color) : HudSurface.control)
            )
            .overlay(
                RoundedRectangle(cornerRadius: HudRadius.standard)
                    .stroke(isSelected ? HudSurface.tintStrong(node.tint.color) : HudHairline.subtle)
            )
        }
        .buttonStyle(.plain)
    }
}
