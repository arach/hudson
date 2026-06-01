import SwiftUI
import HudsonUI

#if os(macOS)
import AppKit
#endif

public enum HudChromeTitlebarPlacement: Sendable {
    case leading
    case trailing
}

public enum HudChromeTitlebarStyle: Sendable {
    /// Use the platform titlebar/toolbar and place actions in standard slots.
    case systemToolbar
    /// Draw the titlebar inside the app content. Useful for platforms or
    /// surfaces that do not participate in a native window toolbar.
    case contentBar
}

public struct HudChromeTitlebarAction {
    public var id: String
    public var placement: HudChromeTitlebarPlacement
    public var label: String
    public var systemImage: String
    public var action: () -> Void

    public init(
        id: String,
        placement: HudChromeTitlebarPlacement,
        label: String,
        systemImage: String,
        action: @escaping () -> Void
    ) {
        self.id = id
        self.placement = placement
        self.label = label
        self.systemImage = systemImage
        self.action = action
    }
}

public struct HudChromeShell<
    Leading: View,
    Trailing: View,
    Content: View,
    StatusBar: View
>: View {
    private let title: String?
    private let titlebarStyle: HudChromeTitlebarStyle
    private let titlebarActions: [HudChromeTitlebarAction]
    private let leading: Leading
    private let trailing: Trailing
    private let content: Content
    private let statusBar: StatusBar

    public init(
        title: String? = nil,
        titlebarStyle: HudChromeTitlebarStyle = .systemToolbar,
        titlebarActions: [HudChromeTitlebarAction] = [],
        @ViewBuilder leading: () -> Leading,
        @ViewBuilder trailing: () -> Trailing,
        @ViewBuilder content: () -> Content,
        @ViewBuilder statusBar: () -> StatusBar
    ) {
        self.title = title
        self.titlebarStyle = titlebarStyle
        self.titlebarActions = titlebarActions
        self.leading = leading()
        self.trailing = trailing()
        self.content = content()
        self.statusBar = statusBar()
    }

    @ViewBuilder
    public var body: some View {
        #if os(macOS)
        switch titlebarStyle {
        case .systemToolbar:
            systemToolbarShell
        case .contentBar:
            contentBarShell
        }
        #else
        contentBarShell
        #endif
    }

    private var contentBarShell: some View {
        HudAppShell {
            leading
        } trailing: {
            trailing
        } topDrawer: {
            HudChromeTitlebar(title: title, actions: titlebarActions)
        } bottomDrawer: {
            EmptyView()
        } content: {
            content
        } statusBar: {
            statusBar
        }
        .background(HudWindowChrome(colorScheme: .dark))
    }

    #if os(macOS)
    private var systemToolbarShell: some View {
        HudAppShell {
            leading
        } trailing: {
            trailing
        } topDrawer: {
            EmptyView()
        } bottomDrawer: {
            EmptyView()
        } content: {
            content
        } statusBar: {
            statusBar
        }
        .toolbar {
            ToolbarItemGroup(placement: .navigation) {
                ForEach(titlebarActions.filter { $0.placement == .leading }, id: \.id) { action in
                    HudChromeToolbarButton(action: action)
                }
            }

            ToolbarItemGroup(placement: .automatic) {
                Spacer()

                ForEach(titlebarActions.filter { $0.placement == .trailing }, id: \.id) { action in
                    HudChromeToolbarButton(action: action)
                }
            }
        }
        .toolbarBackground(Color.black, for: .windowToolbar)
        .modifier(HudChromeToolbarBackgroundVisibilityModifier())
        .background(HudWindowChrome(
            colorScheme: .dark,
            titleVisibility: .hidden,
            titlebarAppearsTransparent: true,
            usesFullSizeContentView: false,
            isMovableByWindowBackground: false,
            hidesToolbar: false
        ))
    }
    #endif
}

private struct HudChromeTitlebar: View {
    let title: String?
    let actions: [HudChromeTitlebarAction]

    @Environment(\.hudTheme) private var theme

    private var leadingActions: [HudChromeTitlebarAction] {
        actions.filter { $0.placement == .leading }
    }

    private var trailingActions: [HudChromeTitlebarAction] {
        actions.filter { $0.placement == .trailing }
    }

    var body: some View {
        ZStack {
            HStack(spacing: HudSpacing.sm) {
                ForEach(leadingActions, id: \.id) { action in
                    HudChromeTitlebarButton(action: action)
                }

                Spacer(minLength: 0)

                ForEach(trailingActions, id: \.id) { action in
                    HudChromeTitlebarButton(action: action)
                }
            }

            if let title, !title.isEmpty {
                Text(title)
                    .font(HudFont.ui(HudTextSize.sm, weight: .semibold))
                    .foregroundStyle(theme.palette.muted)
                    .lineLimit(1)
                    .allowsHitTesting(false)
            }
        }
        .padding(.leading, HudSpacing.lg)
        .padding(.trailing, HudSpacing.md)
        .frame(height: 34)
        .background(Color.black)
        .overlay(alignment: .bottom) {
            HudDivider(color: Color.white.opacity(0.035))
        }
    }
}

#if os(macOS)
private struct HudChromeToolbarButton: NSViewRepresentable {
    let action: HudChromeTitlebarAction

    func makeCoordinator() -> Coordinator {
        Coordinator(action: action.action)
    }

    func makeNSView(context: Context) -> BorderlessButton {
        let button = BorderlessButton()
        button.target = context.coordinator
        button.action = #selector(Coordinator.invokeAction)
        button.setButtonType(.momentaryChange)
        button.bezelStyle = .regularSquare
        button.isBordered = false
        button.showsBorderOnlyWhileMouseInside = false
        button.imagePosition = .imageOnly
        button.imageScaling = .scaleProportionallyDown
        button.alignment = .center
        button.focusRingType = .none
        button.contentTintColor = .secondaryLabelColor
        updateButton(button, context: context)
        return button
    }

    func updateNSView(_ button: BorderlessButton, context: Context) {
        context.coordinator.action = action.action
        updateButton(button, context: context)
    }

    private func updateButton(_ button: BorderlessButton, context: Context) {
        button.toolTip = action.label
        let image = NSImage(systemSymbolName: action.systemImage, accessibilityDescription: action.label)
        image?.isTemplate = true
        button.image = image
    }

    final class Coordinator: NSObject {
        var action: () -> Void

        init(action: @escaping () -> Void) {
            self.action = action
        }

        @objc func invokeAction() {
            action()
        }
    }

    final class BorderlessButton: NSButton {
        override var intrinsicContentSize: NSSize {
            NSSize(width: 24, height: 24)
        }

        override var acceptsFirstResponder: Bool {
            false
        }
    }
}

private struct HudChromeToolbarBackgroundVisibilityModifier: ViewModifier {
    func body(content: Content) -> some View {
        if #available(macOS 15.0, *) {
            content.toolbarBackgroundVisibility(.visible, for: .windowToolbar)
        } else {
            content
        }
    }
}

public extension Scene {
    func hudChromeWindow() -> some Scene {
        self
            .windowStyle(.hiddenTitleBar)
            .windowToolbarStyle(.unifiedCompact(showsTitle: false))
    }
}
#endif

private struct HudChromeTitlebarButton: View {
    let action: HudChromeTitlebarAction

    @Environment(\.hudTheme) private var theme
    @State private var isHovering = false

    var body: some View {
        Button(action: action.action) {
            Image(systemName: action.systemImage)
                .font(HudFont.ui(12, weight: .semibold))
                .foregroundStyle(isHovering ? theme.palette.ink : theme.palette.muted)
                .frame(width: 28, height: 24)
                .background(
                    RoundedRectangle(cornerRadius: HudRadius.standard, style: .continuous)
                        .fill(isHovering ? HudSurface.hover : Color.clear)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: HudRadius.standard, style: .continuous)
                        .stroke(isHovering ? theme.hairline.standard : Color.clear, lineWidth: HudStrokeWidth.thin)
                )
        }
        .buttonStyle(.plain)
        .help(action.label)
        .onHover { isHovering = $0 }
        .animation(.easeOut(duration: 0.10), value: isHovering)
    }
}
