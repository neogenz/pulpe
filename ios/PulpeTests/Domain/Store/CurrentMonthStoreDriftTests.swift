import Foundation
@testable import Pulpe
import Testing

@MainActor
struct CurrentMonthStoreDriftTests {
    // MARK: - Drift Lines

    @Test func driftLines_flagsOnlyExpenseEnvelopesOverPlan() {
        let store = CurrentMonthStore()
        store.populateForTesting(
            budgetLines: [
                TestDataFactory.createBudgetLine(id: "over", name: "Zalando", amount: 94),
                TestDataFactory.createBudgetLine(id: "under", name: "Courses", amount: 700),
                TestDataFactory.createBudgetLine(id: "income-over", name: "Salaire", amount: 100, kind: .income)
            ],
            transactions: [
                TestDataFactory.createTransaction(id: "t1", budgetLineId: "over", amount: 1047),
                TestDataFactory.createTransaction(id: "t2", budgetLineId: "under", amount: 300),
                TestDataFactory.createTransaction(id: "t3", budgetLineId: "income-over", amount: 500, kind: .income)
            ]
        )

        let drifts = store.driftLines

        #expect(drifts.count == 1)
        #expect(drifts.first?.line.id == "over")
        #expect(store.driftTotal == 953)
    }

    @Test func driftLines_sortedByBiggestOverrunFirst() {
        let store = CurrentMonthStore()
        store.populateForTesting(
            budgetLines: [
                TestDataFactory.createBudgetLine(id: "small", amount: 700),
                TestDataFactory.createBudgetLine(id: "big", amount: 94)
            ],
            transactions: [
                TestDataFactory.createTransaction(id: "t1", budgetLineId: "small", amount: 1003),
                TestDataFactory.createTransaction(id: "t2", budgetLineId: "big", amount: 1047)
            ]
        )

        #expect(store.driftLines.map(\.line.id) == ["big", "small"])
        let expectedTotal: Decimal = 1256 // 953 + 303
        #expect(store.driftTotal == expectedTotal)
    }

    @Test func driftLines_includesZeroAmountEnvelopeWithSpending() {
        let store = CurrentMonthStore()
        store.populateForTesting(
            budgetLines: [
                TestDataFactory.createBudgetLine(id: "zero", amount: 0)
            ],
            transactions: [
                TestDataFactory.createTransaction(id: "t1", budgetLineId: "zero", amount: 50)
            ]
        )

        #expect(store.driftLines.count == 1)
        #expect(store.driftTotal == 50)
    }

    @Test func driftLines_excludesRolloverAndEmptyWhenOnPlan() {
        let store = CurrentMonthStore()
        store.populateForTesting(
            budgetLines: [
                TestDataFactory.createBudgetLine(id: "roll", amount: 10, isRollover: true),
                TestDataFactory.createBudgetLine(id: "ok", amount: 500)
            ],
            transactions: [
                TestDataFactory.createTransaction(id: "t1", budgetLineId: "roll", amount: 100),
                TestDataFactory.createTransaction(id: "t2", budgetLineId: "ok", amount: 500)
            ]
        )

        #expect(store.driftLines.isEmpty)
        #expect(store.driftTotal == 0)
    }

    // MARK: - Unchecked Totals

    @Test func uncheckedCount_countsBeyondDisplayCap() {
        let store = CurrentMonthStore()
        store.populateForTesting(
            budgetLines: (0..<4).map { index in
                TestDataFactory.createBudgetLine(id: "bl-\(index)", amount: 100)
            },
            transactions: (0..<4).map { index in
                TestDataFactory.createTransaction(id: "tx-\(index)", amount: 10)
            }
        )

        #expect(store.uncheckedItems.count == 5) // display cap
        #expect(store.uncheckedCount == 8)       // real total
    }

    @Test func uncheckedCount_excludesCheckedAndRollover() {
        let store = CurrentMonthStore()
        store.populateForTesting(
            budgetLines: [
                TestDataFactory.createBudgetLine(id: "checked", amount: 100, isChecked: true),
                TestDataFactory.createBudgetLine(id: "roll", amount: 100, isRollover: true),
                TestDataFactory.createBudgetLine(id: "open", amount: 100)
            ],
            transactions: [
                TestDataFactory.createTransaction(id: "checked-tx", amount: 10, isChecked: true)
            ]
        )

        #expect(store.uncheckedCount == 1)
    }

    // MARK: - Days Remaining

    /// Regression: diffing a timestamped `now` against midnight of the last day truncated
    /// today away — "Jour 23/31" (9 days left incl. today) divided by 8, inflating the
    /// daily allowance by ~13% and up to ~2× on day 30.
    @Test func daysRemaining_midDayTimestamp_includesToday() throws {
        let store = CurrentMonthStore()
        let calendar = Calendar.current

        // July 23 at 14:37 — any intra-day time must count the same as midnight.
        let midDay = try #require(calendar.date(from: DateComponents(
            year: 2026, month: 7, day: 23, hour: 14, minute: 37
        )))

        let days = store.daysRemaining(now: midDay)

        #expect(days == 9) // 23, 24, 25, 26, 27, 28, 29, 30, 31

        // Must agree with periodDayProgress: totalDays - day + 1.
        store.populateForTesting(budget: TestDataFactory.createBudget(id: "b", month: 7, year: 2026))
        let progress = try #require(store.periodDayProgress(now: midDay))
        #expect(days == progress.totalDays - progress.day + 1)
    }

    @Test func daysRemaining_lastDayOfMonth_returns1() throws {
        let store = CurrentMonthStore()
        let lateLastDay = try #require(Calendar.current.date(from: DateComponents(
            year: 2026, month: 7, day: 31, hour: 22, minute: 5
        )))

        #expect(store.daysRemaining(now: lateLastDay) == 1)
    }

    // MARK: - Period Day Progress

    @Test func periodDayProgress_calendarMonth_clampsWithinPeriod() throws {
        let store = CurrentMonthStore()
        store.populateForTesting(budget: TestDataFactory.createBudget(month: 1, year: 2025))

        let midJanuary = try #require(
            Calendar.current.date(from: DateComponents(year: 2025, month: 1, day: 17))
        )
        let progress = store.periodDayProgress(now: midJanuary)

        #expect(progress?.day == 17)
        #expect(progress?.totalDays == 31)
    }

    @Test func periodDayProgress_outsidePeriod_staysClamped() throws {
        let store = CurrentMonthStore()
        store.populateForTesting(budget: TestDataFactory.createBudget(month: 1, year: 2025))

        let march = try #require(
            Calendar.current.date(from: DateComponents(year: 2025, month: 3, day: 10))
        )
        let progress = store.periodDayProgress(now: march)

        #expect(progress?.day == 31)
        #expect(progress?.totalDays == 31)
    }

    @Test func periodDayProgress_nilWithoutBudget() {
        let store = CurrentMonthStore()

        #expect(store.periodDayProgress() == nil)
    }
}
