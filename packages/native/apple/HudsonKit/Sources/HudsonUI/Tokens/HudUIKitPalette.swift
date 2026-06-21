#if canImport(UIKit) && !os(watchOS)
import UIKit

/// UIKit color counterparts for hosted-keyboard controls.
///
/// The SwiftUI palette remains the default for HudsonUI. These UIKit tokens
/// keep keyboard runtime views token-driven without pulling UIColor literals
/// into the view implementations.
public enum HudKeyboardUIColor {
    public static var background: UIColor { UIColor.clear }

    public static var surfaceDark: UIColor { UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(white: 1.0, alpha: 0.03)
            : UIColor(white: 1.0, alpha: 0.74)
    }}

    public static var surfaceLight: UIColor { UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(white: 1.0, alpha: 0.12)
            : UIColor(white: 1.0, alpha: 0.92)
    }}

    public static var surfaceSpecial: UIColor { UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(white: 1.0, alpha: 0.05)
            : UIColor(white: 1.0, alpha: 0.80)
    }}

    public static var specialKeyActive: UIColor { UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(white: 1.0, alpha: 0.14)
            : UIColor(white: 1.0, alpha: 0.92)
    }}

    public static var keyBorder: UIColor { UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(white: 1.0, alpha: 0.16)
            : UIColor(white: 0.0, alpha: 0.08)
    }}

    public static var keyBorderPressed: UIColor { UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(white: 1.0, alpha: 0.24)
            : UIColor(white: 0.0, alpha: 0.16)
    }}

    public static var keyShadow: UIColor { UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor.black
            : UIColor(white: 0.0, alpha: 0.30)
    }}

    public static var textPrimary: UIColor { UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor.white
            : UIColor.black
    }}

    public static var textSecondary: UIColor { UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(white: 0.60, alpha: 1.0)
            : UIColor(white: 0.40, alpha: 1.0)
    }}

    public static var textMuted: UIColor { UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(white: 0.45, alpha: 1.0)
            : UIColor(white: 0.55, alpha: 1.0)
    }}

    public static var dictationActive: UIColor { UIColor(red: 0.91, green: 0.30, blue: 0.24, alpha: 1.0) }
    public static var processing: UIColor { UIColor(red: 0.34, green: 0.68, blue: 1.0, alpha: 1.0) }
    public static var success: UIColor { UIColor(red: 0.30, green: 0.78, blue: 0.47, alpha: 1.0) }
    public static var returnBlue: UIColor { UIColor(red: 0.0, green: 0.478, blue: 1.0, alpha: 1.0) }

    public static var popupBackground: UIColor { UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.22, green: 0.22, blue: 0.24, alpha: 0.98)
            : UIColor(red: 0.95, green: 0.95, blue: 0.97, alpha: 0.98)
    }}
}
#endif
