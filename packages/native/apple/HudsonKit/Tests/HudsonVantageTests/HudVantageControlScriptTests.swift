import XCTest

final class HudVantageControlScriptTests: XCTestCase {
    func testScriptsEmitValidJSONForNumericOptions() throws {
        for scriptPath in controlScriptPaths {
            let command = try queuedCommandFromScript(
                relativeScriptPath: scriptPath,
                arguments: [
                    "tile", "-2", "3",
                    "--width", "320.5",
                    "--height", "2e2",
                    "--gap", "0",
                    "--origin-x", "-10.25",
                    "--origin-y", "4E+1",
                ]
            )

            XCTAssertEqual(command["action"] as? String, "tile")
            XCTAssertEqual(command["apiVersion"] as? String, "v0")
            XCTAssertEqual(command["kind"] as? String, "hudson.vantage.command")
            XCTAssertEqual(try XCTUnwrap(command["columns"] as? NSNumber).intValue, -2)
            XCTAssertEqual(try XCTUnwrap(command["rows"] as? NSNumber).intValue, 3)
            XCTAssertEqual(try XCTUnwrap(command["width"] as? NSNumber).doubleValue, 320.5, accuracy: 0.001)
            XCTAssertEqual(try XCTUnwrap(command["height"] as? NSNumber).doubleValue, 200, accuracy: 0.001)
            XCTAssertEqual(try XCTUnwrap(command["gap"] as? NSNumber).doubleValue, 0, accuracy: 0.001)
            XCTAssertEqual(try XCTUnwrap(command["originX"] as? NSNumber).doubleValue, -10.25, accuracy: 0.001)
            XCTAssertEqual(try XCTUnwrap(command["originY"] as? NSNumber).doubleValue, 40, accuracy: 0.001)
        }
    }

    func testScriptsNormalizeRawCommandsForWaitableControl() throws {
        for scriptPath in controlScriptPaths {
            let command = try queuedCommandFromScript(
                relativeScriptPath: scriptPath,
                arguments: ["raw", #"{"action":"metrics","includeNodes":false}"#]
            )

            XCTAssertEqual(command["id"] as? String, "test-request")
            XCTAssertEqual(command["action"] as? String, "metrics")
            XCTAssertEqual(command["apiVersion"] as? String, "v0")
            XCTAssertEqual(command["kind"] as? String, "hudson.vantage.command")
            XCTAssertEqual(command["includeNodes"] as? Bool, false)

            let explicitIDCommand = try queuedCommandFromScript(
                relativeScriptPath: scriptPath,
                arguments: ["raw", #"{"id":"raw-request","action":"status"}"#]
            )

            XCTAssertEqual(explicitIDCommand["id"] as? String, "raw-request")
            XCTAssertEqual(explicitIDCommand["apiVersion"] as? String, "v0")
            XCTAssertEqual(explicitIDCommand["kind"] as? String, "hudson.vantage.command")
        }
    }

    func testScriptsEmitPerfHarnessCommands() throws {
        for scriptPath in controlScriptPaths {
            let command = try queuedCommandFromScript(
                relativeScriptPath: scriptPath,
                arguments: [
                    "perf-harness",
                    "--prefix", "hudson-perf-lab",
                    "--sessions", "64",
                    "--active", "32",
                    "--mode", "tail",
                    "--rate-ms", "250",
                    "--columns", "8",
                    "--width", "300",
                    "--height", "200",
                    "--gap", "18",
                ]
            )

            XCTAssertEqual(command["action"] as? String, "perf-harness")
            XCTAssertEqual(command["apiVersion"] as? String, "v0")
            XCTAssertEqual(command["kind"] as? String, "hudson.vantage.command")
            XCTAssertEqual(command["prefix"] as? String, "hudson-perf-lab")
            XCTAssertEqual(try XCTUnwrap(command["count"] as? NSNumber).intValue, 64)
            XCTAssertEqual(try XCTUnwrap(command["activeCount"] as? NSNumber).intValue, 32)
            XCTAssertEqual(command["harnessMode"] as? String, "tail")
            XCTAssertEqual(try XCTUnwrap(command["rateMS"] as? NSNumber).doubleValue, 250, accuracy: 0.001)
            XCTAssertEqual(try XCTUnwrap(command["columns"] as? NSNumber).intValue, 8)
            XCTAssertEqual(try XCTUnwrap(command["width"] as? NSNumber).doubleValue, 300, accuracy: 0.001)
            XCTAssertEqual(try XCTUnwrap(command["height"] as? NSNumber).doubleValue, 200, accuracy: 0.001)
            XCTAssertEqual(try XCTUnwrap(command["gap"] as? NSNumber).doubleValue, 18, accuracy: 0.001)
            XCTAssertEqual(command["includeMetrics"] as? Bool, true)
            XCTAssertEqual(command["includeViewport"] as? Bool, true)

            let cleanup = try queuedCommandFromScript(
                relativeScriptPath: scriptPath,
                arguments: ["perf-cleanup", "--prefix", "hudson-perf-lab"]
            )

            XCTAssertEqual(cleanup["action"] as? String, "perf-cleanup")
            XCTAssertEqual(cleanup["prefix"] as? String, "hudson-perf-lab")
            XCTAssertEqual(cleanup["apiVersion"] as? String, "v0")
            XCTAssertEqual(cleanup["kind"] as? String, "hudson.vantage.command")
        }
    }

    func testScriptsEmitRemoteTmuxHealthOptions() throws {
        for scriptPath in controlScriptPaths {
            let command = try queuedCommandFromScript(
                relativeScriptPath: scriptPath,
                arguments: [
                    "tmux-health",
                    "--remote", "devbox",
                    "--session", "hudson-lab",
                    "--timeout-ms", "750",
                    "--no-remote-probe",
                ]
            )

            XCTAssertEqual(command["action"] as? String, "tmux-health")
            XCTAssertEqual(command["apiVersion"] as? String, "v0")
            XCTAssertEqual(command["kind"] as? String, "hudson.vantage.command")
            XCTAssertEqual(command["remoteHost"] as? String, "devbox")
            XCTAssertEqual(command["sessions"] as? [String], ["hudson-lab"])
            XCTAssertEqual(command["probeRemote"] as? Bool, false)
            XCTAssertEqual(try XCTUnwrap(command["timeoutMS"] as? NSNumber).doubleValue, 750, accuracy: 0.001)
        }
    }

    func testScriptsEmitFocusAndPopOutCommands() throws {
        for scriptPath in controlScriptPaths {
            let focus = try queuedCommandFromScript(
                relativeScriptPath: scriptPath,
                arguments: ["focus-mode", "term-1"]
            )

            XCTAssertEqual(focus["action"] as? String, "focus-mode")
            XCTAssertEqual(focus["apiVersion"] as? String, "v0")
            XCTAssertEqual(focus["kind"] as? String, "hudson.vantage.command")
            XCTAssertEqual(focus["nodeIDs"] as? [String], ["term-1"])

            let popOut = try queuedCommandFromScript(
                relativeScriptPath: scriptPath,
                arguments: ["popout", "term-1", "term-2"]
            )

            XCTAssertEqual(popOut["action"] as? String, "popout")
            XCTAssertEqual(popOut["nodeIDs"] as? [String], ["term-1", "term-2"])
            XCTAssertEqual(popOut["apiVersion"] as? String, "v0")
            XCTAssertEqual(popOut["kind"] as? String, "hudson.vantage.command")

            let exitFocus = try queuedCommandFromScript(
                relativeScriptPath: scriptPath,
                arguments: ["exit-focus"]
            )

            XCTAssertEqual(exitFocus["action"] as? String, "exit-focus")
            XCTAssertEqual(exitFocus["apiVersion"] as? String, "v0")
            XCTAssertEqual(exitFocus["kind"] as? String, "hudson.vantage.command")
        }
    }

    func testScriptsEmitWorkspaceDocumentAliases() throws {
        for scriptPath in controlScriptPaths {
            let save = try queuedCommandFromScript(
                relativeScriptPath: scriptPath,
                arguments: ["save-workspace", "--state-file", "/tmp/project.vantage.json"]
            )

            XCTAssertEqual(save["action"] as? String, "save-workspace")
            XCTAssertEqual(save["apiVersion"] as? String, "v0")
            XCTAssertEqual(save["kind"] as? String, "hudson.vantage.command")
            XCTAssertEqual(save["statePath"] as? String, "/tmp/project.vantage.json")

            let restore = try queuedCommandFromScript(
                relativeScriptPath: scriptPath,
                arguments: [
                    "restore-workspace",
                    "--state-file", "/tmp/project.vantage.json",
                    "--create",
                    "--no-reset",
                ]
            )

            XCTAssertEqual(restore["action"] as? String, "restore-workspace")
            XCTAssertEqual(restore["apiVersion"] as? String, "v0")
            XCTAssertEqual(restore["kind"] as? String, "hudson.vantage.command")
            XCTAssertEqual(restore["statePath"] as? String, "/tmp/project.vantage.json")
            XCTAssertEqual(restore["createIfMissing"] as? Bool, true)
            XCTAssertEqual(restore["reset"] as? Bool, false)
        }
    }

    func testScriptsRejectNumericJSONInjection() throws {
        let invalidCases: [(arguments: [String], message: String)] = [
            (["tile", "2", "2", "--width", #"240,"kind":"bad""#], "invalid width"),
            (["spawn", #"1,"kind":"bad""#], "invalid count"),
            (["raw", #""not-an-object""#], "invalid raw command"),
        ]

        for scriptPath in controlScriptPaths {
            for invalidCase in invalidCases {
                let result = try runScript(
                    relativeScriptPath: scriptPath,
                    arguments: invalidCase.arguments
                )

                XCTAssertEqual(result.terminationStatus, 64)
                XCTAssertTrue(
                    result.output.contains(invalidCase.message),
                    "expected \(invalidCase.message) in output: \(result.output)"
                )
                XCTAssertTrue((result.commandText ?? "").isEmpty)
            }
        }
    }

    private var controlScriptPaths: [String] {
        [
            "packages/native/apple/HudsonKit/Scripts/vantagectl.sh",
            "apps/vantage/scripts/vantagectl.sh",
        ]
    }

    private func queuedCommandFromScript(
        relativeScriptPath: String,
        arguments: [String],
        file: StaticString = #filePath,
        line: UInt = #line
    ) throws -> [String: Any] {
        let result = try runScript(relativeScriptPath: relativeScriptPath, arguments: arguments)
        XCTAssertEqual(result.terminationStatus, 0, result.output, file: file, line: line)

        let text = try XCTUnwrap(result.commandText, file: file, line: line)
        let jsonLine = try XCTUnwrap(text.split(separator: "\n").last, file: file, line: line)
        let jsonData = Data(jsonLine.utf8)
        return try XCTUnwrap(
            JSONSerialization.jsonObject(with: jsonData) as? [String: Any],
            file: file,
            line: line
        )
    }

    private func runScript(
        relativeScriptPath: String,
        arguments: [String]
    ) throws -> ScriptResult {
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

        let outputData = output.fileHandleForReading.readDataToEndOfFile()
        let outputText = String(data: outputData, encoding: .utf8) ?? ""
        let commandText = FileManager.default.fileExists(atPath: commandURL.path)
            ? try String(contentsOf: commandURL, encoding: .utf8)
            : nil

        return ScriptResult(
            terminationStatus: process.terminationStatus,
            output: outputText,
            commandText: commandText
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

    private struct ScriptResult {
        var terminationStatus: Int32
        var output: String
        var commandText: String?
    }
}
