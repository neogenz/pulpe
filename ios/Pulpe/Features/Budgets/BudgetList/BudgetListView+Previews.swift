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

#Preview("Year Picker") {
    @Previewable @State var selectedYear = 2026
    YearPicker(years: [2025, 2026, 2027], selectedYear: $selectedYear)
        .padding()
        .background(Color.heroSurface)
}

#Preview("Month Ledger") {
    VStack(spacing: 0) {
        BudgetMonthRow(
            budget: BudgetSparse(
                id: "1", month: 1, year: 2026,
                totalExpenses: 1931.48, totalIncome: 5000, remaining: 3068.52
            ),
            isPast: true
        ) {}
        Divider()
        BudgetMonthRow(
            budget: BudgetSparse(id: "2", month: 2, year: 2026, remaining: -450.25),
            isCurrent: true
        ) {}
        Divider()
        NextMonthRow(month: 3, adjustment: 1200) {}
    }
    .padding(.horizontal, DesignTokens.Spacing.lg)
    .pulpeCardBackground(cornerRadius: DesignTokens.CornerRadius.card)
    .padding()
    .pulpeBackground()
    .environment(UserSettingsStore())
}
