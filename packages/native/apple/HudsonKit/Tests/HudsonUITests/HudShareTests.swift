import Foundation
import Testing
@testable import HudsonUI

@Suite("HudShareItem")
struct HudShareItemTests {

    @Test("text items unwrap to String for the platform payload")
    func textItem() {
        let item = HudShareItem.text("Hello")
        #expect(item.platformValue as? String == "Hello")
    }

    @Test("url items unwrap to URL for the platform payload")
    func urlItem() throws {
        let url = try #require(URL(string: "https://hudsonkit.com"))
        let item = HudShareItem.url(url)
        #expect(item.platformValue as? URL == url)
    }

    @Test("file items unwrap to URL for the platform payload")
    func fileItem() {
        let url = URL(fileURLWithPath: "/tmp/note.txt")
        let item = HudShareItem.file(url)
        #expect(item.platformValue as? URL == url)
    }

    @Test("array convenience preserves order")
    func arrayConvenience() throws {
        let url = try #require(URL(string: "https://hudsonkit.com"))
        let items: [HudShareItem] = [.text("Hi"), .url(url)]
        let payload = items.platformValues
        #expect(payload.count == 2)
        #expect(payload[0] as? String == "Hi")
        #expect(payload[1] as? URL == url)
    }
}
