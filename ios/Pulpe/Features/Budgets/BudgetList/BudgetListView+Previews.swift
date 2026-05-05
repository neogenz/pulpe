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

#Preview("Current Month Hero Card") {
    CurrentMonthHeroCard(budget: BudgetSparse(id: "1", month: 2, year: 2026, remaining: 2350.50)) {}
        .padding()
        .pulpeBackground()
        .environment(UserSettingsStore())
}

#Preview("Current Month Hero Card - Negative") {
    CurrentMonthHeroCard(budget: BudgetSparse(id: "2", month: 2, year: 2026, remaining: -450.25)) {}
        .padding()
        .pulpeBackground()
        .environment(UserSettingsStore())
}

#Preview("Next Month Empty State") {
    NextMonthPlaceholder(month: 3, year: 2026) {}
        .padding()
        .pulpeBackground()
        .environment(UserSettingsStore())
}

#Preview("Year Picker") {
    @Previewable @State var selectedYear = 2026
    YearPicker(years: [2025, 2026, 2027], selectedYear: $selectedYear)
        .padding()
        .pulpeBackground()
}

#Preview("Budget Month Card - Past") {
    BudgetMonthCard(
        budget: BudgetSparse(
            id: "1", month: 1, year: 2026,
            totalExpenses: 1931.48, totalIncome: 5000, remaining: 3068.52
        )
    ) {}
        .padding()
        .environment(UserSettingsStore())
}

#Preview("Budget Month Card - Future") {
    BudgetMonthCard(
        budget: BudgetSparse(
            id: "2", month: 4, year: 2026,
            totalExpenses: 3000, totalIncome: 4500, remaining: 1500
        )
    ) {}
        .padding()
        .environment(UserSettingsStore())
}
