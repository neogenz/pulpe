import Foundation
@testable import Pulpe
import Testing

/// Tests for the payDay race condition where `CurrentMonthView.task` can trigger
/// `forceRefresh()` with nil payDay before `loadBudgetSummary` sets the correct one.
///
/// The race: forceRefresh(nil) → March budget loaded → loadBudgetSummary(27) early-returns
/// because budget is already set → app stuck on March instead of April.
@Suite("PayDay race condition")
@MainActor
struct CurrentMonthStorePayDayRaceTests {
    // MARK: - loadBudgetSummary should detect stale period

    @Test func loadBudgetSummary_withWrongPeriodBudget_doesNotEarlyReturn() async {
        let store = CurrentMonthStore()

        // Simulate forceRefresh(nil) having loaded a budget for a stale period
        store.populateForTesting(
            budget: TestDataFactory.createBudget(month: 1, year: 2020)
        )
        #expect(store.contentState == .loaded)

        // Now call loadBudgetSummary with a payDay — the current period won't match Jan 2020
        await store.loadBudgetSummary(payDayOfMonth: 27)

        // It should NOT early-return. Since there's no backend, it will fail or show empty.
        // The key assertion: contentState must NOT be .loaded with the stale budget.
        let stillHasOldBudget = store.budget?.month == 1 && store.budget?.year == 2020
        #expect(!stillHasOldBudget, "loadBudgetSummary should not keep a budget from the wrong period")
    }

    @Test func loadBudgetSummary_withCorrectPeriodBudget_earlyReturns() async {
        let store = CurrentMonthStore()

        // Populate with a budget matching the current calendar period (no custom payDay)
        let now = Date()
        let calendar = Calendar.current
        let currentMonth = calendar.component(.month, from: now)
        let currentYear = calendar.component(.year, from: now)

        store.populateForTesting(
            budget: TestDataFactory.createBudget(month: currentMonth, year: currentYear)
        )
        #expect(store.contentState == .loaded)

        // loadBudgetSummary with nil payDay → calendar period → matches → should early-return
        await store.loadBudgetSummary(payDayOfMonth: nil)

        // Should still be loaded with the same budget (early return, no reload)
        #expect(store.contentState == .loaded)
        #expect(store.budget?.month == currentMonth)
        #expect(store.budget?.year == currentYear)
    }

    // MARK: - loadBudgetSummary cancels stale in-flight loads

    @Test func loadBudgetSummary_setsPayDayOfMonth() async {
        let store = CurrentMonthStore()

        #expect(store.payDayOfMonth == nil)

        // Even if it fails (no backend), payDayOfMonth must be set
        await store.loadBudgetSummary(payDayOfMonth: 27)

        #expect(store.payDayOfMonth == 27)
    }
}
