import Foundation
@testable import Pulpe
import Testing

/// Regression harness for PUL-264 — the deferred soft-delete commit.
///
/// The soft-delete flow removes a line locally immediately, but defers the
/// server `DELETE` until the undo toast ends. Two defects let that commit be
/// silently dropped: (1) the commit closure captured `[weak self]` while the
/// coordinator is a view-scoped `@State` and the toast is app-scoped — leaving
/// the screen deallocated the coordinator and the commit no-op'd; (2) a guard
/// skipped the `DELETE` whenever the line was still in the store, which a
/// reload racing the undo window re-injects.
///
/// These tests inject a `MockBudgetLineService` / `MockTransactionService`
/// (the protocol seam) so the server commit is observable. They fail on the
/// pre-fix code and lock the behaviour so the bug class cannot silently return.
@Suite(.serialized)
@MainActor
struct BudgetDetailsCoordinatorSoftDeleteTests {
    // MARK: - Lifetime: commit must survive view teardown

    @Test
    func budgetLineSoftDelete_commitsToServer_afterCoordinatorDeallocated() async {
        let service = MockBudgetLineService()
        let toastManager = ToastManager()
        var coord: BudgetDetailsCoordinator? = BudgetDetailsCoordinator(
            budgetId: "test-budget",
            budgetLineService: service
        )
        let line = TestDataFactory.createBudgetLine(id: "line-1")
        await coord?.dispatch(.addBudgetLine(line))

        let ctx = ToastContext(toastManager: toastManager, presentationCurrency: .chf)
        await coord?.dispatch(.softDeleteBudgetLine(line, ctx))
        #expect(coord?.dataStore.budgetLines.isEmpty == true)

        // Leaving the screen before the undo window ends tears down the view and
        // its @State coordinator. The app-scoped toast must still drive the commit.
        coord = nil
        toastManager.dismiss()

        await waitForCondition { service.deleteBudgetLineCallCount == 1 }
        #expect(service.deletedIds == ["line-1"])
    }

    @Test
    func transactionSoftDelete_commitsToServer_afterCoordinatorDeallocated() async {
        let service = MockTransactionService()
        let toastManager = ToastManager()
        var coord: BudgetDetailsCoordinator? = BudgetDetailsCoordinator(
            budgetId: "test-budget",
            transactionService: service
        )
        let tx = TestDataFactory.createTransaction(id: "tx-1")
        await coord?.dispatch(.addTransaction(tx))

        let ctx = ToastContext(toastManager: toastManager, presentationCurrency: .chf)
        await coord?.dispatch(.softDeleteTransaction(tx, ctx))
        #expect(coord?.dataStore.transactions.isEmpty == true)

        coord = nil
        toastManager.dismiss()

        await waitForCondition { service.deleteTransactionCallCount == 1 }
        #expect(service.deletedIds == ["tx-1"])
    }

    // MARK: - Guard: a reload re-injecting the line must not cancel the commit

    @Test
    func budgetLineSoftDelete_lineReinjectedByReload_stillCommitsDelete() async {
        let service = MockBudgetLineService()
        let toastManager = ToastManager()
        let coord = BudgetDetailsCoordinator(
            budgetId: "test-budget",
            budgetLineService: service
        )
        let line = TestDataFactory.createBudgetLine(id: "line-1")
        await coord.dispatch(.addBudgetLine(line))

        let ctx = ToastContext(toastManager: toastManager, presentationCurrency: .chf)
        await coord.dispatch(.softDeleteBudgetLine(line, ctx))
        #expect(coord.dataStore.budgetLines.isEmpty)

        // A reload races the undo window and re-injects the not-yet-deleted line.
        await coord.dispatch(.addBudgetLine(line))
        #expect(coord.dataStore.budgetLines.count == 1)

        toastManager.dismiss()

        await waitForCondition { service.deleteBudgetLineCallCount == 1 }
        #expect(service.deletedIds == ["line-1"])
    }

    // MARK: - Commit must clear a reload-re-injected row from the rendered store

    @Test
    func budgetLineSoftDelete_reinjectedByReload_commitClearsRowFromStore() async {
        let service = MockBudgetLineService()
        let toastManager = ToastManager()
        let coord = BudgetDetailsCoordinator(
            budgetId: "test-budget",
            budgetLineService: service
        )
        let line = TestDataFactory.createBudgetLine(id: "line-1")
        await coord.dispatch(.addBudgetLine(line))

        let ctx = ToastContext(toastManager: toastManager, presentationCurrency: .chf)
        await coord.dispatch(.softDeleteBudgetLine(line, ctx))

        // A reload races the undo window and re-injects the not-yet-deleted line.
        await coord.dispatch(.addBudgetLine(line))
        #expect(coord.dataStore.budgetLines.count == 1)

        // Toast ends → the server DELETE commits. The row the user confirmed
        // gone must not linger in the store the screen renders, even though the
        // reload put it back after the local soft-delete removed it.
        toastManager.dismiss()

        await waitForCondition { service.deleteBudgetLineCallCount == 1 }
        await waitForCondition { coord.dataStore.budgetLines.isEmpty }
        #expect(service.deletedIds == ["line-1"])
    }

    @Test
    func transactionSoftDelete_reinjectedByReload_commitClearsRowFromStore() async {
        let service = MockTransactionService()
        let toastManager = ToastManager()
        let coord = BudgetDetailsCoordinator(
            budgetId: "test-budget",
            transactionService: service
        )
        let tx = TestDataFactory.createTransaction(id: "tx-1")
        await coord.dispatch(.addTransaction(tx))

        let ctx = ToastContext(toastManager: toastManager, presentationCurrency: .chf)
        await coord.dispatch(.softDeleteTransaction(tx, ctx))

        // A reload races the undo window and re-injects the not-yet-deleted row.
        await coord.dispatch(.addTransaction(tx))
        #expect(coord.dataStore.transactions.count == 1)

        toastManager.dismiss()

        await waitForCondition { service.deleteTransactionCallCount == 1 }
        await waitForCondition { coord.dataStore.transactions.isEmpty }
        #expect(service.deletedIds == ["tx-1"])
    }

    // MARK: - Undo must NOT reach the server (regression lock for the fix)

    @Test
    func budgetLineSoftDelete_undo_doesNotCommitDelete() async {
        let service = MockBudgetLineService()
        let toastManager = ToastManager()
        let coord = BudgetDetailsCoordinator(
            budgetId: "test-budget",
            budgetLineService: service
        )
        let line = TestDataFactory.createBudgetLine(id: "line-1")
        await coord.dispatch(.addBudgetLine(line))

        let ctx = ToastContext(toastManager: toastManager, presentationCurrency: .chf)
        await coord.dispatch(.softDeleteBudgetLine(line, ctx))

        toastManager.executeUndo()

        // Undo restores the line locally and must never issue a server DELETE.
        await waitForCondition { coord.dataStore.budgetLines.count == 1 }
        #expect(service.deleteBudgetLineCallCount == 0)
        #expect(coord.dataStore.budgetLines.first?.id == "line-1")
    }
}

/// Regression harness for PUL-258 — month navigation must not strand a pending
/// soft-delete or a stale error on the previous month.
///
/// `prepareNavigation(to:)` swaps the `BudgetDataStore`'s budget out from under
/// the still-open undo toast and its pending `MutationQueue`. Before the fix it
/// left the queue and `syncStore.error` untouched, so a delete queued on month
/// A could later commit, roll back, or undo against month B's store — deleting
/// or re-injecting a transaction on the wrong budget — and a month-A error
/// banner bled onto month B.
///
/// The fix commits the pending deletions against the month being LEFT and
/// clears the error, all BEFORE the store swaps. These tests are deterministic:
/// every assertion holds synchronously inside the awaited `dispatch`, no toast
/// timing involved.
@Suite(.serialized)
@MainActor
struct BudgetDetailsCoordinatorNavFlushTests {
    @Test
    func prepareNavigation_withPendingSoftDelete_commitsToServerBeforeSwap() async {
        let service = MockTransactionService()
        let toastManager = ToastManager()
        let coord = BudgetDetailsCoordinator(budgetId: "month-a", transactionService: service)
        let tx = TestDataFactory.createTransaction(id: "tx-1")
        await coord.dispatch(.addTransaction(tx))

        let ctx = ToastContext(toastManager: toastManager, presentationCurrency: .chf)
        await coord.dispatch(.softDeleteTransaction(tx, ctx))

        await coord.dispatch(.prepareNavigation(to: "month-b"))

        // Leaving the month finalizes the deletion the user walked away from.
        #expect(service.deletedIds == ["tx-1"])
        #expect(coord.mutationQueue.isEmpty)
        #expect(coord.dataStore.budgetId == "month-b")
    }

    @Test
    func prepareNavigation_failedCommit_doesNotBleedIntoNextMonth() async {
        let service = MockTransactionService()
        service.deleteError = URLError(.badServerResponse)
        let toastManager = ToastManager()
        let coord = BudgetDetailsCoordinator(budgetId: "month-a", transactionService: service)
        let tx = TestDataFactory.createTransaction(id: "tx-1")
        await coord.dispatch(.addTransaction(tx))

        let ctx = ToastContext(toastManager: toastManager, presentationCurrency: .chf)
        await coord.dispatch(.softDeleteTransaction(tx, ctx))

        await coord.dispatch(.prepareNavigation(to: "month-b"))

        // The commit ran during navigation (against month A) and failed; its
        // rollback re-injected into the month being left, which the swap then
        // discards. Month B must be clean and the queue drained — pre-fix the
        // delete was never attempted (count 0) and the queue still held tx-1.
        #expect(service.deleteTransactionCallCount == 1)
        #expect(coord.mutationQueue.isEmpty)
        #expect(coord.dataStore.budgetId == "month-b")
        #expect(!coord.dataStore.transactions.contains { $0.id == "tx-1" })
    }

    @Test
    func prepareNavigation_clearsStaleErrorFromPreviousMonth() async {
        let coord = BudgetDetailsCoordinator(budgetId: "month-a")
        coord.syncStore.setError(URLError(.badServerResponse))

        await coord.dispatch(.prepareNavigation(to: "month-b"))

        #expect(coord.syncStore.error == nil)
    }
}
