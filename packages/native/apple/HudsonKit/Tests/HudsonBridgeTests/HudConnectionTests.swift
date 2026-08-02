import Foundation
import Testing
@testable import HudsonBridge

@Suite("HudConnection")
struct HudConnectionTests {
    @Test("classifier recognizes Tailscale CGNAT and rejects invalid octets")
    func strictEndpointClassification() throws {
        let tailscale = HudPairingEndpoint(url: try testURL("http://100.100.10.20:8765"))
        let invalid = HudPairingEndpoint(url: try testURL("http://10.0.0.999:8765"))

        #expect(tailscale.kind == .tailscale)
        #expect(invalid.kind == .remote)
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
