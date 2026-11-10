import SwiftUI
import UIKit

extension Color {
    // MARK: - Financial Colors (from Asset Catalog with light/dark/high-contrast variants)

    /// Income indicator color - Blue (#0061A6 light, #5AA8E0 dark)
    static let financialIncome = Color("FinancialIncome")

    /// Expense indicator color - Orange (#B35800 light, #F0A050 dark)
    static let financialExpense = Color("FinancialExpense")

    /// Savings indicator color - Green (#157038 light, #50C882 dark)
    static let financialSavings = Color("FinancialSavings")

    /// "Dépassé" ocre (V2 `over`, #905800 light, #E5A33A dark). Never red: red is for delete only.
    /// 5.9:1 on white in light mode, 8.6:1 on `surface` in dark mode.
    static let financialOverBudget = Color(light: Color(hex: 0x905800), dark: Color(hex: 0xE5A33A))
    /// Wash behind an ocre label or banner (V2 `over-w`, #F6EBDB light, #3A2A10 dark).
    static let overWash = Color(light: Color(hex: 0xF6EBDB), dark: Color(hex: 0x3A2A10))

    /// Coral (V2 `coral`, #C45028 light, #E8825A dark): a deficit tone, below the ocre in severity of mood.
    static let coral = Color(light: Color(hex: 0xC45028), dark: Color(hex: 0xE8825A))

    /// Map a `TransactionKind` to its semantic financial color.
    static func financialColor(for kind: TransactionKind) -> Color {
        switch kind {
        case .income: financialIncome
        case .expense: financialExpense
        case .saving: financialSavings
        }
    }

    // MARK: - Brand Colors

    /// The one action colour (V2 `accent`, #006E25 light, #7EDB83 dark). Green acts, ink reads.
    /// White on it is 6.4:1 in light mode; `textOnPrimary` flips to near-black in dark mode.
    static let pulpePrimary = Color("PulpePrimary")

    /// Pale green fill: secondary button, selected chip, empty-state disc (V2 `accent-w`,
    /// #E2F0E5 light, #1F3B27 dark).
    static let accentWash = Color(light: Color(hex: 0xE2F0E5), dark: Color(hex: 0x1F3B27))
    /// Text and glyphs on `accentWash` (V2 `accent-ink`, #0B4F1E light, #A6E6AA dark): 8.3:1 / 9.6:1.
    static let accentInk = Color(light: Color(hex: 0x0B4F1E), dark: Color(hex: 0xA6E6AA))

    /// Opaque disabled fill for primary buttons. Replaces opacity-based tints which
    /// bleed underlying content through (e.g. legal disclaimer behind onboarding CTA).
    /// Pairs with `onSurfaceVariant` text:
    /// - Light `#524D48` on `#D6E8DC` ≈ 5.6:1 (AA normal, AAA large)
    /// - Dark  `#B8B0A8` on `#2D3D31` ≈ 5.5:1 (AA normal, AAA large)
    /// Dark fill is lifted from the `#141A16` dark background (~2.6:1 surface contrast)
    /// so the disabled capsule remains visually distinct without an outline.
    static let primaryContainerDisabled = Color(light: Color(hex: 0xD6E8DC), dark: Color(hex: 0x2D3D31))

    // MARK: - App Background
    // V2 `bg`: warm paper canvas. Light #F2F1EC. Dark #121611 (warm near-black, not pure #000).
    static let appBackground = Color(light: Color(hex: 0xF2F1EC), dark: Color(hex: 0x121611))

    // MARK: - Sheet Background
    // V2 `sheet`. Light #F6F5F1. Dark #111111 (darker than the card surface).
    static let sheetBackground = Color(light: Color(hex: 0xF6F5F1), dark: Color(hex: 0x111111))

    /// V2 `sunk`: a recessed fill (segmented track, impact block, neutral banner, settings tile).
    /// Light #ECEAE4, dark #2A2826.
    static let sunk = Color(light: Color(hex: 0xECEAE4), dark: Color(hex: 0x2A2826))

    // MARK: - Surface (V2: card = white, canvas = bg, sheet, sunk — ios/DESIGN.md §2)

    static let surface = Color(light: .white, dark: Color(hex: 0x1A1816))
    static let surfaceContainerLowest = Color(light: .white, dark: Color(hex: 0x1E1C1A))
    static let surfaceContainerLow = Color(light: Color(hex: 0xFCFAF7), dark: Color(hex: 0x1C1A18))
    static let surfaceContainer = Color(light: Color(hex: 0xF6F5F1), dark: Color(hex: 0x201E1C))
    /// V2 `sunk` family: recessed fills on a card or the canvas.
    static let surfaceContainerHigh = sunk
    static let surfaceContainerHighest = Color(light: Color(hex: 0xE8E5E1), dark: Color(hex: 0x2A2826))

    // MARK: - Semantic Text Colors

    /// V2 `ink`: text and amounts, never a fill (#1A1C19 light, #F5F3EF dark).
    static let textPrimary = Color(light: Color(hex: 0x1A1C19), dark: Color(hex: 0xF5F3EF))

    /// Text on primary-colored backgrounds — inverts lightness with `pulpePrimary` (M3 onPrimary pairing).
    /// Light: white on dark forest green #006E25 = 5.1:1 (AA) · Dark: near-black on lime #7EDB83 = ~12.5:1 (AAA)
    static let textOnPrimary = Color(light: .white, dark: Color(hex: 0x0A1F0D))

    /// Secondary line on primary-filled controls (e.g. capsule subtitle). 88% opacity of `textOnPrimary`.
    static var textOnPrimaryMuted: Color { textOnPrimary.opacity(0.88) }

    /// V2 `ink2`: captions and labels, 13pt minimum.
    /// Light #4A4540: 8.4:1 on `appBackground` · Dark #C4BCB3: 9.6:1 on `surface`
    static let textSecondary = Color(light: Color(hex: 0x4A4540), dark: Color(hex: 0xC4BCB3))

    /// V2 `ink3`: placeholders, struck-through "before" figures, chevrons. Never the only carrier of meaning.
    /// Light #77706A · Dark #A39C94 (6.0:1 on `surface`)
    static let textTertiary = Color(light: Color(hex: 0x77706A), dark: Color(hex: 0xA39C94))

    /// Secondary content on surface — alias for textSecondary (M3 naming)
    static let onSurfaceVariant = textSecondary

    // MARK: - Outline

    /// V2 `line2`: the border of an input or an unselected chip (#CFC8BC light, #4A4640 dark).
    static let outline = Color(light: Color(hex: 0xCFC8BC), dark: Color(hex: 0x4A4640))
    /// V2 `line`: hairlines between rows, form-card border (#E6E2DA light, #3A3733 dark).
    static let outlineVariant = Color(light: Color(hex: 0xE6E2DA), dark: Color(hex: 0x3A3733))
    /// V2 `ring`: the unpointed pointing circle's ring (#8F877C light, #8A837A dark), 3:1 on white.
    static let pointRing = Color(light: Color(hex: 0x8F877C), dark: Color(hex: 0x8A837A))

    // MARK: - Destructive Colors (true red for irreversible actions)

    /// V2 `red`: delete, and the genuine-error feedback below (#C62828 light, #FF6B6B dark).
    static let destructivePrimary = Color(light: Color(hex: 0xC62828), dark: Color(hex: 0xFF6B6B))

    /// V2 `red-w`: the destructive button fill and error banner (#FBE7E6 light, #3A1818 dark).
    static let destructiveBackground = Color(light: Color(hex: 0xFBE7E6), dark: Color(hex: 0x3A1818))

    // MARK: - Error Colors

    /// A genuine failure (wrong code, rejected sign-in, failed request) reads in V2 red, never
    /// in the ocre that marks an overrun: an error is not a spending signal.
    static let errorPrimary = destructivePrimary

    // MARK: - Warning Colors

    /// Warning primary — amber/yellow for tips and caution (#B8860B light, #FFD54F dark)
    static let warningPrimary = Color(light: Color(hex: 0xB8860B), dark: Color(hex: 0xFFD54F))

    // MARK: - Action Colors

    /// Edit action color - Blue, following iOS conventions (#0063B4 light, #6BAAEE dark)
    static let editAction = Color(light: Color(hex: 0x0063B4), dark: Color(hex: 0x6BAAEE))

    // MARK: - Component Colors

    /// Background for count badges in section headers
    static let countBadge = Color("CountBadge")

    /// Background track for progress indicators
    static let progressTrack = Color("ProgressTrack")

    /// Border color for input fields (unfocused state): V2 `line2`
    static let inputBorder = outline

    /// Generic badge background
    static let badgeBackground = Color("BadgeBackground")

    /// Input field background — subtle gray fill for contrast on white sheets
    static let inputBackgroundSoft = Color(uiColor: .tertiarySystemFill)

    // MARK: - Gradient Colors

    /// Aligned with frontend dark theme (styles/_financial-colors.scss)
    static let pulpeGradientColors: [Color] = [
        Color(light: Color(hex: 0x0088FF), dark: Color(hex: 0x1A1A1A)),
        Color(light: Color(hex: 0x00DDAA), dark: Color(hex: 0x1E2820)),
        Color(light: Color(hex: 0x00FF55), dark: Color(hex: 0x00531A)),
        Color(light: Color(hex: 0x88FF44), dark: Color(hex: 0x2B883B))
    ]

    // MARK: - Onboarding & Tutorial Colors

    /// High-contrast text colors for onboarding
    static let textPrimaryOnboarding = Color(light: Color(hex: 0x1A1A1A), dark: Color(hex: 0xF5F5F5))
    /// Secondary text - subtle green tint in dark mode for brand cohesion
    static let textSecondaryOnboarding = Color(light: Color(hex: 0x4A4A4A), dark: Color(hex: 0xC8D0CA))

    /// Onboarding backgrounds
    static let onboardingBackground = Color(light: Color(hex: 0xF8FAF9), dark: Color(hex: 0x111614))

    // MARK: - Auth Screen Colors
    /// Glass-morphic card background for auth forms
    static let authCardGlass = Color(light: .white.opacity(0.85), dark: Color(hex: 0x1C1C1E).opacity(0.75))

    /// Mint green background matching landing page suggestion
    static let mintBackground = Color(light: Color(hex: 0xBDF5B7), dark: Color(hex: 0x1A3A1A))

    /// Tutorial overlay with better contrast
    static let tutorialOverlay = Color.black.opacity(0.85)
    static let tutorialSpotlightGlow = Color(hex: 0x00C853).opacity(0.3)

    /// Step category colors for visual distinction
    static let stepIncome = Color(light: Color(hex: 0x2E7D32), dark: Color(hex: 0x4CAF50))
    static let stepHousing = Color(light: Color(hex: 0x1565C0), dark: Color(hex: 0x42A5F5))
    static let stepHealth = Color(light: Color(hex: 0xC62828), dark: Color(hex: 0xEF5350))
    static let stepPhone = Color(light: Color(hex: 0x6A1B9A), dark: Color(hex: 0xAB47BC))
    static let stepTransport = Color(light: Color(hex: 0xEF6C00), dark: Color(hex: 0xFFA726))
    static let stepCredit = Color(light: Color(hex: 0x37474F), dark: Color(hex: 0x78909C))

    // MARK: - PIN Screen Colors (adaptive light/dark)

    /// Primary text on PIN screens
    static let pinText = Color(light: Color(hex: 0x1A1A1A), dark: .white)

    // MARK: - Dashboard Emotion Zone (DESIGN.md §2 — Two-Zone Rule)

    /// Comfortable (Emerald): pale green → neutral warm
    static let dashboardGradientComfortable = Color(light: Color(hex: 0xD0F0DC), dark: Color(hex: 0x0C200E))
    /// Tight (Tangerine): pale warm orange → neutral warm
    static let dashboardGradientTight = Color(light: Color(hex: 0xFCECD0), dark: Color(hex: 0x1C1408))
    /// Deficit (Sunset Coral): warm peach → neutral warm
    static let dashboardGradientDeficit = Color(light: Color(hex: 0xFADCD0), dark: Color(hex: 0x201008))

    // MARK: - Home Dashboard

    /// Cast by the hero surface onto the content zone below it. In light mode the two
    /// zones are close in value and would otherwise read as one flat plane, so the drop is
    /// the whole depth cue; in dark mode the tonal jump already carries it and a black
    /// shadow on a near-black canvas only muddies the edge.
    static let homeZoneBoundaryShadow = Color(
        light: .black.opacity(DesignTokens.Opacity.glow),
        dark: .clear
    )

    // MARK: - Hero Zone (ios/DESIGN.md §2 — constant brand-forest surface, never state-tinted)
    // Financial state lives in the verdict, a chip and the chart accent, never in the
    // surface color. Ratios measured in `HeroContrastTests`.

    /// Hero surface — forest `#0E3A1C` light, `#0B2E16` dark. 11.4:1 against `appBackground`.
    static let heroSurface = Color(light: Color(hex: 0x0E3A1C), dark: Color(hex: 0x0B2E16))
    /// Top stop of the hero's two-stop gradient, a hair lighter than the base. The only depth.
    static let heroSurfaceTop = Color(light: Color(hex: 0x14512A), dark: Color(hex: 0x0E3A1C))
    /// Primary ink on the hero: 12.8:1 on `heroSurface`.
    static let heroInk = Color(light: .white, dark: Color(hex: 0xF3F9F5))
    /// Secondary ink on the hero (eyebrows, tile labels, chart series): mint, 9.9:1.
    static let heroInkSecondary = Color(hex: 0xCFE8D6)
    /// Translucent tile fill on the hero — a tint, never a solid border.
    static var heroTile: Color { heroInk.opacity(DesignTokens.Opacity.heroTile) }
    /// State accents on the forest — the existing dark-mode palette, AA on `heroSurface`.
    /// Positive 7.5:1, caution 5.9:1, deficit 5.2:1, info 4.9:1. Identical in both schemes.
    static let heroAccentPositive = Color(hex: 0x7EDB83)
    static let heroAccentCaution = Color(hex: 0xE5A33A)
    static let heroAccentDeficit = Color(hex: 0xF08A6A)
    static let heroAccentInfo = Color(hex: 0x5AA8E0)

    // MARK: - Row Card

    /// Substitute for `Shadow.subtle` in dark mode: a 5% black shadow renders on
    /// `appBackground`'s near-black tone, so a row card would have no boundary at all.
    /// In light mode the shadow already carries the separation, so the border stays
    /// invisible there.
    static let rowCardBorder = Color(light: .clear, dark: .outlineVariant)

    // MARK: - Skeleton

    /// Placeholder fill for skeleton loading shapes — warm tint to match neutral warm bg
    static let skeletonPlaceholder = Color(light: Color(hex: 0xE8E5E1), dark: Color(hex: 0x242220))

    // MARK: - Initializers

    init(hex: UInt) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }

    init(light: Color, dark: Color) {
        self.init(uiColor: UIColor { traits in
            traits.userInterfaceStyle == .dark ? UIColor(dark) : UIColor(light)
        })
    }
}
