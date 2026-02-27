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
}

#Preview("Current Month Hero Card - Negative") {
    CurrentMonthHeroCard(budget: BudgetSparse(id: "2", month: 2, year: 2026, remaining: -450.25)) {}
        .padding()
        .pulpeBackground()
}

#Preview("Next Month Empty State") {
    NextMonthPlaceholder(month: 3, year: 2026) {}
        .padding()
        .pulpeBackground()
}

#Preview("Year Section - Current Year") {
    YearSection(
        year: 2026,
        budgets: [
            BudgetSparse(id: "1", month: 1, year: 2026, remaining: 3068.52),
            BudgetSparse(id: "2", month: 2, year: 2026, remaining: 1309.02)
        ],
        isExpanded: true,
        onToggle: {},
        onSelect: { _ in },
        onCreateBudget: { _, _ in }
    )
    .padding()
    .pulpeBackground()
}

#Preview("Budget Month Row - Past") {
    BudgetMonthRow(budget: BudgetSparse(id: "1", month: 1, year: 2026, remaining: 3068.52)) {}
        .padding()
        .pulpeCardBackground()
}

#Preview("Budget Month Row - Future") {
    BudgetMonthRow(budget: BudgetSparse(id: "2", month: 4, year: 2026, remaining: 1500.00)) {}
        .padding()
        .pulpeCardBackground()
}
