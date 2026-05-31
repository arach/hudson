import Foundation
import SwiftUI

#if canImport(AppKit)
import AppKit
#endif

@MainActor
public final class HudVantageHostAppModel: ObservableObject {
    public let configuration: HudVantageConfiguration
    public let identity: HudVantageHostIdentity

    @Published public var showsAbout = false
    @Published public private(set) var status: HudVantageHostStatus?

    private var statusObserver: NSObjectProtocol?

    public init(
        configuration: HudVantageConfiguration,
        identity: HudVantageHostIdentity = .vantage
    ) {
        self.configuration = configuration
        self.identity = identity
        statusObserver = NotificationCenter.default.addObserver(
            forName: .vantageHostStatus,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            Task { @MainActor in
                guard let self,
                      let status = HudVantageHostStatus(userInfo: notification.userInfo) else { return }
                self.status = status
            }
        }
    }

    deinit {
        if let statusObserver {
            NotificationCenter.default.removeObserver(statusObserver)
        }
    }

    public var appName: String { identity.appName }

    public var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.1.0"
    }

    public var bundleIdentifier: String {
        Bundle.main.bundleIdentifier ?? "com.hudsonkit.vantage"
    }

    public var controlFilePath: String { configuration.commandURL.path }
    public var responseFilePath: String { configuration.responseURL.path }
    public var stateFilePath: String { configuration.stateURL.path }

    public func send(_ command: VantageHostCommand) {
        VantageHostCommandCenter.post(command)
    }

    public func revealControlFile() {
        #if canImport(AppKit)
        NSWorkspace.shared.activateFileViewerSelecting([configuration.commandURL])
        #endif
    }

    public func revealStateFile() {
        #if canImport(AppKit)
        NSWorkspace.shared.activateFileViewerSelecting([configuration.stateURL])
        #endif
    }

    public func copyControlPaths() {
        #if canImport(AppKit)
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(
            """
            control: \(controlFilePath)
            response: \(responseFilePath)
            state: \(stateFilePath)
            """,
            forType: .string
        )
        #endif
    }
}

#if os(macOS)
public enum HudVantageHostApplication {
    public static func activateOnLaunch() {
        NSApplication.shared.setActivationPolicy(.regular)
        NSApplication.shared.activate(ignoringOtherApps: true)
    }
}
#endif
