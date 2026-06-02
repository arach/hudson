import Foundation
import Testing
@testable import HudsonBridge

@Suite("HudPairing")
struct HudPairingTests {

    @Test("query pairing links become candidates")
    func queryPairingLink() throws {
        let url = try testURL("hudson://pair?hostId=macbook&hostName=Hudson%20Mac&url=http%3A%2F%2F10.0.0.2%3A8765&tailscaleUrl=https%3A%2F%2Fmac.tailnet.ts.net&capabilities=terminal,voice")
        let link = try HudDeepLink.parse(url)
        let parsedCandidate = try HudPairingCandidate.from(link)
        let candidate = try #require(parsedCandidate)

        #expect(candidate.hostID == "macbook")
        #expect(candidate.name == "Hudson Mac")
        #expect(candidate.endpoints.map(\.kind) == [.localNetwork, .tailscale])
        #expect(candidate.capabilities == ["terminal", "voice"])
        #expect(candidate.primaryEndpoint?.kind == .tailscale)
    }

    @Test("base64 URL JSON payloads decode from pairing links")
    func encodedPayloadLink() throws {
        let payload = HudPairingPayload(
            hostID: "studio",
            hostName: "Studio Mac",
            localURL: try testURL("http://192.168.1.24:8765"),
            tailscaleURL: try testURL("https://studio.tailnet.ts.net"),
            publicKey: "pub-123",
            pairingCode: "246810",
            capabilities: ["terminal", "capture"]
        )
        let url = try payload.deepLinkURL()
        let link = try HudDeepLink.parse(url)
        let parsedCandidate = try HudPairingCandidate.from(link)
        let candidate = try #require(parsedCandidate)

        #expect(candidate.hostID == "studio")
        #expect(candidate.publicKey == "pub-123")
        #expect(candidate.pairingCode == "246810")
        #expect(candidate.endpoints.map(\.kind) == [.localNetwork, .tailscale])
    }

    @Test("raw JSON QR payloads decode")
    func rawJSONQRCode() throws {
        let payload = """
        {"version":1,"hostID":"qr-host","displayName":"QR Host","baseURL":"https://hudson.example.com","capabilities":["web"]}
        """

        let candidate = try HudPairingCandidate.fromQRCode(payload)

        #expect(candidate.hostID == "qr-host")
        #expect(candidate.name == "QR Host")
        #expect(candidate.endpoints.first?.kind == .remote)
    }

    @Test("endpoint classifier knows common local routes")
    func endpointClassification() throws {
        let loopback = HudPairingEndpoint(url: try testURL("http://127.0.0.1:8765"))
        let local = HudPairingEndpoint(url: try testURL("http://172.20.1.2:8765"))
        let bonjour = HudPairingEndpoint(url: try testURL("http://hudson.local:8765"))
        let tailscale = HudPairingEndpoint(url: try testURL("https://hudson.ts.net"))
        let remote = HudPairingEndpoint(url: try testURL("https://hudson.example.com"))

        #expect(loopback.kind == .loopback)
        #expect(local.kind == .localNetwork)
        #expect(bonjour.kind == .localNetwork)
        #expect(tailscale.kind == .tailscale)
        #expect(remote.kind == .remote)
    }

    @Test("in-memory trust store upserts and removes hosts")
    func trustStore() async throws {
        let store = HudInMemoryPairingTrustStore()
        let candidate = HudPairingCandidate(
            hostID: "macbook",
            hostName: "Hudson Mac",
            endpoints: [
                HudPairingEndpoint(url: try testURL("http://10.0.0.2:8765"))
            ],
            publicKey: "pub-123",
            capabilities: ["terminal"],
            source: .manual
        )
        let host = try candidate.trustedHost(pairedAt: Date(timeIntervalSince1970: 100))

        try await store.trust(host)
        #expect(try await store.host(id: "macbook") == host)
        #expect(try await store.hosts().map(\.hostID) == ["macbook"])

        try await store.removeHost(id: "macbook")
        #expect(try await store.host(id: "macbook") == nil)
    }

    private func testURL(_ value: String) throws -> URL {
        try #require(URL(string: value))
    }
}
