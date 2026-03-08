import Foundation
@testable import Pulpe
import Testing

@MainActor
struct CurrentMonthStoreDashboardTests {
    // MARK: - Unchecked Items (Combined) Logic

    @Test func uncheckedItems_freeTransactionsFirst_thenAllocated_thenBudgetLines() {
        let store = CurrentMonthStore()
        store.populateForTesting(
            budgetLines: [
                TestDataFactory.createBudgetLine(id: "bl-1", isChecked: false)
            ],
            transactions: [
                TestDataFactory.createTransaction(id: "alloc-tx", budgetLineId: "line-1", isChecked: false),
                TestDataFactory.createTransaction(id: "free-tx", budgetLineId: nil, isChecked: false)
            ]
        )

        let items = store.uncheckedItems

        #expect(items.count == 3)
        #expect(items[0].id == "tx-free-tx")
        #expect(items[1].id == "tx-alloc-tx")
        #expect(items[2].id == "bl-bl-1")
    }

    @Test func uncheckedItems_excludesCheckedTransactions() {
        let store = CurrentMonthStore()
        store.populateForTesting(
            transactions: [
                TestDataFactory.createTransaction(id: "free", budgetLineId: nil, isChecked: false),
                TestDataFactory.createTransaction(id: "checked", budgetLineId: nil, isChecked: true)
            ]
        )

        let items = store.uncheckedItems

        #expect(items.count == 1)
        #expect(items[0].id == "tx-free")
    }

    @Test func uncheckedItems_limitsTo5Total() {
        let store = CurrentMonthStore()
        store.populateForTesting(
            budgetLines: (0..<4).map { i in
                TestDataFactory.createBudgetLine(id: "bl-\(i)", isChecked: false)
            },
            transactions: (0..<4).map { i in
                TestDataFactory.createTransaction(id: "tx-\(i)", budgetLineId: nil, isChecked: false)
            }
        )

        #expect(store.uncheckedItems.count == 5)
    }

    @Test func uncheckedItems_emptyWhenAllChecked() {
        let store = CurrentMonthStore()
        store.populateForTesting(
            budgetLines: [
                TestDataFactory.createBudgetLine(id: "bl-1", isChecked: true)
            ],
            transactions: [
                TestDataFactory.createTransaction(id: "tx-1", isChecked: true)
            ]
        )

        #expect(store.uncheckedItems.isEmpty)
    }

    // MARK: - Savings Summary Logic

    @Test func savingsSummary_computesFromSavingLines() {
        let store = CurrentMonthStore()
        store.populateForTesting(
            budgetLines: [
                TestDataFactory.createBudgetLine(id: "s1", amount: 500, kind: .saving, isChecked: true),
                TestDataFactory.createBudgetLine(id: "s2", amount: 300, kind: .saving, isChecked: false),
                TestDataFactory.createBudgetLine(id: "e1", amount: 1000, kind: .expense)
            ]
        )

        let summary = store.savingsSummary

        #expect(summary.totalPlanned == 800)
        #expect(summary.checkedCount == 1)
        #expect(summary.totalCount == 2)
    }

    @Test func savingsSummary_excludesRolloverLines() {
        let store = CurrentMonthStore()
        store.populateForTesting(
            budgetLines: [
                TestDataFactory.createBudgetLine(id: "s1", amount: 500, kind: .saving, isChecked: false),
                TestDataFactory.createBudgetLine(id: "sr", amount: 200, kind: .saving, isRollover: true)
            ]
        )

        let summary = store.savingsSummary

        #expect(summary.totalCount == 1)
        #expect(summary.totalPlanned == 500)
    }

    // MARK: - SavingsSummary Struct

    @Test func savingsSummary_progressPercentageBasic() {
        let summary = CurrentMonthStore.SavingsSummary(
            totalPlanned: 1000,
            totalRealized: 600,
            checkedCount: 2,
            totalCount: 3
        )

        #expect(summary.progressPercentage == 60)
        #expect(!summary.isComplete)
        #expect(summary.hasSavings)
    }

    @Test func savingsSummary_progressPercentageCappedAt100() {
        let summary = CurrentMonthStore.SavingsSummary(
            totalPlanned: 500,
            totalRealized: 700,
            checkedCount: 3,
            totalCount: 3
        )

        #expect(summary.progressPercentage == 100)
        #expect(summary.isComplete)
    }

    @Test func savingsSummary_progressPercentageFlooredAtZero() {
        let summary = CurrentMonthStore.SavingsSummary(
            totalPlanned: 500,
            totalRealized: -100,
            checkedCount: 0,
            totalCount: 2
        )

        #expect(summary.progressPercentage == 0)
        #expect(!summary.isComplete)
    }

    @Test func savingsSummary_zeroPlannedReturnsZeroPercentage() {
        let summary = CurrentMonthStore.SavingsSummary(
            totalPlanned: 0,
            totalRealized: 0,
            checkedCount: 0,
            totalCount: 0
        )

        #expect(summary.progressPercentage == 0)
        #expect(!summary.isComplete)
        #expect(!summary.hasSavings)
    }

    @Test func savingsSummary_hasSavingsWhenRealizedOnly() {
        let summary = CurrentMonthStore.SavingsSummary(
            totalPlanned: 0,
            totalRealized: 200,
            checkedCount: 1,
            totalCount: 0
        )

        #expect(summary.hasSavings)
    }

    @Test func savingsSummary_isCompleteRequiresPlannedAmount() {
        let summary = CurrentMonthStore.SavingsSummary(
            totalPlanned: 0,
            totalRealized: 0,
            checkedCount: 0,
            totalCount: 0
        )

        #expect(!summary.isComplete)
    }
}
