import Foundation
import SwiftUI
import HudsonUI
import HudsonUIPermissions

#if canImport(AVFoundation)
import AVFoundation
#endif

public enum HudAudioRecorderPhase: String, Sendable {
    case idle
    case requestingPermission
    case ready
    case recording
    case finished
    case failed
    case unavailable

    public var displayName: String {
        switch self {
        case .idle:                 return "Idle"
        case .requestingPermission: return "Requesting"
        case .ready:                return "Ready"
        case .recording:            return "Recording"
        case .finished:             return "Saved"
        case .failed:               return "Blocked"
        case .unavailable:          return "Unavailable"
        }
    }
}

public struct HudAudioRecording: Equatable, Identifiable, Sendable {
    public let id: UUID
    public var url: URL
    public var duration: TimeInterval
    public var createdAt: Date
    public var byteCount: Int64?

    public init(
        id: UUID = UUID(),
        url: URL,
        duration: TimeInterval,
        createdAt: Date = Date(),
        byteCount: Int64? = nil
    ) {
        self.id = id
        self.url = url
        self.duration = duration
        self.createdAt = createdAt
        self.byteCount = byteCount
    }
}

public struct HudAudioRecorderState: Equatable, Sendable {
    public var permissionStatus: HudPermissionStatus
    public var phase: HudAudioRecorderPhase
    public var duration: TimeInterval
    public var averagePower: Float
    public var peakPower: Float
    public var recording: HudAudioRecording?
    public var errorMessage: String?

    public init(
        permissionStatus: HudPermissionStatus = .notDetermined,
        phase: HudAudioRecorderPhase = .idle,
        duration: TimeInterval = 0,
        averagePower: Float = HudAudioRecorderFormatting.silencePower,
        peakPower: Float = HudAudioRecorderFormatting.silencePower,
        recording: HudAudioRecording? = nil,
        errorMessage: String? = nil
    ) {
        self.permissionStatus = permissionStatus
        self.phase = phase
        self.duration = duration
        self.averagePower = averagePower
        self.peakPower = peakPower
        self.recording = recording
        self.errorMessage = errorMessage
    }

    public var isRecording: Bool {
        phase == .recording
    }

    public var formattedDuration: String {
        HudAudioRecorderFormatting.duration(duration)
    }

    public var normalizedLevel: Double {
        HudAudioRecorderFormatting.normalizedLevel(fromAveragePower: averagePower)
    }
}

public struct HudAudioRecorderConfiguration: Equatable, Sendable {
    public var directory: URL?
    public var filePrefix: String
    public var sampleRate: Double
    public var channelCount: Int
    public var meteringInterval: TimeInterval

    public init(
        directory: URL? = nil,
        filePrefix: String = "hudson-recording",
        sampleRate: Double = 44_100,
        channelCount: Int = 1,
        meteringInterval: TimeInterval = 0.08
    ) {
        self.directory = directory
        self.filePrefix = filePrefix
        self.sampleRate = sampleRate
        self.channelCount = max(1, channelCount)
        self.meteringInterval = max(0.05, meteringInterval)
    }

    public func makeOutputURL(
        fileManager: FileManager = .default,
        now: Date = Date(),
        id: UUID = UUID()
    ) throws -> URL {
        let folder = directory
            ?? fileManager.temporaryDirectory.appendingPathComponent("HudsonRecordings", isDirectory: true)
        try fileManager.createDirectory(at: folder, withIntermediateDirectories: true)

        let filename = [
            sanitizedFilePrefix,
            String(Int(now.timeIntervalSince1970)),
            id.uuidString.lowercased(),
        ].joined(separator: "-")

        return folder.appendingPathComponent(filename).appendingPathExtension("m4a")
    }

    public var sanitizedFilePrefix: String {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_"))
        let value = filePrefix.unicodeScalars
            .map { allowed.contains($0) ? String($0) : "-" }
            .joined()
        return value.isEmpty ? "hudson-recording" : value
    }

    #if canImport(AVFoundation)
    fileprivate var avSettings: [String: Any] {
        [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: sampleRate,
            AVNumberOfChannelsKey: channelCount,
            AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
        ]
    }
    #endif
}

public enum HudAudioRecorderFormatting {
    public static let silencePower: Float = -80

    public static func duration(_ interval: TimeInterval) -> String {
        let seconds = max(0, Int(interval.rounded(.down)))
        let hours = seconds / 3_600
        let minutes = (seconds % 3_600) / 60
        let remainingSeconds = seconds % 60

        if hours > 0 {
            return "\(hours):\(twoDigits(minutes)):\(twoDigits(remainingSeconds))"
        }
        return "\(minutes):\(twoDigits(remainingSeconds))"
    }

    public static func normalizedLevel(fromAveragePower power: Float) -> Double {
        let clamped = min(0, max(silencePower, power))
        return Double((clamped - silencePower) / abs(silencePower))
    }

    private static func twoDigits(_ value: Int) -> String {
        value < 10 ? "0\(value)" : "\(value)"
    }
}

@MainActor
public final class HudAudioRecorderController: ObservableObject {
    @Published public private(set) var state: HudAudioRecorderState

    public var configuration: HudAudioRecorderConfiguration

    #if canImport(AVFoundation)
    private var recorder: AVAudioRecorder?
    #endif
    private var meterTimer: Timer?

    public init(configuration: HudAudioRecorderConfiguration = HudAudioRecorderConfiguration()) {
        self.configuration = configuration
        let permissionStatus = HudPermissions.status(of: .microphone)
        self.state = HudAudioRecorderState(
            permissionStatus: permissionStatus,
            phase: Self.initialPhase(for: permissionStatus)
        )
    }

    deinit {
        meterTimer?.invalidate()
        #if canImport(AVFoundation)
        recorder?.stop()
        #endif
    }

    public func requestPermission() async {
        guard state.permissionStatus == .notDetermined else { return }
        state.phase = .requestingPermission

        let status = await HudPermissions.request(.microphone)
        state.permissionStatus = status
        state.errorMessage = nil
        state.phase = Self.initialPhase(for: status)
    }

    public func start() async {
        #if canImport(AVFoundation)
        state.errorMessage = nil
        state.recording = nil

        if state.permissionStatus == .notDetermined {
            await requestPermission()
        }

        guard state.permissionStatus.isAuthorized else {
            state.phase = state.permissionStatus == .unavailable ? .unavailable : .failed
            state.errorMessage = permissionErrorMessage(for: state.permissionStatus)
            return
        }

        do {
            try prepareAudioSession()
            let outputURL = try configuration.makeOutputURL()
            let recorder = try AVAudioRecorder(url: outputURL, settings: configuration.avSettings)
            recorder.isMeteringEnabled = true

            guard recorder.record() else {
                throw HudAudioRecorderError.unableToStart
            }

            self.recorder = recorder
            state.duration = 0
            state.averagePower = HudAudioRecorderFormatting.silencePower
            state.peakPower = HudAudioRecorderFormatting.silencePower
            state.phase = .recording
            startMetering()
        } catch {
            fail(with: error)
        }
        #else
        state.permissionStatus = .unavailable
        state.phase = .unavailable
        state.errorMessage = "Audio recording is not available on this platform."
        #endif
    }

    public func stop() {
        #if canImport(AVFoundation)
        guard let recorder, state.isRecording else { return }

        updateMeters()
        let url = recorder.url
        let duration = max(recorder.currentTime, state.duration)
        recorder.stop()
        self.recorder = nil
        stopMetering()
        tearDownAudioSession()

        let attributes = try? FileManager.default.attributesOfItem(atPath: url.path)
        let byteCount = (attributes?[.size] as? NSNumber)?.int64Value

        state.recording = HudAudioRecording(
            url: url,
            duration: duration,
            byteCount: byteCount
        )
        state.duration = duration
        state.averagePower = HudAudioRecorderFormatting.silencePower
        state.peakPower = HudAudioRecorderFormatting.silencePower
        state.phase = .finished
        #endif
    }

    public func cancel() {
        #if canImport(AVFoundation)
        let url = recorder?.url
        recorder?.stop()
        recorder = nil
        stopMetering()
        tearDownAudioSession()

        if let url {
            try? FileManager.default.removeItem(at: url)
        }

        state.duration = 0
        state.averagePower = HudAudioRecorderFormatting.silencePower
        state.peakPower = HudAudioRecorderFormatting.silencePower
        state.recording = nil
        state.errorMessage = nil
        state.phase = state.permissionStatus.isAuthorized ? .ready : Self.initialPhase(for: state.permissionStatus)
        #endif
    }

    private static func initialPhase(for status: HudPermissionStatus) -> HudAudioRecorderPhase {
        switch status {
        case .granted, .limited: return .ready
        case .unavailable:       return .unavailable
        default:                 return .idle
        }
    }

    private func permissionErrorMessage(for status: HudPermissionStatus) -> String {
        switch status {
        case .denied, .restricted:
            return "Microphone access is blocked. Enable it in Settings to record audio."
        case .unavailable:
            return "Audio recording is not available on this platform."
        default:
            return "Microphone permission is required before recording."
        }
    }

    #if canImport(AVFoundation)
    private func prepareAudioSession() throws {
        #if os(iOS)
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .default, options: [.allowBluetoothHFP, .defaultToSpeaker])
        try session.setActive(true)
        #endif
    }

    private func tearDownAudioSession() {
        #if os(iOS)
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
        #endif
    }

    private func startMetering() {
        stopMetering()
        let timer = Timer(timeInterval: configuration.meteringInterval, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.updateMeters()
            }
        }
        meterTimer = timer
        RunLoop.main.add(timer, forMode: .common)
    }

    private func stopMetering() {
        meterTimer?.invalidate()
        meterTimer = nil
    }

    private func updateMeters() {
        guard let recorder else { return }
        recorder.updateMeters()
        state.duration = recorder.currentTime
        state.averagePower = recorder.averagePower(forChannel: 0)
        state.peakPower = recorder.peakPower(forChannel: 0)
    }

    private func fail(with error: Error) {
        recorder?.stop()
        recorder = nil
        stopMetering()
        tearDownAudioSession()

        state.phase = .failed
        state.errorMessage = error.localizedDescription
        state.averagePower = HudAudioRecorderFormatting.silencePower
        state.peakPower = HudAudioRecorderFormatting.silencePower
    }
    #endif
}

private enum HudAudioRecorderError: LocalizedError {
    case unableToStart

    var errorDescription: String? {
        switch self {
        case .unableToStart:
            return "The audio recorder could not start."
        }
    }
}

public struct HudAudioRecorderView: View {
    @ObservedObject private var controller: HudAudioRecorderController

    private let barFactors: [CGFloat] = [
        0.28, 0.44, 0.62, 0.38, 0.78, 0.52, 0.34, 0.68,
        0.46, 0.90, 0.58, 0.42, 0.72, 0.50, 0.32, 0.64,
        0.40, 0.84, 0.56, 0.36, 0.70, 0.48, 0.30, 0.60,
    ]

    public init(controller: HudAudioRecorderController) {
        self.controller = controller
    }

    public var body: some View {
        HudCard {
            VStack(alignment: .leading, spacing: HudSpacing.xl) {
                header
                meterSurface
                errorText
                controls
                savedRecording
            }
        }
        .accessibilityElement(children: .contain)
    }

    private var header: some View {
        HStack(spacing: HudSpacing.md) {
            Image(systemName: "waveform.circle.fill")
                .font(HudFont.ui(HudTextSize.xl, weight: .semibold))
                .foregroundStyle(HudPalette.accent)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: HudSpacing.xs) {
                Text("Audio recorder")
                    .font(HudFont.ui(HudTextSize.base, weight: .semibold))
                    .foregroundStyle(HudPalette.ink)
                Text("M4A capture with permission + metering")
                    .font(HudFont.ui(HudTextSize.xs))
                    .foregroundStyle(HudPalette.dim)
            }

            Spacer(minLength: HudSpacing.md)
            HudBadge(controller.state.phase.displayName, tint: phaseTint, dot: controller.state.isRecording)
        }
    }

    private var meterSurface: some View {
        HudInset {
            VStack(alignment: .leading, spacing: HudSpacing.lg) {
                HStack(alignment: .lastTextBaseline, spacing: HudSpacing.md) {
                    Text(controller.state.formattedDuration)
                        .font(HudFont.mono(HudTextSize.xxl, weight: .semibold))
                        .foregroundStyle(HudPalette.ink)
                    Spacer(minLength: HudSpacing.md)
                    Text(permissionLabel)
                        .font(HudFont.mono(HudTextSize.xxs, weight: .medium))
                        .foregroundStyle(HudPalette.dim)
                }

                HStack(alignment: .center, spacing: HudSpacing.xs) {
                    ForEach(barFactors.indices, id: \.self) { index in
                        RoundedRectangle(cornerRadius: HudRadius.tight)
                            .fill(barFill(for: index))
                            .frame(width: HudSpacing.sm, height: barHeight(for: index))
                            .accessibilityHidden(true)
                    }
                }
                .frame(maxWidth: .infinity, minHeight: HudSpacing.huge + HudSpacing.xl, alignment: .center)
            }
        }
    }

    @ViewBuilder
    private var errorText: some View {
        if let errorMessage = controller.state.errorMessage {
            Text(errorMessage)
                .font(HudFont.ui(HudTextSize.xs, weight: .medium))
                .foregroundStyle(HudPalette.statusError)
        }
    }

    private var controls: some View {
        HStack(spacing: HudSpacing.md) {
            if controller.state.isRecording {
                HudButton("Stop", icon: "stop.fill", style: .primary(.green)) {
                    controller.stop()
                }
                HudButton("Cancel", icon: "xmark", style: .ghost) {
                    controller.cancel()
                }
            } else {
                HudButton(recordButtonTitle, icon: "record.circle", style: .primary(.red)) {
                    Task { await controller.start() }
                }
                .disabled(!canStart)

                if controller.state.permissionStatus.isTerminal {
                    HudButton("Settings", icon: "gearshape", style: .secondary) {
                        _ = HudPermissions.openSettings()
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var savedRecording: some View {
        if let recording = controller.state.recording {
            HudInset {
                VStack(spacing: HudSpacing.md) {
                    HudKVRow("last file", value: recording.url.lastPathComponent)
                    HudKVRow("duration", value: HudAudioRecorderFormatting.duration(recording.duration))
                    if let byteCount = recording.byteCount {
                        HudKVRow("bytes", value: "\(byteCount)")
                    }
                }
            }
        }
    }

    private var phaseTint: Color {
        switch controller.state.phase {
        case .recording:            return HudPalette.statusError
        case .finished, .ready:     return HudPalette.statusOk
        case .failed, .unavailable: return HudPalette.statusWarn
        case .requestingPermission: return HudPalette.statusInfo
        case .idle:                 return HudPalette.muted
        }
    }

    private var permissionLabel: String {
        switch controller.state.permissionStatus {
        case .granted:       return "MIC GRANTED"
        case .limited:       return "MIC LIMITED"
        case .notDetermined: return "MIC PENDING"
        case .denied:        return "MIC DENIED"
        case .restricted:    return "MIC RESTRICTED"
        case .unavailable:   return "MIC UNAVAILABLE"
        }
    }

    private var recordButtonTitle: String {
        controller.state.permissionStatus == .notDetermined ? "Allow + Record" : "Record"
    }

    private var canStart: Bool {
        let phase = controller.state.phase
        return phase != .requestingPermission
            && phase != .unavailable
            && !controller.state.permissionStatus.isTerminal
    }

    private func barHeight(for index: Int) -> CGFloat {
        let signal = CGFloat(max(0.08, controller.state.normalizedLevel))
        let height = HudSpacing.lg + (HudSpacing.huge * signal * barFactors[index])
        return min(HudSpacing.huge + HudSpacing.xxl, height)
    }

    private func barFill(for index: Int) -> Color {
        guard controller.state.isRecording else { return HudSurface.control }
        let activeCount = Int((controller.state.normalizedLevel * Double(barFactors.count)).rounded(.up))
        return index < max(1, activeCount) ? HudPalette.accent : HudSurface.control
    }
}
