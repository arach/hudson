import Testing
@testable import HudsonUIKeyboard

@Suite("HudMiniKeyboard")
struct HudMiniKeyboardTests {

    @Test("default presets keep terminal canvas and code order")
    func defaultPresetOrder() {
        #expect(HudMiniKeyboardPreset.defaultPresets.map(\.id) == ["terminal", "canvas", "code"])
    }

    @Test("terminal preset exposes control sequences for phone shell use")
    func terminalPresetSequences() throws {
        let terminal = HudMiniKeyboardPreset.terminal
        let keys = terminal.rows.flatMap { $0 }
        let escape = try #require(keys.first(where: { $0.id == "terminal.escape" }))
        let up = try #require(keys.first(where: { $0.id == "terminal.up" }))
        let interrupt = try #require(keys.first(where: { $0.id == "terminal.ctrl-c" }))

        #expect(escape.output == .sequence("\u{1B}"))
        #expect(up.output == .sequence("\u{1B}[A"))
        #expect(interrupt.output == .sequence("\u{3}"))
    }

    @Test("terminal preset includes hosted terminal minimal row")
    func terminalMinimalRow() {
        #expect(HudMiniKeyboardPreset.terminal.minimalKeys.map(\.label) == ["SHIFT", "C", "V", "SPACE", "Q", "*", "RET"])
    }

    @Test("command outputs do not masquerade as transport text")
    func commandOutputHasNoTransportText() {
        #expect(HudMiniKeyboardOutput.command("canvas.fit").transportText == nil)
        #expect(HudMiniKeyboardOutput.text("a").transportText == "a")
        #expect(HudMiniKeyboardOutput.sequence("\u{1B}").transportText == "\u{1B}")
    }

    @Test("compact key cap height stays in a touch-friendly range")
    func compactKeyHeightIsTouchFriendly() {
        // Compact slots have to clear a 36pt touch minimum without growing into
        // a list-row sized tile. Anchors this against accidental regressions.
        #expect(HudMiniKeyboardMetrics.compactKeyHeight >= 36)
        #expect(HudMiniKeyboardMetrics.compactKeyHeight <= 44)
    }

    @Test("compact preset keys land in a clean 3x4 grid")
    func compactGridSlotCount() {
        // All three default presets feed a 12-slot grid (.empty fills any holes
        // a preset omits). The keyboard surface relies on this contract.
        for preset in HudMiniKeyboardPreset.defaultPresets {
            #expect(preset.compactKeys.count == 12)
        }
    }
}
