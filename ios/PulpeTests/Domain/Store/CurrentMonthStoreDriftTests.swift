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

    @Test func uncheckedTotals_countsBeyondDisplayCapAndSumsAmounts() {
        let store = CurrentMonthStore()
        store.populateForTesting(
            budgetLines: (0..<4).map { index in
                TestDataFactory.createBudgetLine(id: "bl-\(index)", amount: 100)
            },
            transactions: (0..<4).map { index in
                TestDataFactory.createTransaction(id: "tx-\(index)", amount: 10)
            }
        )

        let totals = store.uncheckedTotals

        #expect(store.uncheckedItems.count == 5) // display cap
        #expect(totals.count == 8)               // real total
        #expect(totals.amount == 440)
    }

    @Test func uncheckedTotals_excludesCheckedAndRollover() {
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

        let totals = store.uncheckedTotals

        #expect(totals.count == 1)
        #expect(totals.amount == 100)
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
