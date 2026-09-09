import Foundation

#if os(iOS)
import AVFoundation
import Photos
import Speech
import UserNotifications
import UIKit
#elseif os(macOS)
import AVFoundation
import AppKit
import Photos
import Speech
import UserNotifications
#endif

/// Single entry point for permission queries and requests. Replaces the
/// scattered per-framework auth APIs (`AVCaptureDevice.requestAccess`,
/// `PHPhotoLibrary.requestAuthorization`, `UNUserNotificationCenter.
/// requestAuthorization`, etc.) with one async-first surface.
///
/// ```swift
/// let status = await HudPermissions.request(.microphone)
/// if status.isAuthorized { … }
/// ```
public enum HudPermissions {

    /// Current status without prompting.
    public static func status(of permission: HudPermission) -> HudPermissionStatus {
        #if os(iOS)
        return iOSStatus(of: permission)
        #elseif os(macOS)
        return macStatus(of: permission)
        #else
        return .unavailable
        #endif
    }

    /// Surface the OS prompt for a permission and return the resulting status.
    /// If the user has already made a terminal choice, this is a no-op that
    /// returns the existing status (`.denied` / `.restricted` / etc).
    @discardableResult
    public static func request(_ permission: HudPermission) async -> HudPermissionStatus {
        #if os(iOS)
        return await iOSRequest(permission)
        #elseif os(macOS)
        return await macRequest(permission)
        #else
        return .unavailable
        #endif
    }

    /// Open the system Settings app to the host app's permission page. The
    /// only escape from `.denied` / `.restricted`. Returns true when the URL
    /// could be opened.
    @discardableResult
    public static func openSettings() -> Bool {
        #if os(iOS)
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return false }
        UIApplication.shared.open(url)
        return true
        #elseif os(macOS)
        // macOS has no per-app privacy page; Privacy & Security is as close as
        // the system gets, and every one of these permissions is listed there.
        guard let url = URL(
            string: "x-apple.systempreferences:com.apple.preference.security?Privacy"
        ) else { return false }
        return NSWorkspace.shared.open(url)
        #else
        return false
        #endif
    }
}

#if os(macOS)
/// The Mac answers the same questions, with the Mac's APIs.
///
/// Everything here previously returned `.unavailable`, which reads as "this
/// machine has no microphone" and is not what was meant — it meant the layer had
/// only ever been written for iOS. A Mac app asking to record was told the
/// hardware was missing and stopped, so dictation could not start at all.
///
/// The recording permission is `AVCaptureDevice`'s audio device rather than
/// iOS's `AVAudioApplication`, which does not exist here. Requesting requires the
/// usage-description keys in the host app's Info.plist and, under Hardened
/// Runtime, the `com.apple.security.device.audio-input` entitlement.
private extension HudPermissions {

    static func macStatus(of permission: HudPermission) -> HudPermissionStatus {
        switch permission {
        case .microphone:
            return mapCaptureAuth(AVCaptureDevice.authorizationStatus(for: .audio))
        case .speech:
            return mapSpeechStatus(SFSpeechRecognizer.authorizationStatus())
        case .camera:
            return mapCaptureAuth(AVCaptureDevice.authorizationStatus(for: .video))
        case .photos:
            return mapPhotoStatus(PHPhotoLibrary.authorizationStatus(for: .readWrite))
        case .notifications:
            return macNotificationStatusSync()
        }
    }

    static func macRequest(_ permission: HudPermission) async -> HudPermissionStatus {
        switch permission {
        case .microphone:
            let granted = await AVCaptureDevice.requestAccess(for: .audio)
            return granted ? .granted : .denied
        case .speech:
            return await macSpeechRequest()
        case .camera:
            let granted = await AVCaptureDevice.requestAccess(for: .video)
            return granted ? .granted : .denied
        case .photos:
            return mapPhotoStatus(await PHPhotoLibrary.requestAuthorization(for: .readWrite))
        case .notifications:
            do {
                let granted = try await UNUserNotificationCenter.current()
                    .requestAuthorization(options: [.alert, .badge, .sound])
                return granted ? .granted : .denied
            } catch {
                return .denied
            }
        }
    }

    static func macSpeechRequest() async -> HudPermissionStatus {
        await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { status in
                continuation.resume(returning: mapSpeechStatus(status))
            }
        }
    }

    /// Notification settings are async-only; pumped synchronously, as on iOS,
    /// because status is read during view updates rather than on a hot path.
    static func macNotificationStatusSync() -> HudPermissionStatus {
        let semaphore = DispatchSemaphore(value: 0)
        var result: HudPermissionStatus = .notDetermined
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            switch settings.authorizationStatus {
            case .notDetermined: result = .notDetermined
            case .authorized:    result = .granted
            case .provisional:   result = .limited
            case .ephemeral:     result = .limited
            case .denied:        result = .denied
            @unknown default:    result = .notDetermined
            }
            semaphore.signal()
        }
        semaphore.wait()
        return result
    }

    static func mapCaptureAuth(_ status: AVAuthorizationStatus) -> HudPermissionStatus {
        switch status {
        case .notDetermined: return .notDetermined
        case .authorized:    return .granted
        case .denied:        return .denied
        case .restricted:    return .restricted
        @unknown default:    return .notDetermined
        }
    }

    static func mapPhotoStatus(_ status: PHAuthorizationStatus) -> HudPermissionStatus {
        switch status {
        case .notDetermined: return .notDetermined
        case .authorized:    return .granted
        case .limited:       return .limited
        case .denied:        return .denied
        case .restricted:    return .restricted
        @unknown default:    return .notDetermined
        }
    }

    static func mapSpeechStatus(_ status: SFSpeechRecognizerAuthorizationStatus) -> HudPermissionStatus {
        switch status {
        case .notDetermined: return .notDetermined
        case .authorized:    return .granted
        case .denied:        return .denied
        case .restricted:    return .restricted
        @unknown default:    return .notDetermined
        }
    }
}
#endif

#if os(iOS)
private extension HudPermissions {

    static func iOSStatus(of permission: HudPermission) -> HudPermissionStatus {
        switch permission {
        case .microphone:
            return mapAVAudio(AVAudioApplication.shared.recordPermission)
        case .speech:
            return mapSpeechAuth(SFSpeechRecognizer.authorizationStatus())
        case .camera:
            return mapAVAuth(AVCaptureDevice.authorizationStatus(for: .video))
        case .photos:
            return mapPhotoAuth(PHPhotoLibrary.authorizationStatus(for: .readWrite))
        case .notifications:
            // UNUserNotificationCenter status is async-only — pump synchronously
            // off the main actor via a semaphore. This is rare (status checks
            // typically happen during view updates, off the hot path).
            return iOSNotificationStatusSync()
        }
    }

    static func iOSRequest(_ permission: HudPermission) async -> HudPermissionStatus {
        switch permission {
        case .microphone:
            let granted = await AVAudioApplication.requestRecordPermission()
            return granted ? .granted : .denied
        case .speech:
            return await iOSSpeechRequest()
        case .camera:
            let granted = await AVCaptureDevice.requestAccess(for: .video)
            return granted ? .granted : .denied
        case .photos:
            let status = await PHPhotoLibrary.requestAuthorization(for: .readWrite)
            return mapPhotoAuth(status)
        case .notifications:
            do {
                let granted = try await UNUserNotificationCenter.current()
                    .requestAuthorization(options: [.alert, .badge, .sound])
                return granted ? .granted : .denied
            } catch {
                return .denied
            }
        }
    }

    static func iOSSpeechRequest() async -> HudPermissionStatus {
        await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { status in
                continuation.resume(returning: mapSpeechAuth(status))
            }
        }
    }

    static func iOSNotificationStatusSync() -> HudPermissionStatus {
        let semaphore = DispatchSemaphore(value: 0)
        var result: HudPermissionStatus = .notDetermined
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            result = mapNotificationAuth(settings.authorizationStatus)
            semaphore.signal()
        }
        semaphore.wait()
        return result
    }

    static func mapAVAudio(_ status: AVAudioApplication.recordPermission) -> HudPermissionStatus {
        switch status {
        case .undetermined: return .notDetermined
        case .granted:      return .granted
        case .denied:       return .denied
        @unknown default:   return .notDetermined
        }
    }

    static func mapAVAuth(_ status: AVAuthorizationStatus) -> HudPermissionStatus {
        switch status {
        case .notDetermined: return .notDetermined
        case .authorized:    return .granted
        case .denied:        return .denied
        case .restricted:    return .restricted
        @unknown default:    return .notDetermined
        }
    }

    static func mapPhotoAuth(_ status: PHAuthorizationStatus) -> HudPermissionStatus {
        switch status {
        case .notDetermined: return .notDetermined
        case .authorized:    return .granted
        case .limited:       return .limited
        case .denied:        return .denied
        case .restricted:    return .restricted
        @unknown default:    return .notDetermined
        }
    }

    static func mapSpeechAuth(_ status: SFSpeechRecognizerAuthorizationStatus) -> HudPermissionStatus {
        switch status {
        case .notDetermined: return .notDetermined
        case .authorized:    return .granted
        case .denied:        return .denied
        case .restricted:    return .restricted
        @unknown default:    return .notDetermined
        }
    }

    static func mapNotificationAuth(_ status: UNAuthorizationStatus) -> HudPermissionStatus {
        switch status {
        case .notDetermined: return .notDetermined
        case .authorized:    return .granted
        case .provisional:   return .limited
        case .ephemeral:     return .limited
        case .denied:        return .denied
        @unknown default:    return .notDetermined
        }
    }
}
#endif
