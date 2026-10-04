import Foundation
@testable import HudsonNotchCore
import XCTest

final class HudNotchWireTests: XCTestCase {
    private func command(_ json: String) throws -> HudNotchCommand {
        try HudNotchWire.decodeCommand(Data(json.utf8))
    }

    func testLineWithoutOpIsAPost() throws {
        guard case .post(let activity) = try command(#"{"source":"Codex","title":"Done"}"#) else {
            return XCTFail("expected a post")
        }
        XCTAssertEqual(activity.source, "Codex")
        XCTAssertEqual(activity.title, "Done")
        XCTAssertEqual(activity.state, .notice)
        XCTAssertEqual(activity.tone, .info)
    }

    func testLegacyEventShapeMapsOntoActivity() throws {
        let json = #"{"title":"Shipped","body":"v1.2","level":"success","agent":{"name":"Ada"},"action":{"title":"Open","url":"https://example.com"}}"#
        guard case .post(let activity) = try command(json) else { return XCTFail("expected a post") }
        XCTAssertEqual(activity.source, "Ada")
        XCTAssertEqual(activity.detail, "v1.2")
        XCTAssertEqual(activity.state, .done)
        XCTAssertEqual(activity.tone, .success)
        XCTAssertEqual(activity.link, HudNotchLink(title: "Open", url: "https://example.com"))
    }

    func testChoicesImplyWaiting() throws {
        let json = #"{"op":"post","id":"q","title":"Keep?","choices":[{"id":"a","title":"Keep","role":"primary"},{"title":"Later","role":"cancel"}]}"#
        guard case .post(let activity) = try command(json) else { return XCTFail("expected a post") }
        XCTAssertEqual(activity.state, .waiting)
        XCTAssertEqual(activity.choices.map(\.role), [.primary, .cancel])
        XCTAssertFalse(activity.choices[1].id.isEmpty)
        XCTAssertTrue(activity.asksForInput)
    }

    func testOtherOps() throws {
        XCTAssertEqual(try command(#"{"op":"dismiss","id":"x"}"#), .dismiss(id: "x"))
        XCTAssertEqual(try command(#"{"op":"pulse"}"#), .pulse)
        XCTAssertEqual(try command(#"{"op":"subscribe"}"#), .subscribe)
        XCTAssertThrowsError(try command(#"{"op":"dismiss"}"#))
        XCTAssertThrowsError(try command(#"{"op":"explode"}"#))
    }

    func testCommandRoundTrip() throws {
        let activity = HudNotchActivity(
            id: "job", source: "cli", title: "Pick one", state: .waiting,
            choices: [HudNotchChoice(id: "a", title: "A", role: .primary)], replyPrompt: "Or say"
        )
        let line = try HudNotchWire.encodeCommand(.post(activity))
        XCTAssertEqual(line.last, 0x0A)
        XCTAssertEqual(try HudNotchWire.decodeCommand(line), .post(activity))
    }

    func testResponseRoundTrip() throws {
        let at = Date(timeIntervalSince1970: 1_800_000_000)
        let reply = HudNotchResponse.reply(HudNotchReply(id: "job", choice: "a", text: "because", at: at))
        XCTAssertEqual(try HudNotchWire.decodeResponse(HudNotchWire.encodeResponse(reply)), reply)
        let dismissed = HudNotchResponse.dismissed(id: "job")
        XCTAssertEqual(try HudNotchWire.decodeResponse(HudNotchWire.encodeResponse(dismissed)), dismissed)
    }

    func testProgressIsClamped() {
        XCTAssertEqual(HudNotchActivity(title: "x", progress: 1.7).progress, 1)
        XCTAssertEqual(HudNotchActivity(title: "x", progress: -1).progress, 0)
    }
}
