import XCTest
@testable import HudsonVantage

final class HudVantageControlContractTests: XCTestCase {
    func testControlAPIProcessesCommandsQueuedBeforeStartup() async throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer {
            try? FileManager.default.removeItem(at: directory)
        }

        let commandURL = directory.appendingPathComponent("control.jsonl")
        let responseURL = directory.appendingPathComponent("responses.jsonl")
        try """
        {"id":"queued-before-start","action":"status"}
        """.write(to: commandURL, atomically: true, encoding: .utf8)

        let api = HudVantageControlAPI(commandURL: commandURL, responseURL: responseURL)
        let expectation = expectation(description: "queued command handled")

        await MainActor.run {
            api.start { command in
                if command.id == "queued-before-start" {
                    expectation.fulfill()
                }

                return HudVantageControlResponse(
                    id: command.id,
                    action: command.normalizedAction,
                    ok: true,
                    message: "handled",
                    nodeCount: 0
                )
            }
        }

        await fulfillment(of: [expectation], timeout: 2)
        try await Task.sleep(nanoseconds: 200_000_000)
        api.stop()

        let responses = try String(contentsOf: responseURL, encoding: .utf8)
        XCTAssertTrue(responses.contains(#""id":"queued-before-start""#))
    }

    func testControlCommandDecodesRestoreStatePath() throws {
        let json = """
        {
          "id": "restore-1",
          "action": "restore",
          "workspaceID": "scout-lab",
          "statePath": "/tmp/scout-vantage-state.json",
          "createIfMissing": true
        }
        """

        let command = try JSONDecoder().decode(
            HudVantageControlCommand.self,
            from: Data(json.utf8)
        )

        XCTAssertEqual(command.id, "restore-1")
        XCTAssertEqual(command.normalizedAction, "restore")
        XCTAssertEqual(command.workspaceID, "scout-lab")
        XCTAssertEqual(command.statePath, "/tmp/scout-vantage-state.json")
        XCTAssertEqual(command.createIfMissing, true)
    }

    func testControlCommandDecodesPermissionGatedTmuxInstall() throws {
        let json = """
        {
          "id": "install-1",
          "action": "ensure-tmux",
          "installer": "homebrew",
          "confirmInstall": true
        }
        """

        let command = try JSONDecoder().decode(
            HudVantageControlCommand.self,
            from: Data(json.utf8)
        )

        XCTAssertEqual(command.normalizedAction, "ensure-tmux")
        XCTAssertEqual(command.installer, "homebrew")
        XCTAssertEqual(command.confirmInstall, true)
    }

    func testWorkspaceSnapshotRoundTripsDurableTmuxNode() throws {
        let nodeID = UUID()
        let snapshot = HudVantageWorkspaceSnapshot(
            workspaceID: "scout-lab",
            surfaceTitle: "Scout Vantage",
            viewport: HudVantageViewportSnapshot(panX: 12, panY: -40, scale: 0.75),
            nodes: [
                HudVantageNodeSnapshot(
                    id: nodeID,
                    title: "codex 0007",
                    subtitle: "tmux · hudson-lab:agents-codex-0007",
                    tint: "cyan",
                    x: 120,
                    y: 240,
                    width: 500,
                    height: 316,
                    zIndex: 4,
                    runtime: HudVantageRuntimeReference(
                        kind: "tmux",
                        target: "hudson-lab:agents-codex-0007",
                        graphitePath: "hudson.lab.agents.codex.0007.worker",
                        remoteHost: nil
                    )
                )
            ],
            selectedNodeIDs: [nodeID]
        )

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(snapshot)

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let decoded = try decoder.decode(HudVantageWorkspaceSnapshot.self, from: data)

        XCTAssertEqual(decoded.workspaceID, "scout-lab")
        XCTAssertEqual(decoded.viewport.scale, 0.75)
        XCTAssertEqual(decoded.nodes.first?.runtime.kind, "tmux")
        XCTAssertEqual(decoded.nodes.first?.runtime.graphitePath, "hudson.lab.agents.codex.0007.worker")
        XCTAssertEqual(decoded.selectedNodeIDs, [nodeID])
    }

    func testControlResponseCanReturnStructuredNodeSummaries() throws {
        let nodeID = UUID()
        let response = HudVantageControlResponse(
            id: "status-1",
            action: "status",
            ok: true,
            message: "1 terminals",
            workspaceID: "scout-lab",
            nodeCount: 1,
            nodes: [
                HudVantageControlNode(
                    id: nodeID,
                    title: "codex 0007",
                    runtimeKind: "tmux",
                    target: "hudson-lab:agents-codex-0007",
                    graphitePath: "hudson.lab.agents.codex.0007.worker",
                    x: 120,
                    y: 240,
                    width: 500,
                    height: 316,
                    zIndex: 4
                )
            ],
            commandPath: "/tmp/scout-vantage-control.jsonl",
            responsePath: "/tmp/scout-vantage-control.responses.jsonl",
            statePath: "/tmp/scout-vantage-state.json",
            tmuxPath: "/opt/homebrew/bin/tmux",
            tmuxInstallInProgress: false,
            requiresPermission: true,
            installerCommand: "/opt/homebrew/bin/brew install tmux"
        )

        let data = try JSONEncoder().encode(response)
        let object = try XCTUnwrap(
            JSONSerialization.jsonObject(with: data) as? [String: Any]
        )

        XCTAssertEqual(object["ok"] as? Bool, true)
        XCTAssertEqual(object["workspaceID"] as? String, "scout-lab")
        XCTAssertEqual(object["nodeCount"] as? Int, 1)
        XCTAssertEqual(object["statePath"] as? String, "/tmp/scout-vantage-state.json")
        XCTAssertEqual(object["tmuxPath"] as? String, "/opt/homebrew/bin/tmux")
        XCTAssertEqual(object["requiresPermission"] as? Bool, true)
        let nodes = try XCTUnwrap(object["nodes"] as? [[String: Any]])
        XCTAssertEqual(nodes.first?["runtimeKind"] as? String, "tmux")
    }
}
