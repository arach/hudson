import Testing
@testable import HudsonUI

@Suite("HudAgentTurn")
struct HudAgentTurnTests {
    @Test("turn values carry transport-agnostic chat metadata")
    func turnValue() {
        let attachment = HudAgentTurnAttachment(name: "error.log", mediaType: "text/plain", systemImage: "doc.text")
        let turn = HudAgentTurn(
            role: .assistant,
            author: "Assistant",
            text: "Working",
            attachments: [attachment],
            isStreaming: true,
            toolActivity: "bash"
        )

        #expect(turn.role == .assistant)
        #expect(turn.author == "Assistant")
        #expect(turn.attachments == [attachment])
        #expect(turn.isStreaming)
        #expect(turn.toolActivity == "bash")
    }
}

@Suite("HudAgentToolPresentation")
struct HudAgentToolPresentationTests {
    @Test("known tool names normalize to short labels and symbols")
    func knownTools() {
        #expect(HudAgentToolPresentation.displayName(for: "read_file") == "read")
        #expect(HudAgentToolPresentation.symbol(for: "read_file") == "doc.text")
        #expect(HudAgentToolPresentation.displayName(for: "bash") == "shell")
        #expect(HudAgentToolPresentation.symbol(for: "bash") == "terminal")
    }

    @Test("unknown tool names are clipped and use the generic symbol")
    func unknownTools() {
        #expect(HudAgentToolPresentation.displayName(for: "super_long_custom_tool") == "super_long_c")
        #expect(HudAgentToolPresentation.symbol(for: "super_long_custom_tool") == "sparkles")
    }
}
