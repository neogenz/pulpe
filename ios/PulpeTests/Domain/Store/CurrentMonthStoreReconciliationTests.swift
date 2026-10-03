import Foundation
@testable import Pulpe
import Testing

/// PUL-351: the reconciliation's one adjustment goes through the month's own store,
/// which moves the checked balance to the accounts total at once — no refetch, and no
/// total computed apart from the store's real entries.
@MainActor
struct CurrentMonthStoreReconciliationTests {
    @Test func addTransaction_reconciliationAdjustment_realizedBalanceBecomesAccountsTotal() throws {
        let store = CurrentMonthStore()
        nonisolated(unsafe) var mutationCount = 0
        store.onMutation = { mutationCount += 1 }
        let groceries = try #require(Decimal(string: "85.35"))
        store.populateForTesting(
            budget: TestDataFactory.createBudget(id: "test-budget-1", rollover: 120),
            budgetLines: [
                TestDataFactory.createBudgetLine(id: "salary", amount: 5000, kind: .income, isChecked: true),
                TestDataFactory.createBudgetLine(id: "rent", amount: 1800, kind: .expense, isChecked: true),
                TestDataFactory.createBudgetLine(id: "savings", amount: 300, kind: .saving, isChecked: true)
            ],
            transactions: [
                TestDataFactory.createTransaction(id: "groceries", amount: groceries, kind: .expense, isChecked: true),
                TestDataFactory.createTransaction(id: "pending", amount: 40, kind: .expense, isChecked: false)
            ]
        )
        // 5000 + 120 rollover − 1800 − 300 − 85.35; the unchecked 40 does not count.
        #expect(store.realizedMetrics.realizedBalance == Decimal(string: "2934.65"))

        let accountsTotalCents = 291_465
        let verdict = AccountReconciliation.verdict(
            totalCents: accountsTotalCents,
            realizedBalance: store.realizedMetrics.realizedBalance
        )
        #expect(verdict == .adjustment(kind: .expense, amount: 20))
        let payload = try #require(AccountReconciliation.adjustmentPayload(
            budgetId: "test-budget-1", label: "Ajustement", verdict: verdict, now: TestDataFactory.fixedDate
        ))

        store.addTransaction(serverEcho(of: payload))

        #expect(store.realizedMetrics.realizedBalance == Decimal(accountsTotalCents) / 100)
        let isListed = store.transactions.contains { $0.id == "adjustment" && $0.isChecked && $0.isFree }
        #expect(isListed)
        #expect(mutationCount == 1)
    }

    @Test func addTransaction_upToDateAccounts_haveNothingToAdd() {
        let store = CurrentMonthStore()
        store.populateForTesting(
            budget: TestDataFactory.createBudget(id: "test-budget-1"),
            budgetLines: [
                TestDataFactory.createBudgetLine(id: "salary", amount: 3000, kind: .income, isChecked: true)
            ]
        )

        let verdict = AccountReconciliation.verdict(
            totalCents: 300_000,
            realizedBalance: store.realizedMetrics.realizedBalance
        )
        let payload = AccountReconciliation.adjustmentPayload(
            budgetId: "test-budget-1", label: "Ajustement", verdict: verdict, now: TestDataFactory.fixedDate
        )

        #expect(verdict == .upToDate)
        #expect(payload == nil)
    }

    /// The created entry as `POST /transactions` returns it.
    private func serverEcho(of payload: TransactionCreate) -> Transaction {
        Transaction(
            id: "adjustment",
            budgetId: payload.budgetId,
            budgetLineId: payload.budgetLineId,
            name: payload.name,
            amount: payload.amount,
            kind: payload.kind,
            transactionDate: payload.transactionDate ?? TestDataFactory.fixedDate,
            category: nil,
            checkedAt: payload.checkedAt,
            createdAt: TestDataFactory.fixedDate,
            updatedAt: TestDataFactory.fixedDate
        )
    }
}
