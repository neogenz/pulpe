@testable import Pulpe
import SwiftUI
import Testing
import UIKit

/// WCAG 2.1 contrast floor for every ink / accent the hero zone paints on its forest surface.
/// Fails by naming the pair, the scheme and the measured ratio, so a "slightly lighter forest"
/// in a later phase cannot ship silently.
struct HeroContrastTests {
    private static let textFloor = 4.5
    private static let nonTextFloor = 3.0
    private static let schemes: [UIUserInterfaceStyle] = [.light, .dark]

    private struct Pair {
        let name: String
        let foreground: Color
        let background: Color
        let floor: Double
    }

    private static func text(_ name: String, _ foreground: Color, on background: Color = .heroSurface) -> Pair {
        Pair(name: "\(name) on heroSurface", foreground: foreground, background: background, floor: textFloor)
    }

    private static let textPairs: [Pair] = [
        text("heroInk", .heroInk),
        // Toolbar glyph on its disc: the disc is ink at `heroDisc` alpha over the forest,
        // composited here because WCAG measures opaque colours.
        Pair(
            name: "heroInk on heroDisc over heroSurface",
            foreground: .heroInk,
            background: composite(.heroInk, alpha: DesignTokens.Opacity.heroDisc, over: .heroSurface),
            floor: textFloor
        ),
        Pair(name: "heroInk on heroSurfaceTop", foreground: .heroInk, background: .heroSurfaceTop, floor: textFloor),
        text("heroInkSecondary", .heroInkSecondary),
        text("heroAccentPositive", .heroAccentPositive),
        text("heroAccentCaution", .heroAccentCaution),
        text("heroAccentDeficit", .heroAccentDeficit),
        text("heroAccentInfo", .heroAccentInfo),
    ]

    private static let nonTextPairs: [Pair] = [
        Pair(
            name: "heroSurface on appBackground",
            foreground: .heroSurface, background: .appBackground, floor: nonTextFloor
        ),
    ]

    @Test func textPairsClearAA() {
        assertPairs(Self.textPairs)
    }

    /// Light only: in dark mode the forest sits on a near-black canvas (1.2:1) and the zone
    /// boundary is carried by the tonal step and the rounded corners, not by contrast —
    /// the same reason `Shadow.zoneBoundary` is clear in dark mode.
    @Test func nonTextPairsClearGraphicFloorInLight() {
        assertPairs(Self.nonTextPairs, schemes: [.light])
    }

    private func assertPairs(_ pairs: [Pair], schemes: [UIUserInterfaceStyle] = schemes) {
        for scheme in schemes {
            for pair in pairs {
                let ratio = Self.contrastRatio(pair.foreground, pair.background, scheme: scheme)
                let schemeName = scheme == .dark ? "dark" : "light"
                #expect(
                    ratio >= pair.floor,
                    "\(pair.name) (\(schemeName)) = \(String(format: "%.2f", ratio)):1, floor \(pair.floor):1"
                )
            }
        }
    }

    /// Source-over blend of `top` at `alpha` on `base`, resolved in light (the forest is
    /// the same colour in both schemes; the ink too).
    private static func composite(_ top: Color, alpha: Double, over base: Color) -> Color {
        let topColor = UIColor(top).resolvedColor(with: UITraitCollection(userInterfaceStyle: .light))
        let baseColor = UIColor(base).resolvedColor(with: UITraitCollection(userInterfaceStyle: .light))
        var tr: CGFloat = 0, tg: CGFloat = 0, tb: CGFloat = 0, ta: CGFloat = 0
        var br: CGFloat = 0, bg: CGFloat = 0, bb: CGFloat = 0, ba: CGFloat = 0
        topColor.getRed(&tr, green: &tg, blue: &tb, alpha: &ta)
        baseColor.getRed(&br, green: &bg, blue: &bb, alpha: &ba)
        let mix = CGFloat(alpha)
        return Color(
            red: tr * mix + br * (1 - mix),
            green: tg * mix + bg * (1 - mix),
            blue: tb * mix + bb * (1 - mix)
        )
    }

    // MARK: - WCAG relative luminance

    static func contrastRatio(_ foreground: Color, _ background: Color, scheme: UIUserInterfaceStyle) -> Double {
        let lighter = max(luminance(foreground, scheme: scheme), luminance(background, scheme: scheme))
        let darker = min(luminance(foreground, scheme: scheme), luminance(background, scheme: scheme))
        return (lighter + 0.05) / (darker + 0.05)
    }

    private static func luminance(_ color: Color, scheme: UIUserInterfaceStyle) -> Double {
        let resolved = UIColor(color).resolvedColor(with: UITraitCollection(userInterfaceStyle: scheme))
        var red: CGFloat = 0, green: CGFloat = 0, blue: CGFloat = 0, alpha: CGFloat = 0
        resolved.getRed(&red, green: &green, blue: &blue, alpha: &alpha)
        return 0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue)
    }

    private static func linearize(_ channel: CGFloat) -> Double {
        let value = Double(channel)
        return value <= 0.03928 ? value / 12.92 : pow((value + 0.055) / 1.055, 2.4)
    }
}
