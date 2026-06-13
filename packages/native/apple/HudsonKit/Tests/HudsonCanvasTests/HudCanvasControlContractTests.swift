import XCTest
@testable import HudsonCanvasSurface

final class HudCanvasControlContractTests: XCTestCase {
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

        let api = HudCanvasControlAPI(commandURL: commandURL, responseURL: responseURL)
        let expectation = expectation(description: "queued command handled")

        await MainActor.run {
            api.start { command in
                if command.id == "queued-before-start" {
                    expectation.fulfill()
                }

                return HudCanvasControlResponse(
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
          "kind": "hudson.canvas.command",
          "id": "restore-1",
          "action": "restore",
          "workspaceID": "scout-lab",
          "statePath": "/tmp/scout-canvas-state.json",
          "createIfMissing": true
        }
        """

        let command = try JSONDecoder().decode(
            HudCanvasControlCommand.self,
            from: Data(json.utf8)
        )

        XCTAssertEqual(command.id, "restore-1")
        XCTAssertEqual(command.resolvedAPIVersion, "v0")
        XCTAssertEqual(command.kind, "hudson.canvas.command")
        XCTAssertEqual(command.normalizedAction, "restore")
        XCTAssertEqual(command.workspaceID, "scout-lab")
        XCTAssertEqual(command.statePath, "/tmp/scout-canvas-state.json")
        XCTAssertEqual(command.createIfMissing, true)
    }

    func testControlCommandDecodesV0NodeSelectorsAndIncludeFlags() throws {
        let json = """
        {
          "version": "v0",
          "kind": "hudson.canvas.command",
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
            HudCanvasControlCommand.self,
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
            HudCanvasControlCommand.self,
            from: Data(json.utf8)
        )

        XCTAssertEqual(command.normalizedAction, "ensure-tmux")
        XCTAssertEqual(command.installer, "homebrew")
        XCTAssertEqual(command.confirmInstall, true)
    }

    func testControlCommandDecodesRemoteTmuxHealthProbeOptions() throws {
        let json = """
        {
          "apiVersion": "v0",
          "kind": "hudson.canvas.command",
          "id": "remote-health-1",
          "action": "tmux-health",
          "remoteHost": "devbox",
          "sessions": ["hudson-lab"],
          "probeRemote": false,
          "timeoutMS": 750
        }
        """

        let command = try JSONDecoder().decode(
            HudCanvasControlCommand.self,
            from: Data(json.utf8)
        )

        XCTAssertEqual(command.normalizedAction, "tmux-health")
        XCTAssertEqual(command.remoteHost, "devbox")
        XCTAssertEqual(command.sessions, ["hudson-lab"])
        XCTAssertEqual(command.probeRemote, false)
        XCTAssertEqual(command.timeoutMS, 750)
    }

    func testControlCommandDecodesStyleFields() throws {
        let json = """
        {
          "apiVersion": "v0",
          "kind": "hudson.canvas.command",
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
            HudCanvasControlCommand.self,
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

    func testControlCommandDecodesSetupManifestFields() throws {
        let nodeID = UUID()
        let json = """
        {
          "apiVersion": "v0",
          "kind": "hudson.canvas.command",
          "id": "setup-1",
          "action": "setup",
          "manifestPath": "/tmp/scout.canvas.setup.json",
          "createIfMissing": true,
          "removeMissing": true,
          "setup": {
            "kind": "hudson.canvas.setup",
            "schemaVersion": 1,
            "workspaceID": "scout-lab",
            "handoffId": "handoff-1779250564641-425a5e93",
            "handoffPath": "/tmp/openscout/canvas/handoff.json",
            "setupPath": "/tmp/openscout/canvas/handoff.setup.json",
            "presentation": {
              "title": "Scout Canvas",
              "subtitle": "native operating surface",
              "badge": "project",
              "cobrand": "powered by Hudson",
              "theme": "jade"
            },
            "style": {
              "preset": "jade",
              "terminalTheme": "hudson-paper"
            },
            "viewport": {
              "fit": true,
              "scale": 0.75
            },
            "nodes": [
              {
                "id": "hudson.scout.agents.codex.0001.worker",
                "nodeID": "\(nodeID.uuidString)",
                "runtimeKind": "tmux",
                "target": "hudson-scout:agents-codex-0001",
                "tag": "focus",
                "x": 80,
                "y": 96,
                "width": 520,
                "height": 320
              }
            ],
            "selection": ["hudson.scout.agents.codex.0001.worker"],
            "focused": "hudson.scout.agents.codex.0001.worker"
          }
        }
        """

        let command = try JSONDecoder().decode(
            HudCanvasControlCommand.self,
            from: Data(json.utf8)
        )

        XCTAssertEqual(command.normalizedAction, "setup")
        XCTAssertEqual(command.manifestPath, "/tmp/scout.canvas.setup.json")
        XCTAssertEqual(command.createIfMissing, true)
        XCTAssertEqual(command.removeMissing, true)
        let manifest = try XCTUnwrap(command.setupManifest)
        XCTAssertEqual(manifest.workspaceID, "scout-lab")
        XCTAssertEqual(manifest.handoffId, "handoff-1779250564641-425a5e93")
        XCTAssertEqual(manifest.handoffPath, "/tmp/openscout/canvas/handoff.json")
        XCTAssertEqual(manifest.setupPath, "/tmp/openscout/canvas/handoff.setup.json")
        XCTAssertEqual(manifest.presentation?.title, "Scout Canvas")
        XCTAssertEqual(manifest.presentation?.cobrand, "powered by Hudson")
        XCTAssertEqual(manifest.presentation?.theme, "jade")
        XCTAssertEqual(manifest.style?.preset, "jade")
        XCTAssertEqual(manifest.viewport?.fit, true)
        XCTAssertEqual(manifest.nodes.first?.id, "hudson.scout.agents.codex.0001.worker")
        XCTAssertEqual(manifest.nodes.first?.nodeID, nodeID)
        XCTAssertEqual(manifest.nodes.first?.target, "hudson-scout:agents-codex-0001")
        XCTAssertEqual(manifest.selection, ["hudson.scout.agents.codex.0001.worker"])
        XCTAssertEqual(manifest.focused, "hudson.scout.agents.codex.0001.worker")
    }

    func testSetupManifestDecodesDocumentArtifactNodes() throws {
        let json = """
        {
          "kind": "hudson.canvas.setup",
          "schemaVersion": 1,
          "workspaceID": "canvas-practice",
          "nodes": [
            {
              "id": "hudson.canvas.files.surface",
              "runtimeKind": "file",
              "path": "packages/native/apple/HudsonKit/Sources/HudsonCanvasSurface/HudCanvasSurface.swift",
              "language": "swift",
              "role": "source"
            },
            {
              "id": "hudson.canvas.plan.practice",
              "runtime": {
                "kind": "plan",
                "path": "apps/hudson/fixtures/canvas-practice/PLAN.md",
                "language": "markdown",
                "role": "plan"
              },
              "title": "Practice Plan"
            },
            {
              "id": "hudson.canvas.diff.running",
              "runtimeKind": "diff",
              "content": "diff --git a/file b/file",
              "language": "diff",
              "role": "review"
            }
          ],
          "selection": ["hudson.canvas.plan.practice"],
          "focused": "hudson.canvas.plan.practice"
        }
        """

        let manifest = try JSONDecoder().decode(
            HudCanvasSetupManifest.self,
            from: Data(json.utf8)
        )

        XCTAssertEqual(manifest.workspaceID, "canvas-practice")
        XCTAssertEqual(manifest.nodes.count, 3)
        XCTAssertEqual(manifest.nodes[0].runtimeKind, "file")
        XCTAssertEqual(manifest.nodes[0].path, "packages/native/apple/HudsonKit/Sources/HudsonCanvasSurface/HudCanvasSurface.swift")
        XCTAssertEqual(manifest.nodes[0].language, "swift")
        XCTAssertEqual(manifest.nodes[0].role, "source")
        XCTAssertEqual(manifest.nodes[1].runtime?.kind, "plan")
        XCTAssertEqual(manifest.nodes[1].runtime?.path, "apps/hudson/fixtures/canvas-practice/PLAN.md")
        XCTAssertEqual(manifest.nodes[1].runtime?.language, "markdown")
        XCTAssertEqual(manifest.nodes[1].runtime?.role, "plan")
        XCTAssertEqual(manifest.nodes[2].runtimeKind, "diff")
        XCTAssertEqual(manifest.nodes[2].content, "diff --git a/file b/file")
        XCTAssertEqual(manifest.selection, ["hudson.canvas.plan.practice"])
        XCTAssertEqual(manifest.focused, "hudson.canvas.plan.practice")
    }

    func testControlCommandDecodesViewportReplayFields() throws {
        let json = """
        {
          "apiVersion": "v0",
          "kind": "hudson.canvas.command",
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
            HudCanvasControlCommand.self,
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
          "kind": "hudson.canvas.command",
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
            HudCanvasControlCommand.self,
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
        let snapshot = HudCanvasWorkspaceSnapshot(
            workspaceID: "scout-lab",
            surfaceTitle: "Scout Canvas",
            viewport: HudCanvasViewportSnapshot(panX: 12, panY: -40, scale: 0.75),
            layout: HudCanvasSurfaceLayoutSnapshot(
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
                    "focus": HudCanvasTerminalStyleOverride(
                        terminalThemeID: .jadeNight,
                        terminalFontSize: 13.5
                    )
                ]
            ),
            nodes: [
                HudCanvasNodeSnapshot(
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
                    style: HudCanvasTerminalStyleOverride(
                        terminalThemeID: .hudsonPaper,
                        terminalFontFamily: "Menlo"
                    ),
                    runtime: HudCanvasRuntimeReference(
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
                HudCanvasWorkspaceGroupSnapshot(
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
        let decoded = try decoder.decode(HudCanvasWorkspaceSnapshot.self, from: data)

        XCTAssertEqual(decoded.kind, HudCanvasWorkspaceSnapshot.documentKind)
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

    func testWorkspaceSnapshotRoundTripsDocumentArtifactNode() throws {
        let nodeID = UUID()
        let snapshot = HudCanvasWorkspaceSnapshot(
            workspaceID: "canvas-practice",
            surfaceTitle: "Canvas Practice",
            viewport: HudCanvasViewportSnapshot(panX: 0, panY: 0, scale: 1),
            nodes: [
                HudCanvasNodeSnapshot(
                    id: nodeID,
                    externalID: "hudson.canvas.diff.running",
                    title: "Running Diff",
                    subtitle: "review surface placeholder",
                    tint: "teal",
                    x: 700,
                    y: 480,
                    width: 580,
                    height: 360,
                    zIndex: 6,
                    tag: "watch",
                    runtime: HudCanvasRuntimeReference(
                        kind: "diff",
                        path: "apps/hudson/fixtures/canvas-practice/RUNNING.diff",
                        language: "diff",
                        content: "diff --git a/file b/file",
                        role: "review"
                    )
                )
            ],
            selectedNodeIDs: [nodeID]
        )

        let data = try JSONEncoder().encode(snapshot)
        let decoded = try JSONDecoder().decode(HudCanvasWorkspaceSnapshot.self, from: data)

        XCTAssertEqual(decoded.nodes.first?.externalID, "hudson.canvas.diff.running")
        XCTAssertEqual(decoded.nodes.first?.runtime.kind, "diff")
        XCTAssertEqual(decoded.nodes.first?.runtime.path, "apps/hudson/fixtures/canvas-practice/RUNNING.diff")
        XCTAssertEqual(decoded.nodes.first?.runtime.language, "diff")
        XCTAssertEqual(decoded.nodes.first?.runtime.content, "diff --git a/file b/file")
        XCTAssertEqual(decoded.nodes.first?.runtime.role, "review")
    }

    func testWorkspaceSnapshotDecodesWithoutLayoutForV0Compatibility() throws {
        let nodeID = UUID()
        let json = """
        {
          "schemaVersion": 1,
          "workspaceID": "legacy-lab",
          "surfaceTitle": "Legacy Canvas",
          "viewport": { "panX": 0, "panY": 0, "scale": 1 },
          "nodes": [],
          "selectedNodeIDs": ["\(nodeID.uuidString)"],
          "savedAt": "2026-05-07T00:00:00Z"
        }
        """

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let snapshot = try decoder.decode(HudCanvasWorkspaceSnapshot.self, from: Data(json.utf8))

        XCTAssertEqual(snapshot.kind, HudCanvasWorkspaceSnapshot.documentKind)
        XCTAssertEqual(snapshot.workspaceID, "legacy-lab")
        XCTAssertNil(snapshot.layout)
        XCTAssertEqual(snapshot.selectedNodeIDs, [nodeID])
        XCTAssertNil(snapshot.focusedNodeID)
        XCTAssertEqual(snapshot.groups, [])
    }

    func testControlResponseCanReturnStructuredNodeSummaries() throws {
        let nodeID = UUID()
        let response = HudCanvasControlResponse(
            id: "status-1",
            action: "status",
            ok: true,
            message: "1 terminals",
            errorCode: nil,
            workspaceID: "scout-lab",
            handoffId: "handoff-1779250564641-425a5e93",
            nodeCount: 1,
            nodes: [
                HudCanvasControlNode(
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
            viewport: HudCanvasControlViewport(
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
            metrics: HudCanvasControlMetrics(
                nodeCount: 1,
                selectedCount: 1,
                localPTYCount: 0,
                tmuxCount: 1,
                remoteTmuxCount: 0,
                liveSurfaceCount: 1,
                controlCommandCount: 12,
                lastCommandAction: "status",
                lastCommandDurationMS: 2.4,
                perf: HudCanvasPerfSnapshot(
                    counters: HudCanvasPerfCounters(["control.command": 12]),
                    timingSamples: [
                        HudCanvasPerfTimingSample(
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
            style: HudCanvasControlStyle(
                workspace: .jade,
                tagOverrides: [
                    "focus": HudCanvasTerminalStyleOverride(terminalThemeID: .jadeNight),
                ],
                terminalOverrides: [
                    nodeID.uuidString: HudCanvasTerminalStyleOverride(terminalFontSize: 14),
                ]
            ),
            tmuxHealth: [
                HudCanvasTmuxHealth(
                    nodeID: nodeID,
                    target: "hudson-lab:agents-codex-0007",
                    graphitePath: "hudson.lab.agents.codex.0007.worker",
                    status: "ready",
                    session: "hudson-lab",
                    window: "agents-codex-0007",
                    activeWindow: "agents-codex-0007",
                    attachedClients: 1,
                    paneCount: 1,
                    message: "tmux target is available"
                ),
            ],
            setup: HudCanvasSetupReport(
                workspaceID: "scout-lab",
                presentation: HudCanvasSetupPresentation(
                    title: "Scout Canvas",
                    cobrand: "powered by Hudson",
                    theme: "jade"
                ),
                createdNodeIDs: [nodeID],
                reusedNodeIDs: [],
                updatedNodeIDs: [nodeID],
                removedNodeIDs: [],
                failedNodes: []
            ),
            commandPath: "/tmp/scout-canvas-control.jsonl",
            responsePath: "/tmp/scout-canvas-control.responses.jsonl",
            statePath: "/tmp/scout-canvas-state.json",
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
        XCTAssertEqual(object["kind"] as? String, "hudson.canvas.response")
        XCTAssertEqual(object["ok"] as? Bool, true)
        XCTAssertEqual(object["workspaceID"] as? String, "scout-lab")
        XCTAssertEqual(object["handoffId"] as? String, "handoff-1779250564641-425a5e93")
        XCTAssertEqual(object["nodeCount"] as? Int, 1)
        XCTAssertEqual(object["statePath"] as? String, "/tmp/scout-canvas-state.json")
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
        XCTAssertEqual(health.first?["status"] as? String, "ready")
        XCTAssertEqual(health.first?["session"] as? String, "hudson-lab")
        let setup = try XCTUnwrap(object["setup"] as? [String: Any])
        XCTAssertEqual(setup["workspaceID"] as? String, "scout-lab")
        let presentation = try XCTUnwrap(setup["presentation"] as? [String: Any])
        XCTAssertEqual(presentation["title"] as? String, "Scout Canvas")
        XCTAssertEqual(presentation["cobrand"] as? String, "powered by Hudson")
        XCTAssertEqual(presentation["theme"] as? String, "jade")
        XCTAssertEqual(setup["createdNodeIDs"] as? [String], [nodeID.uuidString])
    }

    func testControlResponseOmitsNilOptionalPayloads() throws {
        let response = HudCanvasControlResponse(
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
        XCTAssertEqual(object["kind"] as? String, "hudson.canvas.response")
        XCTAssertEqual(object["errorCode"] as? String, "node_not_found")
        XCTAssertFalse(object.keys.contains("nodes"))
        XCTAssertFalse(object.keys.contains("handoffId"))
        XCTAssertFalse(object.keys.contains("viewport"))
        XCTAssertFalse(object.keys.contains("metrics"))
    }

    func testCanvasCtlEmitsV0MetricsCommand() throws {
        let command = try queuedCommandFromScript(
            relativeScriptPath: "packages/native/apple/HudsonKit/Scripts/canvasctl.sh",
            arguments: ["metrics"]
        )

        XCTAssertEqual(command["id"] as? String, "test-request")
        XCTAssertEqual(command["action"] as? String, "metrics")
        XCTAssertEqual(command["apiVersion"] as? String, "v0")
        XCTAssertEqual(command["kind"] as? String, "hudson.canvas.command")
        XCTAssertEqual(command["includeMetrics"] as? Bool, true)
        XCTAssertEqual(command["includeViewport"] as? Bool, true)
    }

    func testCanvasCtlEmitsV0SelectCommandWithNodeIDs() throws {
        let command = try queuedCommandFromScript(
            relativeScriptPath: "packages/native/apple/HudsonKit/Scripts/canvasctl.sh",
            arguments: ["select", "node-a", "node-b", "--toggle"]
        )

        XCTAssertEqual(command["action"] as? String, "select")
        XCTAssertEqual(command["apiVersion"] as? String, "v0")
        XCTAssertEqual(command["selectionMode"] as? String, "toggle")
        XCTAssertEqual(command["nodeIDs"] as? [String], ["node-a", "node-b"])
    }

    func testCanvasCtlEmitsV0FocusAndCloseCommands() throws {
        let focus = try queuedCommandFromScript(
            relativeScriptPath: "apps/hudson/scripts/canvasctl.sh",
            arguments: ["focus", "node-a"]
        )
        let close = try queuedCommandFromScript(
            relativeScriptPath: "apps/hudson/scripts/canvasctl.sh",
            arguments: ["close", "node-a"]
        )

        XCTAssertEqual(focus["action"] as? String, "focus")
        XCTAssertEqual(focus["apiVersion"] as? String, "v0")
        XCTAssertEqual(focus["kind"] as? String, "hudson.canvas.command")
        XCTAssertEqual(focus["nodeIDs"] as? [String], ["node-a"])

        XCTAssertEqual(close["action"] as? String, "close")
        XCTAssertEqual(close["apiVersion"] as? String, "v0")
        XCTAssertEqual(close["kind"] as? String, "hudson.canvas.command")
        XCTAssertEqual(close["nodeIDs"] as? [String], ["node-a"])
    }

    func testControlScriptsEmitViewportCommands() throws {
        for scriptPath in [
            "packages/native/apple/HudsonKit/Scripts/canvasctl.sh",
            "apps/hudson/scripts/canvasctl.sh",
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
            XCTAssertEqual(command["kind"] as? String, "hudson.canvas.command")
            XCTAssertEqual(command["fit"] as? Bool, true)
            XCTAssertEqual(try XCTUnwrap(command["panX"] as? NSNumber).doubleValue, -120.5, accuracy: 0.001)
            XCTAssertEqual(try XCTUnwrap(command["panY"] as? NSNumber).doubleValue, 44, accuracy: 0.001)
            XCTAssertEqual(try XCTUnwrap(command["scale"] as? NSNumber).doubleValue, 0.25, accuracy: 0.001)
        }
    }

    func testControlScriptsEmitStyleAndTmuxHealthCommands() throws {
        for scriptPath in [
            "packages/native/apple/HudsonKit/Scripts/canvasctl.sh",
            "apps/hudson/scripts/canvasctl.sh",
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
            XCTAssertEqual(style["kind"] as? String, "hudson.canvas.command")
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
            XCTAssertEqual(health["kind"] as? String, "hudson.canvas.command")
            XCTAssertEqual(health["sessions"] as? [String], ["hudson-lab"])
            XCTAssertEqual(health["remoteHost"] as? String, "devbox")

            let setup = try queuedCommandFromScript(
                relativeScriptPath: scriptPath,
                arguments: [
                    "setup",
                    "--manifest", "/tmp/scout.canvas.setup.json",
                    "--create",
                    "--remove-missing",
                    "--fit",
                ]
            )

            XCTAssertEqual(setup["id"] as? String, "test-request")
            XCTAssertEqual(setup["action"] as? String, "setup")
            XCTAssertEqual(setup["apiVersion"] as? String, "v0")
            XCTAssertEqual(setup["kind"] as? String, "hudson.canvas.command")
            XCTAssertEqual(setup["manifestPath"] as? String, "/tmp/scout.canvas.setup.json")
            XCTAssertEqual(setup["createIfMissing"] as? Bool, true)
            XCTAssertEqual(setup["removeMissing"] as? Bool, true)
            XCTAssertEqual(setup["fit"] as? Bool, true)
            XCTAssertEqual(setup["includeStyle"] as? Bool, true)
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
                "packages/native/apple/HudsonKit/Scripts/canvasctl.sh"
            )
            if FileManager.default.fileExists(atPath: candidate.path) {
                return url
            }
            url.deleteLastPathComponent()
        }
        throw CocoaError(.fileNoSuchFile)
    }
}
