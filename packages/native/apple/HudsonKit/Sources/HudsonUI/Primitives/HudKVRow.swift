import SwiftUI

/// Key/value row — uppercase mono key on the left, mono value on the right.
/// Used for telemetry, metadata, configuration display.
public struct HudKVRow: View {
    public let key: String
    public let value: String
    public var valueColor: Color
    public var valueLineLimit: Int?

    public init(
        _ key: String,
        value: String,
        valueColor: Color = HudPalette.ink,
        valueLineLimit: Int? = 2
    ) {
        self.key = key
        self.value = value
        self.valueColor = valueColor
        self.valueLineLimit = valueLineLimit
    }

    public var body: some View {
        HStack {
            Text(key.uppercased())
                .font(HudFont.mono(9))
                .tracking(0.8)
                .foregroundStyle(HudPalette.dim)
                .lineLimit(1)
            Spacer()
            Text(value)
                .font(HudFont.mono(11))
                .foregroundStyle(valueColor)
                .multilineTextAlignment(.trailing)
                .lineLimit(valueLineLimit)
                .truncationMode(.middle)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(key), \(value)")
    }
}
