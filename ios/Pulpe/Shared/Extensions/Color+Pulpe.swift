import SwiftUI

extension Color {

    // MARK: - Financial Colors (from Asset Catalog with light/dark/high-contrast variants)

    /// Income indicator color - Blue (#0056A3 light, #5AA8E0 dark)
    static let financialIncome = Color("FinancialIncome")

    /// Expense indicator color - Orange (#B35800 light, #F0A050 dark)
    static let financialExpense = Color("FinancialExpense")

    /// Savings indicator color - Green (#1E8A4C light, #50C882 dark)
    static let financialSavings = Color("FinancialSavings")

    // MARK: - Brand Colors

    /// Primary brand color - Dark green (#006820 light, #4AA070 dark)
    static let pulpePrimary = Color("PulpePrimary")

    // MARK: - Semantic Text Colors

    /// Tertiary text with improved contrast (40% opacity light, 50% dark)
    static let textTertiary = Color("TextTertiary")

    // MARK: - Component Colors

    /// Background for count badges in section headers
    static let countBadge = Color("CountBadge")

    /// Background track for progress indicators
    static let progressTrack = Color("ProgressTrack")

    /// Border color for input fields (unfocused state)
    static let inputBorder = Color("InputBorder")

    /// Generic badge background
    static let badgeBackground = Color("BadgeBackground")

    /// Input field background - softer than systemGray6
    static let inputBackgroundSoft = Color(light: Color(hex: 0xF5F5F7), dark: Color(hex: 0x1C1C1E))

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
