@testable import Pulpe
import Testing

struct BudgetListRefreshPolicyTests {
    @Test
    func navigationRefreshPolicy_refreshesTheActiveSidebar() {
        #expect(BudgetListRefreshPolicy.shouldLoadAfterTabChange(
            from: .currentMonth,
            to: .budgets
        ))
        #expect(!BudgetListRefreshPolicy.shouldLoadAfterTabChange(
            from: .budgets,
            to: .currentMonth
        ))

        #expect(BudgetListRefreshPolicy.shouldLoadAfterPathChange(from: 1, to: 0, selectedTab: .budgets))
        #expect(!BudgetListRefreshPolicy.shouldLoadAfterPathChange(from: 1, to: 0, selectedTab: .currentMonth))
        #expect(!BudgetListRefreshPolicy.shouldLoadAfterPathChange(from: 0, to: 1, selectedTab: .budgets))
        #expect(!BudgetListRefreshPolicy.shouldLoadAfterPathChange(from: 1, to: 2, selectedTab: .budgets))

        #expect(BudgetListRefreshPolicy.shouldLoadAfterInvalidation(selectedTab: .budgets))
        #expect(!BudgetListRefreshPolicy.shouldLoadAfterInvalidation(selectedTab: .currentMonth))
    }
}
