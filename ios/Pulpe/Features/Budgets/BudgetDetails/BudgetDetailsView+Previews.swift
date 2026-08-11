import SwiftUI

// MARK: - Previews

#Preview {
    NavigationStack {
        BudgetDetailsView(budgetId: "test")
    }
    .environment(AppState())
    .environment(BudgetDetailsRouter())
    .environment(UserSettingsStore())
    .environment(BudgetListStore())
    .environment(DashboardStore())
    .environment(CurrentMonthStore())
    .environment(SavingsGoalStore())
    .environment(TagStore())
}
