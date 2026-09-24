#if os(macOS)
import Foundation
@testable import HudsonNotchCore
import Synchronization
import XCTest

/// A lock-guarded value that escaping closures can share.
private final class Locked<Value: Sendable>: Sendable {
    private let mutex: Mutex<Value>
    init(_ value: Value) { mutex = Mutex(value) }
    func withLock<R>(_ body: (inout Value) -> R) -> R { mutex.withLock { body(&$0) } }
}

final class HudNotchSocketTests: XCTestCase {
    private var socketURL: URL!
    private var server: HudNotchSocketServer!
    private let received = Locked<[HudNotchCommand]>([])

    override func setUpWithError() throws {
        // sun_path is 104 bytes; the test temp directory is too deep.
        socketURL = URL(fileURLWithPath: "/tmp/hn-\(UUID().uuidString.prefix(8)).sock")
        let received = self.received
        server = HudNotchSocketServer(socketURL: socketURL) { command in
            received.withLock { $0.append(command) }
        }
        try server.start()
    }

    override func tearDown() {
        server.stop()
        server = nil
    }

    private func waitFor(_ condition: () -> Bool, timeout: TimeInterval = 2) {
        let deadline = Date().addingTimeInterval(timeout)
        while !condition(), Date() < deadline {
            RunLoop.current.run(until: Date().addingTimeInterval(0.01))
        }
    }

    func testFireAndForgetPost() throws {
        try HudNotchClient(socketURL: socketURL).send(.post(HudNotchActivity(id: "a", title: "Hello")))
        waitFor { received.withLock { !$0.isEmpty } }
        guard case .post(let activity) = received.withLock({ $0.first }) else { return XCTFail("no post") }
        XCTAssertEqual(activity.id, "a")
    }

    func testSecondServerOnSameSocketIsRefused() {
        let other = HudNotchSocketServer(socketURL: socketURL) { _ in }
        XCTAssertThrowsError(try other.start()) { error in
            XCTAssertEqual(error as? HudNotchSocketError, .alreadyRunning(socketURL.path))
        }
    }

    func testAskReceivesReplyAndSubscriberSeesIt() throws {
        let client = HudNotchClient(socketURL: socketURL)
        let seen = Locked<[HudNotchResponse]>([])
        let subscribed = expectation(description: "subscriber got the reply")
        Thread {
            try? client.subscribe { response in
                seen.withLock { $0.append(response) }
                subscribed.fulfill()
                return false
            }
        }.start()
        waitFor { received.withLock { $0.contains(.subscribe) } }

        let answered = expectation(description: "asker got the reply")
        let answer = Locked<HudNotchResponse?>(nil)
        Thread {
            let response = try? client.ask(HudNotchActivity(id: "q", title: "Keep?"), timeout: 5)
            answer.withLock { $0 = response }
            answered.fulfill()
        }.start()

        waitFor { received.withLock { $0.contains { if case .post(let a) = $0 { a.id == "q" } else { false } } } }
        guard case .post(let posted) = received.withLock({ $0.last }) else { return XCTFail("no post") }
        XCTAssertEqual(posted.state, .waiting, "ask forces waiting")

        let reply = HudNotchResponse.reply(HudNotchReply(id: "q", choice: "keep", at: Date(timeIntervalSince1970: 0)))
        server.respond(reply)
        wait(for: [answered, subscribed], timeout: 3)
        XCTAssertEqual(answer.withLock { $0 }, reply)
        XCTAssertEqual(seen.withLock { $0 }, [reply])
    }

    func testAskIgnoresResponsesForOtherIDsAndTimesOut() throws {
        let client = HudNotchClient(socketURL: socketURL)
        let started = Date()
        XCTAssertThrowsError(try client.ask(HudNotchActivity(id: "slow", title: "Wait"), timeout: 0.3)) { error in
            XCTAssertEqual(error as? HudNotchSocketError, .timedOut)
        }
        XCTAssertLessThan(Date().timeIntervalSince(started), 2)
    }

    func testPathTooLongIsReported() {
        let long = URL(fileURLWithPath: "/tmp/" + String(repeating: "x", count: 120))
        XCTAssertThrowsError(try HudNotchClient(socketURL: long).send(.pulse)) { error in
            XCTAssertEqual(error as? HudNotchSocketError, .pathTooLong(long.path))
        }
    }
}
#endif
