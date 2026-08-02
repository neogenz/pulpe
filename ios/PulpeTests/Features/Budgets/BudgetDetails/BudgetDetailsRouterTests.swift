import Foundation
@testable import Pulpe
import Testing

/// Navigation seam for pushing a linked savings goal from a saving prévision's
/// detail (PUL-12). The router is the sole writer of `appState.budgetPath`
/// inside the BudgetDetails feature, so the goal push flows through it.
@MainActor
@Suite("BudgetDetailsRouter savings goal push")
struct BudgetDetailsRouterTests {
    private func makeGoal(id: String = "goal-1", name: String = "Maison") -> SavingsGoal {
        SavingsGoal(
            id: id,
            userId: "user-1",
            name: name,
            targetAmount: 50000,
            targetDate: "2099-01-01",
            status: .active,
            createdAt: Date(timeIntervalSince1970: 0),
            updatedAt: Date(timeIntervalSince1970: 0)
        )
    }

    @Test func pushSavingsGoal_appendsGoalDetailToBudgetPath() {
        let appState = AppState()
        appState.selectedTab = .budgets
        let router = BudgetDetailsRouter()
        router.bind(to: appState)

        router.pushSavingsGoal(makeGoal())

        #expect(appState.budgetPath.count == 1)
    }

    /// The budget detail is also reachable from the accueil. Pushing from there onto the
    /// budgets stack sent the row to a screen nobody was looking at, and left the visible
    /// back button pointing at the budget list instead of the accueil.
    @Test func pushSavingsGoal_fromCurrentMonth_staysOnTheCurrentMonthStack() {
        let appState = AppState()
        appState.selectedTab = .currentMonth
        let router = BudgetDetailsRouter()
        router.bind(to: appState)

        router.pushSavingsGoal(makeGoal())

        #expect(appState.currentMonthPath.count == 1)
        #expect(appState.budgetPath.isEmpty)
    }

    @Test func popToRoot_unwindsTheStackTheDetailWasOpenedFrom() {
        let appState = AppState()
        appState.selectedTab = .currentMonth
        let router = BudgetDetailsRouter()
        router.bind(to: appState)
        router.pushSavingsGoal(makeGoal())

        router.popToRoot()

        #expect(appState.currentMonthPath.isEmpty)
        #expect(appState.budgetPath.isEmpty)
    }
}
