import Foundation
import Testing
@testable import HudsonBridge

@Suite("HudNearbyTransport")
struct HudNearbyTransportTests {
    @Test("Nearby registration and discovery default to local Bonjour")
    func localDomainDefaults() {
        #expect(HudNearbyService(type: "_hud-test._tcp").domain == "local.")
        #expect(HudNearbyService(type: "_hud-test._tcp", domain: nil).domain == "local.")
        #expect(HudNearbyService(type: "_hud-test._tcp", domain: "   ").domain == "local.")

        #expect(HudNearbyBrowser(serviceType: "_hud-test._tcp").domain == "local.")
        #expect(HudNearbyBrowser(serviceType: "_hud-test._tcp", domain: nil).domain == "local.")
        #expect(
            HudNearbyBrowser(serviceType: "_hud-test._tcp", domain: "   ").domain
                == "local."
        )
    }

    @Test("service types must describe a TCP Bonjour service")
    func serviceTypeValidation() async {
        let browser = HudNearbyBrowser(serviceType: "linea-transfer")

        do {
            try await browser.run { _ in .finish }
            Issue.record("Invalid service type unexpectedly started browsing")
        } catch let error as HudNearbyTransportError {
            #expect(error == .invalidServiceType("linea-transfer"))
        } catch {
            Issue.record("Unexpected error: \(error)")
        }
    }

    @Test("Nearby discovery rejects wide-area DNS-SD domains")
    func browserRejectsNonLocalDomain() async {
        for domain in ["example.com.", "subdomain.local."] {
            let browser = HudNearbyBrowser(
                serviceType: "_hud-test._tcp",
                domain: domain
            )

            do {
                _ = try await browser.firstPeer(timeout: .zero)
                Issue.record("Non-local domain unexpectedly started browsing: \(domain)")
            } catch let error as HudNearbyTransportError {
                #expect(error == .invalidServiceDomain(domain))
            } catch {
                Issue.record("Unexpected error: \(error)")
            }
        }
    }

    @Test("Nearby registration rejects wide-area DNS-SD domains")
    func listenerRejectsNonLocalDomain() async {
        for domain in ["example.com.", "subdomain.local."] {
            let listener = HudNearbyListener(
                service: HudNearbyService(
                    type: "_hud-test._tcp",
                    domain: domain
                ),
                // Keep the test fail-fast even if validation ordering regresses.
                configuration: HudNearbyTransportConfiguration(
                    maximumMessageBytes: -1
                )
            )

            do {
                try await listener.run { _ in }
                Issue.record("Non-local domain unexpectedly started listening: \(domain)")
            } catch let error as HudNearbyTransportError {
                #expect(error == .invalidServiceDomain(domain))
            } catch {
                Issue.record("Unexpected error: \(error)")
            }
        }
    }

    @Test("Nearby accepts local Bonjour spelling variants")
    func localDomainVariants() async {
        for domain in ["local", "LOCAL.", " local. "] {
            let browser = HudNearbyBrowser(
                serviceType: "_hud-test._tcp",
                domain: domain
            )

            do {
                _ = try await browser.firstPeer(timeout: .zero)
                Issue.record("Zero-duration discovery unexpectedly found a peer")
            } catch let error as HudNearbyTransportError {
                #expect(error == .timedOut(operation: "discovery"))
            } catch {
                Issue.record("Unexpected error: \(error)")
            }
        }
    }

    @Test("configuration rejects payload bounds outside the UInt16 wire limit")
    func configurationValidation() async {
        let service = HudNearbyService(type: "_hud-test._tcp")
        let expected = HudNearbyTransportError.invalidConfiguration(
            "maximumMessageBytes must be between 0 and "
                + "\(HudNearbyTransportConfiguration.wireMaximumMessageBytes)"
        )

        #expect(
            HudNearbyTransportConfiguration().maximumMessageBytes
                == Int(UInt16.max)
        )

        for invalidMaximum in [
            -1,
            HudNearbyTransportConfiguration.wireMaximumMessageBytes + 1,
        ] {
            let listener = HudNearbyListener(
                service: service,
                configuration: HudNearbyTransportConfiguration(
                    maximumMessageBytes: invalidMaximum
                )
            )

            do {
                try await listener.run { _ in }
                Issue.record("Invalid configuration unexpectedly started listening")
            } catch let error as HudNearbyTransportError {
                #expect(error == expected)
            } catch {
                Issue.record("Unexpected error: \(error)")
            }
        }
    }

    @Test("zero discovery timeout fails without starting an unbounded browse")
    func immediateTimeout() async {
        let browser = HudNearbyBrowser(serviceType: "_hud-test._tcp")

        do {
            _ = try await browser.firstPeer(timeout: .zero)
            Issue.record("Zero-duration discovery unexpectedly found a peer")
        } catch let error as HudNearbyTransportError {
            #expect(error == .timedOut(operation: "discovery"))
        } catch {
            Issue.record("Unexpected error: \(error)")
        }
    }

    @Test("filtered Bonjour discovery and UInt8/UInt16 TLV framing round-trip")
    func bonjourTLVRoundTrip() async throws {
        let suffix = UUID().uuidString
            .replacingOccurrences(of: "-", with: "")
            .prefix(6)
            .lowercased()
        let service = HudNearbyService(
            name: "Hudson nearby test \(suffix)",
            type: "_h\(suffix)._tcp",
            metadata: ["test": suffix]
        )
        let configuration = HudNearbyTransportConfiguration(
            maximumMessageBytes: 1_024,
            operationTimeout: .seconds(5),
            newConnectionLimit: 1
        )
        let listener = HudNearbyListener(service: service, configuration: configuration)
        let incompatibleService = HudNearbyService(
            name: "AAA incompatible nearby test \(suffix)",
            type: service.type,
            metadata: ["test": "incompatible"]
        )
        let incompatibleListener = HudNearbyListener(
            service: incompatibleService,
            configuration: configuration
        )
        let listenerTask = Task {
            try await listener.run { connection in
                do {
                    let request = try await connection.receive()
                    try await connection.send(
                        HudNearbyMessage(
                            type: request.type &+ 1,
                            payload: request.payload + Data(" pong".utf8)
                        )
                    )
                } catch {
                    Issue.record("Listener connection failed: \(error)")
                    throw error
                }
            }
        }
        let incompatibleListenerTask = Task {
            try await incompatibleListener.run { _ in }
        }
        defer {
            listenerTask.cancel()
            incompatibleListenerTask.cancel()
        }

        let browser = HudNearbyBrowser(serviceType: service.type)
        let incompatiblePeer = try await browser.firstPeer(
            timeout: .seconds(10),
            matching: { $0.metadata["test"] == "incompatible" }
        )
        #expect(incompatiblePeer.name == incompatibleService.name)

        let peer: HudNearbyPeer
        do {
            peer = try await browser.firstPeer(
                timeout: .seconds(10),
                matching: { $0.metadata["test"] == suffix }
            )
        } catch {
            Issue.record("Discovery failed: \(error)")
            throw error
        }
        #expect(peer.name == service.name)
        #expect(peer.metadata["test"] == suffix)

        let response = NearbyMessageBox()
        do {
            try await HudNearbyConnector(configuration: configuration).run(to: peer) { connection in
                do {
                    try await connection.send(
                        HudNearbyMessage(type: 41, payload: Data("ping".utf8))
                    )
                } catch {
                    Issue.record("Send failed: \(error)")
                    throw error
                }
                do {
                    await response.set(try await connection.receive())
                } catch {
                    Issue.record("Receive failed: \(error)")
                    throw error
                }
            }
        } catch {
            Issue.record("Connection failed: \(error)")
            throw error
        }

        let message = try #require(await response.value)
        #expect(message.type == 42)
        #expect(message.payload == Data("ping pong".utf8))
    }
}

private actor NearbyMessageBox {
    private(set) var value: HudNearbyMessage?

    func set(_ value: HudNearbyMessage) {
        self.value = value
    }
}
