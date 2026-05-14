import SwiftUI

// MARK: - Preview

#Preview("Budget Detail Hero — Flat") {
    ScrollView {
        VStack(spacing: DesignTokens.Spacing.xxl) {
            // Comfortable with rollover
            BudgetDetailHero(
                metrics: .init(
                    totalIncome: 7500,
                    totalExpenses: 3440,
                    totalSavings: 600,
                    available: 7500,
                    endingBalance: 4060,
                    remaining: 4060,
                    rollover: 0
                ),
                timeElapsedPercentage: 50,
                rolloverAmount: 4060,
                previousBudgetMonth: "mars",
                onRolloverTap: {}
            )

            // Tight: 80-100% used
            BudgetDetailHero(
                metrics: .init(
                    totalIncome: 4300,
                    totalExpenses: 3800,
                    totalSavings: 200,
                    available: 4300,
                    endingBalance: 500,
                    remaining: 500,
                    rollover: 0
                ),
                timeElapsedPercentage: 65
            )

            // Deficit with negative rollover
            BudgetDetailHero(
                metrics: .init(
                    totalIncome: 4121,
                    totalExpenses: 5351,
                    totalSavings: 0,
                    available: 4121,
                    endingBalance: -1230,
                    remaining: -1230,
                    rollover: 0
                ),
                timeElapsedPercentage: 85,
                rolloverAmount: -350,
                previousBudgetMonth: "février"
            )
        }
        .padding(.vertical, DesignTokens.Spacing.lg)
    }
    .pulpeBackground()
    .environment(UserSettingsStore())
}
