import Foundation
@testable import Pulpe
import Testing

@Suite("BudgetsTab month beside the list")
struct BudgetsTabShownBudgetTests {
    private let current = BudgetPeriodCalculator.periodForDate(Date(), payDayOfMonth: nil)

    private var budgets: [BudgetSparse] {
        [
            BudgetSparse(id: "past", month: 1, year: current.year - 1),
            BudgetSparse(id: "current", month: current.month, year: current.year),
            BudgetSparse(id: "future", month: 1, year: current.year + 1),
        ]
    }

    @Test func shownBudgetId_existingSelection_keepsIt() {
        #expect(BudgetsTab.shownBudgetId(selection: "past", budgets: budgets, payDayOfMonth: nil) == "past")
    }

    @Test func shownBudgetId_noSelection_showsMonthInProgress() {
        #expect(BudgetsTab.shownBudgetId(selection: nil, budgets: budgets, payDayOfMonth: nil) == "current")
    }

    @Test func shownBudgetId_deletedSelection_fallsBackToMonthInProgress() {
        #expect(BudgetsTab.shownBudgetId(selection: "deleted", budgets: budgets, payDayOfMonth: nil) == "current")
    }

    @Test func shownBudgetId_noMonthInProgress_showsLatest() {
        let withoutCurrent = budgets.filter { $0.id != "current" }
        #expect(BudgetsTab.shownBudgetId(selection: nil, budgets: withoutCurrent, payDayOfMonth: nil) == "future")
    }

    @Test func shownBudgetId_noBudgets_showsNothing() {
        #expect(BudgetsTab.shownBudgetId(selection: "past", budgets: [], payDayOfMonth: nil) == nil)
    }
}

/// The widget opens a month: pushed on top of the list, or made the selection when the list
/// sits beside its month, where a push would stack a second copy of the page.
@MainActor
@Suite("Opening a month from the widget")
struct OpenBudgetMonthTests {
    @Test func openBudgetMonth_listBesideMonth_selectsWithoutPushing() async {
        let appState = AppState()
        appState.showsBudgetMonthBesideList = true

        appState.openBudgetMonth("budget-1")
        await waitForCondition { appState.selectedTab == .budgets }

        #expect(appState.budgetSelection == "budget-1")
        #expect(appState.budgetPath.isEmpty)
    }

    @Test func openBudgetMonth_listAlone_pushesTheMonth() async {
        let appState = AppState()

        appState.openBudgetMonth("budget-1")
        await waitForCondition { appState.selectedTab == .budgets }

        #expect(appState.budgetPath.count == 1)
    }
}
