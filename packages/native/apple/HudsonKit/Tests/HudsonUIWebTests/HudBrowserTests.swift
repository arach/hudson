import Foundation
import Testing
@testable import HudsonUIWeb

@Suite("HudBrowser")
@MainActor
struct HudBrowserTests {
    @Test("open loads browser content")
    func openLoadsBrowserContent() async throws {
        let browser = HudBrowser(
            policy: HudBrowserPolicy(allowedSchemes: ["data"])
        )
        let html = "<html><head><title>Hudson browser loaded</title></head><body>Ready</body></html>"
        let encoded = try #require(
            html.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)
        )
        let url = try #require(URL(string: "data:text/html,\(encoded)"))

        browser.open(url)

        let clock = ContinuousClock()
        let deadline = clock.now.advanced(by: .seconds(3))
        while browser.title != "Hudson browser loaded", clock.now < deadline {
            try await Task.sleep(for: .milliseconds(25))
        }

        #expect(browser.title == "Hudson browser loaded")
        #expect(browser.failure == nil)
    }

    @Test("refused schemes never become page navigations")
    func refusedSchemesStayOutsideThePage() throws {
        var blocked: URL?
        let browser = HudBrowser(
            policy: HudBrowserPolicy(
                allowedSchemes: ["https"],
                onBlocked: { url, _ in blocked = url }
            )
        )
        let url = try #require(URL(string: "mailto:reader@example.com"))

        browser.open(url)

        #expect(blocked == url)
        #expect(browser.url == nil)
    }
}
