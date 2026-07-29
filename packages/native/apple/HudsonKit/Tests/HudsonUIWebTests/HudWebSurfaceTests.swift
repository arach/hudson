import Foundation
import Testing
@testable import HudsonUIWeb

@Suite("HudWebSurface")
struct HudWebSurfaceTests {

    @Test("locations expose their loading policy")
    func loadingPolicies() throws {
        let pairedURL = try #require(URL(string: "http://hudson.local:3500/native/surfaces/code-editor"))
        let hostedURL = try #require(URL(string: "https://hudson.example/embed/hudson/docs"))

        #expect(HudWebSurfaceLocation.bundled(directory: "HudsonWebSurfaces/code-editor").loadingPolicy == .bundled)
        #expect(HudWebSurfaceLocation.paired(pairedURL).loadingPolicy == .paired)
        #expect(HudWebSurfaceLocation.hosted(hostedURL).loadingPolicy == .hosted)
    }

    @Test("remote locations resolve directly to URL web view sources")
    func remoteLocationsResolveToURLSources() throws {
        let pairedURL = try #require(URL(string: "http://hudson.local:3500/native/surfaces/observe"))
        let hostedURL = try #require(URL(string: "https://hudson.example/embed/hudson/voice"))

        try expectURLSource(HudWebSurfaceLocation.paired(pairedURL), equals: pairedURL)
        try expectURLSource(HudWebSurfaceLocation.hosted(hostedURL), equals: hostedURL)
    }

    @Test("descriptors keep identity separate from loading policy")
    func descriptorIdentityIsStable() throws {
        let pairedURL = try #require(URL(string: "http://hudson.local:3500/native/surfaces/code-editor"))
        let descriptor = HudWebSurfaceDescriptor(
            id: "code-editor",
            title: "Code Editor",
            location: .paired(pairedURL),
            lifecycle: .keepWarm
        )

        #expect(descriptor.id == "code-editor")
        #expect(descriptor.title == "Code Editor")
        #expect(descriptor.loadingPolicy == .paired)
        #expect(descriptor.lifecycle == .keepWarm)
    }

    @Test("missing bundled resources do not produce a web view source")
    func missingBundledResourceIsNil() {
        let location = HudWebSurfaceLocation.bundled(directory: "MissingHudsonSurface")

        #expect(location.webViewSource() == nil)
    }

    @Test("bundled resources preserve an explicit shared read-access root")
    func bundledResourceUsesFileSource() throws {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("HudWebSurfaceTests-\(UUID().uuidString).bundle", isDirectory: true)
        let resources = root.appendingPathComponent("Contents/Resources", isDirectory: true)
        let shared = resources.appendingPathComponent("WebSurfaces/shared", isDirectory: true)
        let lanes = resources.appendingPathComponent("WebSurfaces/lanes", isDirectory: true)
        try FileManager.default.createDirectory(at: shared, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: lanes, withIntermediateDirectories: true)
        try "<html></html>".write(to: lanes.appendingPathComponent("index.html"), atomically: true, encoding: .utf8)
        try "window.test = true".write(to: shared.appendingPathComponent("app.js"), atomically: true, encoding: .utf8)
        try """
        <?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
        <plist version="1.0"><dict><key>CFBundleIdentifier</key><string>dev.hudson.web-tests</string></dict></plist>
        """.write(to: root.appendingPathComponent("Contents/Info.plist"), atomically: true, encoding: .utf8)
        defer { try? FileManager.default.removeItem(at: root) }

        let bundle = try #require(Bundle(url: root))
        let location = HudWebSurfaceLocation.bundled(
            directory: "WebSurfaces/lanes",
            readAccessDirectory: "WebSurfaces"
        )
        let source = try #require(location.webViewSource(in: bundle))
        guard case .file(let index, let readAccessRoot) = source else {
            Issue.record("Expected bundled content to use loadFileURL source semantics")
            return
        }
        #expect(index.lastPathComponent == "index.html")
        #expect(readAccessRoot.lastPathComponent == "WebSurfaces")
    }

    @Test("bundled resources reject parent-directory read roots")
    func bundledResourceRejectsEscape() throws {
        let location = HudWebSurfaceLocation.bundled(
            directory: "WebSurfaces/lanes",
            readAccessDirectory: "../Private"
        )
        #expect(location.bundledReadAccessURL() == nil)
    }

    private func expectURLSource(_ location: HudWebSurfaceLocation, equals expectedURL: URL) throws {
        let source = try #require(location.webViewSource())
        guard case .url(let url) = source else {
            Issue.record("Expected URL source")
            return
        }
        #expect(url == expectedURL)
    }
}
