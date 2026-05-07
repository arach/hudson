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
          "apiVersion": "v0",
          "kind": "hudson.vantage.command",
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
        XCTAssertEqual(command.resolvedAPIVersion, "v0")
        XCTAssertEqual(command.kind, "hudson.vantage.command")
        XCTAssertEqual(command.normalizedAction, "restore")
        XCTAssertEqual(command.workspaceID, "scout-lab")
        XCTAssertEqual(command.statePath, "/tmp/scout-vantage-state.json")
        XCTAssertEqual(command.createIfMissing, true)
    }

    func testControlCommandDecodesV0NodeSelectorsAndIncludeFlags() throws {
        let json = """
        {
          "version": "v0",
          "kind": "hudson.vantage.command",
          "id": "select-1",
          "action": "select",
          "nodeID": "abc123",
          "nodeIDs": ["def456", "789abc"],
          "selectionMode": "toggle",
          "includeNodes": false,
          "includeMetrics": true,
          "includeViewport": true
        }
        """

        let command = try JSONDecoder().decode(
            HudVantageControlCommand.self,
            from: Data(json.utf8)
        )

        XCTAssertEqual(command.resolvedAPIVersion, "v0")
        XCTAssertEqual(command.normalizedAction, "select")
        XCTAssertEqual(command.nodeID, "abc123")
        XCTAssertEqual(command.nodeIDs, ["def456", "789abc"])
        XCTAssertEqual(command.normalizedSelectionMode, "toggle")
        XCTAssertEqual(command.includeNodes, false)
        XCTAssertEqual(command.includeMetrics, true)
        XCTAssertEqual(command.includeViewport, true)
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

    func testControlCommandDecodesStyleFields() throws {
        let json = """
        {
          "apiVersion": "v0",
          "kind": "hudson.vantage.command",
          "id": "style-1",
          "action": "style",
          "styleScope": "tag",
          "tag": "focus",
          "stylePreset": "jade",
          "chromeStyle": "graphite",
          "terminalTheme": "hudson-paper",
          "terminalFontFamily": "Menlo",
          "terminalFontSize": 14.5,
          "canvasGridMode": "dots",
          "canvasGridStep": 24,
          "canvasMinorOpacity": 0.12,
          "canvasMajorOpacity": 0.22,
          "focusPadding": 20,
          "includeStyle": true
        }
        """

        let command = try JSONDecoder().decode(
            HudVantageControlCommand.self,
            from: Data(json.utf8)
        )

        XCTAssertEqual(command.normalizedAction, "style")
        XCTAssertEqual(command.normalizedStyleScope, "tag")
        XCTAssertEqual(command.tag, "focus")
        XCTAssertEqual(command.stylePreset, "jade")
        XCTAssertEqual(command.chromeStyle, "graphite")
        XCTAssertEqual(command.terminalTheme, "hudson-paper")
        XCTAssertEqual(command.terminalFontFamily, "Menlo")
        XCTAssertEqual(command.terminalFontSize, 14.5)
        XCTAssertEqual(command.canvasGridMode, "dots")
        XCTAssertEqual(command.canvasGridStep, 24)
        XCTAssertEqual(command.canvasMinorOpacity, 0.12)
        XCTAssertEqual(command.canvasMajorOpacity, 0.22)
        XCTAssertEqual(command.focusPadding, 20)
        XCTAssertEqual(command.includeStyle, true)
    }

    func testControlCommandDecodesViewportReplayFields() throws {
        let json = """
        {
          "apiVersion": "v0",
          "kind": "hudson.vantage.command",
          "id": "viewport-1",
          "action": "viewport",
          "reset": false,
          "fit": true,
          "panX": -120.5,
          "panY": 44,
          "scale": 0.25
        }
        """

        let command = try JSONDecoder().decode(
            HudVantageControlCommand.self,
            from: Data(json.utf8)
        )

        XCTAssertEqual(command.normalizedAction, "viewport")
        XCTAssertEqual(command.fit, true)
        XCTAssertEqual(command.reset, false)
        XCTAssertEqual(command.panX, -120.5)
        XCTAssertEqual(command.panY, 44)
        XCTAssertEqual(command.scale, 0.25)
    }

    func testControlCommandDecodesPerfHarnessFields() throws {
        let json = """
        {
          "apiVersion": "v0",
          "kind": "hudson.vantage.command",
          "id": "perf-1",
          "action": "perf-harness",
          "count": 64,
          "activeCount": 32,
          "harnessMode": "tail",
          "rateMS": 250,
          "prefix": "hudson-perf-lab"
        }
        """

        let command = try JSONDecoder().decode(
            HudVantageControlCommand.self,
            from: Data(json.utf8)
        )

        XCTAssertEqual(command.normalizedAction, "perf-harness")
        XCTAssertEqual(command.count, 64)
        XCTAssertEqual(command.activeCount, 32)
        XCTAssertEqual(command.harnessMode, "tail")
        XCTAssertEqual(command.rateMS, 250)
        XCTAssertEqual(command.prefix, "hudson-perf-lab")
    }

    func testWorkspaceSnapshotRoundTripsDurableTmuxNode() throws {
        let nodeID = UUID()
        let snapshot = HudVantageWorkspaceSnapshot(
            workspaceID: "scout-lab",
            surfaceTitle: "Scout Vantage",
            viewport: HudVantageViewportSnapshot(panX: 12, panY: -40, scale: 0.75),
            layout: HudVantageSurfaceLayoutSnapshot(
                canvasTool: "hand",
                navigationFilter: "selected",
                navigationTagFilter: "focus",
                navigationCollapsed: true,
                navigationWidth: 288,
                minimapCollapsed: true,
                inspectorCollapsed: false,
                inspectorWidth: 336,
                style: .blueprint,
                tagStyles: [
                    "focus": HudVantageTerminalStyleOverride(
                        terminalThemeID: .jadeNight,
                        terminalFontSize: 13.5
                    )
                ]
            ),
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
                    tag: "focus",
                    style: HudVantageTerminalStyleOverride(
                        terminalThemeID: .hudsonPaper,
                        terminalFontFamily: "Menlo"
                    ),
                    runtime: HudVantageRuntimeReference(
                        kind: "tmux",
                        target: "hudson-lab:agents-codex-0007",
                        graphitePath: "hudson.lab.agents.codex.0007.worker",
                        remoteHost: nil
                    )
                )
            ],
            selectedNodeIDs: [nodeID],
            focusedNodeID: nodeID,
            groups: [
                HudVantageWorkspaceGroupSnapshot(
                    id: "tag.focus",
                    name: "Focus",
                    nodeIDs: [nodeID],
                    tags: ["focus"]
                )
            ]
        )

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(snapshot)

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let decoded = try decoder.decode(HudVantageWorkspaceSnapshot.self, from: data)

        XCTAssertEqual(decoded.kind, HudVantageWorkspaceSnapshot.documentKind)
        XCTAssertEqual(decoded.workspaceID, "scout-lab")
        XCTAssertEqual(decoded.viewport.scale, 0.75)
        XCTAssertEqual(decoded.layout?.canvasTool, "hand")
        XCTAssertEqual(decoded.layout?.navigationFilter, "selected")
        XCTAssertEqual(decoded.layout?.navigationTagFilter, "focus")
        XCTAssertEqual(decoded.layout?.navigationCollapsed, true)
        XCTAssertEqual(decoded.layout?.minimapCollapsed, true)
        XCTAssertEqual(decoded.layout?.inspectorWidth, 336)
        XCTAssertEqual(decoded.layout?.style?.id, "blueprint")
        XCTAssertEqual(decoded.layout?.style?.terminalThemeID, .blueprint)
        XCTAssertEqual(decoded.layout?.style?.canvasGridStep, 24)
        XCTAssertEqual(decoded.layout?.tagStyles?["focus"]?.terminalThemeID, .jadeNight)
        XCTAssertEqual(decoded.layout?.tagStyles?["focus"]?.terminalFontSize, 13.5)
        XCTAssertEqual(decoded.nodes.first?.tag, "focus")
        XCTAssertEqual(decoded.nodes.first?.style?.terminalThemeID, .hudsonPaper)
        XCTAssertEqual(decoded.nodes.first?.style?.terminalFontFamily, "Menlo")
        XCTAssertEqual(decoded.nodes.first?.runtime.kind, "tmux")
        XCTAssertEqual(decoded.nodes.first?.runtime.graphitePath, "hudson.lab.agents.codex.0007.worker")
        XCTAssertEqual(decoded.selectedNodeIDs, [nodeID])
        XCTAssertEqual(decoded.focusedNodeID, nodeID)
        XCTAssertEqual(decoded.groups.first?.id, "tag.focus")
        XCTAssertEqual(decoded.groups.first?.nodeIDs, [nodeID])
    }

    func testWorkspaceSnapshotDecodesWithoutLayoutForV0Compatibility() throws {
        let nodeID = UUID()
        let json = """
        {
          "schemaVersion": 1,
          "workspaceID": "legacy-lab",
          "surfaceTitle": "Legacy Vantage",
          "viewport": { "panX": 0, "panY": 0, "scale": 1 },
          "nodes": [],
          "selectedNodeIDs": ["\(nodeID.uuidString)"],
          "savedAt": "2026-05-07T00:00:00Z"
        }
        """

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let snapshot = try decoder.decode(HudVantageWorkspaceSnapshot.self, from: Data(json.utf8))

        XCTAssertEqual(snapshot.kind, HudVantageWorkspaceSnapshot.documentKind)
        XCTAssertEqual(snapshot.workspaceID, "legacy-lab")
        XCTAssertNil(snapshot.layout)
        XCTAssertEqual(snapshot.selectedNodeIDs, [nodeID])
        XCTAssertNil(snapshot.focusedNodeID)
        XCTAssertEqual(snapshot.groups, [])
    }

    func testControlResponseCanReturnStructuredNodeSummaries() throws {
        let nodeID = UUID()
        let response = HudVantageControlResponse(
            id: "status-1",
            action: "status",
            ok: true,
            message: "1 terminals",
            errorCode: nil,
            workspaceID: "scout-lab",
            nodeCount: 1,
            nodes: [
                HudVantageControlNode(
                    id: nodeID,
                    title: "codex 0007",
                    subtitle: "tmux · hudson-lab:agents-codex-0007",
                    runtimeKind: "tmux",
                    target: "hudson-lab:agents-codex-0007",
                    graphitePath: "hudson.lab.agents.codex.0007.worker",
                    selected: true,
                    x: 120,
                    y: 240,
                    width: 500,
                    height: 316,
                    zIndex: 4,
                    tag: "focus"
                )
            ],
            selectedNodeIDs: [nodeID],
            focusedNodeID: nodeID,
            viewport: HudVantageControlViewport(
                panX: 10,
                panY: 20,
                scale: 0.8,
                viewportWidth: 1200,
                viewportHeight: 800,
                worldMinX: -12.5,
                worldMinY: -25,
                worldWidth: 1500,
                worldHeight: 1000
            ),
            metrics: HudVantageControlMetrics(
                nodeCount: 1,
                selectedCount: 1,
                localPTYCount: 0,
                tmuxCount: 1,
                remoteTmuxCount: 0,
                liveSurfaceCount: 1,
                controlCommandCount: 12,
                lastCommandAction: "status",
                lastCommandDurationMS: 2.4,
                perf: HudVantagePerfSnapshot(
                    counters: HudVantagePerfCounters(["control.command": 12]),
                    timingSamples: [
                        HudVantagePerfTimingSample(
                            name: "control.status",
                            durationMS: 2.4,
                            recordedAt: Date(timeIntervalSince1970: 12)
                        )
                    ],
                    capturedAt: Date(timeIntervalSince1970: 13)
                ),
                minScale: 0.002,
                maxScale: 64
            ),
            style: HudVantageControlStyle(
                workspace: .jade,
                tagOverrides: [
                    "focus": HudVantageTerminalStyleOverride(terminalThemeID: .jadeNight),
                ],
                terminalOverrides: [
                    nodeID.uuidString: HudVantageTerminalStyleOverride(terminalFontSize: 14),
                ]
            ),
            tmuxHealth: [
                HudVantageTmuxHealth(
                    nodeID: nodeID,
                    target: "hudson-lab:agents-codex-0007",
                    graphitePath: "hudson.lab.agents.codex.0007.worker",
                    status: "running",
                    session: "hudson-lab",
                    window: "agents-codex-0007",
                    activeWindow: "agents-codex-0007",
                    attachedClients: 1,
                    paneCount: 1,
                    message: "tmux target is available"
                ),
            ],
            commandPath: "/tmp/scout-vantage-control.jsonl",
            responsePath: "/tmp/scout-vantage-control.responses.jsonl",
            statePath: "/tmp/scout-vantage-state.json",
            tmuxPath: "/opt/homebrew/bin/tmux",
            tmuxInstallInProgress: false,
            requiresPermission: true,
            installerCommand: "/opt/homebrew/bin/brew install tmux",
            durationMS: 3.2
        )

        let data = try JSONEncoder().encode(response)
        let object = try XCTUnwrap(
            JSONSerialization.jsonObject(with: data) as? [String: Any]
        )

        XCTAssertEqual(object["apiVersion"] as? String, "v0")
        XCTAssertEqual(object["kind"] as? String, "hudson.vantage.response")
        XCTAssertEqual(object["ok"] as? Bool, true)
        XCTAssertEqual(object["workspaceID"] as? String, "scout-lab")
        XCTAssertEqual(object["nodeCount"] as? Int, 1)
        XCTAssertEqual(object["statePath"] as? String, "/tmp/scout-vantage-state.json")
        XCTAssertEqual(object["tmuxPath"] as? String, "/opt/homebrew/bin/tmux")
        XCTAssertEqual(object["requiresPermission"] as? Bool, true)
        XCTAssertEqual(object["durationMS"] as? Double, 3.2)
        let nodes = try XCTUnwrap(object["nodes"] as? [[String: Any]])
        XCTAssertEqual(nodes.first?["runtimeKind"] as? String, "tmux")
        XCTAssertEqual(nodes.first?["subtitle"] as? String, "tmux · hudson-lab:agents-codex-0007")
        XCTAssertEqual(nodes.first?["selected"] as? Bool, true)
        XCTAssertEqual(nodes.first?["tag"] as? String, "focus")

        let selectedNodeIDs = try XCTUnwrap(object["selectedNodeIDs"] as? [String])
        XCTAssertEqual(selectedNodeIDs, [nodeID.uuidString])
        XCTAssertEqual(object["focusedNodeID"] as? String, nodeID.uuidString)
        let viewport = try XCTUnwrap(object["viewport"] as? [String: Any])
        XCTAssertEqual(viewport["scale"] as? Double, 0.8)
        let metrics = try XCTUnwrap(object["metrics"] as? [String: Any])
        XCTAssertEqual(metrics["tmuxCount"] as? Int, 1)
        XCTAssertEqual(metrics["controlCommandCount"] as? Int, 12)
        let perf = try XCTUnwrap(metrics["perf"] as? [String: Any])
        let counters = try XCTUnwrap(perf["counters"] as? [String: Any])
        XCTAssertEqual(counters["control.command"] as? Int, 12)
        let style = try XCTUnwrap(object["style"] as? [String: Any])
        let workspaceStyle = try XCTUnwrap(style["workspace"] as? [String: Any])
        XCTAssertEqual(workspaceStyle["id"] as? String, "jade")
        let tagOverrides = try XCTUnwrap(style["tagOverrides"] as? [String: Any])
        let focusOverride = try XCTUnwrap(tagOverrides["focus"] as? [String: Any])
        XCTAssertEqual(focusOverride["terminalThemeID"] as? String, "jadeNight")
        let terminalOverrides = try XCTUnwrap(style["terminalOverrides"] as? [String: Any])
        let nodeOverride = try XCTUnwrap(terminalOverrides[nodeID.uuidString] as? [String: Any])
        XCTAssertEqual(nodeOverride["terminalFontSize"] as? Int, 14)
        let health = try XCTUnwrap(object["tmuxHealth"] as? [[String: Any]])
        XCTAssertEqual(health.first?["status"] as? String, "running")
        XCTAssertEqual(health.first?["session"] as? String, "hudson-lab")
    }

    func testControlResponseOmitsNilOptionalPayloads() throws {
        let response = HudVantageControlResponse(
            id: "flags",
            action: "status",
            ok: true,
            message: "ok",
            errorCode: "node_not_found",
            nodeCount: 0,
            nodes: nil,
            selectedNodeIDs: [],
            viewport: nil,
            metrics: nil,
            durationMS: 1.5
        )

        let data = try JSONEncoder().encode(response)
        let object = try XCTUnwrap(
            JSONSerialization.jsonObject(with: data) as? [String: Any]
        )

        XCTAssertEqual(object["apiVersion"] as? String, "v0")
        XCTAssertEqual(object["kind"] as? String, "hudson.vantage.response")
        XCTAssertEqual(object["errorCode"] as? String, "node_not_found")
        XCTAssertFalse(object.keys.contains("nodes"))
        XCTAssertFalse(object.keys.contains("viewport"))
        XCTAssertFalse(object.keys.contains("metrics"))
    }

    func testVantageCtlEmitsV0MetricsCommand() throws {
        let command = try queuedCommandFromScript(
            relativeScriptPath: "packages/native/apple/HudsonKit/Scripts/vantagectl.sh",
            arguments: ["metrics"]
        )

        XCTAssertEqual(command["id"] as? String, "test-request")
        XCTAssertEqual(command["action"] as? String, "metrics")
        XCTAssertEqual(command["apiVersion"] as? String, "v0")
        XCTAssertEqual(command["kind"] as? String, "hudson.vantage.command")
        XCTAssertEqual(command["includeMetrics"] as? Bool, true)
        XCTAssertEqual(command["includeViewport"] as? Bool, true)
    }

    func testVantageCtlEmitsV0SelectCommandWithNodeIDs() throws {
        let command = try queuedCommandFromScript(
            relativeScriptPath: "packages/native/apple/HudsonKit/Scripts/vantagectl.sh",
            arguments: ["select", "node-a", "node-b", "--toggle"]
        )

        XCTAssertEqual(command["action"] as? String, "select")
        XCTAssertEqual(command["apiVersion"] as? String, "v0")
        XCTAssertEqual(command["selectionMode"] as? String, "toggle")
        XCTAssertEqual(command["nodeIDs"] as? [String], ["node-a", "node-b"])
    }

    func testCanvasCtlEmitsV0FocusAndCloseCommands() throws {
        let focus = try queuedCommandFromScript(
            relativeScriptPath: "examples/termini-canvas/scripts/canvasctl.sh",
            arguments: ["focus", "node-a"]
        )
        let close = try queuedCommandFromScript(
            relativeScriptPath: "examples/termini-canvas/scripts/canvasctl.sh",
            arguments: ["close", "node-a"]
        )

        XCTAssertEqual(focus["action"] as? String, "focus")
        XCTAssertEqual(focus["apiVersion"] as? String, "v0")
        XCTAssertEqual(focus["kind"] as? String, "hudson.vantage.command")
        XCTAssertEqual(focus["nodeIDs"] as? [String], ["node-a"])

        XCTAssertEqual(close["action"] as? String, "close")
        XCTAssertEqual(close["apiVersion"] as? String, "v0")
        XCTAssertEqual(close["kind"] as? String, "hudson.vantage.command")
        XCTAssertEqual(close["nodeIDs"] as? [String], ["node-a"])
    }

    func testControlScriptsEmitViewportCommands() throws {
        for scriptPath in [
            "packages/native/apple/HudsonKit/Scripts/vantagectl.sh",
            "examples/termini-canvas/scripts/canvasctl.sh",
        ] {
            let command = try queuedCommandFromScript(
                relativeScriptPath: scriptPath,
                arguments: [
                    "viewport",
                    "--fit",
                    "--pan-x", "-120.5",
                    "--pan-y", "44",
                    "--scale", "0.25",
                ]
            )

            XCTAssertEqual(command["id"] as? String, "test-request")
            XCTAssertEqual(command["action"] as? String, "viewport")
            XCTAssertEqual(command["apiVersion"] as? String, "v0")
            XCTAssertEqual(command["kind"] as? String, "hudson.vantage.command")
            XCTAssertEqual(command["fit"] as? Bool, true)
            XCTAssertEqual(try XCTUnwrap(command["panX"] as? NSNumber).doubleValue, -120.5, accuracy: 0.001)
            XCTAssertEqual(try XCTUnwrap(command["panY"] as? NSNumber).doubleValue, 44, accuracy: 0.001)
            XCTAssertEqual(try XCTUnwrap(command["scale"] as? NSNumber).doubleValue, 0.25, accuracy: 0.001)
        }
    }

    func testControlScriptsEmitStyleAndTmuxHealthCommands() throws {
        for scriptPath in [
            "packages/native/apple/HudsonKit/Scripts/vantagectl.sh",
            "examples/termini-canvas/scripts/canvasctl.sh",
        ] {
            let style = try queuedCommandFromScript(
                relativeScriptPath: scriptPath,
                arguments: [
                    "style",
                    "--scope", "workspace",
                    "--preset", "jade",
                    "--terminal-theme", "hudson-paper",
                    "--font-size", "14.5",
                    "--grid-mode", "dots",
                    "--focus-padding", "20",
                ]
            )

            XCTAssertEqual(style["id"] as? String, "test-request")
            XCTAssertEqual(style["action"] as? String, "style")
            XCTAssertEqual(style["apiVersion"] as? String, "v0")
            XCTAssertEqual(style["kind"] as? String, "hudson.vantage.command")
            XCTAssertEqual(style["includeStyle"] as? Bool, true)
            XCTAssertEqual(style["styleScope"] as? String, "workspace")
            XCTAssertEqual(style["stylePreset"] as? String, "jade")
            XCTAssertEqual(style["terminalTheme"] as? String, "hudson-paper")
            XCTAssertEqual(try XCTUnwrap(style["terminalFontSize"] as? NSNumber).doubleValue, 14.5, accuracy: 0.001)
            XCTAssertEqual(style["canvasGridMode"] as? String, "dots")
            XCTAssertEqual(style["focusPadding"] as? Int, 20)

            let health = try queuedCommandFromScript(
                relativeScriptPath: scriptPath,
                arguments: [
                    "tmux-health",
                    "--session", "hudson-lab",
                    "--remote", "devbox",
                ]
            )

            XCTAssertEqual(health["id"] as? String, "test-request")
            XCTAssertEqual(health["action"] as? String, "tmux-health")
            XCTAssertEqual(health["apiVersion"] as? String, "v0")
            XCTAssertEqual(health["kind"] as? String, "hudson.vantage.command")
            XCTAssertEqual(health["sessions"] as? [String], ["hudson-lab"])
            XCTAssertEqual(health["remoteHost"] as? String, "devbox")
        }
    }

    private func queuedCommandFromScript(
        relativeScriptPath: String,
        arguments: [String]
    ) throws -> [String: Any] {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer {
            try? FileManager.default.removeItem(at: directory)
        }

        let commandURL = directory.appendingPathComponent("control.jsonl")
        let responseURL = directory.appendingPathComponent("responses.jsonl")
        let scriptURL = try repoRootURL().appendingPathComponent(relativeScriptPath)

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/bash")
        process.arguments = [
            scriptURL.path,
            "--control-file", commandURL.path,
            "--response-file", responseURL.path,
            "--id", "test-request",
        ] + arguments

        let output = Pipe()
        process.standardOutput = output
        process.standardError = output
        try process.run()
        process.waitUntilExit()

        let data = output.fileHandleForReading.readDataToEndOfFile()
        let processOutput = String(data: data, encoding: .utf8) ?? ""
        XCTAssertEqual(
            process.terminationStatus,
            0,
            "script failed with output: \(processOutput)"
        )

        let text = try String(contentsOf: commandURL, encoding: .utf8)
        let line = try XCTUnwrap(text.split(separator: "\n").last)
        let jsonData = Data(line.utf8)
        return try XCTUnwrap(
            JSONSerialization.jsonObject(with: jsonData) as? [String: Any]
        )
    }

    private func repoRootURL() throws -> URL {
        var url = URL(fileURLWithPath: #filePath)
        while url.path != "/" {
            let candidate = url.appendingPathComponent(
                "packages/native/apple/HudsonKit/Scripts/vantagectl.sh"
            )
            if FileManager.default.fileExists(atPath: candidate.path) {
                return url
            }
            url.deleteLastPathComponent()
        }
        throw CocoaError(.fileNoSuchFile)
    }
}
