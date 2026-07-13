import SwiftUI
import UIKit

extension Color {
    init(hex: UInt, alpha: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xff) / 255,
            green: Double((hex >> 8) & 0xff) / 255,
            blue: Double(hex & 0xff) / 255,
            opacity: alpha
        )
    }

    /// Pack the color's RGB into a 0xRRGGBB integer for persistence.
    var hexValue: UInt {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        UIColor(self).getRed(&r, green: &g, blue: &b, alpha: &a)
        return (UInt(max(0, r) * 255) << 16) | (UInt(max(0, g) * 255) << 8) | UInt(max(0, b) * 255)
    }
}

/// Named colors for categories (stored as the name in the `color` column).
enum CategoryPalette {
    static let options: [(name: String, color: Color)] = [
        ("orange", Color(hex: 0xE8772E)), ("red", Color(hex: 0xD7263D)),
        ("amber", Color(hex: 0xE2A60B)), ("green", Color(hex: 0x2E9E5B)),
        ("blue", Color(hex: 0x3B82F6)), ("purple", Color(hex: 0x8B5CF6)),
        ("pink", Color(hex: 0xEC4899)), ("gray", Color(hex: 0x8C8479)),
    ]
    static func color(_ name: String) -> Color {
        options.first { $0.name == name }?.color ?? Color(hex: 0x8C8479)
    }
}

/// The three website themes: Default (beige), Light (white), Dark.
enum AppTheme: String, CaseIterable, Identifiable {
    case beige, light, dark
    var id: String { rawValue }
    var label: String {
        switch self {
        case .beige: return "Default"
        case .light: return "Light"
        case .dark: return "Dark"
        }
    }
}

/// Observable theme: drives every surface color + the accent, persisted to UserDefaults.
@MainActor
final class Theme: ObservableObject {
    @Published var mode: AppTheme {
        didSet { UserDefaults.standard.set(mode.rawValue, forKey: "lynx-theme"); scheduleIconUpdate() }
    }
    @Published var accentHex: UInt {
        didSet { UserDefaults.standard.set(Int(accentHex), forKey: "lynx-accent"); scheduleIconUpdate() }
    }
    /// Off by default: changing the home-screen icon can trigger an iOS system alert, so this
    /// is opt-in. When on, the icon follows the theme (background) + accent (dot).
    @Published var dynamicIcon: Bool {
        didSet { UserDefaults.standard.set(dynamicIcon, forKey: "lynx-dynamic-icon"); scheduleIconUpdate() }
    }

    private var iconTask: Task<Void, Never>?

    init() {
        mode = AppTheme(rawValue: UserDefaults.standard.string(forKey: "lynx-theme") ?? "beige") ?? .beige
        accentHex = UInt(UserDefaults.standard.object(forKey: "lynx-accent") as? Int ?? 0xE8772E)
        dynamicIcon = UserDefaults.standard.object(forKey: "lynx-dynamic-icon") as? Bool ?? false
        scheduleIconUpdate()
    }

    /// Match the home-screen icon to the current theme + accent, debounced so dragging the
    /// color wheel doesn't thrash the icon. No-op unless the user opted in.
    private func scheduleIconUpdate() {
        guard dynamicIcon else { return }
        iconTask?.cancel()
        let (m, a) = (mode, accentHex)
        iconTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 700_000_000)
            if Task.isCancelled { return }
            AppIconManager.apply(mode: m, accentHex: a)
        }
    }

    var colorScheme: ColorScheme { mode == .dark ? .dark : .light }
    var accent: Color { Color(hex: accentHex) }

    var bg: Color {
        switch mode {
        case .beige: return Color(hex: 0xF6F1E7)
        case .light: return Color(hex: 0xFFFFFF)
        case .dark: return Color(hex: 0x141310)
        }
    }
    var surface: Color {
        switch mode {
        case .beige: return Color(hex: 0xFFFCF5)
        case .light: return Color(hex: 0xF5F5F3)
        case .dark: return Color(hex: 0x201E18)
        }
    }
    var pill: Color {
        switch mode {
        case .beige: return Color(hex: 0xEEE6CC)
        case .light: return Color(hex: 0xECECE9)
        case .dark: return Color(hex: 0x2D2A22)
        }
    }
    var border: Color {
        switch mode {
        case .beige: return Color(hex: 0xE7DFCB)
        case .light: return Color(hex: 0xE5E5E1)
        case .dark: return Color(hex: 0x322E25)
        }
    }
    var text: Color { mode == .dark ? Color(hex: 0xECE7DF) : Color(hex: 0x2B2723) }
    var muted: Color { mode == .dark ? Color(hex: 0x97907F) : Color(hex: 0x8C8479) }
}
