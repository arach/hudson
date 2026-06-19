import AVFoundation
import SwiftUI
import HudsonUI

#if os(macOS)
import AppKit
#elseif os(iOS)
import UIKit
#endif

public struct HudsonVoiceSettingsView: View {
    private let preferencesURL: URL
    private let showsMicrophonePermission: Bool
    private let managesMicrophonePermission: Bool
    private let appName: String

    @State private var preferences: HudsonVoicePreferences
    @State private var inputDevices: [HudsonVoiceAudioDevice] = []
    @State private var defaultInputDeviceId: String?
    @State private var runtimeStatus: VoiceRuntimeStatus = .unchecked
    @State private var microphoneStatus: AVAuthorizationStatus = Self.currentMicrophoneStatus()
    @State private var errorMessage: String?
    @State private var isRequestingMicrophone = false

    public init(
        preferencesURL: URL = HudsonVoicePreferences.defaultPreferencesURL,
        showsMicrophonePermission: Bool = true,
        managesMicrophonePermission: Bool = true,
        appName: String = "This app"
    ) {
        self.preferencesURL = preferencesURL
        self.showsMicrophonePermission = showsMicrophonePermission
        self.managesMicrophonePermission = managesMicrophonePermission
        self.appName = appName
        let loaded = (try? HudsonVoicePreferences.load(from: preferencesURL)) ?? HudsonVoicePreferences()
        _preferences = State(initialValue: loaded.normalized())
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: HudSpacing.xxl) {
            runtimeSection
            captureSection
            troubleshootingSection
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .task {
            refreshAll()
        }
    }

    private var runtimeSection: some View {
        VoiceSettingsSection("Runtime") {
            VoiceSettingsRow(
                icon: runtimeStatus.icon,
                iconColor: runtimeStatus.tint,
                title: "Engine",
                subtitle: runtimeDetail
            ) {
                HudBadge(runtimeStatus.label, tint: runtimeStatus.tint)
            }

            if showsMicrophonePermission {
                HudDivider()
                microphonePermissionRow
            }
        }
    }

    private var captureSection: some View {
        VoiceSettingsSection("Capture") {
            VoiceSettingsPickerRow(
                title: "Input Device",
                subtitle: "The microphone \(appName) uses for dictation and voice commands",
                value: selectedInputDeviceLabel,
                icon: "mic",
                iconColor: HudPalette.dim,
                selection: inputDeviceSelection
            ) {
                Text("System Default").tag("")
                if let missing = missingSelectedInputDeviceId {
                    Text("Missing device (\(shortDeviceId(missing)))").tag(missing)
                }
                ForEach(inputDevices) { device in
                    Text(deviceLabel(device)).tag(device.id)
                }
            }

            HudDivider()

            VoiceSettingsPickerRow(
                title: "Capture Mode",
                subtitle: "Default session mode used by apps that do not override it",
                value: modeLabel(preferences.mode),
                icon: "waveform.badge.mic",
                iconColor: HudPalette.dim,
                selection: modeSelection
            ) {
                Text("Push to Talk").tag(HudVoiceMode.pushToTalk)
                Text("Always On").tag(HudVoiceMode.alwaysOn)
            }

            HudDivider()

            VoiceSettingsPickerRow(
                title: "Transcription Model",
                subtitle: "On-device model for live dictation",
                value: modelLabel(preferences.preferredTranscriptionModelId),
                icon: "cpu",
                iconColor: HudPalette.dim,
                selection: modelSelection
            ) {
                Text("Parakeet v3").tag(HudsonVoicePreferences.defaultTranscriptionModelId)
            }

            HudDivider()

            VoiceSettingsPickerRow(
                title: "Language",
                subtitle: "Recognition language for the embedded runtime",
                value: languageLabel(preferences.preferredLanguage),
                icon: "textformat.abc",
                iconColor: HudPalette.dim,
                selection: languageSelection
            ) {
                Text("English").tag("en")
            }
        }
    }

    private var troubleshootingSection: some View {
        VoiceSettingsSection("Readiness") {
            VoiceSettingsRow(
                icon: "arrow.clockwise",
                iconColor: HudPalette.dim,
                title: "Refresh Status",
                subtitle: "Re-read runtime capability, microphone permission, devices, and preferences",
                onTap: refreshAll
            )

            HudDivider()

            VoiceSettingsRow(
                icon: "doc.text.magnifyingglass",
                iconColor: HudPalette.dim,
                title: "Preferences File",
                subtitle: preferencesURL.path
            )

            HudDivider()

            VoiceSettingsRow(
                icon: "point.3.connected.trianglepath.dotted",
                iconColor: HudPalette.dim,
                title: "Runtime Capability",
                subtitle: HudsonVoiceRuntime.runtimeURL().path
            )

            if let errorMessage {
                HudDivider()
                VoiceSettingsRow(
                    icon: "exclamationmark.triangle.fill",
                    iconColor: HudPalette.statusWarn,
                    title: "Last Error",
                    subtitle: errorMessage
                )
            }
        }
    }

    private var permissionControl: some View {
        HStack(spacing: HudSpacing.sm) {
            HudBadge(microphoneStatusLabel, tint: microphoneTint, dot: microphoneStatus == .authorized)

            switch microphoneStatus {
            case .notDetermined:
                HudButton(isRequestingMicrophone ? "Requesting" : "Allow", icon: "mic.badge.plus", style: .primary(.green)) {
                    requestMicrophoneAccess()
                }
                .disabled(isRequestingMicrophone)
            case .denied, .restricted:
                HStack(spacing: HudSpacing.xs) {
                    HudButton("Open Settings", icon: "arrow.up.forward.app", style: .secondary) {
                        _ = Self.openMicrophoneSettings()
                    }
                    HudButton("Recheck", icon: "checkmark.shield", style: .ghost) {
                        microphoneStatus = Self.currentMicrophoneStatus()
                    }
                }
            case .authorized:
                HudButton("Recheck", icon: "checkmark.shield", style: .ghost) {
                    microphoneStatus = Self.currentMicrophoneStatus()
                }
            @unknown default:
                HudButton("Recheck", icon: "checkmark.shield", style: .ghost) {
                    microphoneStatus = Self.currentMicrophoneStatus()
                }
            }
        }
    }

    @ViewBuilder
    private var microphonePermissionRow: some View {
        if managesMicrophonePermission {
            VoiceSettingsRow(
                icon: microphoneIcon,
                iconColor: microphoneTint,
                title: "Microphone",
                subtitle: microphoneDetail
            ) {
                permissionControl
            }
        } else {
            VoiceSettingsRow(
                icon: "waveform.badge.mic",
                iconColor: HudPalette.dim,
                title: "Microphone",
                subtitle: "Microphone access is handled outside this app. Open the app that captures audio to change it."
            ) {
                HudBadge("Review", tint: HudPalette.dim)
            }
        }
    }

    private var inputDeviceSelection: Binding<String> {
        Binding(
            get: { preferences.preferredInputDeviceId ?? "" },
            set: { saveInputDevice($0) }
        )
    }

    private var modeSelection: Binding<HudVoiceMode> {
        Binding(
            get: { preferences.mode },
            set: { mode in
                savePreferences { $0.mode = mode }
            }
        )
    }

    private var modelSelection: Binding<String> {
        Binding(
            get: { preferences.preferredTranscriptionModelId ?? HudsonVoicePreferences.defaultTranscriptionModelId },
            set: { modelId in
                savePreferences { $0.preferredTranscriptionModelId = clean(modelId) ?? HudsonVoicePreferences.defaultTranscriptionModelId }
            }
        )
    }

    private var languageSelection: Binding<String> {
        Binding(
            get: { preferences.preferredLanguage ?? "en" },
            set: { language in
                savePreferences { $0.preferredLanguage = clean(language) ?? "en" }
            }
        )
    }

    private var selectedInputDeviceLabel: String {
        guard let selected = preferences.preferredInputDeviceId else {
            if let defaultDevice = inputDevices.first(where: { $0.id == defaultInputDeviceId }) {
                return "\(defaultDevice.name) via system default"
            }
            return "System Default"
        }
        return inputDevices.first(where: { $0.id == selected }).map(deviceLabel) ?? "Missing device (\(shortDeviceId(selected)))"
    }

    private var runtimeDetail: String {
        switch runtimeStatus {
        case .unchecked:
            return "Voice engine status has not been checked yet."
        case .available(_, let endpoint, let pid):
            let pidText = pid.map { ", pid \($0)" } ?? ""
            return "Built into \(appName) and ready for local voice capture. \(endpoint)\(pidText)"
        case .unavailable(let message):
            return message
        }
    }

    private var missingSelectedInputDeviceId: String? {
        guard let selected = preferences.preferredInputDeviceId,
              !inputDevices.contains(where: { $0.id == selected })
        else {
            return nil
        }
        return selected
    }

    private var microphoneIcon: String {
        switch microphoneStatus {
        case .authorized:
            return "checkmark.circle.fill"
        case .denied, .restricted:
            return "exclamationmark.circle.fill"
        case .notDetermined:
            return "mic.badge.plus"
        @unknown default:
            return "questionmark.circle.fill"
        }
    }

    private var microphoneTint: Color {
        switch microphoneStatus {
        case .authorized:
            return HudPalette.statusOk
        case .denied, .restricted:
            return HudPalette.statusError
        case .notDetermined:
            return HudPalette.dim
        @unknown default:
            return HudPalette.statusWarn
        }
    }

    private var microphoneStatusLabel: String {
        switch microphoneStatus {
        case .authorized:
            return "granted"
        case .denied:
            return "off"
        case .restricted:
            return "restricted"
        case .notDetermined:
            return "not set"
        @unknown default:
            return "unknown"
        }
    }

    private var microphoneDetail: String {
        switch microphoneStatus {
        case .authorized:
            return "\(appName) can use the microphone for dictation and voice commands."
        case .denied:
            return "Microphone access is off for \(appName). Open System Settings and enable it under Privacy & Security."
        case .restricted:
            return "Microphone access is blocked by this Mac or an administrator."
        case .notDetermined:
            return "Voice capture needs a one-time macOS prompt. macOS will ask for access to \(appName)."
        @unknown default:
            return "Microphone status is unknown."
        }
    }

    private func refreshAll() {
        refreshPreferences()
        refreshRuntime()
        refreshDevices()
        if managesMicrophonePermission {
            microphoneStatus = Self.currentMicrophoneStatus()
        }
    }

    private func refreshPreferences() {
        do {
            preferences = try HudsonVoicePreferences.load(from: preferencesURL).normalized()
            errorMessage = nil
        } catch {
            preferences = HudsonVoicePreferences()
            errorMessage = error.localizedDescription
        }
    }

    private func refreshRuntime() {
        do {
            let capability = try HudsonVoiceRuntime.read()
            runtimeStatus = .available(
                service: capability.service,
                endpoint: capability.endpoint.url.absoluteString,
                pid: capability.pid
            )
        } catch {
            runtimeStatus = .unavailable(error.localizedDescription)
        }
    }

    private func refreshDevices() {
        let list = HudsonVoiceAudioDevices.listInputDevices(selectedDeviceId: preferences.preferredInputDeviceId)
        inputDevices = list.devices
        defaultInputDeviceId = list.defaultDeviceId
    }

    private func saveInputDevice(_ rawDeviceId: String) {
        do {
            let next = try HudsonVoiceAudioDevices.setPreferredInputDevice(clean(rawDeviceId), preferencesURL: preferencesURL)
            preferences = next.normalized()
            refreshDevices()
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
            refreshPreferences()
            refreshDevices()
        }
    }

    private func savePreferences(_ mutate: (inout HudsonVoicePreferences) -> Void) {
        do {
            var next = preferences
            mutate(&next)
            try next.save(to: preferencesURL)
            preferences = next.normalized()
            refreshDevices()
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
            refreshPreferences()
            refreshDevices()
        }
    }

    private func requestMicrophoneAccess() {
        guard managesMicrophonePermission else {
            return
        }
        isRequestingMicrophone = true
        Task {
            _ = await AVCaptureDevice.requestAccess(for: .audio)
            await MainActor.run {
                microphoneStatus = Self.currentMicrophoneStatus()
                isRequestingMicrophone = false
            }
        }
    }

    private func deviceLabel(_ device: HudsonVoiceAudioDevice) -> String {
        device.isDefault ? "\(device.name) (Default)" : device.name
    }

    private func modeLabel(_ mode: HudVoiceMode) -> String {
        switch mode {
        case .pushToTalk:
            return "Push to Talk"
        case .alwaysOn:
            return "Always On"
        }
    }

    private func modelLabel(_ modelId: String?) -> String {
        switch modelId ?? HudsonVoicePreferences.defaultTranscriptionModelId {
        case HudsonVoicePreferences.defaultTranscriptionModelId:
            return "Parakeet v3"
        case let custom:
            return custom
        }
    }

    private func languageLabel(_ language: String?) -> String {
        switch clean(language) ?? "en" {
        case "en":
            return "English"
        case let custom:
            return custom
        }
    }

    private func shortDeviceId(_ id: String) -> String {
        String(id.prefix(8))
    }

    private func clean(_ value: String?) -> String? {
        let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? nil : trimmed
    }

    private static func currentMicrophoneStatus() -> AVAuthorizationStatus {
        AVCaptureDevice.authorizationStatus(for: .audio)
    }

    @discardableResult
    private static func openMicrophoneSettings() -> Bool {
        #if os(macOS)
        guard let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone") else {
            return false
        }
        NSWorkspace.shared.open(url)
        return true
        #elseif os(iOS)
        guard let url = URL(string: UIApplication.openSettingsURLString) else {
            return false
        }
        UIApplication.shared.open(url)
        return true
        #else
        return false
        #endif
    }
}

private struct VoiceSettingsSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: () -> Content

    init(_ title: String, @ViewBuilder content: @escaping () -> Content) {
        self.title = title
        self.content = content
    }

    var body: some View {
        VStack(alignment: .leading, spacing: HudSpacing.sm) {
            Text(title)
                .font(HudFont.mono(HudTextSize.xxs, weight: .semibold))
                .foregroundStyle(HudPalette.dim)

            VStack(spacing: 0) {
                content()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: HudRadius.card).fill(HudPalette.surface))
            .overlay(RoundedRectangle(cornerRadius: HudRadius.card).stroke(HudHairline.standard, lineWidth: HudStrokeWidth.thin))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct VoiceSettingsRow<Trailing: View>: View {
    let icon: String
    let iconColor: Color
    let title: String
    let subtitle: String?
    let value: String?
    let onTap: (() -> Void)?
    @ViewBuilder let trailing: () -> Trailing

    init(
        icon: String,
        iconColor: Color = HudPalette.dim,
        title: String,
        subtitle: String? = nil,
        value: String? = nil,
        onTap: (() -> Void)? = nil,
        @ViewBuilder trailing: @escaping () -> Trailing
    ) {
        self.icon = icon
        self.iconColor = iconColor
        self.title = title
        self.subtitle = subtitle
        self.value = value
        self.onTap = onTap
        self.trailing = trailing
    }

    private var metaText: String? {
        let parts = [subtitle, value]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        return parts.isEmpty ? nil : parts.joined(separator: "  ·  ")
    }

    var body: some View {
        let content = HStack(alignment: .center, spacing: HudSpacing.xl) {
            Image(systemName: icon)
                .font(.system(size: HudTextSize.sm, weight: .medium))
                .foregroundStyle(iconColor)
                .frame(width: 18, height: 24, alignment: .center)

            VStack(alignment: .leading, spacing: HudSpacing.xxs) {
                Text(title)
                    .font(HudFont.mono(HudTextSize.sm, weight: .semibold))
                    .foregroundStyle(HudPalette.ink)

                if let metaText {
                    Text(metaText)
                        .font(HudFont.mono(HudTextSize.xxs))
                        .foregroundStyle(HudPalette.muted)
                        .lineLimit(2)
                }
            }

            Spacer(minLength: HudSpacing.lg)
            trailing()
        }
        .padding(.horizontal, HudSpacing.xl)
        .padding(.vertical, HudSpacing.lg)

        if let onTap {
            Button(action: onTap) { content }
                .buttonStyle(.plain)
                .contentShape(Rectangle())
        } else {
            content
        }
    }
}

extension VoiceSettingsRow where Trailing == EmptyView {
    init(
        icon: String,
        iconColor: Color = HudPalette.dim,
        title: String,
        subtitle: String? = nil,
        value: String? = nil,
        onTap: (() -> Void)? = nil
    ) {
        self.init(
            icon: icon,
            iconColor: iconColor,
            title: title,
            subtitle: subtitle,
            value: value,
            onTap: onTap,
            trailing: { EmptyView() }
        )
    }
}

private struct VoiceSettingsPickerRow<SelectionValue: Hashable, Options: View>: View {
    let title: String
    let subtitle: String?
    let value: String?
    let icon: String
    let iconColor: Color
    @Binding var selection: SelectionValue
    @ViewBuilder let options: () -> Options

    init(
        title: String,
        subtitle: String? = nil,
        value: String? = nil,
        icon: String,
        iconColor: Color = HudPalette.dim,
        selection: Binding<SelectionValue>,
        @ViewBuilder options: @escaping () -> Options
    ) {
        self.title = title
        self.subtitle = subtitle
        self.value = value
        self.icon = icon
        self.iconColor = iconColor
        self._selection = selection
        self.options = options
    }

    var body: some View {
        VoiceSettingsRow(
            icon: icon,
            iconColor: iconColor,
            title: title,
            subtitle: subtitle,
            value: value
        ) {
            Picker(title, selection: $selection) {
                options()
            }
            .labelsHidden()
            .pickerStyle(.menu)
            .frame(width: 148)
        }
    }
}

private enum VoiceRuntimeStatus: Equatable {
    case unchecked
    case available(service: String, endpoint: String, pid: Int32?)
    case unavailable(String)

    var label: String {
        switch self {
        case .unchecked:
            return "Unchecked"
        case .available:
            return "Online"
        case .unavailable:
            return "Offline"
        }
    }

    var icon: String {
        switch self {
        case .unchecked:
            return "waveform.badge.magnifyingglass"
        case .available:
            return "waveform.badge.checkmark"
        case .unavailable:
            return "waveform.badge.exclamationmark"
        }
    }

    var tint: Color {
        switch self {
        case .unchecked:
            return HudPalette.dim
        case .available:
            return HudPalette.statusOk
        case .unavailable:
            return HudPalette.statusWarn
        }
    }

    var detail: String {
        switch self {
        case .unchecked:
            return "Runtime status has not been checked yet."
        case .available(let service, let endpoint, let pid):
            if let pid {
                return "\(service) at \(endpoint), pid \(pid)"
            }
            return "\(service) at \(endpoint)"
        case .unavailable(let message):
            return message
        }
    }
}
