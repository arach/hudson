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

/// Interactive demo for `HudNavigationSidebar`.
///
/// The central feature: a `Slider` bound to `progress` so the bounce-free
/// label-column transition can be scrubbed by hand. Pickers expose all four
/// style axes so every variant is reachable without editing code.
struct SidebarTab: View {
    @Environment(\.hudsonAppManifest) private var manifest

    @State private var selection: DemoSidebarSection? = .home
    @State private var progress: Double = 0

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
                    .frame(maxHeight: 420)

                // Controls column
                controlsColumn
                    .frame(maxWidth: 380, alignment: .topLeading)
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
                HudBadge("PROGRESS \(Int(progress * 100))%", tint: manifest.accent)
            }

            Text("HudNavigationSidebar uses two parallel columns — a fixed rail and an animated label column — so icons never move during expand/compact transitions. Scrub the slider below to inspect the transition at any point.")
                .font(HudFont.ui(12))
                .foregroundStyle(HudPalette.muted)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: 720, alignment: .leading)
        }
    }

    // MARK: Sidebar preview

    private var sidebarPreview: some View {
        HudNavigationSidebar(
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
                    .font(HudFont.ui(13, weight: .semibold))
                    .foregroundStyle(HudPalette.ink)
                    .lineLimit(1)
            },
            footer: {
                Image(systemName: "person.crop.circle")
                    .font(.system(size: 15, weight: .regular))
                    .foregroundStyle(HudPalette.muted)
            }
        )
        .background(
            RoundedRectangle(cornerRadius: HudRadius.card)
                .stroke(HudHairline.standard, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: HudRadius.card))
    }

    // MARK: Controls column

    private var controlsColumn: some View {
        VStack(alignment: .leading, spacing: HudSpacing.huge) {
            progressControl
            styleControls
            selectionInfo
        }
    }

    private var progressControl: some View {
        HudCard {
            VStack(alignment: .leading, spacing: HudSpacing.lg) {
                HudSectionLabel("Transition scrubber", tint: manifest.accent)
                Text("Drag to inspect the bounce-free label-column animation at any point. Icons in the rail column never shift x-position regardless of progress.")
                    .font(HudFont.ui(11))
                    .foregroundStyle(HudPalette.dim)
                    .fixedSize(horizontal: false, vertical: true)

                HStack(spacing: HudSpacing.lg) {
                    Text("expanded")
                        .font(HudFont.mono(10))
                        .foregroundStyle(HudPalette.dim)
                    Slider(value: $progress, in: 0...1)
                        .tint(manifest.accent)
                    Text("compact")
                        .font(HudFont.mono(10))
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
                HudKVRow("Progress",  value: String(format: "%.3f", progress))
                HudKVRow("Mode",      value: progress < 0.5 ? "expanded" : "compact")
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
