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
    let onOpenTerminal: () -> Void
    let onToggleRail: () -> Void
    let onToggleInspector: () -> Void

    @Environment(\.hudsonAppManifest) private var manifest

    var body: some View {
        VStack(alignment: .leading, spacing: HudSpacing.huge) {
            header

            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 320), spacing: HudSpacing.xl)],
                alignment: .leading,
                spacing: HudSpacing.xl
            ) {
                ForEach(primitives) { primitive in
                    PrimitiveCard(primitive: primitive)
                }
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: HudSpacing.md) {
            HStack(spacing: HudSpacing.md) {
                HudSectionLabel("Shell · M3 chrome", tint: manifest.accent)
                Spacer()
                HudBadge("\(primitives.count) PRIMITIVES", tint: manifest.accent)
            }

            Text("HudsonShell composes the chassis around a HApp — slots for navigation, inspection, drawers, and overlays. Each card below documents one surface and lets you exercise it live.")
                .font(HudFont.ui(HudTextSize.sm))
                .foregroundStyle(HudPalette.muted)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: HudLayout.readableWidth, alignment: .leading)
        }
    }

    // MARK: Primitives

    private var primitives: [Primitive] {
        [
            Primitive(
                id: "appshell",
                name: "HudAppShell",
                icon: "rectangle.split.3x1",
                tagline: "Chassis with six slots — leading, trailing, topDrawer, bottomDrawer, content, statusBar. The whole thing you're looking at right now.",
                actionLabel: nil,
                action: nil
            ),
            Primitive(
                id: "rail",
                name: "HudNavigationRail",
                icon: "sidebar.left",
                tagline: "Leading rail · 64pt collapsed, 240pt expanded. Brand header reads from manifest.",
                actionLabel: "Toggle expand",
                action: onToggleRail
            ),
            Primitive(
                id: "inspector",
                name: "HudInspector",
                icon: "sidebar.right",
                tagline: "Trailing 280pt collapsible panel with a header slot and scrolling body. Hidden by the shell on compact width.",
                actionLabel: "Toggle inspector",
                action: onToggleInspector
            ),
            Primitive(
                id: "drawer",
                name: "HudTerminalDrawer",
                icon: "terminal",
                tagline: "Bottom slide-up drawer with isOpen binding. This demo keeps a single status footer; terminal runs as a floating takeover app instead.",
                actionLabel: "Open terminal app",
                action: onOpenTerminal
            ),
            Primitive(
                id: "canvas",
                name: "HudCanvas",
                icon: "rectangle.dashed",
                tagline: "Content-slot work surface. Optional grid background, pinned header, scrolling body. The arach-laptop detail screen uses this.",
                actionLabel: nil,
                action: nil
            ),
            Primitive(
                id: "takeover",
                name: "HudTakeover",
                icon: "rectangle.fill.on.rectangle.fill",
                tagline: "Full-viewport blocking flow mounted via .hudsonTakeover. Header slot, content slot, fade + slide-up transition.",
                actionLabel: "Open takeover",
                action: onOpenTakeover
            ),
            Primitive(
                id: "palette",
                name: "HudCommandPalette",
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
        HudCard {
            VStack(alignment: .leading, spacing: HudSpacing.lg) {
                HStack(spacing: HudSpacing.lg) {
                    Image(systemName: primitive.icon)
                        .font(HudFont.ui(HudTextSize.md, weight: .medium))
                        .foregroundStyle(manifest.accent)
                        .frame(width: HudIconSize.large, height: HudIconSize.large)
                        .background(RoundedRectangle(cornerRadius: HudRadius.standard).fill(HudSurface.tintFill(manifest.accent)))
                        .overlay(RoundedRectangle(cornerRadius: HudRadius.standard).stroke(HudSurface.tintBorder(manifest.accent), lineWidth: 1))

                    Text(primitive.name)
                        .font(HudFont.mono(HudTextSize.base, weight: .semibold))
                        .foregroundStyle(HudPalette.ink)

                    Spacer()
                }

                Text(primitive.tagline)
                    .font(HudFont.ui(HudTextSize.sm))
                    .foregroundStyle(HudPalette.muted)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Spacer(minLength: HudSpacing.sm)

                HStack {
                    Spacer()
                    if let label = primitive.actionLabel, let action = primitive.action {
                        HudButton(label, icon: "play.fill", style: .secondary, action: action)
                    } else {
                        Text("ALWAYS-ON")
                            .font(HudFont.mono(HudTextSize.micro, weight: .semibold))
                            .tracking(1.0)
                            .foregroundStyle(HudPalette.dim)
                            .frame(height: HudLayout.buttonHeight)
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .frame(maxHeight: .infinity, alignment: .top)
    }
}
