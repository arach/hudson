import AppKit
import SwiftUI
import HudsonNativeSupport

@main
struct HudsonMenuApp: App {
    @NSApplicationDelegateAdaptor(HudsonMenuAppDelegate.self) private var appDelegate
    @Environment(\.openSettings) private var openSettings

    @StateObject private var voiceHost: HudsonVoiceDaemonHost

    init() {
        let voiceHost = HudsonVoiceDaemonHost()
        _voiceHost = StateObject(wrappedValue: voiceHost)
        Task { @MainActor in
            voiceHost.refreshMicrophonePermission()
            if voiceHost.microphonePermission.canRequest {
                await voiceHost.requestMicrophonePermission()
            } else {
                voiceHost.start()
            }
        }
    }

    var body: some Scene {
        MenuBarExtra("Hudson", systemImage: "waveform") {
            HudsonMenuView(voiceHost: voiceHost, openSettings: openSettings)
        }
        .menuBarExtraStyle(.window)

        Settings {
            HudsonMenuSettingsView(voiceHost: voiceHost)
        }
    }
}

final class HudsonMenuAppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
    }
}

private struct HudsonMenuView: View {
    @ObservedObject var voiceHost: HudsonVoiceDaemonHost
    let openSettings: OpenSettingsAction

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            header
            Divider()
            voiceSection
            Divider()
            actions
        }
        .padding(14)
        .frame(width: 340)
    }

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("Hudson")
                    .font(.system(size: 15, weight: .semibold))
                Text("Voice daemon and local services")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Circle()
                .fill(voiceHost.lifecycle.tint)
                .frame(width: 9, height: 9)
        }
    }

    private var voiceSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Voice daemon")
                .font(.system(size: 12, weight: .semibold))
            Text(voiceHost.summary)
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            HStack {
                Button("Start") { voiceHost.start() }
                    .disabled(voiceHost.lifecycle == .running || voiceHost.lifecycle == .starting)
                Button("Stop") { voiceHost.stop() }
                    .disabled(voiceHost.lifecycle != .running && voiceHost.lifecycle != .starting)
                if voiceHost.microphonePermission.canRequest {
                    Button("Allow Mic") {
                        Task { await voiceHost.requestMicrophonePermission() }
                    }
                }
            }
            .controlSize(.small)
        }
    }

    private var actions: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Button("Show Hudson") {
                    HudsonMainAppLauncher.showHudsonApp()
                }
                Button("Settings") {
                    openSettings()
                }
            }
            .controlSize(.small)

            HStack {
                Button("Open Mic Settings") {
                    voiceHost.openMicrophoneSettings()
                }
                Button("Quit") {
                    NSApp.terminate(nil)
                }
            }
            .controlSize(.small)
        }
    }
}

private struct HudsonMenuSettingsView: View {
    @ObservedObject var voiceHost: HudsonVoiceDaemonHost

    var body: some View {
        Form {
            Section("Permission") {
                LabeledContent("Microphone", value: voiceHost.microphonePermission.label)
                HStack {
                    Button("Refresh") { voiceHost.refreshMicrophonePermission() }
                    Button("Request Access") {
                        Task { await voiceHost.requestMicrophonePermission() }
                    }
                    .disabled(!voiceHost.microphonePermission.canRequest)
                    Button("Open System Settings") {
                        voiceHost.openMicrophoneSettings()
                    }
                }
            }

            Section("Hudson Voice") {
                Picker("Input Device", selection: inputDeviceBinding) {
                    Text("System Default").tag("")
                    ForEach(voiceHost.inputDevices) { device in
                        Text(deviceLabel(device)).tag(device.id)
                    }
                }
                .onAppear {
                    voiceHost.refreshInputDevices()
                }

                LabeledContent("Selected Input", value: selectedInputLabel)
                LabeledContent("Default Input", value: defaultInputLabel)
                LabeledContent("Engine", value: "Hudson Voice embedded runtime")
                LabeledContent("Model", value: voiceHost.preferences.preferredTranscriptionModelId ?? "Default")
                LabeledContent("Model Readiness", value: "\(voiceHost.modelReadiness.label) - \(voiceHost.modelReadiness.detail)")
            }

            Section("Daemon") {
                LabeledContent("Lifecycle", value: voiceHost.lifecycle.label)
                LabeledContent("Runtime", value: voiceHost.runtimeDetail)
                LabeledContent("Capability", value: voiceHost.diagnostics.runtimeCapabilityPath)
                if let startedAt = voiceHost.startedAt {
                    LabeledContent("Started", value: startedAt.formatted(date: .abbreviated, time: .standard))
                }
                HStack {
                    Button("Start") { voiceHost.start() }
                        .disabled(voiceHost.lifecycle == .running || voiceHost.lifecycle == .starting)
                    Button("Stop") { voiceHost.stop() }
                        .disabled(voiceHost.lifecycle != .running && voiceHost.lifecycle != .starting)
                }
            }
        }
        .formStyle(.grouped)
        .padding()
        .frame(width: 720, height: 520)
    }

    private var inputDeviceBinding: Binding<String> {
        Binding(
            get: { voiceHost.preferences.preferredInputDeviceId ?? "" },
            set: { voiceHost.setPreferredInputDevice($0.isEmpty ? nil : $0) }
        )
    }

    private var selectedInputLabel: String {
        guard let id = voiceHost.preferences.preferredInputDeviceId else {
            return "System Default"
        }
        return voiceHost.inputDevices.first(where: { $0.id == id })?.name ?? "Unavailable"
    }

    private var defaultInputLabel: String {
        voiceHost.inputDevices.first(where: { $0.isDefault })?.name ?? "System Default"
    }

    private func deviceLabel(_ device: HudsonVoiceHostAudioDevice) -> String {
        if device.isDefault {
            return "\(device.name) (Default)"
        }
        return device.name
    }
}

private enum HudsonMainAppLauncher {
    static func showHudsonApp() {
        if let running = NSRunningApplication.runningApplications(withBundleIdentifier: "com.hudsonkit.hudson").first {
            running.activate(options: [.activateAllWindows])
            return
        }

        let siblingURL = Bundle.main.bundleURL
            .deletingLastPathComponent()
            .appendingPathComponent("Hudson.app", isDirectory: true)

        if FileManager.default.fileExists(atPath: siblingURL.path) {
            let configuration = NSWorkspace.OpenConfiguration()
            configuration.activates = true
            NSWorkspace.shared.openApplication(at: siblingURL, configuration: configuration)
            return
        }

        guard let installedURL = NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.hudsonkit.hudson") else {
            return
        }
        let configuration = NSWorkspace.OpenConfiguration()
        configuration.activates = true
        NSWorkspace.shared.openApplication(at: installedURL, configuration: configuration)
    }
}
