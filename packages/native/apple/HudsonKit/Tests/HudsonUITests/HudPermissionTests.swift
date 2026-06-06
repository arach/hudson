import Foundation
import Testing
@testable import HudsonUIPermissions

@Suite("HudPermissionStatus")
struct HudPermissionStatusTests {

    @Test("isAuthorized covers granted and limited only")
    func isAuthorized() {
        #expect(HudPermissionStatus.granted.isAuthorized)
        #expect(HudPermissionStatus.limited.isAuthorized)
        #expect(!HudPermissionStatus.notDetermined.isAuthorized)
        #expect(!HudPermissionStatus.denied.isAuthorized)
        #expect(!HudPermissionStatus.restricted.isAuthorized)
        #expect(!HudPermissionStatus.unavailable.isAuthorized)
    }

    @Test("isTerminal covers denied and restricted only")
    func isTerminal() {
        #expect(HudPermissionStatus.denied.isTerminal)
        #expect(HudPermissionStatus.restricted.isTerminal)
        #expect(!HudPermissionStatus.notDetermined.isTerminal)
        #expect(!HudPermissionStatus.granted.isTerminal)
        #expect(!HudPermissionStatus.limited.isTerminal)
        #expect(!HudPermissionStatus.unavailable.isTerminal)
    }
}

@Suite("HudPermission Info.plist keys")
struct HudPermissionInfoPlistTests {

    @Test("each permission maps to its NSUsageDescription key (notifications excluded)")
    func infoPlistKeyMapping() {
        #expect(HudPermission.microphone.infoPlistKey == "NSMicrophoneUsageDescription")
        #expect(HudPermission.speech.infoPlistKey == "NSSpeechRecognitionUsageDescription")
        #expect(HudPermission.camera.infoPlistKey == "NSCameraUsageDescription")
        #expect(HudPermission.photos.infoPlistKey == "NSPhotoLibraryUsageDescription")
        #expect(HudPermission.notifications.infoPlistKey == "")
    }

    @Test("every permission has a non-empty display name and SF Symbol")
    func displayMetadata() {
        for permission in HudPermission.allCases {
            #expect(!permission.displayName.isEmpty, "missing displayName for \(permission)")
            #expect(!permission.symbolName.isEmpty, "missing symbolName for \(permission)")
        }
    }
}

@Suite("HudPermissionReadiness")
struct HudPermissionReadinessTests {

    @Test("isReady requires every tracked permission to be authorized")
    func isReady() {
        let readiness = HudPermissionReadiness(
            permissions: [.microphone, .speech],
            statuses: [.microphone: .granted, .speech: .granted]
        )
        #expect(readiness.isReady)
    }

    @Test("limited counts as ready")
    func limitedCountsAsReady() {
        let readiness = HudPermissionReadiness(
            permissions: [.photos],
            statuses: [.photos: .limited]
        )
        #expect(readiness.isReady)
    }

    @Test("blockers reports denied and restricted permissions")
    func blockers() {
        let readiness = HudPermissionReadiness(
            permissions: [.microphone, .speech, .camera],
            statuses: [
                .microphone: .granted,
                .speech: .denied,
                .camera: .restricted,
            ]
        )
        #expect(!readiness.isReady)
        #expect(readiness.blockers == [.speech, .camera])
        #expect(readiness.firstBlocker == .speech)
        #expect(readiness.hasBlockers)
    }

    @Test("pending reports notDetermined permissions only")
    func pending() {
        let readiness = HudPermissionReadiness(
            permissions: [.microphone, .speech, .camera],
            statuses: [
                .microphone: .notDetermined,
                .speech: .granted,
                .camera: .denied,
            ]
        )
        #expect(readiness.pending == [.microphone])
        #expect(readiness.hasPending)
    }

    @Test("missing keys default to notDetermined")
    func missingKeysDefault() {
        let readiness = HudPermissionReadiness(
            permissions: [.microphone, .speech],
            statuses: [.microphone: .granted]
        )
        #expect(readiness.statuses[.speech] == .notDetermined)
        #expect(readiness.pending == [.speech])
    }

    @Test("statuses for permissions outside the tracked set are dropped")
    func ignoresUntrackedKeys() {
        let readiness = HudPermissionReadiness(
            permissions: [.microphone],
            statuses: [.microphone: .granted, .camera: .denied]
        )
        #expect(readiness.statuses.keys.contains(.microphone))
        #expect(!readiness.statuses.keys.contains(.camera))
    }

    @Test("permissions order is preserved")
    func permissionsOrder() {
        let readiness = HudPermissionReadiness([.speech, .microphone, .camera])
        #expect(readiness.permissions == [.speech, .microphone, .camera])
    }
}
