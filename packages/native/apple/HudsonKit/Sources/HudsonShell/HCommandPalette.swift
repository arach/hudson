import SwiftUI
import HudsonUI
import HudsonObservability

// MARK: - Command

/// One row in the command palette. `icon` is an SF Symbol name; `subtitle` is
/// optional secondary text; `action` runs when the user picks the row.
public struct HCommand: Identifiable {
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
public struct HCommandPalette: View {
    @Binding public var isPresented: Bool
    public let commands: [HCommand]

    @State private var query: String = ""
    @State private var selectedIndex: Int = 0
    @FocusState private var fieldFocused: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(isPresented: Binding<Bool>, commands: [HCommand]) {
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
            HInstrumentation.ui.event("CommandPalette.open", metadata: paletteMetadata)
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
        .frame(width: 0, height: 0)
        .accessibilityHidden(true)
    }

    private var scrim: some View {
        Color.black.opacity(0.55)
            .ignoresSafeArea()
            .onTapGesture { dismiss() }
    }

    private var paletteCard: some View {
        VStack(spacing: 0) {
            searchField
            HDivider(color: HHairline.standard)

            if filtered.isEmpty {
                emptyState
            } else {
                commandList
            }
        }
        .frame(maxWidth: 560)
        .background(HPalette.surface)
        .clipShape(RoundedRectangle(cornerRadius: HRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: HRadius.card)
                .stroke(HHairline.standard, lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.45), radius: 30, x: 0, y: 12)
        .padding(HSpacing.xxl)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .padding(.top, 80)
    }

    private var searchField: some View {
        HStack(spacing: HSpacing.lg) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(HPalette.muted)

            TextField("", text: $query, prompt:
                Text("Type a command…")
                    .foregroundStyle(HPalette.dim)
            )
            .textFieldStyle(.plain)
            .font(HFont.mono(13))
            .foregroundStyle(HPalette.ink)
            .focused($fieldFocused)
            .onSubmit { runSelection() }
            .onChange(of: query) { _, _ in selectedIndex = 0 }

            if !query.isEmpty {
                Button(action: { query = "" }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 13))
                        .foregroundStyle(HPalette.dim)
                }
                .buttonStyle(.plain)
            }

            HBadge("ESC", tint: HPalette.dim)
        }
        .padding(.horizontal, HSpacing.xl)
        .frame(height: 48)
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
                                    HSectionLabel(group, tint: HPalette.muted)
                                    Spacer()
                                }
                                .padding(.horizontal, HSpacing.xl)
                                .padding(.top, HSpacing.lg)
                                .padding(.bottom, HSpacing.sm)
                                .background(HPalette.surface)
                            }
                        }
                    }
                }
                .padding(.bottom, HSpacing.md)
            }
            .frame(maxHeight: 380)
            .onChange(of: selectedIndex) { _, newIndex in
                if let id = commands[safe: newIndex]?.id {
                    if reduceMotion {
                        proxy.scrollTo(id, anchor: .center)
                    } else {
                        withAnimation(HMotion.quickScroll) {
                            proxy.scrollTo(id, anchor: .center)
                        }
                    }
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: HSpacing.md) {
            Image(systemName: "questionmark.circle")
                .font(.system(size: 22))
                .foregroundStyle(HPalette.dim)
            Text("No commands match \"\(query)\"")
                .font(HFont.mono(11))
                .foregroundStyle(HPalette.muted)
        }
        .padding(HSpacing.huge)
        .frame(maxWidth: .infinity)
    }

    // MARK: Filtering & grouping

    private var filtered: [HCommand] {
        guard !query.isEmpty else { return commands }
        let needle = query.lowercased()
        return commands.filter {
            $0.title.lowercased().contains(needle)
                || ($0.subtitle?.lowercased().contains(needle) ?? false)
        }
    }

    private struct GroupedSection {
        let group: String?
        let items: [HCommand]
    }

    private func grouped(from commands: [HCommand]) -> [GroupedSection] {
        var seen: [String?] = []
        var sections: [String?: [HCommand]] = [:]
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

        HInstrumentation.ui.event("CommandPalette.run", metadata: metadata)
        dismiss(reason: "run")

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
            HInstrumentation.ui.span("CommandPalette.run.action", metadata: metadata) {
                cmd.action()
            }
        }
    }

    private func dismiss(reason: String = "user") {
        HInstrumentation.ui.event("CommandPalette.dismiss", metadata: dismissMetadata(reason: reason))
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

    private func commandMetadata(command: HCommand, filteredCount: Int) -> [String: String] {
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
    let command: HCommand
    let isSelected: Bool
    let onTap: () -> Void
    let onHover: () -> Void
    @State private var isHovering = false

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: HSpacing.lg) {
                if let icon = command.icon {
                    Image(systemName: icon)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(isSelected ? HPalette.ink : HPalette.muted)
                        .frame(width: 22)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(command.title)
                        .font(HFont.ui(13, weight: isSelected ? .semibold : .regular))
                        .foregroundStyle(isSelected ? HPalette.ink : HPalette.muted)
                    if let subtitle = command.subtitle {
                        Text(subtitle)
                            .font(HFont.mono(10))
                            .foregroundStyle(HPalette.dim)
                    }
                }
                Spacer(minLength: 0)
                if isSelected {
                    Image(systemName: "return")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(HPalette.muted)
                }
            }
            .padding(.horizontal, HSpacing.xl)
            .padding(.vertical, HSpacing.md)
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
            return Color.white.opacity(0.06)
        }
        if isHovering {
            return Color.white.opacity(0.035)
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
        commands: [HCommand]
    ) -> some View {
        modifier(HCommandPalettePresenter(isPresented: isPresented, commands: commands))
    }
}

private struct HCommandPalettePresenter: ViewModifier {
    @Binding var isPresented: Bool
    let commands: [HCommand]
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        ZStack {
            content
            if isPresented {
                HCommandPalette(isPresented: $isPresented, commands: commands)
                    .transition(.opacity)
                    .zIndex(2)
            }
        }
        .animation(HMotion.ifAllowed(HMotion.quickFade, reduceMotion: reduceMotion), value: isPresented)
    }
}

// MARK: - Safe collection subscript

private extension Collection {
    subscript(safe index: Index) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
