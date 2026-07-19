import AppKit
import Foundation
import SwiftUI
import HudsonKitExperimental

@main
enum HudsonKitExperimentalVisualDemoEntry {
    @MainActor
    static func main() throws {
        if let snapshotPath = snapshotPath(in: CommandLine.arguments) {
            try writeSnapshot(
                to: URL(fileURLWithPath: snapshotPath),
                usesDarkAppearance: CommandLine.arguments.contains("--dark")
            )
            return
        }

        HudsonKitExperimentalVisualDemoApp.main()
    }

    private static func snapshotPath(in arguments: [String]) -> String? {
        guard let flagIndex = arguments.firstIndex(of: "--snapshot"),
              arguments.indices.contains(flagIndex + 1) else {
            return nil
        }
        return arguments[flagIndex + 1]
    }

    @MainActor
    private static func writeSnapshot(to url: URL, usesDarkAppearance: Bool) throws {
        try renderSnapshot(
            to: url,
            usesDarkAppearance: usesDarkAppearance,
            backgroundColor: usesDarkAppearance ? .black : .white
        )
    }

    @MainActor
    private static func renderSnapshot(
        to url: URL,
        usesDarkAppearance: Bool,
        backgroundColor: Color
    ) throws {
        let content = HudLevelMeterDemoView()
            .environment(\.colorScheme, usesDarkAppearance ? .dark : .light)
            // Fixed evidence dimensions make repeated visual reviews comparable.
            // hudlint:disable next-line geometry
            .frame(width: 900, height: 450)
            .background(backgroundColor)
        let renderer = ImageRenderer(content: content)
        renderer.scale = 2

        guard let image = renderer.nsImage,
              let representation = image.tiffRepresentation,
              let bitmap = NSBitmapImageRep(data: representation),
              let data = bitmap.representation(using: .png, properties: [:]) else {
            throw SnapshotError.unavailable
        }

        try data.write(to: url, options: .atomic)
        print("Wrote \(url.path)")
    }
}

private struct HudsonKitExperimentalVisualDemoApp: App {
    var body: some Scene {
        WindowGroup("Experimental Level Meter") {
            HudLevelMeterDemoView()
                // Dedicated demo window minimums keep the fixed geometry legible.
                // hudlint:disable next-line geometry
                .frame(minWidth: 420, minHeight: 240)
        }
    }
}

private struct HudLevelMeterDemoView: View {
    private enum Metrics {
        static let contentWidth: CGFloat = 520
        static let laneWidth: CGFloat = 360
        static let laneHeight: CGFloat = 96
        static let laneCornerRadius: CGFloat = 10
        static let centerlineHeight: CGFloat = 1
        static let stackSpacing: CGFloat = 14
        static let contentInset: CGFloat = 18
    }

    private static let frames: [[Double]] = [
        [0.08, 0.22, 0.48, 0.86],
        [0.16, 0.64, 0.35, 0.72],
        [0.28, 0.14, 0.92, 0.41],
    ]

    @State private var history = initialHistory()
    @State private var nextFrame = 1

    private var accessibility: HudLevelMeterAccessibility {
        HudLevelMeterAccessibility(samples: history.samples)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Metrics.stackSpacing) {
            Text("Synthetic level history")
                .font(.headline)

            Text("Newest samples meet the right edge. Advance adds a fixed, repeatable input frame.")
                .foregroundStyle(.secondary)
                .frame(maxWidth: Metrics.contentWidth, alignment: .leading)

            ZStack {
                RoundedRectangle(cornerRadius: Metrics.laneCornerRadius)
                    .fill(Color(nsColor: .textBackgroundColor))

                Rectangle()
                    .fill(Color(nsColor: .separatorColor))
                    .frame(height: Metrics.centerlineHeight)

                HudLevelMeter(
                    history: history,
                    tint: .cyan,
                    accessibilityLabel: "Synthetic live level history"
                )
                .accessibilityIdentifier("experimental-level-meter")
            }
            .frame(width: Metrics.laneWidth, height: Metrics.laneHeight)
            .clipShape(.rect(cornerRadius: Metrics.laneCornerRadius))
            .overlay {
                RoundedRectangle(cornerRadius: Metrics.laneCornerRadius)
                    .stroke(Color(nsColor: .separatorColor))
            }

            Text(levelSummary)
                .font(.callout)
                .foregroundStyle(.secondary)
                .monospacedDigit()

            HStack {
                Button("Advance frame", action: advance)
                Button("Reset", action: reset)
            }
        }
        .padding(Metrics.contentInset)
    }

    private func advance() {
        for value in Self.frames[nextFrame] {
            history.append(HudLevelSample(unitValue: value))
        }
        nextFrame = (nextFrame + 1) % Self.frames.count
    }

    private func reset() {
        history = Self.initialHistory()
        nextFrame = 1
    }

    private static func initialHistory() -> HudLevelHistory {
        var history = HudLevelHistory(capacity: 72)
        for value in Array(repeating: frames[0], count: 9).flatMap({ $0 }) {
            history.append(HudLevelSample(unitValue: value))
        }
        return history
    }

    private var levelSummary: String {
        guard let currentPercent = accessibility.currentPercent,
              let peakPercent = accessibility.peakPercent else {
            return "No level samples"
        }
        return "\(accessibility.sampleCount) samples · current \(currentPercent)% · peak \(peakPercent)%"
    }
}

private enum SnapshotError: Error {
    case unavailable
}
