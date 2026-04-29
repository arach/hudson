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

            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 260), spacing: HudsonSpacing.xl)],
                alignment: .leading,
                spacing: HudsonSpacing.xl
            ) {
                ReferenceStepCard(index: "01", title: "Introduce", detail: "State what the app does and what remains local.")
                ReferenceStepCard(index: "02", title: "Prepare", detail: "Request permissions and verify required services.")
                ReferenceStepCard(index: "03", title: "Confirm", detail: "Show readiness before entering the main workspace.")
            }
        }
    }
}

struct ConfigurationReferenceScreen: View {
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
                    HudsonKVRow("Model", value: "local-default")
                    HudsonKVRow("Backend", value: "native")
                    HudsonKVRow("Warmup", value: "On demand", valueColor: HudsonPalette.statusInfo)
                }
            }

            HudsonCard {
                VStack(alignment: .leading, spacing: HudsonSpacing.lg) {
                    HudsonSectionLabel("Integration")
                    HudsonInset {
                        VStack(alignment: .leading, spacing: HudsonSpacing.md) {
                            HudsonKVRow("Origin", value: "http://localhost:*")
                            HudsonKVRow("Policy", value: "User managed")
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
                RuntimeMetricCard(label: "Daemon", value: "Running", tint: HudsonPalette.statusOk)
                RuntimeMetricCard(label: "Bridge", value: "Listening", tint: HudsonPalette.statusInfo)
                RuntimeMetricCard(label: "Warmup", value: "Ready", tint: HudsonPalette.statusOk)
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

private struct ReferenceStepCard: View {
    let index: String
    let title: String
    let detail: String

    var body: some View {
        HudsonCard {
            VStack(alignment: .leading, spacing: HudsonSpacing.lg) {
                HudsonBadge(index, tint: HudsonPalette.statusInfo)
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
    let tint: Color

    var body: some View {
        HudsonCard {
            HStack(spacing: HudsonSpacing.lg) {
                HudsonStatusDot(color: tint, pulses: true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(label.uppercased())
                        .font(HudsonFont.mono(9, weight: .semibold))
                        .foregroundStyle(HudsonPalette.dim)
                    Text(value)
                        .font(HudsonFont.mono(13, weight: .semibold))
                        .foregroundStyle(HudsonPalette.ink)
                }
                Spacer()
            }
        }
    }
}
