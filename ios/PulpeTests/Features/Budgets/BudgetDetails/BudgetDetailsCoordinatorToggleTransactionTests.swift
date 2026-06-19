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
struct BudgetDetailsCoordinatorToggleTransactionTests {
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
