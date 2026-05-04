import SwiftUI
import HudsonUI

/// Self-documenting tab for the HudsonShell chrome primitives.
///
/// Each card pairs a one-line tagline with a "Try it" action that exercises
/// the live shell state — toggling the rail, opening the palette, etc. The
/// idea is that someone scanning the demo can both read what each surface
/// does and feel it.
struct ShellTab: View {
    let onOpenPalette: () -> Void
    let onOpenTakeover: () -> Void
    let onToggleDrawer: () -> Void
    let onToggleRail: () -> Void
    let onToggleInspector: () -> Void

    @Environment(\.hudsonAppManifest) private var manifest

    var body: some View {
        VStack(alignment: .leading, spacing: HSpacing.huge) {
            header

            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 320), spacing: HSpacing.xl)],
                alignment: .leading,
                spacing: HSpacing.xl
            ) {
                ForEach(primitives) { primitive in
                    PrimitiveCard(primitive: primitive)
                }
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: HSpacing.md) {
            HStack(spacing: HSpacing.md) {
                HSectionLabel("Shell · M3 chrome", tint: manifest.accent)
                Spacer()
                HBadge("\(primitives.count) PRIMITIVES", tint: manifest.accent)
            }

            Text("HudsonShell composes the chassis around a HApp — slots for navigation, inspection, drawers, and overlays. Each card below documents one surface and lets you exercise it live.")
                .font(HFont.ui(12))
                .foregroundStyle(HPalette.muted)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: 720, alignment: .leading)
        }
    }

    // MARK: Primitives

    private var primitives: [Primitive] {
        [
            Primitive(
                id: "appshell",
                name: "HAppShell",
                icon: "rectangle.split.3x1",
                tagline: "Chassis with six slots — leading, trailing, topDrawer, bottomDrawer, content, statusBar. The whole thing you're looking at right now.",
                actionLabel: nil,
                action: nil
            ),
            Primitive(
                id: "rail",
                name: "HNavigationRail",
                icon: "sidebar.left",
                tagline: "Leading rail · 64pt collapsed, 240pt expanded. Brand header reads from manifest. Footer slot hosts the variant picker.",
                actionLabel: "Toggle expand",
                action: onToggleRail
            ),
            Primitive(
                id: "inspector",
                name: "HInspector",
                icon: "sidebar.right",
                tagline: "Trailing 280pt collapsible panel with a header slot and scrolling body. Hidden by the shell on compact width.",
                actionLabel: "Toggle inspector",
                action: onToggleInspector
            ),
            Primitive(
                id: "drawer",
                name: "HTerminalDrawer",
                icon: "terminal",
                tagline: "Bottom slide-up drawer with isOpen binding. Always shows a 32pt header strip; expands to a configurable height when open.",
                actionLabel: "Toggle drawer",
                action: onToggleDrawer
            ),
            Primitive(
                id: "canvas",
                name: "HCanvas",
                icon: "rectangle.dashed",
                tagline: "Content-slot work surface. Optional grid background, pinned header, scrolling body. The arach-laptop detail screen uses this.",
                actionLabel: nil,
                action: nil
            ),
            Primitive(
                id: "takeover",
                name: "HTakeover",
                icon: "rectangle.fill.on.rectangle.fill",
                tagline: "Full-viewport blocking flow mounted via .hudsonTakeover. Header slot, content slot, fade + slide-up transition.",
                actionLabel: "Open takeover",
                action: onOpenTakeover
            ),
            Primitive(
                id: "palette",
                name: "HCommandPalette",
                icon: "command",
                tagline: "Centered ⌘K overlay. Search field, grouped command list, keyboard navigation, scrim backdrop, return to execute, esc to dismiss.",
                actionLabel: "Open palette",
                action: onOpenPalette
            )
        ]
    }
}

// MARK: - Primitive model

private struct Primitive: Identifiable {
    let id: String
    let name: String
    let icon: String
    let tagline: String
    let actionLabel: String?
    let action: (() -> Void)?
}

// MARK: - Card

private struct PrimitiveCard: View {
    let primitive: Primitive
    @Environment(\.hudsonAppManifest) private var manifest

    var body: some View {
        HCard {
            VStack(alignment: .leading, spacing: HSpacing.lg) {
                HStack(spacing: HSpacing.lg) {
                    Image(systemName: primitive.icon)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(manifest.accent)
                        .frame(width: 32, height: 32)
                        .background(RoundedRectangle(cornerRadius: HRadius.standard).fill(manifest.accent.opacity(0.12)))
                        .overlay(RoundedRectangle(cornerRadius: HRadius.standard).stroke(manifest.accent.opacity(0.28), lineWidth: 1))

                    Text(primitive.name)
                        .font(HFont.mono(13, weight: .semibold))
                        .foregroundStyle(HPalette.ink)

                    Spacer()
                }

                Text(primitive.tagline)
                    .font(HFont.ui(12))
                    .foregroundStyle(HPalette.muted)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Spacer(minLength: HSpacing.sm)

                HStack {
                    Spacer()
                    if let label = primitive.actionLabel, let action = primitive.action {
                        HButton(label, icon: "play.fill", style: .secondary, action: action)
                    } else {
                        Text("ALWAYS-ON")
                            .font(HFont.mono(9, weight: .semibold))
                            .tracking(1.0)
                            .foregroundStyle(HPalette.dim)
                            .frame(height: 32)
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .frame(maxHeight: .infinity, alignment: .top)
    }
}
