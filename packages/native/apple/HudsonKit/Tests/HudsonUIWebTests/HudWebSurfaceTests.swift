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

    private func expectURLSource(_ location: HudWebSurfaceLocation, equals expectedURL: URL) throws {
        let source = try #require(location.webViewSource())
        guard case .url(let url) = source else {
            Issue.record("Expected URL source")
            return
        }
        #expect(url == expectedURL)
    }
}
