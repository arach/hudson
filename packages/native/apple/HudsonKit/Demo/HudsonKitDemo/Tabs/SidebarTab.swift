import SwiftUI
import HudsonUI
import HudsonShell

// MARK: - Demo selection enum

enum DemoSidebarSection: String, Hashable, CaseIterable, Identifiable {
    case home, library, recents, settings, about
    var id: String { rawValue }

    var title: String {
        switch self {
        case .home:     return "Home"
        case .library:  return "Library"
        case .recents:  return "Recents"
        case .settings: return "Settings"
        case .about:    return "About"
        }
    }

    var icon: String {
        switch self {
        case .home:     return "house"
        case .library:  return "rectangle.stack"
        case .recents:  return "clock"
        case .settings: return "gear"
        case .about:    return "info.circle"
        }
    }

    var selectedIcon: String {
        switch self {
        case .home:     return "house.fill"
        case .library:  return "rectangle.stack.fill"
        case .recents:  return "clock.fill"
        case .settings: return "gearshape.fill"
        case .about:    return "info.circle.fill"
        }
    }
}

// MARK: - Demo modes

/// Fixed, compact, and resizable are *modes of the same component* —
/// `HudNavigationSidebar` — not different sidebars.
enum DemoSidebarMode: String, CaseIterable, Identifiable {
    case scrub, compact, resizable
    var id: String { rawValue }

    var label: String {
        switch self {
        case .scrub:     return "Scrub"
        case .compact:   return "Compact"
        case .resizable: return "Resizable"
        }
    }

    var blurb: String {
        switch self {
        case .scrub:
            return "The `progress: Double` initializer. Scrub the slider to inspect the bounce-free label-column transition at any point — the contract design tooling uses."
        case .compact:
            return "The `isCompact: Bool` initializer with a fixed label width. Wrap the toggle in `withAnimation` at the call site to animate it."
        case .resizable:
            return "The same component with `.resizable(isCompact:labelWidth:)`. Drag the trailing edge to size it, drag left past the collapse width to compact it, drag right from compact to expand. Hudson owns the gesture; the app owns the two bindings."
        }
    }
}

// MARK: - SidebarTab

/// Interactive demo for `HudNavigationSidebar`.
///
/// One component, three modes. Fixed and progress-scrubbing are initializers;
/// resizing is a behavior opted into with `.resizable(...)`. Pickers expose all
/// four style axes so every variant is reachable without editing code.
struct SidebarTab: View {
    @Environment(\.hudsonAppManifest) private var manifest

    @State private var selection: DemoSidebarSection? = .home
    @State private var mode: DemoSidebarMode = .scrub
    @State private var progress: Double = 0

    // Resizable mode — bindings the *application* owns. Hudson never persists
    // these; a real app would back `labelWidth` with @AppStorage.
    @State private var isCompact = false
    @State private var labelWidth: CGFloat = 200
    @State private var isResizing = false

    // Style axes — each independently controllable
    @State private var surfaceStyle:   HudSidebarSurfaceStyle   = .base
    @State private var indicatorStyle: HudSidebarIndicatorStyle = .base
    @State private var iconStyle:      HudSidebarIconStyle      = .base
    @State private var motionStyle:    HudSidebarMotionStyle    = .base

    private var entries: [HudSidebarEntry<DemoSidebarSection>] {
        [
            .item(HudSidebarItem(id: .home,    title: "Home",    icon: "house",           selectedIcon: "house.fill")),
            .item(HudSidebarItem(id: .library, title: "Library", icon: "rectangle.stack", selectedIcon: "rectangle.stack.fill")),
            .item(HudSidebarItem(id: .recents, title: "Recents", icon: "clock",           selectedIcon: "clock.fill")),
            .section(id: "system", title: "System"),
            .item(HudSidebarItem(id: .settings, title: "Settings", icon: "gear",       selectedIcon: "gearshape.fill")),
            .item(HudSidebarItem(id: .about,    title: "About",    icon: "info.circle", selectedIcon: "info.circle.fill")),
        ]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: HudSpacing.huge) {
            header

            HStack(alignment: .top, spacing: HudSpacing.xxl) {
                // Live preview — the sidebar itself
                sidebarPreview
                    .frame(maxHeight: HudLayout.popoverWidth + 40)

                // Controls column
                controlsColumn
                    .frame(maxWidth: HudLayout.popoverWidth, alignment: .topLeading)
            }
        }
        .environment(
            \.hudsonSidebarStyle,
            HudSidebarStyle(
                surface: surfaceStyle,
                indicator: indicatorStyle,
                icon: iconStyle,
                motion: motionStyle
            )
        )
    }

    // MARK: Header

    private var header: some View {
        VStack(alignment: .leading, spacing: HudSpacing.md) {
            HStack(spacing: HudSpacing.md) {
                HudSectionLabel("Sidebar · bounce-free nav", tint: manifest.accent)
                Spacer()
                if mode == .resizable {
                    HudBadge(isResizing ? "RESIZING" : "WIDTH \(Int(labelWidth))", tint: manifest.accent)
                } else {
                    HudBadge("PROGRESS \(Int(effectiveProgress * 100))%", tint: manifest.accent)
                }
            }

            Text("HudNavigationSidebar uses two parallel columns — a fixed rail and an animated label column — so icons never move during expand/compact transitions. Fixed, compact, and resizable are modes of this one component.")
                .font(HudFont.ui(HudTextSize.sm))
                .foregroundStyle(HudPalette.muted)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: HudLayout.readableWidth, alignment: .leading)
        }
    }

    // MARK: Sidebar preview

    /// Where `progress` currently comes from. Scrub mode drives it directly;
    /// the other two modes derive it from the boolean.
    private var effectiveProgress: Double {
        switch mode {
        case .scrub:                return progress
        case .compact, .resizable:  return isCompact ? 1 : 0
        }
    }

    /// One component, built once — only the mode-specific wrapper differs.
    ///
    /// `base` is deliberately a local `let` rather than a `some View` helper:
    /// `.resizable(...)` is a method on `HudNavigationSidebar` itself, so it has
    /// to be reachable on the concrete type.
    @ViewBuilder
    private var sidebarPreview: some View {
        let base = HudNavigationSidebar(
            selection: $selection,
            entries: entries,
            progress: effectiveProgress,
            labelWidth: mode == .resizable ? labelWidth : HudSidebarLayout.labelWidth,
            railHeader: {
                // Simple logo placeholder: accent dot
                Circle()
                    .fill(manifest.accent)
                    .frame(width: HudIconSize.micro, height: HudIconSize.micro)
            },
            labelHeader: {
                Text(manifest.name)
                    .font(HudFont.ui(HudTextSize.base, weight: .semibold))
                    .foregroundStyle(HudPalette.ink)
                    .lineLimit(1)
            },
            footer: {
                Image(systemName: "person.crop.circle")
                    .font(HudFont.ui(HudTextSize.lgm, weight: .regular))
                    .foregroundStyle(HudPalette.muted)
            }
        )

        switch mode {
        case .scrub, .compact:
            base
                .background(previewBorder)
                // Safe to clip: nothing draws outside the sidebar's own bounds.
                .clipShape(RoundedRectangle(cornerRadius: HudRadius.card))

        case .resizable:
            base
                .resizable(
                    isCompact: $isCompact,
                    labelWidth: $labelWidth,
                    minLabelWidth: 120,
                    maxLabelWidth: 280,
                    onResizePhaseChange: { isResizing = $0 }
                )
                // No clip — the edge handle straddles the trailing edge, so
                // clipping would eat half its hit area and its halo.
                .background(previewBorder)
        }
    }

    private var previewBorder: some View {
        RoundedRectangle(cornerRadius: HudRadius.card)
            .stroke(HudHairline.standard, lineWidth: 1)
    }

    // MARK: Controls column

    private var controlsColumn: some View {
        VStack(alignment: .leading, spacing: HudSpacing.huge) {
            modeControl
            styleControls
            selectionInfo
        }
    }

    private var modeControl: some View {
        HudCard {
            VStack(alignment: .leading, spacing: HudSpacing.lg) {
                HudSectionLabel("Mode", tint: manifest.accent)

                Picker("Mode", selection: $mode) {
                    ForEach(DemoSidebarMode.allCases) {
                        Text($0.label).tag($0)
                    }
                }
                .pickerStyle(.segmented)

                Text(mode.blurb)
                    .font(HudFont.ui(HudTextSize.xs))
                    .foregroundStyle(HudPalette.dim)
                    .fixedSize(horizontal: false, vertical: true)

                switch mode {
                case .scrub:     scrubControls
                case .compact:   compactControls
                case .resizable: resizableControls
                }
            }
        }
    }

    private var scrubControls: some View {
        VStack(alignment: .leading, spacing: HudSpacing.lg) {
            HStack(spacing: HudSpacing.lg) {
                Text("expanded")
                    .font(HudFont.mono(HudTextSize.xxs))
                    .foregroundStyle(HudPalette.dim)
                Slider(value: $progress, in: 0...1)
                    .tint(manifest.accent)
                Text("compact")
                    .font(HudFont.mono(HudTextSize.xxs))
                    .foregroundStyle(HudPalette.dim)
            }

            HStack(spacing: HudSpacing.xl) {
                HudButton("Expand", style: .secondary) {
                    withAnimation(HudMotion.expandCollapse) { progress = 0 }
                }
                HudButton("Compact", style: .ghost) {
                    withAnimation(HudMotion.expandCollapse) { progress = 1 }
                }
            }
        }
    }

    private var compactControls: some View {
        HStack(spacing: HudSpacing.xl) {
            HudButton("Expand", style: .secondary) {
                withAnimation(HudMotion.expandCollapse) { isCompact = false }
            }
            HudButton("Compact", style: .ghost) {
                withAnimation(HudMotion.expandCollapse) { isCompact = true }
            }
        }
    }

    private var resizableControls: some View {
        VStack(alignment: .leading, spacing: HudSpacing.lg) {
            Text("Persistence is application-owned — Hudson defines no UserDefaults keys. A shipping app would declare `@AppStorage(\"sidebarLabelWidth\") var labelWidth = 156.0` and pass it straight in.")
                .font(HudFont.ui(HudTextSize.xxs))
                .foregroundStyle(HudPalette.dim)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: HudSpacing.xl) {
                HudButton(isCompact ? "Expand" : "Compact", style: .secondary) {
                    withAnimation(HudMotion.expandCollapse) { isCompact.toggle() }
                }
                HudButton("Reset width", style: .ghost) {
                    labelWidth = 200
                }
            }
        }
    }

    private var styleControls: some View {
        HudCard {
            VStack(alignment: .leading, spacing: HudSpacing.lg) {
                HudSectionLabel("Style axes", tint: manifest.accent)

                styleRow(label: "Surface") {
                    Picker("Surface", selection: $surfaceStyle) {
                        ForEach(HudSidebarSurfaceStyle.allCases) {
                            Text($0.label).tag($0)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                styleRow(label: "Indicator") {
                    Picker("Indicator", selection: $indicatorStyle) {
                        ForEach(HudSidebarIndicatorStyle.allCases) {
                            Text($0.label).tag($0)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                styleRow(label: "Icon") {
                    Picker("Icon", selection: $iconStyle) {
                        ForEach(HudSidebarIconStyle.allCases) {
                            Text($0.label).tag($0)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                styleRow(label: "Motion") {
                    Picker("Motion", selection: $motionStyle) {
                        ForEach(HudSidebarMotionStyle.allCases) {
                            Text($0.label).tag($0)
                        }
                    }
                    .pickerStyle(.segmented)
                }
            }
        }
    }

    private var selectionInfo: some View {
        HudCard {
            VStack(alignment: .leading, spacing: HudSpacing.md) {
                HudSectionLabel("State", tint: HudPalette.muted)
                HudKVRow("Selection", value: selection?.title ?? "none")
                HudKVRow("Progress",  value: String(format: "%.3f", effectiveProgress))
                HudKVRow("Column",    value: effectiveProgress < 0.5 ? "expanded" : "compact")
                if mode == .resizable {
                    HudKVRow("Label width", value: String(format: "%.0f pt", labelWidth))
                    HudKVRow("Resizing",    value: isResizing ? "yes" : "no")
                }
            }
        }
    }

    @ViewBuilder
    private func styleRow<Content: View>(label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: HudSpacing.xs) {
            Text(label.uppercased())
                .font(HudFont.mono(HudTextSize.xxs, weight: .semibold))
                .tracking(HudTracking.wider)
                .foregroundStyle(HudPalette.dim)
            content()
        }
    }
}

// MARK: - HudMotion extension

private extension HudMotion {
    /// Sidebar-specific expand/collapse animation alias.
    static let expandCollapse: Animation = HudMotion.chromeSpring
}
