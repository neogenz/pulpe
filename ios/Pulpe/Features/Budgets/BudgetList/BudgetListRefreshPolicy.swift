enum BudgetListRefreshPolicy {
    static func shouldLoadAfterTabChange(from oldTab: Tab, to newTab: Tab, pathCount: Int) -> Bool {
        oldTab != .budgets && newTab == .budgets && pathCount == 0
    }

    static func shouldLoadAfterPathChange(from oldCount: Int, to newCount: Int, selectedTab: Tab) -> Bool {
        selectedTab == .budgets && oldCount > 0 && newCount == 0
    }

    static func shouldLoadAfterInvalidation(selectedTab: Tab, pathCount: Int) -> Bool {
        selectedTab == .budgets && pathCount == 0
    }
}
