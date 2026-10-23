enum BudgetListRefreshPolicy {
    static func shouldLoadAfterTabChange(from oldTab: Tab, to newTab: Tab) -> Bool {
        oldTab != .budgets && newTab == .budgets
    }

    static func shouldLoadAfterPathChange(from oldCount: Int, to newCount: Int, selectedTab: Tab) -> Bool {
        selectedTab == .budgets && oldCount > 0 && newCount == 0
    }

    static func shouldLoadAfterInvalidation(selectedTab: Tab) -> Bool {
        selectedTab == .budgets
    }
}
