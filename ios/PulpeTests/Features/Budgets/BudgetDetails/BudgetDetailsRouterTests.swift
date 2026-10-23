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

    // MARK: - Withdrawal → its budget (PUL-329)

    /// A withdrawal listed on a goal leads to the budget that received it, and
    /// pushes onto the stack the user is looking at — switching tabs would drop
    /// them into the budgets section with a back button pointing at a list they
    /// never opened. One entry, so one Back returns to the goal: the destination
    /// used to carry the funded transaction's id as well, and landing on the
    /// budget then pushed that transaction's editor on top of it.
    @Test func withdrawalDestination_pushesTheBudgetAloneOntoTheStackInView() {
        let appState = AppState()
        appState.selectedTab = .savingsGoals

        appState.pushOnActiveStack(BudgetDestination.details(budgetId: "budget-1"))

        #expect(appState.savingsGoalsPath.count == 1)
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
    @Test func rootEntry_selectsMonthAndKeepsOtherStacks() {
        let appState = AppState()
        appState.currentMonthPath.append("origin")

        appState.openBudget("new-month", year: 2027)

        #expect(appState.selectedTab == .budgets)
        #expect(appState.selectedBudgetId == "new-month")
        #expect(appState.budgetYear == 2027)
        #expect(appState.budgetPath.isEmpty)
        #expect(appState.currentMonthPath.count == 1)
    }

    @Test(arguments: [Tab.currentMonth, .budgets, .savingsGoals])
    func nestedBudgetAndPop_preserveTheirOrigin(_ tab: Tab) {
        let appState = AppState()
        appState.openBudget("selected-month", year: 2026)
        appState.selectedTab = tab
        let router = BudgetDetailsRouter()
        router.bind(to: appState)
        appState.pushOnActiveStack(BudgetDestination.details(budgetId: "nested-month"))
        #expect(appState.selectedBudgetId == "selected-month")

        router.popToRoot()

        #expect(appState.selectedBudgetId == (tab == .budgets ? nil : "selected-month"))
        #expect(appState.budgetYear == 2026)
        #expect(appState.currentMonthPath.isEmpty)
        #expect(appState.budgetPath.isEmpty)
        #expect(appState.savingsGoalsPath.isEmpty)
    }

    @Test func reopeningTheSameMonth_keepsItsYearAndColdDetailsResolveTheirs() {
        let appState = AppState()
        appState.openBudget("january", year: 2027)
        appState.openBudget("january")
        #expect(appState.budgetYear == 2027)
        appState.openBudget("cold-month")
        #expect(appState.budgetYear == nil)
        appState.updateBudgetSelection("cold-month", year: 2028)
        #expect(appState.budgetYear == 2028)
    }

    @Test(arguments: [false, true])
    func rootEntry_refusesToReplaceAnOpenDraft(pushed: Bool) {
        let appState = AppState()
        appState.openBudget("draft-month", year: 2027)
        appState.budgetRouter.bind(to: appState)
        if pushed {
            appState.budgetRouter.push(.editTx(transactionId: "draft"))
        } else {
            appState.budgetRouter.present(.addBudgetLine)
        }

        appState.openBudget("other-month", year: 2028)

        #expect(appState.selectedBudgetId == "draft-month")
        #expect(appState.budgetYear == 2027)
        #expect(appState.budgetPath.count == (pushed ? 1 : 0))
        #expect((appState.budgetRouter.sheet != nil) == !pushed)
        #expect(appState.toastManager.currentToast?.type == .error)
    }
    @Test func sheetPresentation_retainsTheExactNestedBudgetUntilDismissal() {
        let appState = AppState()
        appState.openBudget("root-month", year: 2026)
        let nested = BudgetDetailsCoordinator(budgetId: "nested-month")
        let router = appState.budgetRouter
        router.present(.addBudgetLine, from: nested)

        appState.updateBudgetSelection("root-month", year: 2026)

        #expect(router.sheetPresentation?.coordinator === nested)
        #expect(router.sheetPresentation?.destination.id == "addBudgetLine")
        router.dismissSheet()
        #expect(router.sheetPresentation == nil)
    }
}
