import SwiftUI
import HudsonUI
import HudsonObservability

struct LogsTab: View {
    @ObservedObject private var store = HudLogStore.shared
    @State private var seededDemoEntries = false

    var body: some View {
        HudLoggerView(
            store: store,
            title: "Diagnostics",
            showDemoControls: true,
            emptySubtitle: "Tap a level button above to emit a test log."
        )
        .onAppear(perform: seedDemoEntriesIfNeeded)
    }

    private func seedDemoEntriesIfNeeded() {
        guard !seededDemoEntries else { return }
        seededDemoEntries = true
        guard store.entries.count <= 1 else { return }

        let now = Date()
        let seed: [(TimeInterval, HudLogLevel, String, String, [String: String])] = [
            (-280, .info, "shell", "HudsonKitDemoIOS booted", ["state": "ready"]),
            (-224, .notice, "bridge", "Deep link router registered hudson and hudsonkit schemes", ["routes": "10"]),
            (-181, .info, "pairing", "Pairing parser warmed QR and URL payload formats", ["status": "ready"]),
            (-140, .warning, "network", "Local network endpoint deferred until permission prompt completes", ["fallback": "tailscale"]),
            (-102, .notice, "terminal", "Termini capability advertised to paired hosts", ["sessions": "2"]),
            (-64, .debug, "web", "CodeMirror surface released inactive WebKit view", ["reason": "close"]),
            (-28, .info, "voice", "Dictation route selected device transcription", ["engine": "apple"])
        ]

        for item in seed {
            store.append(
                HudLogEntry(
                    timestamp: now.addingTimeInterval(item.0),
                    level: item.1,
                    subsystem: HudLogger.defaultSubsystem,
                    category: item.2,
                    message: item.3,
                    metadata: item.4
                )
            )
        }
    }
}