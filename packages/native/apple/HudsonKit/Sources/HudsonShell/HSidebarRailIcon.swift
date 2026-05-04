import SwiftUI
import HudsonUI

// MARK: - HSidebarRailIcon
//
// One icon cell for the fixed rail column of `HNavigationSidebar`.
//
// Hover/focus/selection states honor the four `HSidebarStyle` axes and
// `@Environment(\.accessibilityReduceMotion)`. The compact-mode accent bar
// is rendered as an overlay; its visibility is controlled by `compactBarOpacity`
// so the parent can fade it in only when the sidebar has fully settled into
// compact mode.
//
// Public so callers composing custom rail rows (groupings, badges, drag
// affordances) can build on the same hover/focus/selection visuals without
// re-implementing them. The standard `HNavigationSidebar` uses this directly.

public struct HSidebarRailIcon<Selection: Hashable>: View {
    public let item: HSidebarItem<Selection>
    public let isSelected: Bool
    public let accent: Color
    public let progress: Double
    public let compactBarOpacity: Double
    public let style: HSidebarStyle
    public let reduceMotion: Bool
    public let onTap: () -> Void

    @State private var isHovering = false
    @State private var isPressing = false
    @State private var breathPhase: CGFloat = 1.0
    @FocusState private var isFocused: Bool

    public init(
        item: HSidebarItem<Selection>,
        isSelected: Bool,
        accent: Color,
        progress: Double,
        compactBarOpacity: Double,
        style: HSidebarStyle,
        reduceMotion: Bool,
        onTap: @escaping () -> Void
    ) {
        self.item = item
        self.isSelected = isSelected
        self.accent = accent
        self.progress = progress
        self.compactBarOpacity = compactBarOpacity
        self.style = style
        self.reduceMotion = reduceMotion
        self.onTap = onTap
    }

    private var glyphName: String {
        if isSelected, let s = item.selectedIcon { return s }
        return item.icon
    }

    private var iconColor: Color {
        if isSelected  { return accent }
        if isHovering  { return HPalette.ink }
        return HPalette.muted
    }

    private var iconScale: CGFloat {
        switch style.icon {
        case .kinetic:
            let breath = isSelected ? breathPhase : 1.0
            let lift   = (isHovering && !isSelected) ? 1.08 : 1.0
            let press  = isPressing ? 0.94 : 1.0
            return breath * lift * press
        case .glass:
            return (isHovering && !isSelected) ? 1.04 : 1.0
        default:
            return 1.0
        }
    }

    private var hoverAnimation: Animation {
        switch style.icon {
        case .kinetic:   return .spring(response: 0.28, dampingFraction: 0.72)
        case .glass:     return .spring(response: 0.22, dampingFraction: 0.85)
        case .editorial: return .easeInOut(duration: 0.16)
        case .base:      return .easeOut(duration: 0.12)
        }
    }

    public var body: some View {
        Image(systemName: glyphName)
            .font(.system(size: HSidebarLayout.iconSize))
            .foregroundStyle(iconColor)
            .frame(width: HSidebarLayout.railWidth, height: HSidebarLayout.rowHeight)
            .background { hoverBackground }
            .scaleEffect(iconScale)
            .animation(reduceMotion ? nil : hoverAnimation, value: isHovering)
            .animation(
                reduceMotion ? nil : .spring(response: 0.18, dampingFraction: 0.65),
                value: isPressing
            )
            .overlay(alignment: .bottom) {
                // Compact-mode accent bar — centered in rail, shown at bottom of row.
                RoundedRectangle(cornerRadius: 1)
                    .fill(accent)
                    .frame(
                        width: HSidebarLayout.compactAccentBarWidth,
                        height: HSidebarLayout.compactAccentBarHeight
                    )
                    .opacity(isSelected ? compactBarOpacity : 0)
            }
            .overlay(
                RoundedRectangle(cornerRadius: HRadius.standard)
                    .stroke(isFocused ? HFocus.ring : Color.clear, lineWidth: HFocus.ringWidth)
            )
            .contentShape(Rectangle())
            .onTapGesture { onTap() }
            .simultaneousGesture(
                style.icon == .kinetic
                    ? DragGesture(minimumDistance: 0)
                        .onChanged { _ in isPressing = true }
                        .onEnded   { _ in isPressing = false }
                    : nil
            )
            .focusable(true)
            .focused($isFocused)
            .onHover { isHovering = $0 }
            .onContinuousHover { phase in
                switch phase {
                case .active: isHovering = true
                case .ended:  isHovering = false
                }
                // TODO: HSidebarTooltip — compact-mode tooltips land in a follow-up
            }
            .onChange(of: isSelected) { _, nowSelected in
                guard style.icon == .kinetic else { return }
                if nowSelected {
                    breathPhase = 1.10
                    if !reduceMotion {
                        withAnimation(.spring(response: 0.34, dampingFraction: 0.55)) {
                            breathPhase = 1.0
                        }
                        startBreathing()
                    } else {
                        breathPhase = 1.0
                    }
                } else {
                    breathPhase = 1.0
                }
            }
            .onAppear {
                if style.icon == .kinetic, isSelected, !reduceMotion { startBreathing() }
            }
            .accessibilityLabel(item.tooltipLabel ?? item.title)
            .accessibilityValue(isSelected ? "Selected" : "Not selected")
            .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    @ViewBuilder
    private var hoverBackground: some View {
        if isHovering && !isSelected {
            switch style.icon {
            case .editorial:
                EmptyView()
            case .glass:
                ZStack {
                    RoundedRectangle(cornerRadius: 6)
                        .fill(
                            RadialGradient(
                                colors: [Color.white.opacity(0.10), Color.white.opacity(0)],
                                center: .center, startRadius: 0, endRadius: 18
                            )
                        )
                        .blur(radius: 2)
                    RoundedRectangle(cornerRadius: 6)
                        .strokeBorder(Color.white.opacity(0.06), lineWidth: 0.5)
                }
                .padding(.horizontal, HSpacing.xs)
                .padding(.vertical, HSpacing.xxs + 1)
                .transition(.opacity.combined(with: .scale(scale: 0.94)))

            case .kinetic:
                RoundedRectangle(cornerRadius: 7)
                    .fill(HSurface.hover)
                    .padding(.horizontal, HSpacing.xs)
                    .padding(.vertical, HSpacing.xxs + 1)

            case .base:
                RoundedRectangle(cornerRadius: HRadius.standard - 1)
                    .fill(HSurface.inset)
                    .padding(.horizontal, HSpacing.xs)
                    .padding(.vertical, HSpacing.xxs + 1)
                    .transition(.opacity)
            }
        }
    }

    private func startBreathing() {
        guard style.icon == .kinetic, isSelected else { return }
        withAnimation(.easeInOut(duration: 1.6).repeatForever(autoreverses: true)) {
            breathPhase = 1.04
        }
    }
}
