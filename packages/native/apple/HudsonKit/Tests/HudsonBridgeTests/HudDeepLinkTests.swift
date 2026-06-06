import Foundation
import Testing
@testable import HudsonBridge

@Suite("HudDeepLink")
struct HudDeepLinkTests {

    @Test("settings links parse their section")
    func settings() throws {
        let url = try #require(URL(string: "hudson://settings?section=voice"))
        let link = try HudDeepLink.parse(url)

        #expect(link.route == .settings(section: "voice"))
        #expect(link.parameters["section"] == "voice")
        #expect(link.callback == nil)
    }

    @Test("workspace IDs can come from path components")
    func workspacePath() throws {
        let url = try #require(URL(string: "hudson://workspace/hudson-mobile"))
        let link = try HudDeepLink.parse(url)

        #expect(link.route == .workspace(id: "hudson-mobile"))
        #expect(link.components == ["hudson-mobile"])
    }

    @Test("node IDs are required")
    func nodeRequiresID() throws {
        let url = try #require(URL(string: "hudson://node"))

        #expect(throws: HudDeepLinkError.missingParameter(route: "node", parameter: "id")) {
            try HudDeepLink.parse(url)
        }
    }

    @Test("terminal sessions can come from query parameters")
    func terminalSession() throws {
        let url = try #require(URL(string: "hudson://terminal?session=lead"))
        let link = try HudDeepLink.parse(url)

        #expect(link.route == .terminal(session: "lead"))
    }

    @Test("pairing links preserve opaque payloads")
    func pairingPayload() throws {
        let url = try #require(URL(string: "hudson://pair?payload=abc123"))
        let link = try HudDeepLink.parse(url)

        #expect(link.route == .pair(payload: "abc123"))
    }

    @Test("capture links default to OCR")
    func captureOCR() throws {
        let url = try #require(URL(string: "hudson://capture"))
        let link = try HudDeepLink.parse(url)

        #expect(link.route == .capture(mode: .ocr))
    }

    @Test("x-callback-url routes are unwrapped")
    func xCallbackURL() throws {
        let url = try #require(URL(string: "hudson://x-callback-url/workspace?id=demo&x-source=shortcut&x-success=hudson%3A%2F%2Fsettings"))
        let link = try HudDeepLink.parse(url)

        #expect(link.route == .workspace(id: "demo"))
        #expect(link.callback?.source == "shortcut")
        #expect(link.callback?.success == URL(string: "hudson://settings"))
    }

    @Test("web routes require a nested URL")
    func webURL() throws {
        let url = try #require(URL(string: "hudson://web?url=https%3A%2F%2Fhudsonkit.dev%2Fdocs"))
        let link = try HudDeepLink.parse(url)

        #expect(link.route == .web(url: try #require(URL(string: "https://hudsonkit.dev/docs"))))
    }

    @Test("unsupported schemes are rejected")
    func unsupportedScheme() throws {
        let url = try #require(URL(string: "talkie://settings"))

        #expect(throws: HudDeepLinkError.unsupportedScheme("talkie")) {
            try HudDeepLink.parse(url)
        }
    }
}
