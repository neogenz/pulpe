import SwiftUI

extension Color {

    // MARK: - Financial Colors (from Asset Catalog with light/dark/high-contrast variants)

    /// Income indicator color - Blue (#0056A3 light, #5AA8E0 dark)
    static let financialIncome = Color("FinancialIncome")

    /// Expense indicator color - Orange (#B35800 light, #F0A050 dark)
    static let financialExpense = Color("FinancialExpense")

    /// Savings indicator color - Green (#1E8A4C light, #50C882 dark)
    static let financialSavings = Color("FinancialSavings")

    /// Over-budget indicator - Warm amber, not aggressive red (#C27A00 light, #E5A33A dark)
    static let financialOverBudget = Color(light: Color(hex: 0xC27A00), dark: Color(hex: 0xE5A33A))

    // MARK: - Brand Colors

    /// Primary brand color - Dark green (#006820 light, #4AA070 dark)
    static let pulpePrimary = Color("PulpePrimary")

    // MARK: - Surface Colors (system semantic for proper light/dark/high-contrast)

    /// Primary background — system grouped background (off-white in light, elevated dark in dark mode)
    static let surfacePrimary = Color(uiColor: .systemGroupedBackground)

    /// Card/modal surfaces — elevated in dark mode for visible card definition
    static let surfaceCard = Color(uiColor: .secondarySystemGroupedBackground)

    /// Secondary surface for form backgrounds, inactive pills
    static let surfaceSecondary = Color(uiColor: .secondarySystemGroupedBackground)

    // MARK: - Semantic Text Colors

    /// Primary text — DA noir doux (#181D17 light, #F5F5F5 dark)
    static let textPrimary = Color(light: Color(hex: 0x181D17), dark: Color(hex: 0xF5F5F5))

    /// Text on primary-colored backgrounds (white in both modes)
    static let textOnPrimary = Color(light: .white, dark: .white)

    /// Tertiary text with improved contrast (40% opacity light, 50% dark)
    static let textTertiary = Color("TextTertiary")

    // MARK: - Error Colors

    /// Error primary — warm orange, not aggressive red (#D4760A light, #F0A050 dark)
    static let errorPrimary = Color(light: Color(hex: 0xD4760A), dark: Color(hex: 0xF0A050))

    /// Error background — soft warm tint (#FFF3E0 light, #2A1F10 dark)
    static let errorBackground = Color(light: Color(hex: 0xFFF3E0), dark: Color(hex: 0x2A1F10))

    // MARK: - Warning Colors

    /// Warning primary — amber/yellow for tips and caution (#B8860B light, #FFD54F dark)
    static let warningPrimary = Color(light: Color(hex: 0xB8860B), dark: Color(hex: 0xFFD54F))

    /// Warning background — soft amber tint (#FFF8E1 light, #2A2510 dark)
    static let warningBackground = Color(light: Color(hex: 0xFFF8E1), dark: Color(hex: 0x2A2510))

    // MARK: - Component Colors

    /// Background for count badges in section headers
    static let countBadge = Color("CountBadge")

    /// Background track for progress indicators
    static let progressTrack = Color("ProgressTrack")

    /// Border color for input fields (unfocused state)
    static let inputBorder = Color("InputBorder")

    /// Generic badge background
    static let badgeBackground = Color("BadgeBackground")

    /// Input field background — system tertiary fill for native feel
    static let inputBackgroundSoft = Color(uiColor: .tertiarySystemFill)

    /// Input focus glow color
    static let inputFocusGlow = Color(light: Color(hex: 0x006820).opacity(0.12), dark: Color(hex: 0x4AA070).opacity(0.15))

    // MARK: - Gradient Colors

    /// Aligned with frontend dark theme (styles/_financial-colors.scss)
    static let pulpeGradientColors: [Color] = [
        Color(light: Color(hex: 0x0088FF), dark: Color(hex: 0x1A1A1A)),
        Color(light: Color(hex: 0x00DDAA), dark: Color(hex: 0x1E2820)),
        Color(light: Color(hex: 0x00FF55), dark: Color(hex: 0x00531A)),
        Color(light: Color(hex: 0x88FF44), dark: Color(hex: 0x2B883B))
    ]

    // MARK: - App Background Gradient

    // Semantic gradient colors for premium background (neutral dark, green accents in light)
    private static let gradientBaseTop = Color(light: Color(hex: 0xE4F3E0), dark: Color(hex: 0x141414))
    private static let gradientBaseMid = Color(light: Color(hex: 0xD8EDD8), dark: Color(hex: 0x1A1A1C))
    private static let gradientBaseBottom = Color(light: Color(hex: 0xCEE5D0), dark: Color(hex: 0x1C1C1E))
    private static let gradientAccentMint = Color(light: Color(hex: 0xA8E0B0), dark: Color(hex: 0x1E2020))
    private static let gradientAccentSage = Color(light: Color(hex: 0xC5E0C8), dark: Color(hex: 0x1D1E1D))
    private static let gradientCenterGlow = Color(light: Color(hex: 0xD8EDD8), dark: Color(hex: 0x1E1F1E))

    // MARK: - Mesh Gradient Data (light mode only — dark mode uses system background)

    static let meshPoints: [SIMD2<Float>] = [
        .init(x: 0, y: 0),    .init(x: 0.5, y: 0),    .init(x: 1, y: 0),
        .init(x: 0, y: 0.5),  .init(x: 0.55, y: 0.5), .init(x: 1, y: 0.5),
        .init(x: 0, y: 1),    .init(x: 0.5, y: 1),    .init(x: 1, y: 1)
    ]

    @available(iOS 18.0, *)
    static let lightMeshColors: [Color] = [
        Color(hex: 0xC2EDCA).opacity(0.70),
        Color(hex: 0xDFF0DF).opacity(0.55),
        Color(hex: 0xECF2E8).opacity(0.45),
        Color(hex: 0xD0E8D2).opacity(0.50),
        Color(hex: 0xEEF5EF),
        Color(hex: 0xC8E6CE).opacity(0.55),
        Color(hex: 0xD8ECDA).opacity(0.50),
        Color(hex: 0xBDE4C4).opacity(0.60),
        Color(hex: 0xD5EDD8).opacity(0.45)
    ]

    @ViewBuilder
    static var appFallbackBackground: some View {
        ZStack {
            Color(uiColor: .systemGroupedBackground)
            LinearGradient(
                colors: [gradientBaseTop.opacity(0.50), gradientBaseMid.opacity(0.45), gradientBaseBottom.opacity(0.40)],
                startPoint: .top,
                endPoint: .bottom
            )
            RadialGradient(
                colors: [gradientAccentMint.opacity(0.40), .clear],
                center: .topTrailing,
                startRadius: 0,
                endRadius: 400
            )
            RadialGradient(
                colors: [gradientAccentSage.opacity(0.35), .clear],
                center: .bottomLeading,
                startRadius: 0,
                endRadius: 350
            )
        }
    }

    /// Premium multi-layered background with visible color for Liquid Glass refraction
    @ViewBuilder
    static var appPremiumBackground: some View {
        ZStack {
            baseGradientLayer
            mintAccentLayer
            sageAccentLayer
            centerGlowLayer
        }
    }

    @ViewBuilder
    private static var baseGradientLayer: some View {
        LinearGradient(
            colors: [gradientBaseTop, gradientBaseMid, gradientBaseBottom],
            startPoint: .top,
            endPoint: .bottom
        )
    }

    @ViewBuilder
    private static var mintAccentLayer: some View {
        RadialGradient(
            colors: [gradientAccentMint.opacity(0.85), .clear],
            center: .topTrailing,
            startRadius: 0,
            endRadius: 400
        )
    }

    @ViewBuilder
    private static var sageAccentLayer: some View {
        RadialGradient(
            colors: [gradientAccentSage.opacity(0.75), .clear],
            center: .bottomLeading,
            startRadius: 0,
            endRadius: 350
        )
    }

    @ViewBuilder
    private static var centerGlowLayer: some View {
        RadialGradient(
            colors: [gradientCenterGlow.opacity(0.55), .clear],
            center: .center,
            startRadius: 50,
            endRadius: 500
        )
    }

    // MARK: - Status-Tinted Backgrounds (for budget details)

    /// Positive status background (green tint in light, near-black in dark)
    @ViewBuilder
    static var appPositiveBackground: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(light: Color(hex: 0xD0EDCF), dark: Color(hex: 0x0D0E0D)),
                    Color(light: Color(hex: 0xE4F3E0), dark: Color(hex: 0x0C0C0E))
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            RadialGradient(
                colors: [Color(light: Color(hex: 0xA8E0B0), dark: Color(hex: 0x10120F)).opacity(0.60), .clear],
                center: .topTrailing,
                startRadius: 0,
                endRadius: 400
            )
        }
    }

    /// Negative status background (amber tint in light, near-black in dark)
    @ViewBuilder
    static var appNegativeBackground: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(light: Color(hex: 0xFDE8D8), dark: Color(hex: 0x0E0D0C)),
                    Color(light: Color(hex: 0xFDF4EC), dark: Color(hex: 0x0C0C0E))
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            RadialGradient(
                colors: [Color(light: Color(hex: 0xF0C8A0), dark: Color(hex: 0x12100E)).opacity(0.50), .clear],
                center: .topTrailing,
                startRadius: 0,
                endRadius: 400
            )
        }
    }

    /// Legacy gradient (kept for compatibility)
    static let appBackgroundGradient = LinearGradient(
        colors: [
            Color(light: Color(hex: 0xF8F9F8), dark: Color(hex: 0x1A1A1A)),
            Color(light: Color(hex: 0xEBF5ED), dark: Color(hex: 0x1A1A1C))
        ],
        startPoint: .top,
        endPoint: .bottom
    )

    // MARK: - Onboarding & Tutorial Colors

    /// High-contrast text colors for onboarding
    static let textPrimaryOnboarding = Color(light: Color(hex: 0x1A1A1A), dark: Color(hex: 0xF5F5F5))
    static let textSecondaryOnboarding = Color(light: Color(hex: 0x4A4A4A), dark: Color(hex: 0xB0B0B0))
    static let textTertiaryOnboarding = Color(light: Color(hex: 0x6B6B6B), dark: Color(hex: 0x8A8A8A))

    /// Onboarding backgrounds
    static let onboardingBackground = Color(light: Color(hex: 0xF8FAF9), dark: Color(hex: 0x1C1C1E))
    static let onboardingCardBackground = Color(light: .white, dark: Color(hex: 0x2C2C2E))

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

    /// Onboarding accent gradient
    static let onboardingGradient = LinearGradient(
        colors: [Color(light: Color(hex: 0x006E25), dark: Color(hex: 0x2E7D32)),
                 Color(light: Color(hex: 0x00A838), dark: Color(hex: 0x4CAF50))],
        startPoint: .leading,
        endPoint: .trailing
    )

    // MARK: - PIN Screen Colors (adaptive light/dark)

    /// PIN background gradient stops
    static let pinGradientTop = Color(light: Color(hex: 0xF0F2F5), dark: Color(hex: 0x0F1923))
    static let pinGradientMid = Color(light: Color(hex: 0xE8EBF0), dark: Color(hex: 0x1A2733))
    static let pinGradientBottom = Color(light: Color(hex: 0xE0E4EA), dark: Color(hex: 0x0D1520))

    /// PIN screen gradient
    static let pinBackground = LinearGradient(
        colors: [pinGradientTop, pinGradientMid, pinGradientBottom],
        startPoint: .top,
        endPoint: .bottom
    )

    /// Primary text on PIN screens
    static let pinText = Color(light: Color(hex: 0x1A1F2B), dark: .white)

    /// Secondary text on PIN screens (subtitles, links)
    static let pinTextSecondary = Color(light: Color(hex: 0x5A6070), dark: .white.opacity(0.5))

    /// Numpad button fill
    static let pinButtonFill = Color(light: Color(hex: 0x1A1F2B).opacity(0.06), dark: .white.opacity(0.08))

    /// Numpad button stroke
    static let pinButtonStroke = Color(light: Color(hex: 0x1A1F2B).opacity(0.10), dark: .white.opacity(0.15))

    /// PIN dot color (filled state)
    static let pinDotFilled = Color(light: Color(hex: 0x1A1F2B), dark: .white)

    /// PIN dot color (empty state)
    static let pinDotEmpty = Color(light: Color(hex: 0x1A1F2B).opacity(0.2), dark: .white.opacity(0.3))

    /// Recovery key input field background
    static let pinInputBackground = Color(light: Color(hex: 0x1A1F2B).opacity(0.05), dark: .white.opacity(0.08))

    /// Recovery key input field border
    static let pinInputBorder = Color(light: Color(hex: 0x1A1F2B).opacity(0.12), dark: .white.opacity(0.15))

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
