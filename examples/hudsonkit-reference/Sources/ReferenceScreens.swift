import SwiftUI
import HudsonUI
import HudsonVoice

struct WelcomeReferenceScreen: View {
    var body: some View {
        VStack(alignment: .leading, spacing: HSpacing.huge) {
            ScreenHeader(
                title: "Welcome",
                badge: "FIRST RUN",
                summary: "Use this shape for onboarding, account-free setup, permissions, and the first successful connection to local services."
            )

            ReferenceHeroCard()

            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 260), spacing: HSpacing.xl)],
                alignment: .leading,
                spacing: HSpacing.xl
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
        ReferenceOrigin(origin: "http://localhost:*", policy: "User managed", tint: HPalette.statusInfo),
        ReferenceOrigin(origin: "hudson://bridge", policy: "Trusted", tint: HPalette.statusOk),
        ReferenceOrigin(origin: "file://exports", policy: "Prompt", tint: HPalette.statusWarn),
    ]

    private var visibleOrigins: [ReferenceOrigin] {
        guard !originFilter.isEmpty else { return origins }
        return origins.filter {
            $0.origin.localizedCaseInsensitiveContains(originFilter)
            || $0.policy.localizedCaseInsensitiveContains(originFilter)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: HSpacing.huge) {
            ScreenHeader(
                title: "Configuration",
                badge: "SETTINGS",
                summary: "Use dense cards and key-value rows for user-editable service settings, provider choices, and integration allowlists."
            )

            HCard {
                VStack(alignment: .leading, spacing: HSpacing.lg) {
                    HSectionLabel("Provider")
                    VStack(spacing: HSpacing.md) {
                        HListRow(
                            title: "Native",
                            subtitle: "Local runtime and direct shell integration",
                            icon: "cpu",
                            iconTint: .cyan,
                            isSelected: selectedProvider == "native"
                        ) {
                            selectedProvider = "native"
                        } trailing: {
                            HBadge("DEFAULT", tint: HPalette.statusInfo)
                        }

                        HListRow(
                            title: "Remote",
                            subtitle: "Reference row for hosted adapters",
                            icon: "network",
                            iconTint: .blue,
                            isSelected: selectedProvider == "remote"
                        ) {
                            selectedProvider = "remote"
                        } trailing: {
                            HBadge("OPTIONAL", tint: HPalette.muted)
                        }
                    }
                }
            }

            HCard {
                VStack(alignment: .leading, spacing: HSpacing.lg) {
                    HSectionLabel("Integration")
                    HField("Filter origins", text: $originFilter)
                    HInset {
                        VStack(alignment: .leading, spacing: HSpacing.md) {
                            if visibleOrigins.isEmpty {
                                HEmptyState(title: "No matching origins", subtitle: "Clear the filter to restore the reference policies.", icon: "magnifyingglass")
                            } else {
                                ForEach(visibleOrigins) { origin in
                                    HKVRow("Origin", value: origin.origin)
                                    HKVRow("Policy", value: origin.policy, valueColor: origin.tint)
                                    if origin.id != visibleOrigins.last?.id {
                                        HDivider()
                                    }
                                }
                            }
                        }
                    }
                    HStack {
                        HButton("Add", icon: "plus", style: .primary(.cyan)) {}
                        HButton("Refresh", icon: "arrow.clockwise", style: .secondary) {}
                    }
                }
            }
        }
    }
}

struct RuntimeReferenceScreen: View {
    @State private var selectedEvent = "bridge"

    private let events = [
        ReferenceRuntimeEvent(id: "daemon", title: "Daemon launched", detail: "Process 42037 is accepting requests", icon: "bolt.fill", tint: HPalette.statusOk, time: "now"),
        ReferenceRuntimeEvent(id: "bridge", title: "Bridge listening", detail: "Loopback endpoint ready on 127.0.0.1", icon: "point.3.connected.trianglepath.dotted", tint: HPalette.statusInfo, time: "14s"),
        ReferenceRuntimeEvent(id: "warmup", title: "Warmup complete", detail: "First request path is primed", icon: "gauge.with.dots.needle.67percent", tint: HPalette.statusOk, time: "41s"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: HSpacing.huge) {
            ScreenHeader(
                title: "Runtime",
                badge: "HEALTH",
                summary: "Expose service state, ports, process IDs, recent events, and recovery controls without burying them in generic settings."
            )

            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 240), spacing: HSpacing.xl)],
                alignment: .leading,
                spacing: HSpacing.xl
            ) {
                RuntimeMetricCard(label: "Daemon", value: "Running", detail: "PID 42037", tint: HPalette.statusOk, pulses: true)
                RuntimeMetricCard(label: "Bridge", value: "Listening", detail: "127.0.0.1", tint: HPalette.statusInfo)
                RuntimeMetricCard(label: "Warmup", value: "Ready", detail: "41 ms", tint: HPalette.statusOk)
            }

            HCard(padding: HSpacing.md) {
                VStack(alignment: .leading, spacing: HSpacing.md) {
                    HSectionLabel("Recent events")
                        .padding(.horizontal, HSpacing.md)
                    ForEach(events) { event in
                        HListRow(
                            title: event.title,
                            subtitle: event.detail,
                            icon: event.icon,
                            iconTint: event.iconTint,
                            isSelected: selectedEvent == event.id
                        ) {
                            selectedEvent = event.id
                        } trailing: {
                            HBadge(event.time, tint: event.tint)
                        }
                    }
                }
            }

            HCard {
                VStack(alignment: .leading, spacing: HSpacing.md) {
                    HSectionLabel("Recovery")
                    Text("Give users explicit recovery actions for stale sessions, stopped services, and configuration drift.")
                        .font(HFont.ui(12))
                        .foregroundStyle(HPalette.muted)
                    HStack {
                        HButton("Restart", icon: "arrow.clockwise", style: .secondary) {}
                        HButton("Run check", icon: "stethoscope", style: .ghost) {}
                    }
                }
            }
        }
    }
}

struct VoiceReferenceScreen: View {
    var body: some View {
        VStack(alignment: .leading, spacing: HSpacing.huge) {
            ScreenHeader(
                title: "Voice",
                badge: "OPTIONAL MODULE",
                summary: "Feature modules should mount as ordinary app-owned screens. The host app decides when a provider is enabled and how recovered state is presented."
            )

            HCard(padding: HSpacing.md) {
                VStack(spacing: HSpacing.md) {
                    HListRow(
                        title: "Health check",
                        subtitle: "Probe before showing live controls",
                        icon: "checkmark.seal",
                        iconTint: .green,
                        trailing: {
                            HBadge("HOST", tint: HPalette.statusOk)
                        }
                    )
                    HListRow(
                        title: "Live session",
                        subtitle: "Provider UI stays mounted as a normal screen",
                        icon: "waveform",
                        iconTint: .cyan,
                        trailing: {
                            HBadge("MODULE", tint: HPalette.statusInfo)
                        }
                    )
                    HListRow(
                        title: "Recovery",
                        subtitle: "Cleanup belongs in app-owned settings and runtime views",
                        icon: "wrench.and.screwdriver",
                        iconTint: .amber,
                        trailing: {
                            HBadge("APP", tint: HPalette.statusWarn)
                        }
                    )
                }
            }

            LazyVGrid(
                columns: [
                    GridItem(.adaptive(minimum: 360, maximum: 620), spacing: HSpacing.xl)
                ],
                alignment: .leading,
                spacing: HSpacing.xl
            ) {
                HVoicePanel(options: HVoxLiveSessionOptions(clientId: "hudsonkit-reference"))

                HCard {
                    VStack(alignment: .leading, spacing: HSpacing.lg) {
                        HSectionLabel("Host responsibilities", tint: HPalette.statusInfo)
                        Text("A product app owns when voice is available, which provider is enabled, and how stale session recovery appears inside its own settings and runtime screens.")
                            .font(HFont.ui(12))
                            .foregroundStyle(HPalette.muted)
                            .fixedSize(horizontal: false, vertical: true)

                        HInset {
                            VStack(alignment: .leading, spacing: HSpacing.md) {
                                HKVRow("Provider", value: "Vox")
                                HKVRow("Endpoint", value: "127.0.0.1:42138")
                                HKVRow("Recovery", value: "App owned", valueColor: HPalette.statusInfo)
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                HCard {
                    VStack(alignment: .leading, spacing: HSpacing.lg) {
                        HSectionLabel("Provider contract", tint: HPalette.statusInfo)
                        Text("Use a small adapter around the local companion. Keep the screen ordinary: health check, live session controls, transcript surface, and explicit cleanup actions.")
                            .font(HFont.ui(12))
                            .foregroundStyle(HPalette.muted)
                            .fixedSize(horizontal: false, vertical: true)

                        HStack(spacing: HSpacing.md) {
                            HBadge("HEALTH", tint: HPalette.statusOk, dot: true)
                            HBadge("LIVE SESSION", tint: HPalette.statusInfo, dot: true)
                            HBadge("RECOVERY", tint: HPalette.statusWarn, dot: true)
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
        VStack(alignment: .leading, spacing: HSpacing.md) {
            HStack(spacing: HSpacing.md) {
                HSectionLabel(title)
                HBadge(badge, tint: HPalette.statusInfo)
            }
            Text(summary)
                .font(HFont.ui(12))
                .foregroundStyle(HPalette.muted)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: 760, alignment: .leading)
        }
    }
}

private struct ReferenceHeroCard: View {
    var body: some View {
        HCard(padding: 0) {
            ZStack(alignment: .topLeading) {
                HGridBackground(step: 24)
                    .opacity(0.8)

                VStack(alignment: .leading, spacing: HSpacing.xl) {
                    HStack(spacing: HSpacing.md) {
                        HBadge("NATIVE", tint: HPalette.statusInfo, dot: true)
                        HBadge("FAST SHELL", tint: HPalette.statusOk, dot: true)
                        HBadge("BASELINE", tint: HPalette.muted)
                    }

                    Text("HudsonKit reference scaffold")
                        .font(HFont.ui(24, weight: .semibold))
                        .foregroundStyle(HPalette.ink)

                    Text("A compact app shell with rail navigation, inspector context, status chrome, primitive controls, and optional module mounting.")
                        .font(HFont.ui(13))
                        .foregroundStyle(HPalette.muted)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: 620, alignment: .leading)

                    HInset {
                        VStack(spacing: HSpacing.md) {
                            HKVRow("Target", value: "macOS 14 / iOS 17")
                            HKVRow("Motion", value: "Short transitions", valueColor: HPalette.statusOk)
                            HKVRow("Measure", value: "Shell / SwiftUI / Module baselines", valueColor: HPalette.statusInfo)
                        }
                    }
                    .frame(maxWidth: 420, alignment: .leading)
                }
                .padding(HSpacing.huge)
            }
            .frame(maxWidth: .infinity, minHeight: 220, alignment: .topLeading)
            .clipShape(RoundedRectangle(cornerRadius: HRadius.card))
        }
    }
}

private struct ReferenceStepCard: View {
    let index: String
    let icon: String
    let title: String
    let detail: String

    var body: some View {
        HCard {
            VStack(alignment: .leading, spacing: HSpacing.lg) {
                HStack {
                    HBadge(index, tint: HPalette.statusInfo)
                    Spacer()
                    Image(systemName: icon)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(HPalette.statusInfo)
                        .frame(width: 28, height: 28)
                        .background(RoundedRectangle(cornerRadius: HRadius.standard).fill(HPalette.statusInfo.opacity(0.12)))
                        .overlay(RoundedRectangle(cornerRadius: HRadius.standard).stroke(HPalette.statusInfo.opacity(0.28), lineWidth: 1))
                }
                Text(title)
                    .font(HFont.mono(13, weight: .semibold))
                    .foregroundStyle(HPalette.ink)
                Text(detail)
                    .font(HFont.ui(12))
                    .foregroundStyle(HPalette.muted)
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
        HCard {
            HStack(spacing: HSpacing.lg) {
                HStatusDot(color: tint, pulses: pulses)
                VStack(alignment: .leading, spacing: 2) {
                    Text(label.uppercased())
                        .font(HFont.mono(9, weight: .semibold))
                        .foregroundStyle(HPalette.dim)
                    Text(value)
                        .font(HFont.mono(13, weight: .semibold))
                        .foregroundStyle(HPalette.ink)
                    Text(detail)
                        .font(HFont.mono(10))
                        .foregroundStyle(HPalette.muted)
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

    var iconTint: HTint {
        switch id {
        case "daemon": return .green
        case "bridge": return .cyan
        default: return .blue
        }
    }
}
