import Foundation
@testable import Pulpe
import Testing

/// Regression harness for PUL-271 — a reload landing inside the undo window
/// must not re-display rows pending soft-deletion.
///
/// Deleting a line from its detail page pops back to `BudgetDetailsView`,
/// whose appearance-scoped `.task(id:)` restarts and dispatches
/// `.reloadCurrentBudget`. The server still contains the row (its DELETE is
/// deferred until the toast ends) and the PUL-257 generation guard passes —
/// the soft-delete bumped the generation BEFORE the fetch started, not
/// mid-flight. Pre-fix, `applyDetails` re-injected the row ~100ms after the
/// pop, visibly resurrecting it while the undo toast was still up.
///
/// The fix filters the fetched snapshot against
/// `mutationQueue.pendingSoftDeletions` before applying it, reading the queue
/// AFTER the fetch returns so an undo landing mid-fetch keeps its restored row.
@Suite(.serialized)
@MainActor
struct BudgetDetailsSoftDeleteReloadTests {
    @Test
    func reloadDuringUndoWindow_keepsSoftDeletedLineHiddenAndStillCommits() async {
        let budgetId = "pul271-line"
        BudgetDetailCache.shared.invalidate(budgetId: budgetId)
        let budgetService = MockBudgetService()
        let lineService = MockBudgetLineService()
        let toastManager = ToastManager()
        let coord = BudgetDetailsCoordinator(
            budgetId: budgetId,
            budgetService: budgetService,
            budgetLineService: lineService
        )
        let deleted = TestDataFactory.createBudgetLine(id: "line-1")
        let kept = TestDataFactory.createBudgetLine(id: "line-2")
        await coord.dispatch(.addBudgetLine(deleted))

        let ctx = ToastContext(toastManager: toastManager, presentationCurrency: .chf)
        await coord.dispatch(.softDeleteBudgetLine(deleted, ctx))
        #expect(coord.dataStore.budgetLines.isEmpty)

        // Pop-back restarts the screen's `.task`, which reloads. The server
        // snapshot still contains the deleted line — its DELETE is deferred —
        // plus a second line that must prove the snapshot was applied, not
        // skipped.
        budgetService.stubbedDetails = BudgetDetails(
            budget: TestDataFactory.createBudget(),
            transactions: [],
            budgetLines: [deleted, kept]
        )
        await coord.dispatch(.reloadCurrentBudget)

        // The pending row stays hidden while the undo toast is up; the rest
        // of the snapshot lands.
        #expect(coord.dataStore.budgetLines.map(\.id) == ["line-2"])

        // The toast's natural end must still commit the deferred DELETE.
        toastManager.dismiss()
        await waitForCondition { lineService.deleteBudgetLineCallCount == 1 }
        #expect(lineService.deletedIds == ["line-1"])

        BudgetDetailCache.shared.invalidate(budgetId: budgetId)
    }

    @Test
    func reloadDuringUndoWindow_keepsSoftDeletedTransactionHidden() async {
        let budgetId = "pul271-tx"
        BudgetDetailCache.shared.invalidate(budgetId: budgetId)
        let budgetService = MockBudgetService()
        let txService = MockTransactionService()
        let toastManager = ToastManager()
        let coord = BudgetDetailsCoordinator(
            budgetId: budgetId,
            budgetService: budgetService,
            transactionService: txService
        )
        let tx = TestDataFactory.createTransaction(id: "tx-1")
        await coord.dispatch(.addTransaction(tx))

        let ctx = ToastContext(toastManager: toastManager, presentationCurrency: .chf)
        await coord.dispatch(.softDeleteTransaction(tx, ctx))
        #expect(coord.dataStore.transactions.isEmpty)

        budgetService.stubbedDetails = BudgetDetails(
            budget: TestDataFactory.createBudget(),
            transactions: [tx],
            budgetLines: []
        )
        await coord.dispatch(.reloadCurrentBudget)

        #expect(coord.dataStore.transactions.isEmpty)
        // The snapshot itself was applied — only the pending row is stripped.
        #expect(coord.dataStore.budget != nil)

        toastManager.dismiss()
        await waitForCondition { txService.deleteTransactionCallCount == 1 }

        BudgetDetailCache.shared.invalidate(budgetId: budgetId)
    }

    @Test
    func undoAfterReloadDuringUndoWindow_restoresLine() async {
        let budgetId = "pul271-undo"
        BudgetDetailCache.shared.invalidate(budgetId: budgetId)
        let budgetService = MockBudgetService()
        let lineService = MockBudgetLineService()
        let toastManager = ToastManager()
        let coord = BudgetDetailsCoordinator(
            budgetId: budgetId,
            budgetService: budgetService,
            budgetLineService: lineService
        )
        let line = TestDataFactory.createBudgetLine(id: "line-1")
        await coord.dispatch(.addBudgetLine(line))

        let ctx = ToastContext(toastManager: toastManager, presentationCurrency: .chf)
        await coord.dispatch(.softDeleteBudgetLine(line, ctx))

        budgetService.stubbedDetails = BudgetDetails(
            budget: TestDataFactory.createBudget(),
            transactions: [],
            budgetLines: [line]
        )
        await coord.dispatch(.reloadCurrentBudget)
        #expect(coord.dataStore.budgetLines.isEmpty)

        // Undo after the filtered reload restores the line locally and never
        // issues the server DELETE.
        toastManager.executeUndo()
        await waitForCondition { coord.dataStore.budgetLines.count == 1 }
        #expect(coord.dataStore.budgetLines.first?.id == "line-1")
        #expect(lineService.deleteBudgetLineCallCount == 0)

        BudgetDetailCache.shared.invalidate(budgetId: budgetId)
    }

    @Test
    func undoLandingMidFetch_keepsRestoredLineAfterApply() async {
        let budgetId = "pul271-undo-race"
        BudgetDetailCache.shared.invalidate(budgetId: budgetId)
        let budgetService = MockBudgetService()
        let lineService = MockBudgetLineService()
        let toastManager = ToastManager()
        let coord = BudgetDetailsCoordinator(
            budgetId: budgetId,
            budgetService: budgetService,
            budgetLineService: lineService
        )
        let line = TestDataFactory.createBudgetLine(id: "line-1")
        await coord.dispatch(.addBudgetLine(line))

        let ctx = ToastContext(toastManager: toastManager, presentationCurrency: .chf)
        await coord.dispatch(.softDeleteBudgetLine(line, ctx))

        budgetService.stubbedDetails = BudgetDetails(
            budget: TestDataFactory.createBudget(),
            transactions: [],
            budgetLines: [line]
        )
        budgetService.gateDetails()

        // The reload suspends inside the fetch; the user taps "Annuler" while
        // it is in flight. The restored row must survive the apply — the
        // pending filter reads the queue after the await (the undo already
        // popped its item) and the undo's append bumps the generation anyway.
        let reload = Task { await coord.dispatch(.reloadCurrentBudget) }
        await waitForCondition { budgetService.didEnterDetails }

        toastManager.executeUndo()
        await waitForCondition { coord.dataStore.budgetLines.count == 1 }

        budgetService.releaseDetails()
        await reload.value

        #expect(coord.dataStore.budgetLines.first?.id == "line-1")
        #expect(lineService.deleteBudgetLineCallCount == 0)

        BudgetDetailCache.shared.invalidate(budgetId: budgetId)
    }
}
