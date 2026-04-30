import SwiftUI
import HudsonUI
import HudsonVoice

struct WelcomeReferenceScreen: View {
    var body: some View {
        VStack(alignment: .leading, spacing: HudsonSpacing.huge) {
            ScreenHeader(
                title: "Welcome",
                badge: "FIRST RUN",
                summary: "Use this shape for onboarding, account-free setup, permissions, and the first successful connection to local services."
            )

            ReferenceHeroCard()

            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 260), spacing: HudsonSpacing.xl)],
                alignment: .leading,
                spacing: HudsonSpacing.xl
            ) {
                ReferenceStepCard(index: "01", icon: "sparkles", title: "Introduce", detail: "State what the app does and what remains local.")
                ReferenceStepCard(index: "02", icon: "checklist", title: "Prepare", detail: "Request permissions and verify required services.")
                ReferenceStepCard(index: "03", icon: "checkmark.seal", title: "Confirm", detail: "Show readiness before entering the main workspace.")
            }
        }
    }
}

struct ConfigurationReferenceScreen: View {
    @State private var selectedProvider = "native"
    @State private var originFilter = ""

    private let origins = [
        ReferenceOrigin(origin: "http://localhost:*", policy: "User managed", tint: HudsonPalette.statusInfo),
        ReferenceOrigin(origin: "hudson://bridge", policy: "Trusted", tint: HudsonPalette.statusOk),
        ReferenceOrigin(origin: "file://exports", policy: "Prompt", tint: HudsonPalette.statusWarn),
    ]

    private var visibleOrigins: [ReferenceOrigin] {
        guard !originFilter.isEmpty else { return origins }
        return origins.filter {
            $0.origin.localizedCaseInsensitiveContains(originFilter)
            || $0.policy.localizedCaseInsensitiveContains(originFilter)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: HudsonSpacing.huge) {
            ScreenHeader(
                title: "Configuration",
                badge: "SETTINGS",
                summary: "Use dense cards and key-value rows for user-editable service settings, provider choices, and integration allowlists."
            )

            HudsonCard {
                VStack(alignment: .leading, spacing: HudsonSpacing.lg) {
                    HudsonSectionLabel("Provider")
                    VStack(spacing: HudsonSpacing.md) {
                        HudsonListRow(
                            title: "Native",
                            subtitle: "Local runtime and direct shell integration",
                            icon: "cpu",
                            iconTint: .cyan,
                            isSelected: selectedProvider == "native"
                        ) {
                            selectedProvider = "native"
                        } trailing: {
                            HudsonBadge("DEFAULT", tint: HudsonPalette.statusInfo)
                        }

                        HudsonListRow(
                            title: "Remote",
                            subtitle: "Reference row for hosted adapters",
                            icon: "network",
                            iconTint: .blue,
                            isSelected: selectedProvider == "remote"
                        ) {
                            selectedProvider = "remote"
                        } trailing: {
                            HudsonBadge("OPTIONAL", tint: HudsonPalette.muted)
                        }
                    }
                }
            }

            HudsonCard {
                VStack(alignment: .leading, spacing: HudsonSpacing.lg) {
                    HudsonSectionLabel("Integration")
                    HudsonField("Filter origins", text: $originFilter)
                    HudsonInset {
                        VStack(alignment: .leading, spacing: HudsonSpacing.md) {
                            if visibleOrigins.isEmpty {
                                HudsonEmptyState(title: "No matching origins", subtitle: "Clear the filter to restore the reference policies.", icon: "magnifyingglass")
                            } else {
                                ForEach(visibleOrigins) { origin in
                                    HudsonKVRow("Origin", value: origin.origin)
                                    HudsonKVRow("Policy", value: origin.policy, valueColor: origin.tint)
                                    if origin.id != visibleOrigins.last?.id {
                                        HudsonDivider()
                                    }
                                }
                            }
                        }
                    }
                    HStack {
                        HudsonButton("Add", icon: "plus", style: .primary(.cyan)) {}
                        HudsonButton("Refresh", icon: "arrow.clockwise", style: .secondary) {}
                    }
                }
            }
        }
    }
}

struct RuntimeReferenceScreen: View {
    @State private var selectedEvent = "bridge"

    private let events = [
        ReferenceRuntimeEvent(id: "daemon", title: "Daemon launched", detail: "Process 42037 is accepting requests", icon: "bolt.fill", tint: HudsonPalette.statusOk, time: "now"),
        ReferenceRuntimeEvent(id: "bridge", title: "Bridge listening", detail: "Loopback endpoint ready on 127.0.0.1", icon: "point.3.connected.trianglepath.dotted", tint: HudsonPalette.statusInfo, time: "14s"),
        ReferenceRuntimeEvent(id: "warmup", title: "Warmup complete", detail: "First request path is primed", icon: "gauge.with.dots.needle.67percent", tint: HudsonPalette.statusOk, time: "41s"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: HudsonSpacing.huge) {
            ScreenHeader(
                title: "Runtime",
                badge: "HEALTH",
                summary: "Expose service state, ports, process IDs, recent events, and recovery controls without burying them in generic settings."
            )

            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 240), spacing: HudsonSpacing.xl)],
                alignment: .leading,
                spacing: HudsonSpacing.xl
            ) {
                RuntimeMetricCard(label: "Daemon", value: "Running", detail: "PID 42037", tint: HudsonPalette.statusOk, pulses: true)
                RuntimeMetricCard(label: "Bridge", value: "Listening", detail: "127.0.0.1", tint: HudsonPalette.statusInfo)
                RuntimeMetricCard(label: "Warmup", value: "Ready", detail: "41 ms", tint: HudsonPalette.statusOk)
            }

            HudsonCard(padding: HudsonSpacing.md) {
                VStack(alignment: .leading, spacing: HudsonSpacing.md) {
                    HudsonSectionLabel("Recent events")
                        .padding(.horizontal, HudsonSpacing.md)
                    ForEach(events) { event in
                        HudsonListRow(
                            title: event.title,
                            subtitle: event.detail,
                            icon: event.icon,
                            iconTint: event.iconTint,
                            isSelected: selectedEvent == event.id
                        ) {
                            selectedEvent = event.id
                        } trailing: {
                            HudsonBadge(event.time, tint: event.tint)
                        }
                    }
                }
            }

            HudsonCard {
                VStack(alignment: .leading, spacing: HudsonSpacing.md) {
                    HudsonSectionLabel("Recovery")
                    Text("Give users explicit recovery actions for stale sessions, stopped services, and configuration drift.")
                        .font(HudsonFont.ui(12))
                        .foregroundStyle(HudsonPalette.muted)
                    HStack {
                        HudsonButton("Restart", icon: "arrow.clockwise", style: .secondary) {}
                        HudsonButton("Run check", icon: "stethoscope", style: .ghost) {}
                    }
                }
            }
        }
    }
}

struct VoiceReferenceScreen: View {
    var body: some View {
        VStack(alignment: .leading, spacing: HudsonSpacing.huge) {
            ScreenHeader(
                title: "Voice",
                badge: "OPTIONAL MODULE",
                summary: "Feature modules should mount as ordinary app-owned screens. The host app decides when a provider is enabled and how recovered state is presented."
            )

            HudsonCard(padding: HudsonSpacing.md) {
                VStack(spacing: HudsonSpacing.md) {
                    HudsonListRow(
                        title: "Health check",
                        subtitle: "Probe before showing live controls",
                        icon: "checkmark.seal",
                        iconTint: .green,
                        trailing: {
                            HudsonBadge("HOST", tint: HudsonPalette.statusOk)
                        }
                    )
                    HudsonListRow(
                        title: "Live session",
                        subtitle: "Provider UI stays mounted as a normal screen",
                        icon: "waveform",
                        iconTint: .cyan,
                        trailing: {
                            HudsonBadge("MODULE", tint: HudsonPalette.statusInfo)
                        }
                    )
                    HudsonListRow(
                        title: "Recovery",
                        subtitle: "Cleanup belongs in app-owned settings and runtime views",
                        icon: "wrench.and.screwdriver",
                        iconTint: .amber,
                        trailing: {
                            HudsonBadge("APP", tint: HudsonPalette.statusWarn)
                        }
                    )
                }
            }

            LazyVGrid(
                columns: [
                    GridItem(.adaptive(minimum: 360, maximum: 620), spacing: HudsonSpacing.xl)
                ],
                alignment: .leading,
                spacing: HudsonSpacing.xl
            ) {
                HudsonVoicePanel(options: HudsonVoxLiveSessionOptions(clientId: "hudsonkit-reference"))

                HudsonCard {
                    VStack(alignment: .leading, spacing: HudsonSpacing.lg) {
                        HudsonSectionLabel("Host responsibilities", tint: HudsonPalette.statusInfo)
                        Text("A product app owns when voice is available, which provider is enabled, and how stale session recovery appears inside its own settings and runtime screens.")
                            .font(HudsonFont.ui(12))
                            .foregroundStyle(HudsonPalette.muted)
                            .fixedSize(horizontal: false, vertical: true)

                        HudsonInset {
                            VStack(alignment: .leading, spacing: HudsonSpacing.md) {
                                HudsonKVRow("Provider", value: "Vox")
                                HudsonKVRow("Endpoint", value: "127.0.0.1:42137")
                                HudsonKVRow("Recovery", value: "App owned", valueColor: HudsonPalette.statusInfo)
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                HudsonCard {
                    VStack(alignment: .leading, spacing: HudsonSpacing.lg) {
                        HudsonSectionLabel("Provider contract", tint: HudsonPalette.statusInfo)
                        Text("Use a small adapter around the local companion. Keep the screen ordinary: health check, live session controls, transcript surface, and explicit cleanup actions.")
                            .font(HudsonFont.ui(12))
                            .foregroundStyle(HudsonPalette.muted)
                            .fixedSize(horizontal: false, vertical: true)

                        HStack(spacing: HudsonSpacing.md) {
                            HudsonBadge("HEALTH", tint: HudsonPalette.statusOk, dot: true)
                            HudsonBadge("LIVE SESSION", tint: HudsonPalette.statusInfo, dot: true)
                            HudsonBadge("RECOVERY", tint: HudsonPalette.statusWarn, dot: true)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }
}

private struct ScreenHeader: View {
    let title: String
    let badge: String
    let summary: String

    var body: some View {
        VStack(alignment: .leading, spacing: HudsonSpacing.md) {
            HStack(spacing: HudsonSpacing.md) {
                HudsonSectionLabel(title)
                HudsonBadge(badge, tint: HudsonPalette.statusInfo)
            }
            Text(summary)
                .font(HudsonFont.ui(12))
                .foregroundStyle(HudsonPalette.muted)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: 760, alignment: .leading)
        }
    }
}

private struct ReferenceHeroCard: View {
    var body: some View {
        HudsonCard(padding: 0) {
            ZStack(alignment: .topLeading) {
                HudsonGridBackground(step: 24)
                    .opacity(0.8)

                VStack(alignment: .leading, spacing: HudsonSpacing.xl) {
                    HStack(spacing: HudsonSpacing.md) {
                        HudsonBadge("NATIVE", tint: HudsonPalette.statusInfo, dot: true)
                        HudsonBadge("FAST SHELL", tint: HudsonPalette.statusOk, dot: true)
                        HudsonBadge("BASELINE", tint: HudsonPalette.muted)
                    }

                    Text("HudsonKit reference scaffold")
                        .font(HudsonFont.ui(24, weight: .semibold))
                        .foregroundStyle(HudsonPalette.ink)

                    Text("A compact app shell with rail navigation, inspector context, status chrome, primitive controls, and optional module mounting.")
                        .font(HudsonFont.ui(13))
                        .foregroundStyle(HudsonPalette.muted)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: 620, alignment: .leading)

                    HudsonInset {
                        VStack(spacing: HudsonSpacing.md) {
                            HudsonKVRow("Target", value: "macOS 14 / iOS 17")
                            HudsonKVRow("Motion", value: "Short transitions", valueColor: HudsonPalette.statusOk)
                            HudsonKVRow("Measure", value: "Shell / SwiftUI / Module baselines", valueColor: HudsonPalette.statusInfo)
                        }
                    }
                    .frame(maxWidth: 420, alignment: .leading)
                }
                .padding(HudsonSpacing.huge)
            }
            .frame(maxWidth: .infinity, minHeight: 220, alignment: .topLeading)
            .clipShape(RoundedRectangle(cornerRadius: HudsonRadius.card))
        }
    }
}

private struct ReferenceStepCard: View {
    let index: String
    let icon: String
    let title: String
    let detail: String

    var body: some View {
        HudsonCard {
            VStack(alignment: .leading, spacing: HudsonSpacing.lg) {
                HStack {
                    HudsonBadge(index, tint: HudsonPalette.statusInfo)
                    Spacer()
                    Image(systemName: icon)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(HudsonPalette.statusInfo)
                        .frame(width: 28, height: 28)
                        .background(RoundedRectangle(cornerRadius: HudsonRadius.standard).fill(HudsonPalette.statusInfo.opacity(0.12)))
                        .overlay(RoundedRectangle(cornerRadius: HudsonRadius.standard).stroke(HudsonPalette.statusInfo.opacity(0.28), lineWidth: 1))
                }
                Text(title)
                    .font(HudsonFont.mono(13, weight: .semibold))
                    .foregroundStyle(HudsonPalette.ink)
                Text(detail)
                    .font(HudsonFont.ui(12))
                    .foregroundStyle(HudsonPalette.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private struct RuntimeMetricCard: View {
    let label: String
    let value: String
    let detail: String
    let tint: Color
    var pulses = false

    var body: some View {
        HudsonCard {
            HStack(spacing: HudsonSpacing.lg) {
                HudsonStatusDot(color: tint, pulses: pulses)
                VStack(alignment: .leading, spacing: 2) {
                    Text(label.uppercased())
                        .font(HudsonFont.mono(9, weight: .semibold))
                        .foregroundStyle(HudsonPalette.dim)
                    Text(value)
                        .font(HudsonFont.mono(13, weight: .semibold))
                        .foregroundStyle(HudsonPalette.ink)
                    Text(detail)
                        .font(HudsonFont.mono(10))
                        .foregroundStyle(HudsonPalette.muted)
                }
                Spacer()
            }
        }
    }
}

private struct ReferenceOrigin: Identifiable {
    let origin: String
    let policy: String
    let tint: Color

    var id: String { origin }
}

private struct ReferenceRuntimeEvent: Identifiable {
    let id: String
    let title: String
    let detail: String
    let icon: String
    let tint: Color
    let time: String

    var iconTint: HudsonTint {
        switch id {
        case "daemon": return .green
        case "bridge": return .cyan
        default: return .blue
        }
    }
}
