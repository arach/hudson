import Foundation
import SwiftUI
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

    init(index: Int, origin: CGPoint, size: CGSize, tint: HudTint) {
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

struct TerminiCanvasRootView: View {
    @State private var nodes: [TerminalNode] = [
        TerminalNode(
            index: 1,
            origin: CGPoint(x: 88, y: 86),
            size: CGSize(width: 520, height: 330),
            tint: .cyan
        ),
        TerminalNode(
            index: 2,
            origin: CGPoint(x: 420, y: 292),
            size: CGSize(width: 470, height: 292),
            tint: .green
        ),
    ]
    @State private var selectedID: UUID?
    @State private var railExpanded = true
    @State private var inspectorCollapsed = false
    @State private var nextIndex = 3

    var body: some View {
        HudAppShell {
            HudNavigationRail(
                selection: .constant("canvas"),
                items: [
                    HudRailItem(id: "canvas", label: "Canvas", icon: "rectangle.3.group"),
                    HudRailItem(id: "terminals", label: "Terminals", icon: "terminal"),
                ],
                isExpanded: $railExpanded
            ) {
                VStack(alignment: .leading, spacing: HudSpacing.md) {
                    HudSectionLabel("CASE STUDY")
                    HudBadge("NATIVE", tint: HudPalette.statusInfo, dot: true)
                    HudBadge("\(nodes.count) NODES", tint: HudPalette.statusOk, dot: true)
                }
            }
        } trailing: {
            HudInspector(isCollapsed: $inspectorCollapsed) {
                HStack {
                    HudSectionLabel("Terminals")
                    Spacer()
                    HudBadge("\(nodes.count)", tint: HudPalette.statusInfo)
                }
            } content: {
                inspector
            }
        } content: {
            HudCanvas(showGrid: true) {
                canvasHeader
            } content: {
                terminalCanvas
                    .frame(minWidth: 920, minHeight: 560)
            }
        } statusBar: {
            statusBar
        }
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
            HudButton("New", icon: "plus", style: .primary(.cyan)) {
                spawnTerminal()
            }
        }
    }

    private var terminalCanvas: some View {
        ZStack(alignment: .topLeading) {
            ForEach(nodes) { node in
                TerminalNodeView(
                    node: node,
                    isSelected: selectedID == node.id,
                    onSelect: { bringToFront(node.id) },
                    onClose: { close(node.id) },
                    onMove: { delta in move(node.id, delta: delta) },
                    onResize: { delta in resize(node.id, delta: delta) }
                )
            }
        }
        .coordinateSpace(name: "termini-canvas")
        .contentShape(Rectangle())
        .onTapGesture {
            selectedID = nil
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
                    isSelected: selectedID == node.id,
                    onSelect: { bringToFront(node.id) }
                )
            }

            Spacer()
        }
        .padding(HudSpacing.xxl)
    }

    private var statusBar: some View {
        HStack(spacing: HudSpacing.xl) {
            HudStatusDot(color: HudPalette.statusOk)
            Text("HUDSONKIT MACOS")
                .font(HudFont.mono(10, weight: .bold))
                .tracking(1.4)
                .foregroundStyle(HudPalette.muted)
            Text("·")
                .font(HudFont.mono(10))
                .foregroundStyle(HudPalette.dim)
            Text("canvas + Termini surfaces")
                .font(HudFont.mono(10))
                .foregroundStyle(HudPalette.muted)
            Spacer()
            HudButton(
                inspectorCollapsed ? "Inspector" : "Hide inspector",
                icon: "sidebar.right",
                style: .ghost
            ) {
                inspectorCollapsed.toggle()
            }
        }
        .padding(.horizontal, HudSpacing.xxl)
        .frame(height: HudLayout.statusBarHeight)
    }

    private func spawnTerminal() {
        let offset = CGFloat((nextIndex - 1) % 5) * 36
        let node = TerminalNode(
            index: nextIndex,
            origin: CGPoint(x: 130 + offset, y: 120 + offset),
            size: CGSize(width: 500, height: 316),
            tint: [.cyan, .blue, .teal, .green][(nextIndex - 1) % 4]
        )
        nodes.append(node)
        selectedID = node.id
        nextIndex += 1
    }

    private func bringToFront(_ id: UUID) {
        selectedID = id
        guard let index = nodes.firstIndex(where: { $0.id == id }) else { return }
        let node = nodes.remove(at: index)
        nodes.append(node)
    }

    private func close(_ id: UUID) {
        nodes.first { $0.id == id }?.stop()
        nodes.removeAll { $0.id == id }
        if selectedID == id {
            selectedID = nodes.last?.id
        }
    }

    private func move(_ id: UUID, delta: CGSize) {
        guard let node = nodes.first(where: { $0.id == id }) else { return }
        node.move(by: delta)
    }

    private func resize(_ id: UUID, delta: CGSize) {
        guard let node = nodes.first(where: { $0.id == id }) else { return }
        node.resize(by: delta)
    }
}

private struct TerminalNodeView: View {
    @ObservedObject var node: TerminalNode
    let isSelected: Bool
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
            TerminalSurfaceContainer(controller: node.controller)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(HudPalette.bg)
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
            Spacer()
            Text(node.subtitle)
                .font(HudFont.mono(HudTextSize.xxs))
                .foregroundStyle(HudPalette.dim)
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
        Image(systemName: "arrow.down.right.and.arrow.up.left")
            .font(HudFont.ui(HudTextSize.micro, weight: .semibold))
            .foregroundStyle(HudPalette.dim)
            .frame(width: 24, height: 24)
            .contentShape(Rectangle())
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
