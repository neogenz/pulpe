import SwiftUI
import TipKit

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
}

#Preview("Gestures Tip") {
    List {
        Section("Dépenses") {
            TipView(ProductTips.gestures)
            Text("Courses alimentaires")
        }
    }
    .listStyle(.insetGrouped)
    .scrollContentBackground(.hidden)
    .pulpeBackground()
    .task { try? Tips.resetDatastore() }
}
