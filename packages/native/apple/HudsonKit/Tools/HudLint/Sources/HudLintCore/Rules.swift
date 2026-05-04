import Foundation

/// Default Hudson rule set — captures the drift patterns observed in Talkie
/// (hardcoded colors, opacity literals, raw padding/frame numbers, ad-hoc
/// `Font.system(size:)`) before they re-establish themselves in HudsonKit.
public enum DefaultRules {
    public static let all: [Rule] = [
        // MARK: Palette — colors must come from HudPalette / HudTint / HudSurface.
        RegexRule(
            category: .palette,
            pattern: #"\bColor\s*\(\s*red\s*:"#,
            message: "Hardcoded RGB color. Use HudPalette / HudTint / HudSurface instead."
        ),
        RegexRule(
            category: .palette,
            pattern: #"\bColor\s*\(\s*\.(sRGB|sRGBLinear|displayP3)\b"#,
            message: "Hardcoded color space literal. Use HudPalette / HudTint instead."
        ),
        RegexRule(
            category: .palette,
            pattern: #"\bColor\s*\(\s*hue\s*:"#,
            message: "Hardcoded HSB color. Use HudPalette / HudTint instead."
        ),
        RegexRule(
            category: .palette,
            pattern: #"\bUIColor\s*\(\s*(red|white|hue)\s*:"#,
            message: "Hardcoded UIColor. Use HudPalette / HudTint instead."
        ),
        RegexRule(
            category: .palette,
            pattern: #"\bNSColor\s*\(\s*(red|white|hue|calibrated|deviceRed)\s*:?"#,
            message: "Hardcoded NSColor. Use HudPalette / HudTint instead."
        ),
        RegexRule(
            category: .palette,
            pattern: #"\bColor\.(white|black)\s*\.opacity\s*\("#,
            message: "Raw white/black with opacity. Use HudSurface.* (hover/press/control/inset) instead."
        ),

        // MARK: Typography — font sizes must come from HudTextSize via HudFont.
        RegexRule(
            category: .typography,
            pattern: #"\bFont\.system\s*\(\s*size\s*:\s*[0-9]"#,
            message: "Hardcoded font size. Use HudFont.ui(HudTextSize.X) / HudFont.mono(HudTextSize.X)."
        ),
        RegexRule(
            category: .typography,
            pattern: #"\.font\(\s*\.system\s*\(\s*size\s*:\s*[0-9]"#,
            message: "Hardcoded font size. Use HudFont.ui(HudTextSize.X) / HudFont.mono(HudTextSize.X)."
        ),

        // MARK: Spacing — padding values must come from HudSpacing.
        RegexRule(
            category: .spacing,
            pattern: #"\.padding\(\s*[1-9][0-9]*(\.[0-9]+)?\s*\)"#,
            message: "Hardcoded padding value. Use HudSpacing.{xs,sm,md,lg,xl,xxl,xxxl,huge}."
        ),
        RegexRule(
            category: .spacing,
            pattern: #"\.padding\(\s*\.\w+\s*,\s*[1-9][0-9]*(\.[0-9]+)?\s*\)"#,
            message: "Hardcoded padding value. Use HudSpacing.{xs,sm,md,lg,xl,xxl,xxxl,huge}."
        ),

        // MARK: Geometry — frame / cornerRadius / lineWidth must use tokens.
        RegexRule(
            category: .geometry,
            pattern: #"\.frame\(\s*(width|height|maxWidth|maxHeight|minWidth|minHeight|idealWidth|idealHeight)\s*:\s*[0-9]"#,
            message: "Hardcoded frame dimension. Use HudLayout / HudSpacing / a HudIconSize token."
        ),
        RegexRule(
            category: .geometry,
            pattern: #"\.cornerRadius\(\s*[0-9]"#,
            message: "Hardcoded corner radius. Use HudRadius.{tight,standard,card}."
        ),
        RegexRule(
            category: .geometry,
            pattern: #"RoundedRectangle\(\s*cornerRadius\s*:\s*[0-9]"#,
            message: "Hardcoded corner radius. Use HudRadius.{tight,standard,card}."
        ),
        RegexRule(
            category: .geometry,
            pattern: #"\.lineWidth\(\s*[0-9]"#,
            message: "Hardcoded line width. Use HudHairline width tokens."
        ),

        // MARK: Opacity — numeric .opacity(...) literals leak design intent.
        RegexRule(
            category: .opacity,
            pattern: #"\.opacity\(\s*0?\.[0-9]"#,
            message: "Hardcoded opacity literal. Express intent via HudSurface.* / HudPalette.*Soft / token alpha."
        ),
    ]
}
