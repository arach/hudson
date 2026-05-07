import XCTest
@testable import HudsonVantage

final class HudVantageHostAPITests: XCTestCase {
    func testDefaultCallbacksCanBeInvokedAsNoOpsOnMainActor() async {
        let callbacks = HudVantageHostCallbacks()
        let hostEvent = HudVantageHostEvent(kind: .surfaceReady, workspaceID: "scout-lab")
        let permissionRequest = HudVantagePermissionRequest(
            kind: .runtimeInstall,
            title: "Install tmux",
            detail: "Hudson Vantage needs tmux before attaching Scout sessions."
        )
        let runtimeEvent = HudVantageRuntimeEvent(
            kind: .ready,
            runtimeKind: "tmux",
            target: "hudson-lab:agents-codex-0007"
        )

        await MainActor.run {
            callbacks.onHostEvent(hostEvent)
            callbacks.onPermissionRequest(permissionRequest)
            callbacks.onRuntimeEvent(runtimeEvent)
            HudVantageHostCallbacks.noop.onHostEvent(hostEvent)
        }

        XCTAssertEqual(hostEvent.kind, .surfaceReady)
        XCTAssertEqual(permissionRequest.kind, .runtimeInstall)
        XCTAssertEqual(runtimeEvent.kind, .ready)
    }

    func testHostPayloadsRoundTripThroughJSON() throws {
        let date = Date(timeIntervalSince1970: 1_700_000_000)
        let nodeID = UUID(uuidString: "00000000-0000-0000-0000-000000000007")!

        let hostEvent = HudVantageHostEvent(
            id: UUID(uuidString: "10000000-0000-0000-0000-000000000001")!,
            kind: .selectionChanged,
            workspaceID: "scout-lab",
            nodeID: nodeID,
            message: "1 node selected",
            metadata: ["source": "host-api-test"],
            emittedAt: date
        )
        let permissionRequest = HudVantagePermissionRequest(
            id: UUID(uuidString: "20000000-0000-0000-0000-000000000001")!,
            kind: .remoteConnection,
            title: "Connect remote tmux",
            detail: "Attach to a remote Scout runtime.",
            workspaceID: "scout-lab",
            nodeID: nodeID,
            command: "ssh scout-host tmux attach",
            target: "scout-host",
            metadata: ["runtime": "tmux"],
            requestedAt: date
        )
        let runtimeEvent = HudVantageRuntimeEvent(
            id: UUID(uuidString: "30000000-0000-0000-0000-000000000001")!,
            kind: .output,
            runtimeKind: "tmux",
            runtimeID: "agents-codex-0007",
            workspaceID: "scout-lab",
            nodeID: nodeID,
            target: "hudson-lab:agents-codex-0007",
            graphitePath: "hudson.lab.agents.codex.0007.worker",
            remoteHost: "hudson-lab",
            message: "ready",
            metadata: ["stream": "stdout"],
            emittedAt: date
        )

        XCTAssertEqual(try roundTrip(hostEvent), hostEvent)
        XCTAssertEqual(try roundTrip(permissionRequest), permissionRequest)
        XCTAssertEqual(try roundTrip(runtimeEvent), runtimeEvent)
    }

    private func roundTrip<T: Codable>(_ value: T) throws -> T {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(value)

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(T.self, from: data)
    }
}
