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

    // MARK: - Gradient Colors

    static let pulpeGradientColors: [Color] = [
        Color(hex: 0x0088FF),
        Color(hex: 0x00DDAA),
        Color(hex: 0x00FF55),
        Color(hex: 0x88FF44)
    ]

    // MARK: - Onboarding & Tutorial Colors

    /// High-contrast text colors for onboarding
    static let textPrimaryOnboarding = Color(hex: 0x1A1A1A)
    static let textSecondaryOnboarding = Color(hex: 0x4A4A4A)
    static let textTertiaryOnboarding = Color(hex: 0x6B6B6B)

    /// Onboarding backgrounds
    static let onboardingBackground = Color(hex: 0xF8FAF9)
    static let onboardingCardBackground = Color.white

    /// Mint green background matching landing page suggestion
    static let mintBackground = Color(hex: 0xBDF5B7)

    /// Tutorial overlay with better contrast
    static let tutorialOverlay = Color.black.opacity(0.85)
    static let tutorialSpotlightGlow = Color(hex: 0x00C853).opacity(0.3)

    /// Step category colors for visual distinction
    static let stepIncome = Color(hex: 0x2E7D32)
    static let stepHousing = Color(hex: 0x1565C0)
    static let stepHealth = Color(hex: 0xC62828)
    static let stepPhone = Color(hex: 0x6A1B9A)
    static let stepTransport = Color(hex: 0xEF6C00)
    static let stepCredit = Color(hex: 0x37474F)

    /// Onboarding accent gradient
    static let onboardingGradient = LinearGradient(
        colors: [Color(hex: 0x006E25), Color(hex: 0x00A838)],
        startPoint: .leading,
        endPoint: .trailing
    )

    // MARK: - Hex Initializer (for gradients only)

    init(hex: UInt) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}
