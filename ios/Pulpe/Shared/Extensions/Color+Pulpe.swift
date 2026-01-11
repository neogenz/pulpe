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

    // MARK: - Hex Initializer (for gradients only)

    init(hex: UInt) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}
