import SwiftUI
import HudsonUI
import HudsonObservability

// MARK: - Command

/// One row in the command palette. `icon` is an SF Symbol name; `subtitle` is
/// optional secondary text; `action` runs when the user picks the row.
public struct HudCommand: Identifiable {
    public let id: String
    public let title: String
    public let subtitle: String?
    public let icon: String?
    public let group: String?
    public let action: () -> Void

    public init(
        id: String,
        title: String,
        subtitle: String? = nil,
        icon: String? = nil,
        group: String? = nil,
        action: @escaping () -> Void
    ) {
        self.id = id
        self.title = title
        self.subtitle = subtitle
        self.icon = icon
        self.group = group
        self.action = action
    }
}

// MARK: - Palette

/// Centered overlay command palette — search field on top, scrolling command
/// list below. Use `.hudsonCommandPalette(isPresented:commands:)` on any view
/// to mount it; the palette renders as an overlay with a scrim backdrop.
///
/// Keyboard: typing filters the list, Up/Down moves selection, Return runs
/// the highlighted command, Esc dismisses.
public struct HudCommandPalette: View {
    @Binding public var isPresented: Bool
    public let commands: [HudCommand]

    @State private var query: String = ""
    @State private var selectedIndex: Int = 0
    @FocusState private var fieldFocused: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(isPresented: Binding<Bool>, commands: [HudCommand]) {
        self._isPresented = isPresented
        self.commands = commands
    }

    public var body: some View {
        ZStack {
            scrim
            paletteCard
            keyboardLayer
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onAppear {
            query = ""
            selectedIndex = 0
            fieldFocused = true
            HudInstrumentation.ui.event("CommandPalette.open", metadata: paletteMetadata)
        }
    }

    /// Hidden buttons that wire keyboard shortcuts (Esc to dismiss, Up/Down to
    /// move selection). Kept invisible but inside the view tree so SwiftUI
    /// routes the shortcut while the palette is presented.
    private var keyboardLayer: some View {
        ZStack {
            Button("Dismiss") { dismiss() }
                .keyboardShortcut(.escape, modifiers: [])
            Button("Move up") { moveSelection(-1) }
            .keyboardShortcut(.upArrow, modifiers: [])
            Button("Move down") { moveSelection(1) }
            .keyboardShortcut(.downArrow, modifiers: [])
        }
        .opacity(0)
        // Invisible keyboard sink — zero-size shape that still routes shortcuts.
        // hudlint:disable next-line geometry
        .frame(width: 0, height: 0)
        .accessibilityHidden(true)
    }

    private var scrim: some View {
        HudSurface.scrimHeavy
            .ignoresSafeArea()
            .onTapGesture { dismiss() }
    }

    private var paletteCard: some View {
        VStack(spacing: 0) {
            searchField
            HudDivider(color: HudHairline.standard)

            if filtered.isEmpty {
                emptyState
            } else {
                commandList
            }
        }
        .frame(maxWidth: HudLayout.dialogWidth)
        .background(HudPalette.surface)
        .clipShape(RoundedRectangle(cornerRadius: HudRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: HudRadius.card)
                .stroke(HudHairline.standard, lineWidth: HudStrokeWidth.standard)
        )
        .shadow(color: HudSurface.scrim, radius: 30, x: 0, y: 12)
        .padding(HudSpacing.xxl)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        // Top inset positions palette ~80pt from screen top — design choice for the overlay.
        // hudlint:disable next-line spacing
        .padding(.top, 80)
    }

    private var searchField: some View {
        HStack(spacing: HudSpacing.lg) {
            Image(systemName: "magnifyingglass")
                .font(HudFont.ui(HudTextSize.md, weight: .medium))
                .foregroundStyle(HudPalette.muted)

            TextField("", text: $query, prompt:
                Text("Type a command…")
                    .foregroundStyle(HudPalette.dim)
            )
            .textFieldStyle(.plain)
            .font(HudFont.mono(HudTextSize.base))
            .foregroundStyle(HudPalette.ink)
            .focused($fieldFocused)
            .onSubmit { runSelection() }
            .onChange(of: query) { _, _ in selectedIndex = 0 }

            if !query.isEmpty {
                Button(action: { query = "" }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(HudFont.ui(HudTextSize.base))
                        .foregroundStyle(HudPalette.dim)
                }
                .buttonStyle(.plain)
            }

            HudBadge("ESC", tint: HudPalette.dim)
        }
        .padding(.horizontal, HudSpacing.xl)
        .frame(height: HudLayout.navHeight)
    }

    private var commandList: some View {
        let commands = filtered
        let sections = grouped(from: commands)

        return ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0, pinnedViews: [.sectionHeaders]) {
                    ForEach(sections, id: \.group) { section in
                        Section {
                            ForEach(section.items) { command in
                                CommandRow(
                                    command: command,
                                    isSelected: commands[safe: selectedIndex]?.id == command.id,
                                    onTap: {
                                        if let idx = commands.firstIndex(where: { $0.id == command.id }) {
                                            selectedIndex = idx
                                            runSelection()
                                        }
                                    },
                                    onHover: {
                                        if let idx = commands.firstIndex(where: { $0.id == command.id }) {
                                            selectedIndex = idx
                                        }
                                    }
                                )
                                .id(command.id)
                            }
                        } header: {
                            if let group = section.group {
                                HStack {
                                    HudSectionLabel(group, tint: HudPalette.muted)
                                    Spacer()
                                }
                                .padding(.horizontal, HudSpacing.xl)
                                .padding(.top, HudSpacing.lg)
                                .padding(.bottom, HudSpacing.sm)
                                .background(HudPalette.surface)
                            }
                        }
                    }
                }
                .padding(.bottom, HudSpacing.md)
            }
            .frame(maxHeight: HudLayout.popoverWidth)
            .onChange(of: selectedIndex) { _, newIndex in
                if let id = commands[safe: newIndex]?.id {
                    if reduceMotion {
                        proxy.scrollTo(id, anchor: .center)
                    } else {
                        withAnimation(HudMotion.quickScroll) {
                            proxy.scrollTo(id, anchor: .center)
                        }
                    }
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: HudSpacing.md) {
            Image(systemName: "questionmark.circle")
                .font(HudFont.ui(HudTextSize.xxl))
                .foregroundStyle(HudPalette.dim)
            Text("No commands match \"\(query)\"")
                .font(HudFont.mono(HudTextSize.xs))
                .foregroundStyle(HudPalette.muted)
        }
        .padding(HudSpacing.huge)
        .frame(maxWidth: .infinity)
    }

    // MARK: Filtering & grouping

    private var filtered: [HudCommand] {
        guard !query.isEmpty else { return commands }
        let needle = query.lowercased()
        return commands.filter {
            $0.title.lowercased().contains(needle)
                || ($0.subtitle?.lowercased().contains(needle) ?? false)
        }
    }

    private struct GroupedSection {
        let group: String?
        let items: [HudCommand]
    }

    private func grouped(from commands: [HudCommand]) -> [GroupedSection] {
        var seen: [String?] = []
        var sections: [String?: [HudCommand]] = [:]
        for cmd in commands {
            if !seen.contains(where: { $0 == cmd.group }) {
                seen.append(cmd.group)
            }
            sections[cmd.group, default: []].append(cmd)
        }
        return seen.map { GroupedSection(group: $0, items: sections[$0] ?? []) }
    }

    // MARK: Actions

    private func runSelection() {
        let visibleCommands = filtered
        guard let cmd = visibleCommands[safe: selectedIndex] else { return }
        let metadata = commandMetadata(command: cmd, filteredCount: visibleCommands.count)

        HudInstrumentation.ui.event("CommandPalette.run", metadata: metadata)
        dismiss(reason: "run")

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
            HudInstrumentation.ui.span("CommandPalette.run.action", metadata: metadata) {
                cmd.action()
            }
        }
    }

    private func dismiss(reason: String = "user") {
        HudInstrumentation.ui.event("CommandPalette.dismiss", metadata: dismissMetadata(reason: reason))
        isPresented = false
    }

    private func moveSelection(_ delta: Int) {
        let commands = filtered
        guard !commands.isEmpty else { return }
        selectedIndex = (selectedIndex + delta + commands.count) % commands.count
    }

    private var paletteMetadata: [String: String] {
        [
            "commandCount": "\(commands.count)",
            "hasCommands": hudsonBool(!commands.isEmpty),
        ]
    }

    private func commandMetadata(command: HudCommand, filteredCount: Int) -> [String: String] {
        [
            "commandCount": "\(commands.count)",
            "commandId": command.id,
            "filteredCount": "\(filteredCount)",
            "queryActive": hudsonBool(!query.isEmpty),
        ]
    }

    private func dismissMetadata(reason: String) -> [String: String] {
        [
            "filteredCount": "\(filtered.count)",
            "queryActive": hudsonBool(!query.isEmpty),
            "reason": reason,
        ]
    }
}

private func hudsonBool(_ value: Bool) -> String {
    value ? "true" : "false"
}

// MARK: - Command row

private struct CommandRow: View {
    let command: HudCommand
    let isSelected: Bool
    let onTap: () -> Void
    let onHover: () -> Void
    @State private var isHovering = false

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: HudSpacing.lg) {
                if let icon = command.icon {
                    Image(systemName: icon)
                        .font(HudFont.ui(HudTextSize.base, weight: .medium))
                        .foregroundStyle(isSelected ? HudPalette.ink : HudPalette.muted)
                        .frame(width: HudIconSize.small)
                }
                VStack(alignment: .leading, spacing: HudSpacing.xxs) {
                    Text(command.title)
                        .font(HudFont.ui(HudTextSize.base, weight: isSelected ? .semibold : .regular))
                        .foregroundStyle(isSelected ? HudPalette.ink : HudPalette.muted)
                    if let subtitle = command.subtitle {
                        Text(subtitle)
                            .font(HudFont.mono(HudTextSize.xxs))
                            .foregroundStyle(HudPalette.dim)
                    }
                }
                Spacer(minLength: 0)
                if isSelected {
                    Image(systemName: "return")
                        .font(HudFont.ui(HudTextSize.xs, weight: .semibold))
                        .foregroundStyle(HudPalette.muted)
                }
            }
            .padding(.horizontal, HudSpacing.xl)
            .padding(.vertical, HudSpacing.md)
            .background(background)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { hovering in
            isHovering = hovering
            if hovering {
                onHover()
            }
        }
        .accessibilityLabel(accessibilityLabel)
        .accessibilityValue(isSelected ? "Selected" : "Not selected")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private var background: Color {
        if isSelected {
            return HudSurface.press
        }
        if isHovering {
            return HudSurface.hover
        }
        return .clear
    }

    private var accessibilityLabel: String {
        if let subtitle = command.subtitle {
            return "\(command.title), \(subtitle)"
        }
        return command.title
    }
}

// MARK: - View modifier

extension View {
    /// Mount a command palette on any view. Triggered by setting the
    /// `isPresented` binding to true (e.g., from a ⌘K key handler).
    public func hudsonCommandPalette(
        isPresented: Binding<Bool>,
        commands: [HudCommand]
    ) -> some View {
        modifier(HudCommandPalettePresenter(isPresented: isPresented, commands: commands))
    }
}

private struct HudCommandPalettePresenter: ViewModifier {
    @Binding var isPresented: Bool
    let commands: [HudCommand]
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        ZStack {
            content
            if isPresented {
                HudCommandPalette(isPresented: $isPresented, commands: commands)
                    .transition(.opacity)
                    .zIndex(2)
            }
        }
        .animation(HudMotion.ifAllowed(HudMotion.quickFade, reduceMotion: reduceMotion), value: isPresented)
    }
}

// MARK: - Safe collection subscript

private extension Collection {
    subscript(safe index: Index) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
