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

// MARK: - SidebarTab

/// Interactive demo for `HNavigationSidebar`.
///
/// The central feature: a `Slider` bound to `progress` so the bounce-free
/// label-column transition can be scrubbed by hand. Pickers expose all four
/// style axes so every variant is reachable without editing code.
struct SidebarTab: View {
    @Environment(\.hudsonAppManifest) private var manifest

    @State private var selection: DemoSidebarSection? = .home
    @State private var progress: Double = 0

    // Style axes — each independently controllable
    @State private var surfaceStyle:   HSidebarSurfaceStyle   = .base
    @State private var indicatorStyle: HSidebarIndicatorStyle = .base
    @State private var iconStyle:      HSidebarIconStyle      = .base
    @State private var motionStyle:    HSidebarMotionStyle    = .base

    private var entries: [HSidebarEntry<DemoSidebarSection>] {
        [
            .item(HSidebarItem(id: .home,    title: "Home",    icon: "house",           selectedIcon: "house.fill")),
            .item(HSidebarItem(id: .library, title: "Library", icon: "rectangle.stack", selectedIcon: "rectangle.stack.fill")),
            .item(HSidebarItem(id: .recents, title: "Recents", icon: "clock",           selectedIcon: "clock.fill")),
            .section(id: "system", title: "System"),
            .item(HSidebarItem(id: .settings, title: "Settings", icon: "gear",       selectedIcon: "gearshape.fill")),
            .item(HSidebarItem(id: .about,    title: "About",    icon: "info.circle", selectedIcon: "info.circle.fill")),
        ]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: HSpacing.huge) {
            header

            HStack(alignment: .top, spacing: HSpacing.xxl) {
                // Live preview — the sidebar itself
                sidebarPreview
                    .frame(maxHeight: 420)

                // Controls column
                controlsColumn
                    .frame(maxWidth: 380, alignment: .topLeading)
            }
        }
        .environment(
            \.hudsonSidebarStyle,
            HSidebarStyle(
                surface: surfaceStyle,
                indicator: indicatorStyle,
                icon: iconStyle,
                motion: motionStyle
            )
        )
    }

    // MARK: Header

    private var header: some View {
        VStack(alignment: .leading, spacing: HSpacing.md) {
            HStack(spacing: HSpacing.md) {
                HSectionLabel("Sidebar · bounce-free nav", tint: manifest.accent)
                Spacer()
                HBadge("PROGRESS \(Int(progress * 100))%", tint: manifest.accent)
            }

            Text("HNavigationSidebar uses two parallel columns — a fixed rail and an animated label column — so icons never move during expand/compact transitions. Scrub the slider below to inspect the transition at any point.")
                .font(HFont.ui(12))
                .foregroundStyle(HPalette.muted)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: 720, alignment: .leading)
        }
    }

    // MARK: Sidebar preview

    private var sidebarPreview: some View {
        HNavigationSidebar(
            selection: $selection,
            entries: entries,
            progress: progress,
            railHeader: {
                // Simple logo placeholder: accent dot
                Circle()
                    .fill(manifest.accent)
                    .frame(width: 18, height: 18)
            },
            labelHeader: {
                Text(manifest.name)
                    .font(HFont.ui(13, weight: .semibold))
                    .foregroundStyle(HPalette.ink)
                    .lineLimit(1)
            },
            footer: {
                Image(systemName: "person.crop.circle")
                    .font(.system(size: 15, weight: .regular))
                    .foregroundStyle(HPalette.muted)
            }
        )
        .background(
            RoundedRectangle(cornerRadius: HRadius.card)
                .stroke(HHairline.standard, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: HRadius.card))
    }

    // MARK: Controls column

    private var controlsColumn: some View {
        VStack(alignment: .leading, spacing: HSpacing.huge) {
            progressControl
            styleControls
            selectionInfo
        }
    }

    private var progressControl: some View {
        HCard {
            VStack(alignment: .leading, spacing: HSpacing.lg) {
                HSectionLabel("Transition scrubber", tint: manifest.accent)
                Text("Drag to inspect the bounce-free label-column animation at any point. Icons in the rail column never shift x-position regardless of progress.")
                    .font(HFont.ui(11))
                    .foregroundStyle(HPalette.dim)
                    .fixedSize(horizontal: false, vertical: true)

                HStack(spacing: HSpacing.lg) {
                    Text("expanded")
                        .font(HFont.mono(10))
                        .foregroundStyle(HPalette.dim)
                    Slider(value: $progress, in: 0...1)
                        .tint(manifest.accent)
                    Text("compact")
                        .font(HFont.mono(10))
                        .foregroundStyle(HPalette.dim)
                }

                HStack(spacing: HSpacing.xl) {
                    HButton("Expand", style: .secondary) {
                        withAnimation(HMotion.expandCollapse) { progress = 0 }
                    }
                    HButton("Compact", style: .ghost) {
                        withAnimation(HMotion.expandCollapse) { progress = 1 }
                    }
                }
            }
        }
    }

    private var styleControls: some View {
        HCard {
            VStack(alignment: .leading, spacing: HSpacing.lg) {
                HSectionLabel("Style axes", tint: manifest.accent)

                styleRow(label: "Surface") {
                    Picker("Surface", selection: $surfaceStyle) {
                        ForEach(HSidebarSurfaceStyle.allCases) {
                            Text($0.label).tag($0)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                styleRow(label: "Indicator") {
                    Picker("Indicator", selection: $indicatorStyle) {
                        ForEach(HSidebarIndicatorStyle.allCases) {
                            Text($0.label).tag($0)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                styleRow(label: "Icon") {
                    Picker("Icon", selection: $iconStyle) {
                        ForEach(HSidebarIconStyle.allCases) {
                            Text($0.label).tag($0)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                styleRow(label: "Motion") {
                    Picker("Motion", selection: $motionStyle) {
                        ForEach(HSidebarMotionStyle.allCases) {
                            Text($0.label).tag($0)
                        }
                    }
                    .pickerStyle(.segmented)
                }
            }
        }
    }

    private var selectionInfo: some View {
        HCard {
            VStack(alignment: .leading, spacing: HSpacing.md) {
                HSectionLabel("State", tint: HPalette.muted)
                HKVRow("Selection", value: selection?.title ?? "none")
                HKVRow("Progress",  value: String(format: "%.3f", progress))
                HKVRow("Mode",      value: progress < 0.5 ? "expanded" : "compact")
            }
        }
    }

    @ViewBuilder
    private func styleRow<Content: View>(label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: HSpacing.xs) {
            Text(label.uppercased())
                .font(HFont.mono(HTextSize.xxs, weight: .semibold))
                .tracking(HTracking.wider)
                .foregroundStyle(HPalette.dim)
            content()
        }
    }
}

// MARK: - HMotion extension

private extension HMotion {
    /// Sidebar-specific expand/collapse animation alias.
    static let expandCollapse: Animation = HMotion.chromeSpring
}
