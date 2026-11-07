import SwiftUI

#Preview("Budget List") {
    NavigationStack {
        BudgetListView()
    }
    .environment(AppState())
    .environment(CurrentMonthStore())
    .environment(BudgetListStore())
    .environment(UserSettingsStore())
}

#Preview("Month Ledger") {
    VStack(spacing: DesignTokens.Spacing.lg) {
        BudgetMonthRow(
            budget: BudgetSparse(
                id: "2", month: 11, year: 2026,
                totalExpenses: 4000, totalIncome: 5000, remaining: 1248.50
            ),
            periodLabel: "25 oct. au 24 nov. · jour 10 sur 31",
            role: .current
        ) {}
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .pulpeSurfaceCard()
        VStack(spacing: DesignTokens.Spacing.none) {
            BudgetMonthRow(budget: BudgetSparse(id: "1", month: 3, year: 2026, remaining: -45.20), role: .closed) {}
            FormRowDivider()
            BudgetMonthRow(budget: BudgetSparse(id: "3", month: 2, year: 2026, remaining: 180), role: .closed) {}
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .pulpeSurfaceCard()
        NextFreeMonthCard(month: (11, 2027), onCreate: {}, onPlan: {})
    }
    .padding()
    .pulpeBackground()
    .environment(UserSettingsStore())
}
