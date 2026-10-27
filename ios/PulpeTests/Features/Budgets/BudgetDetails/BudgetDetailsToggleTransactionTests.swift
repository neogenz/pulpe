import Foundation
@testable import Pulpe
import Testing

/// Coverage for PUL-277 — pointing a *free* transaction (no `budgetLineId`)
/// from the budget detail screen. The `.toggleTransaction` action and its
/// optimistic-apply / rollback path already existed, but had no UI caller (and
/// thus no test) before this feature wired a `PointCircle` onto free-transaction
/// rows. These lock the persistence contract behind CA2: the toggle is applied
/// optimistically and reverted when the server call fails.
@Suite(.serialized)
@MainActor
struct BudgetDetailsToggleTransactionTests {
    @Test(arguments: ["past-budget", "future-budget"])
    func reconciliation_pointsOnlyTheViewedMonth(budgetId: String) async {
        let service = MockTransactionService()
        let coord = BudgetDetailsCoordinator(
            budgetId: budgetId, budgetLineService: MockBudgetLineService(), transactionService: service
        )
        let tx = TestDataFactory.createTransaction(id: "viewed-tx", budgetId: budgetId)
        let line = TestDataFactory.createBudgetLine(id: "viewed-line", budgetId: budgetId)
        await coord.dispatch(.addTransaction(tx))
        await coord.dispatch(.addBudgetLine(line))
        let home = CurrentMonthStore()
        let homeTx = TestDataFactory.createTransaction(id: "home-tx", budgetId: "home-budget")
        let homeLine = TestDataFactory.createBudgetLine(id: "home-line", budgetId: "home-budget")
        home.populateForTesting(
            budget: TestDataFactory.createBudget(id: "home-budget"), budgetLines: [homeLine], transactions: [homeTx]
        )
        let context = ToastContext(toastManager: ToastManager(), presentationCurrency: .chf)
        let checking = coord.reconciliationChecking(context)
        #expect(checking.items.map(\.id) == ["tx-viewed-tx", "bl-viewed-line"])
        #expect(await checking.toggle(.transaction(homeTx)) == false)
        #expect(await checking.toggle(.budgetLine(homeLine)) == false)
        service.failingToggleIds = [tx.id]
        #expect(await checking.toggle(.transaction(tx)) == false)
        #expect(coord.dataStore.transactions.first?.isChecked == false)
        service.failingToggleIds = []
        #expect(await checking.toggle(.transaction(tx)))
        #expect(await checking.toggle(.budgetLine(line)))
        #expect(coord.reconciliationChecking(context).items.isEmpty)
        #expect(coord.dataStore.realizedMetrics.realizedBalance == -1100)
        #expect(home.transactions.first?.isChecked == false)
        #expect(home.budgetLines.first?.isChecked == false)
        await coord.dispatch(.prepareNavigation(to: "another-budget"))
        #expect(await checking.toggle(.transaction(tx)) == false)
        #expect(await checking.toggle(.budgetLine(line)) == false)
    }

    @Test
    func toggleTransaction_freeTransaction_pointsOptimistically() async {
        let txService = MockTransactionService()
        let coord = BudgetDetailsCoordinator(
            budgetId: "test-budget",
            transactionService: txService
        )
        let freeTx = TestDataFactory.createTransaction(id: "tx-free", isChecked: false)
        await coord.dispatch(.addTransaction(freeTx))

        await coord.dispatch(.toggleTransaction(freeTx))

        #expect(coord.dataStore.transactions.first?.isChecked == true)
    }

    @Test
    func toggleTransaction_serverFailure_rollsBackToUnchecked() async {
        let txService = MockTransactionService()
        txService.failingToggleIds = ["tx-free"]
        let coord = BudgetDetailsCoordinator(
            budgetId: "test-budget",
            transactionService: txService
        )
        let freeTx = TestDataFactory.createTransaction(id: "tx-free", isChecked: false)
        await coord.dispatch(.addTransaction(freeTx))

        await coord.dispatch(.toggleTransaction(freeTx))

        #expect(coord.dataStore.transactions.first?.isChecked == false)
    }
}
