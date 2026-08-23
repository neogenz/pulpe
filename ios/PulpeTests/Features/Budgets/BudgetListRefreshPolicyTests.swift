@testable import Pulpe
import Testing

struct BudgetListRefreshPolicyTests {
    @Test
    func navigationRefreshPolicy_onlyAcceptsVisibleReturnsToRoot() {
        #expect(BudgetListRefreshPolicy.shouldLoadAfterTabChange(
            from: .currentMonth,
            to: .budgets,
            pathCount: 0
        ))
        #expect(!BudgetListRefreshPolicy.shouldLoadAfterTabChange(
            from: .budgets,
            to: .currentMonth,
            pathCount: 0
        ))
        #expect(!BudgetListRefreshPolicy.shouldLoadAfterTabChange(
            from: .currentMonth,
            to: .budgets,
            pathCount: 1
        ))

        #expect(BudgetListRefreshPolicy.shouldLoadAfterPathChange(from: 1, to: 0, selectedTab: .budgets))
        #expect(!BudgetListRefreshPolicy.shouldLoadAfterPathChange(from: 1, to: 0, selectedTab: .currentMonth))
        #expect(!BudgetListRefreshPolicy.shouldLoadAfterPathChange(from: 0, to: 1, selectedTab: .budgets))
        #expect(!BudgetListRefreshPolicy.shouldLoadAfterPathChange(from: 1, to: 2, selectedTab: .budgets))

        #expect(BudgetListRefreshPolicy.shouldLoadAfterInvalidation(selectedTab: .budgets, pathCount: 0))
        #expect(!BudgetListRefreshPolicy.shouldLoadAfterInvalidation(selectedTab: .currentMonth, pathCount: 0))
        #expect(!BudgetListRefreshPolicy.shouldLoadAfterInvalidation(selectedTab: .budgets, pathCount: 1))
    }
}
