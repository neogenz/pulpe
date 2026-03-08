import Foundation
@testable import Pulpe
import Testing

struct CurrentMonthStoreDashboardTests {
    // MARK: - Unchecked Budget Lines Logic

    @Test func uncheckedBudgetLines_filtersUncheckedNonRollover() {
        let checked = TestDataFactory.createBudgetLine(id: "checked", isChecked: true)
        let unchecked = TestDataFactory.createBudgetLine(id: "unchecked", isChecked: false)
        let rollover = TestDataFactory.createBudgetLine(id: "rollover", isChecked: false, isRollover: true)

        let lines = [checked, unchecked, rollover]

        let result = Array(
            lines
                .filter { !$0.isChecked && !($0.isRollover ?? false) }
                .sorted { $0.createdAt > $1.createdAt }
                .prefix(5)
        )

        #expect(result.count == 1)
        #expect(result[0].id == "unchecked")
    }

    @Test func uncheckedBudgetLines_limitsTo5() {
        let lines = (0..<8).map { i in
            TestDataFactory.createBudgetLine(id: "line-\(i)", isChecked: false)
        }

        let result = Array(
            lines
                .filter { !$0.isChecked && !($0.isRollover ?? false) }
                .sorted { $0.createdAt > $1.createdAt }
                .prefix(5)
        )

        #expect(result.count == 5)
    }

    @Test func uncheckedBudgetLines_returnsEmptyWhenAllChecked() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "line-1", isChecked: true),
            TestDataFactory.createBudgetLine(id: "line-2", isChecked: true)
        ]

        let result = Array(
            lines
                .filter { !$0.isChecked && !($0.isRollover ?? false) }
                .prefix(5)
        )

        #expect(result.isEmpty)
    }

    @Test func uncheckedBudgetLines_sortsByKindIncomeThenExpenseThenSaving() {
        let kindOrder: [TransactionKind] = [.income, .expense, .saving]
        let saving = TestDataFactory.createBudgetLine(id: "saving", kind: .saving, isChecked: false)
        let expense = TestDataFactory.createBudgetLine(id: "expense", kind: .expense, isChecked: false)
        let income = TestDataFactory.createBudgetLine(id: "income", kind: .income, isChecked: false)

        let lines = [saving, expense, income]

        let result = Array(
            lines
                .filter { !$0.isChecked && !($0.isRollover ?? false) }
                .sorted {
                    let lhs = kindOrder.firstIndex(of: $0.kind) ?? 99
                    let rhs = kindOrder.firstIndex(of: $1.kind) ?? 99
                    if lhs != rhs { return lhs < rhs }
                    return $0.createdAt > $1.createdAt
                }
                .prefix(5)
        )

        #expect(result.count == 3)
        #expect(result[0].id == "income")
        #expect(result[1].id == "expense")
        #expect(result[2].id == "saving")
    }

    // MARK: - Unchecked Items (Combined) Logic

    @Test func uncheckedItems_freeTransactionsFirst_thenAllocated_thenBudgetLines() {
        let freeTx = TestDataFactory.createTransaction(id: "free-tx", budgetLineId: nil, isChecked: false)
        let allocatedTx = TestDataFactory.createTransaction(id: "alloc-tx", budgetLineId: "line-1", isChecked: false)
        let budgetLine = TestDataFactory.createBudgetLine(id: "bl-1", isChecked: false)

        let transactions = [allocatedTx, freeTx]
        let budgetLines = [budgetLine]

        var items: [CurrentMonthStore.CheckableItem] = []
        items += transactions.filter { $0.isFree && !$0.isChecked }
            .sorted { $0.transactionDate > $1.transactionDate }
            .map { .transaction($0) }
        items += transactions.filter { $0.isAllocated && !$0.isChecked }
            .sorted { $0.transactionDate > $1.transactionDate }
            .map { .transaction($0) }
        items += budgetLines.filter { !$0.isChecked && !($0.isRollover ?? false) }
            .map { .budgetLine($0) }

        #expect(items.count == 3)
        #expect(items[0].id == "tx-free-tx")
        #expect(items[1].id == "tx-alloc-tx")
        #expect(items[2].id == "bl-bl-1")
    }

    @Test func uncheckedItems_excludesCheckedTransactions() {
        let uncheckedFree = TestDataFactory.createTransaction(id: "free", budgetLineId: nil, isChecked: false)
        let checkedFree = TestDataFactory.createTransaction(id: "checked", budgetLineId: nil, isChecked: true)

        let transactions = [uncheckedFree, checkedFree]

        var items: [CurrentMonthStore.CheckableItem] = []
        items += transactions.filter { $0.isFree && !$0.isChecked }
            .map { .transaction($0) }

        #expect(items.count == 1)
        #expect(items[0].id == "tx-free")
    }

    @Test func uncheckedItems_limitsTo5Total() {
        let transactions = (0..<4).map { i in
            TestDataFactory.createTransaction(id: "tx-\(i)", budgetLineId: nil, isChecked: false)
        }
        let budgetLines = (0..<4).map { i in
            TestDataFactory.createBudgetLine(id: "bl-\(i)", isChecked: false)
        }

        var items: [CurrentMonthStore.CheckableItem] = []
        items += transactions.filter { $0.isFree && !$0.isChecked }
            .map { .transaction($0) }
        items += budgetLines.filter { !$0.isChecked && !($0.isRollover ?? false) }
            .map { .budgetLine($0) }
        let result = Array(items.prefix(5))

        #expect(result.count == 5)
    }

    @Test func uncheckedItems_emptyWhenAllChecked() {
        let transactions = [
            TestDataFactory.createTransaction(id: "tx-1", isChecked: true)
        ]
        let budgetLines = [
            TestDataFactory.createBudgetLine(id: "bl-1", isChecked: true)
        ]

        var items: [CurrentMonthStore.CheckableItem] = []
        items += transactions.filter { $0.isFree && !$0.isChecked }
            .map { .transaction($0) }
        items += transactions.filter { $0.isAllocated && !$0.isChecked }
            .map { .transaction($0) }
        items += budgetLines.filter { !$0.isChecked && !($0.isRollover ?? false) }
            .map { .budgetLine($0) }

        #expect(items.isEmpty)
    }

    // MARK: - Savings Summary Logic

    @Test func savingsSummary_computesFromSavingLines() {
        let savingLine1 = TestDataFactory.createBudgetLine(id: "s1", amount: 500, kind: .saving, isChecked: true)
        let savingLine2 = TestDataFactory.createBudgetLine(id: "s2", amount: 300, kind: .saving, isChecked: false)
        let expenseLine = TestDataFactory.createBudgetLine(id: "e1", amount: 1000, kind: .expense)

        let lines = [savingLine1, savingLine2, expenseLine]

        let savingLines = lines.filter { $0.kind == .saving && !($0.isRollover ?? false) }
        let totalPlanned = savingLines.reduce(Decimal.zero) { $0 + $1.amount }
        let checkedCount = savingLines.filter(\.isChecked).count

        #expect(totalPlanned == 800)
        #expect(checkedCount == 1)
        #expect(savingLines.count == 2)
    }

    @Test func savingsSummary_excludesRolloverLines() {
        let savingLine = TestDataFactory.createBudgetLine(id: "s1", amount: 500, kind: .saving, isChecked: false)
        let rolloverSaving = TestDataFactory.createBudgetLine(id: "sr", amount: 200, kind: .saving, isRollover: true)

        let lines = [savingLine, rolloverSaving]

        let savingLines = lines.filter { $0.kind == .saving && !($0.isRollover ?? false) }

        #expect(savingLines.count == 1)
        #expect(savingLines[0].id == "s1")
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
