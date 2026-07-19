import XCTest
@testable import HudsonTerminal

final class HudTerminalSSHConnectionTests: XCTestCase {
    func testExecStartupMapsToTerminiExecRequest() {
        let connection = HudTerminalSSHConnection(
            host: "example.com",
            username: "tester",
            authentication: .privateKey(pem: "private-key"),
            startup: .exec(command: "tmux new -A -s scout"),
            hostKeyFingerprint: "SHA256:example"
        )

        let termini = connection.terminiConnection

        XCTAssertEqual(termini.startupCommand, "tmux new -A -s scout")
        XCTAssertTrue(termini.useExecRequest)
        XCTAssertEqual(termini.hostKeyFingerprint, "SHA256:example")
    }

    func testShellStartupDoesNotUseExecRequest() {
        let connection = HudTerminalSSHConnection(
            host: "example.com",
            username: "tester",
            authentication: .password("secret"),
            startup: .shell(command: "echo ready")
        )

        let termini = connection.terminiConnection

        XCTAssertEqual(termini.startupCommand, "echo ready")
        XCTAssertFalse(termini.useExecRequest)
    }
}
