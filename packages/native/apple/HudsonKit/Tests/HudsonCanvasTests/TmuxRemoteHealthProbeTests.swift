import XCTest
@testable import HudsonCanvasSurface

final class TmuxRemoteHealthProbeTests: XCTestCase {
    func testRemoteTmuxProbeBuildsNonInteractiveSSHCommand() {
        let command = TmuxRemoteHealthProbe.command(
            remoteHost: "devbox",
            target: "hudson-lab:agents",
            timeoutSeconds: 1.2
        )

        XCTAssertEqual(command.executableURL.path, "/usr/bin/ssh")
        XCTAssertTrue(command.arguments.contains("-T"))
        XCTAssertTrue(command.arguments.contains("BatchMode=yes"))
        XCTAssertTrue(command.arguments.contains("NumberOfPasswordPrompts=0"))
        XCTAssertTrue(command.arguments.contains("PasswordAuthentication=no"))
        XCTAssertTrue(command.arguments.contains("KbdInteractiveAuthentication=no"))
        XCTAssertTrue(command.arguments.contains("ConnectTimeout=2"))
        XCTAssertTrue(command.arguments.contains("devbox"))
        XCTAssertTrue(command.arguments.last?.contains("tmux has-session") == true)
        XCTAssertTrue(command.arguments.last?.contains("hudson-lab:agents") == true)
    }

    func testRemoteTmuxProbeClassifiesReadyOutput() {
        let probe = TmuxRemoteHealthProbe { _, _ in
            TmuxRemoteHealthProcessResult(
                status: 0,
                stdout: """
                CANVAS_STATUS=ready
                CANVAS_SESSION=hudson-lab
                CANVAS_WINDOW=agents
                CANVAS_ACTIVE_WINDOW=agents
                CANVAS_ATTACHED=1
                CANVAS_PANES=3
                """,
                stderr: "",
                timedOut: false
            )
        }

        let result = probe.check(remoteHost: "devbox", target: "hudson-lab:agents")

        XCTAssertEqual(result.status, "ready")
        XCTAssertEqual(result.session, "hudson-lab")
        XCTAssertEqual(result.window, "agents")
        XCTAssertEqual(result.activeWindow, "agents")
        XCTAssertEqual(result.attachedClients, 1)
        XCTAssertEqual(result.paneCount, 3)
        XCTAssertEqual(result.message, "remote tmux target is ready")
    }

    func testRemoteTmuxProbeClassifiesAuthNeeded() {
        let result = TmuxRemoteHealthProbe.result(
            from: TmuxRemoteHealthProcessResult(
                status: 255,
                stdout: "",
                stderr: "Permission denied (publickey).",
                timedOut: false
            )
        )

        XCTAssertEqual(result.status, "auth-needed")
        XCTAssertEqual(result.message, "remote ssh authentication or host-key approval is needed")
    }

    func testRemoteTmuxProbeClassifiesTimeoutAsUnreachable() {
        let result = TmuxRemoteHealthProbe.result(
            from: TmuxRemoteHealthProcessResult(
                status: 143,
                stdout: "",
                stderr: "",
                timedOut: true
            )
        )

        XCTAssertEqual(result.status, "unreachable")
        XCTAssertEqual(result.message, "remote tmux health check timed out")
    }

    func testRemoteTmuxProbeClassifiesMissingRemoteTarget() {
        let result = TmuxRemoteHealthProbe.result(
            from: TmuxRemoteHealthProcessResult(
                status: 44,
                stdout: "CANVAS_STATUS=session-missing\n",
                stderr: "",
                timedOut: false
            )
        )

        XCTAssertEqual(result.status, "session-missing")
        XCTAssertEqual(result.message, "remote tmux session or target was not found")
    }
}
