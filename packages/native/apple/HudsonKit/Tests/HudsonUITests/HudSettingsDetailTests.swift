import SwiftUI
import Testing
@testable import HudsonUI

#if os(macOS)
import AppKit

private final class HudSettingsDetailMeasurement: @unchecked Sendable {
    var size = CGSize.zero
}

private struct HudSettingsDetailMeasurementLayout: Layout {
    let measurement: HudSettingsDetailMeasurement

    func sizeThatFits(
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) -> CGSize {
        guard let subview = subviews.first else { return .zero }
        let size = subview.sizeThatFits(proposal)
        measurement.size = size
        return size
    }

    func placeSubviews(
        in bounds: CGRect,
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) {
        subviews.first?.place(
            at: CGPoint(x: bounds.minX, y: bounds.minY),
            anchor: .topLeading,
            proposal: proposal
        )
    }
}

@Suite("HudSecretClipboard")
struct HudSecretClipboardTests {
    @Test("macOS clipboard writes secrets and only clears the copied value")
    func writesAndConditionallyClears() {
        let pasteboard = NSPasteboard(
            name: NSPasteboard.Name("HudSecretClipboardTests.\(UUID().uuidString)")
        )

        #expect(HudSecretClipboard.copy("secret", to: pasteboard))
        #expect(pasteboard.string(forType: .string) == "secret")

        #expect(HudSecretClipboard.copy("replacement", to: pasteboard))
        HudSecretClipboard.clear(ifMatching: "secret", from: pasteboard)
        #expect(pasteboard.string(forType: .string) == "replacement")

        HudSecretClipboard.clear(ifMatching: "replacement", from: pasteboard)
        #expect(pasteboard.string(forType: .string) == nil)
    }
}
#endif

@Suite("HudSettingsDetail")
struct HudSettingsDetailTests {
    @Test("settings detail layout collapses below its configured threshold")
    func choosesResponsiveLayout() {
        #expect(
            HudSettingsDetailLayoutPolicy.layout(for: 759, collapseBelow: 760) == .stacked
        )
        #expect(
            HudSettingsDetailLayoutPolicy.layout(for: 760, collapseBelow: 760) == .columns
        )
        #expect(
            HudSettingsDetailLayoutPolicy.layout(for: 499, collapseBelow: 500) == .stacked
        )
        #expect(
            HudSettingsDetailLayoutPolicy.layout(for: 500, collapseBelow: 500) == .columns
        )
    }

    @MainActor
    @Test("settings detail primitives construct with default and custom slots")
    func constructsSettingsPrimitives() {
        _ = HudSettingsDetail {
            Text("Accounts")
        } detail: {
            Text("Account detail")
        }

        _ = HudSettingsNavigationRow(
            title: "Voice",
            subtitle: "Speech providers",
            icon: "waveform",
            isSelected: true,
            onTap: {}
        )

        _ = HudSettingsNavigationRow(
            title: "Advanced",
            icon: "gearshape",
            isSelected: false,
            onTap: {},
            trailing: { Text("3") }
        )

        _ = HudCredentialSection(
            "API key",
            text: .constant("secret"),
            destinationTitle: "Create key",
            destinationURL: URL(string: "https://example.com")
        )
    }

    #if os(macOS)
    @MainActor
    @Test("settings detail contributes its content height inside a vertical scroll view")
    func contentSizesInsideVerticalScrollView() {
        let measurement = HudSettingsDetailMeasurement()
        let root = ScrollView(.vertical) {
            HudSettingsDetailMeasurementLayout(measurement: measurement) {
                HudSettingsDetail {
                    Color.clear.frame(height: 100)
                    Color.clear.frame(height: 100)
                } detail: {
                    Color.clear.frame(height: 150)
                    Color.clear.frame(height: 150)
                }
            }
        }
        .frame(width: 600, height: 400)

        let host = NSHostingView(rootView: root)
        host.frame = NSRect(x: 0, y: 0, width: 600, height: 400)
        host.layoutSubtreeIfNeeded()
        RunLoop.main.run(until: Date().addingTimeInterval(0.1))
        host.layoutSubtreeIfNeeded()

        #expect(measurement.size.width == 600)
        #expect(measurement.size.height > 400)
    }

    @MainActor
    @Test("settings detail keeps an empty slot from collapsing the layout")
    func emptySlotStillSizesInsideVerticalScrollView() {
        let measurement = HudSettingsDetailMeasurement()
        let root = ScrollView(.vertical) {
            HudSettingsDetailMeasurementLayout(measurement: measurement) {
                HudSettingsDetail {
                    EmptyView()
                } detail: {
                    Color.clear.frame(height: 500)
                }
            }
        }
        .frame(width: 600, height: 400)

        let host = NSHostingView(rootView: root)
        host.frame = NSRect(x: 0, y: 0, width: 600, height: 400)
        host.layoutSubtreeIfNeeded()
        RunLoop.main.run(until: Date().addingTimeInterval(0.1))
        host.layoutSubtreeIfNeeded()

        #expect(measurement.size.width == 600)
        #expect(measurement.size.height > 400)
    }
    #endif
}
