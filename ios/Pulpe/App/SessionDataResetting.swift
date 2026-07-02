import Foundation

/// Protocol for resetting feature store data during session teardown.
@MainActor
protocol SessionDataResetting {
    func resetStores()
}

/// Production implementation that resets all feature stores.
@MainActor
final class LiveSessionDataResetter: SessionDataResetting {
    private let currentMonthStore: CurrentMonthStore
    private let budgetListStore: BudgetListStore
    private let dashboardStore: DashboardStore
    private let userSettingsStore: UserSettingsStore
    private let savingsGoalStore: SavingsGoalStore

    init(
        currentMonthStore: CurrentMonthStore,
        budgetListStore: BudgetListStore,
        dashboardStore: DashboardStore,
        userSettingsStore: UserSettingsStore,
        savingsGoalStore: SavingsGoalStore
    ) {
        self.currentMonthStore = currentMonthStore
        self.budgetListStore = budgetListStore
        self.dashboardStore = dashboardStore
        self.userSettingsStore = userSettingsStore
        self.savingsGoalStore = savingsGoalStore
    }

    func resetStores() {
        currentMonthStore.reset()
        budgetListStore.reset()
        dashboardStore.reset()
        userSettingsStore.reset()
        savingsGoalStore.reset()
    }
}
