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
