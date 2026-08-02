import Foundation
import Testing
@testable import HudsonBridge

@Suite("HudConnection")
struct HudConnectionTests {
    @Test("classifier recognizes Tailscale CGNAT and rejects invalid octets")
    func strictEndpointClassification() throws {
        let tailscale = HudPairingEndpoint(url: try testURL("http://100.100.10.20:8765"))
        let invalid = HudPairingEndpoint(url: try testURL("http://10.0.0.999:8765"))
        let ambiguous = HudPairingEndpoint(url: try testURL("http://010.0.0.1:8765"))
        let spoofedTailscale = HudPairingEndpoint(
            url: try testURL("http://100.100.10.20.evil.com:8765")
        )
        let spoofedLAN = HudPairingEndpoint(url: try testURL("http://192.168.1.5.evil.com:8765"))

        #expect(tailscale.kind == .tailscale)
        #expect(invalid.kind == .remote)
        #expect(ambiguous.kind == .remote)
        #expect(spoofedTailscale.kind == .remote)
        #expect(spoofedLAN.kind == .remote)
    }

    @Test("route consent and remembered success survive provider changes")
    func providerIndependentRouteIdentity() throws {
        let bonjour = route("http://blink.local:8765", kind: .localNetwork, provider: "bonjour")
        let stored = route("http://blink.local:8765", kind: .localNetwork, provider: "paired-host")
        #expect(bonjour.id == stored.id)

        var settings = HudConnectionSettings(routeEnabled: [bonjour.id: false])
        #expect(!settings.allows(stored, default: true))

        settings = HudConnectionSettings(
            routeKindEnabled: [HudConnectionRouteKind.localNetwork.rawValue: false],
            providerEnabled: [stored.providerID: true]
        )
        #expect(!settings.allows(stored, default: true))

        settings = HudConnectionSettings()
        settings.recordSuccess(bonjour, hostID: "mac")
        let ordered = HudConnectionPlanner.orderedRoutes(
            [
                route("https://blink.example.ts.net", kind: .tailscale, provider: "tailscale"),
                stored,
            ],
            hostID: "mac",
            policy: .tailscaleFirst,
            settings: settings
        )
        #expect(ordered.first?.id == stored.id)
    }

    @Test("planner applies consent, app ordering, deduplication, and success promotion")
    func planning() throws {
        let lan = route("http://blink.local:8765", kind: .localNetwork, provider: "bonjour")
        let duplicateLAN = route("http://blink.local:8765", kind: .localNetwork, provider: "stored")
        let tailscale = route("https://blink.example.ts.net", kind: .tailscale, provider: "tailscale")
        let osnKind = HudConnectionRouteKind(rawValue: "openscout-network")
        let osn = route("https://mesh.oscout.net", kind: osnKind, provider: "osn")

        var settings = HudConnectionSettings(
            routeKindEnabled: [osnKind.rawValue: false],
            preferredRouteKinds: [.localNetwork, .localNetwork, .tailscale]
        )
        var ordered = HudConnectionPlanner.orderedRoutes(
            [tailscale, osn, lan, duplicateLAN],
            hostID: "mac",
            policy: .lanFirst,
            settings: settings
        )
        #expect(ordered.map(\.id) == [lan.id, tailscale.id])

        settings.recordSuccess(tailscale, hostID: "mac")
        ordered = HudConnectionPlanner.orderedRoutes(
            [tailscale, osn, lan],
            hostID: "mac",
            policy: .lanFirst,
            settings: settings
        )
        #expect(ordered.map(\.id) == [tailscale.id, lan.id])
    }

    @Test("cascade falls through and persists its winning route")
    func cascade() async throws {
        let lan = route("http://blink.local:8765", kind: .localNetwork, provider: "bonjour")
        let tailscale = route("https://blink.example.ts.net", kind: .tailscale, provider: "tailscale")
        let store = HudInMemoryConnectionSettingsStore()
        let cascade = HudConnectionCascade(
            policy: HudConnectionPolicy(
                preferredRouteKinds: [.localNetwork, .tailscale],
                attemptTimeout: nil
            ),
            settingsStore: store
        )
        let host = HudPairedHost(hostID: "mac", name: "Studio Mac")

        let result = try await cascade.connect(to: host, routes: [tailscale, lan]) { route in
            if route.kind == .localNetwork {
                throw TestConnectionError.unreachable
            }
            return route.endpoint.url
        }

        #expect(result.route.id == tailscale.id)
        #expect(result.attempts.map(\.outcome) == [.failed, .succeeded])
        #expect(result.settingsPersistenceFailure == nil)
        let saved = try await store.load()
        #expect(saved.lastSuccessfulRouteByHostID["mac"] == tailscale.id)
    }

    @Test("non-finite and oversized timeouts cannot trap")
    func safeTimeoutConversion() async throws {
        let lan = route("http://blink.local:8765", kind: .localNetwork, provider: "bonjour")
        for timeout in [TimeInterval.infinity, TimeInterval.greatestFiniteMagnitude] {
            let cascade = HudConnectionCascade(
                policy: HudConnectionPolicy(
                    preferredRouteKinds: [.localNetwork],
                    attemptTimeout: timeout
                ),
                settingsStore: HudInMemoryConnectionSettingsStore()
            )

            let result = try await cascade.connect(
                to: HudPairedHost(hostID: "mac", name: "Studio Mac"),
                routes: [lan]
            ) { route in
                route.endpoint.url
            }

            #expect(result.route.id == lan.id)
        }
    }

    @Test("success persistence does not overwrite a concurrent consent change")
    func atomicSuccessPersistence() async throws {
        let lan = route("http://blink.local:8765", kind: .localNetwork, provider: "bonjour")
        let relay = route("https://relay.example.com", kind: .remote, provider: "relay")
        let store = HudInMemoryConnectionSettingsStore()
        let gate = AttemptGate()
        let cascade = HudConnectionCascade(
            policy: HudConnectionPolicy(
                preferredRouteKinds: [.localNetwork],
                attemptTimeout: nil
            ),
            settingsStore: store
        )

        let connectionTask = Task {
            try await cascade.connect(
                to: HudPairedHost(hostID: "mac", name: "Studio Mac"),
                routes: [lan]
            ) { route in
                await gate.markStartedAndWait()
                return route.endpoint.url
            }
        }

        await gate.waitUntilStarted()
        _ = try await store.update { settings in
            settings.routeEnabled[relay.id] = false
        }
        await gate.release()
        _ = try await connectionTask.value

        let saved = try await store.load()
        #expect(saved.routeEnabled[relay.id] == false)
        #expect(saved.lastSuccessfulRouteByHostID["mac"] == lan.id)
    }

    @Test("UserDefaults settings store round-trips custom provider policy")
    func settingsPersistence() async throws {
        let suiteName = "HudConnectionTests.\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suiteName))
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let store = HudUserDefaultsConnectionSettingsStore(
            namespace: "test",
            userDefaults: defaults
        )
        let settings = HudConnectionSettings(
            routeKindEnabled: ["openscout-network": true],
            providerEnabled: ["osn": true],
            preferredRouteKinds: [
                .localNetwork,
                .tailscale,
                HudConnectionRouteKind(rawValue: "openscout-network"),
            ]
        )

        try await store.save(settings)
        #expect(try await store.load() == settings)
    }

    @Test("route catalog preserves good providers when another provider fails")
    func providerInventory() async throws {
        let host = HudPairedHost(
            hostID: "mac",
            name: "Studio Mac",
            endpoints: [HudPairingEndpoint(url: try testURL("http://blink.local:8765"))]
        )
        let catalog = HudConnectionRouteCatalog(
            providers: [HudPairedHostRouteProvider(), FailingRouteProvider()]
        )

        let inventory = await catalog.inventory(for: host)

        #expect(inventory.routes.count == 1)
        #expect(inventory.providerFailures == [
            HudConnectionProviderFailure(providerID: "offline-provider", message: "Provider offline")
        ])
    }

    private func route(
        _ url: String,
        kind: HudConnectionRouteKind,
        provider: String
    ) -> HudConnectionRoute {
        HudConnectionRoute(
            endpoint: HudPairingEndpoint(url: URL(string: url)!),
            kind: kind,
            providerID: provider
        )
    }

    private func testURL(_ value: String) throws -> URL {
        try #require(URL(string: value))
    }
}

private actor AttemptGate {
    private var started = false
    private var released = false

    func markStartedAndWait() async {
        started = true
        while !released {
            await Task.yield()
        }
    }

    func waitUntilStarted() async {
        while !started {
            await Task.yield()
        }
    }

    func release() {
        released = true
    }
}

private struct FailingRouteProvider: HudConnectionRouteProvider {
    let id = "offline-provider"

    func routes(for host: HudPairedHost) async throws -> [HudConnectionRoute] {
        throw TestConnectionError.providerOffline
    }
}

private enum TestConnectionError: Error, LocalizedError {
    case unreachable
    case providerOffline

    var errorDescription: String? {
        switch self {
        case .unreachable: "Route unreachable"
        case .providerOffline: "Provider offline"
        }
    }
}
