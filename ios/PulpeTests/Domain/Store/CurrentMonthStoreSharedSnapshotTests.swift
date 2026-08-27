import Foundation
@testable import Pulpe
import Testing

/// The accueil reads the shared detail snapshot instead of refetching after a detail
/// mutation. Seen from the accueil, a soft delete has three moments — the delete, the
/// undo, and the unwind refresh when the pushed page pops — and none of them may reach
/// the server: a fetch during the undo window brings the row back (the server keeps it
/// until the toast commits), and none is scheduled after the commit.
///
/// `CurrentMonthStore` talks to the concrete `BudgetService`, so "no fetch" is observed
/// through `error`: without a backend, any fetch surfaces one.
///
/// The reverse holds too: a row the accueil changed itself has to be in the entry, or
/// the next adoption reverts it.
@Suite(.serialized)
@MainActor
struct CurrentMonthStoreSharedSnapshotTests {
    private let cache = BudgetDetailCache.shared
    private let budget = TestDataFactory.createBudget(id: "budget-accueil", month: 8, year: 2026)
    private let rowA = TestDataFactory.createTransaction(id: "tx-a", budgetId: "budget-accueil", name: "A")
    private let rowB = TestDataFactory.createTransaction(id: "tx-b", budgetId: "budget-accueil", name: "B")
    private let history = DriftHistory(
        usualOutflowDrift: 0, closedMonths: 3, priorStrength: 1, driftMad: 0, driftProfile: []
    )

    /// The accueil and the cache aligned on the same month, plus a detail coordinator bound
    /// to the accueil the way `BudgetDetailsView`'s `.task` does. The coordinator's budget
    /// is seeded in the cache too, so its `syncCache()` has a budget to write.
    private func makeBoundAccueil(
        coordinatorBudget: Budget? = nil
    ) -> (accueil: CurrentMonthStore, coordinator: BudgetDetailsCoordinator) {
        cache.invalidateAll()
        cache.store(budgetId: budget.id, budget: budget, budgetLines: [], transactions: [rowA, rowB])
        if let coordinatorBudget {
            cache.store(budgetId: coordinatorBudget.id, budget: coordinatorBudget, budgetLines: [], transactions: [])
        }
        let accueil = CurrentMonthStore()
        accueil.populateForTesting(budget: budget, transactions: [rowA, rowB], history: history)
        // A mock so a toast commit can never reach the network from a leftover timer.
        let coordinator = BudgetDetailsCoordinator(
            budgetId: (coordinatorBudget ?? budget).id,
            transactionService: MockTransactionService()
        )
        coordinator.bind(
            budgetListStore: BudgetListStore(),
            dashboardStore: DashboardStore(),
            currentMonthStore: accueil,
            savingsGoalStore: SavingsGoalStore()
        )
        return (accueil, coordinator)
    }

    /// Long auto-dismiss: the commit must stay out of every assertion window below.
    private func makeToastContext() -> ToastContext {
        ToastContext(
            toastManager: ToastManager(autoDismissDuration: .seconds(30)),
            presentationCurrency: .chf
        )
    }

    @Test
    func softDelete_onTheAccueilsMonth_hidesTheRowWithoutAFetch() async {
        let (accueil, coordinator) = makeBoundAccueil()

        await coordinator.dispatch(.softDeleteTransaction(rowA, makeToastContext()))

        #expect(accueil.transactions.map(\.id) == ["tx-b"])
    }

    @Test
    func undoFromTheToast_restoresTheRowOnTheAccueil() async {
        let (accueil, coordinator) = makeBoundAccueil()
        let context = makeToastContext()
        await coordinator.dispatch(.softDeleteTransaction(rowA, context))
        #expect(accueil.transactions.map(\.id) == ["tx-b"], "Setup: the row is gone")

        await context.toastManager.currentToast?.undoAction?()

        #expect(Set(accueil.transactions.map(\.id)) == ["tx-a", "tx-b"])
    }

    @Test
    func unwindRefresh_withAFreshEntry_keepsTheAdoptedRowsAndTheHistory() async {
        let (accueil, coordinator) = makeBoundAccueil()
        await coordinator.dispatch(.softDeleteTransaction(rowA, makeToastContext()))

        // The pushed page popped: the accueil runs its own unwind refresh.
        accueil.invalidateCache()
        await accueil.loadDetailsIfNeeded()

        #expect(accueil.transactions.map(\.id) == ["tx-b"], "A refetch would bring the row back")
        #expect(accueil.error == nil, "No fetch: the fresh entry wins")
        #expect(accueil.history == history, "The entry carries no history; the current one stays")
    }

    @Test
    func mutationOnAnotherBudget_leavesTheAccueilUntouchedAndStale() async {
        let other = TestDataFactory.createBudget(id: "budget-other", month: 7, year: 2026)
        let (accueil, coordinator) = makeBoundAccueil(coordinatorBudget: other)
        #expect(accueil.adoptSharedSnapshotIfFresh(), "Setup: the accueil's TTL is fresh")

        let otherRow = TestDataFactory.createTransaction(id: "tx-other", budgetId: other.id)
        await coordinator.dispatch(.addTransaction(otherRow))

        #expect(accueil.transactions.map(\.id) == ["tx-a", "tx-b"], "Untouched")
        // Stale: the next load reads the shared entry again instead of being skipped.
        cache.store(budgetId: budget.id, budget: budget, budgetLines: [], transactions: [rowA])
        await accueil.loadDetailsIfNeeded()
        #expect(accueil.transactions.map(\.id) == ["tx-a"], "A fresh TTL would have skipped the load")
    }

    @Test
    func localAddition_isInTheSharedEntryAndSurvivesAdoption() {
        let (accueil, _) = makeBoundAccueil()
        let added = TestDataFactory.createTransaction(id: "tx-c", budgetId: budget.id, name: "C")

        accueil.addTransaction(added)

        #expect(
            cache.get(budgetId: budget.id)?.transactions.map(\.id) == ["tx-a", "tx-b", "tx-c"],
            "The entry is what a tap on the new row opens"
        )
        #expect(accueil.adoptSharedSnapshotIfFresh(), "Setup: the entry is fresh")
        #expect(
            accueil.transactions.map(\.id) == ["tx-a", "tx-b", "tx-c"],
            "Adoption must not revert a local change"
        )
    }
}
