import UIKit
import Foundation

/// Switches the home-screen icon to match the in-app theme (background) and accent (dot).
/// Variants are pre-bundled alternate icons (one per theme × preset accent); a custom
/// accent snaps to the nearest preset.
enum AppIconManager {
    static let presetAccents: [(name: String, hex: UInt)] = [
        ("Orange", 0xE8772E), ("Red", 0xD7263D), ("Amber", 0xE2A60B), ("Green", 0x2E9E5B),
        ("Blue", 0x3B82F6), ("Purple", 0x8B5CF6), ("Pink", 0xEC4899), ("Ink", 0x111111),
    ]

    private static func themeName(_ mode: AppTheme) -> String {
        switch mode {
        case .beige: return "Beige"
        case .light: return "Light"
        case .dark: return "Dark"
        }
    }

    private static func nearestAccent(_ hex: UInt) -> String {
        func rgb(_ h: UInt) -> (Double, Double, Double) {
            (Double((h >> 16) & 0xff), Double((h >> 8) & 0xff), Double(h & 0xff))
        }
        let (r, g, b) = rgb(hex)
        return presetAccents.min { lhs, rhs in
            let (lr, lg, lb) = rgb(lhs.hex), (rr, rg, rb) = rgb(rhs.hex)
            let dl = pow(lr - r, 2) + pow(lg - g, 2) + pow(lb - b, 2)
            let dr = pow(rr - r, 2) + pow(rg - g, 2) + pow(rb - b, 2)
            return dl < dr
        }!.name
    }

    /// Alternate icon name for the settings, or nil for the primary (Beige + Orange).
    static func iconName(mode: AppTheme, accentHex: UInt) -> String? {
        let t = themeName(mode)
        let a = nearestAccent(accentHex)
        if t == "Beige" && a == "Orange" { return nil }
        return "Alt\(t)\(a)"
    }

    @MainActor
    static func apply(mode: AppTheme, accentHex: UInt) {
        guard UIApplication.shared.supportsAlternateIcons else { return }
        let target = iconName(mode: mode, accentHex: accentHex)
        guard UIApplication.shared.alternateIconName != target else { return }
        setWithoutAlert(target)
    }

    /// Use the private completion-handler variant so iOS skips the system
    /// "You've changed the icon" alert on every change. Acceptable for a personal sideload.
    @MainActor
    private static func setWithoutAlert(_ name: String?) {
        let selector = NSSelectorFromString("_setAlternateIconName:completionHandler:")
        if UIApplication.shared.responds(to: selector) {
            typealias Fn = @convention(c) (NSObject, Selector, NSString?, @escaping (NSError?) -> Void) -> Void
            let imp = UIApplication.shared.method(for: selector)
            let fn = unsafeBitCast(imp, to: Fn.self)
            fn(UIApplication.shared, selector, name as NSString?, { _ in })
        } else {
            UIApplication.shared.setAlternateIconName(name) { _ in }
        }
    }
}
