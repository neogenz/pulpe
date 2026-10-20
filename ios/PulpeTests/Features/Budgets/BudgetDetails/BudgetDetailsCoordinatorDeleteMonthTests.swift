import Foundation
@testable import Pulpe
import Testing

/// PUL-361: deleting the open month through `dispatch(.deleteMonth)`. The server is
/// the authority, so the screen only changes after it confirms; a refusal leaves the
/// screen and its cache as they were.
@Suite("BudgetDetailsCoordinator: delete month", .serialized)
@MainActor
struct BudgetDetailsCoordinatorDeleteMonthTests {
    private let budgetId = "pul361-open-month"
    private let neighbourId = "pul361-neighbour-month"
    private let cache = BudgetDetailCache.shared

    @Test("The month is deleted with the link confirmation it was given", arguments: [true, false])
    func deleteMonth_sendsBudgetIdAndConfirmLinks(confirmLinks: Bool) async {
        let (coordinator, service) = makeCoordinator()
        defer { cleanUp() }

        await coordinator.dispatch(.deleteMonth(confirmLinks: confirmLinks, toast().context, onDeleted: {}))

        #expect(service.deletedBudgets.map(\.id) == [budgetId])
        #expect(service.deletedBudgets.map(\.confirmLinks) == [confirmLinks])
    }

    @Test("A deleted month marks the app stores stale, empties every detail cache and hands control back")
    func deleteMonth_success_firesMutationWipesCachesAndCallsOnDeleted() async {
        let (coordinator, _) = makeCoordinator()
        defer { cleanUp() }
        var mutations = 0
        coordinator.dataStore.onMutation = { mutations += 1 }
        var deletions = 0
        let (manager, context) = toast()

        await coordinator.dispatch(.deleteMonth(confirmLinks: false, context, onDeleted: { deletions += 1 }))

        #expect(mutations == 1)
        #expect(cache.get(budgetId: budgetId) == nil)
        #expect(cache.get(budgetId: neighbourId) == nil)
        #expect(deletions == 1)
        #expect(manager.currentToast?.message == "Mois supprimé")
    }

    @Test("A refused delete shows an error toast and leaves the screen and the cache untouched")
    func deleteMonth_failure_showsErrorToastAndChangesNothing() async {
        let (coordinator, service) = makeCoordinator()
        defer { cleanUp() }
        service.deleteError = URLError(.badServerResponse)
        var mutations = 0
        coordinator.dataStore.onMutation = { mutations += 1 }
        var deletions = 0
        let (manager, context) = toast()

        await coordinator.dispatch(.deleteMonth(confirmLinks: true, context, onDeleted: { deletions += 1 }))

        #expect(manager.currentToast?.message == "Le mois n'a pas pu être supprimé")
        #expect(manager.currentToast?.type == .error)
        #expect(deletions == 0)
        #expect(mutations == 0)
        #expect(cache.get(budgetId: budgetId) != nil)
        #expect(cache.get(budgetId: neighbourId) != nil)
        #expect(coordinator.dataStore.budget?.id == budgetId)
    }

    @Test("A pending soft-deletion is committed before the month goes, so its toast cannot rewrite the cache")
    func deleteMonth_settlesPendingSoftDeletionsFirst() async {
        let transactionService = MockTransactionService()
        let (coordinator, _) = makeCoordinator(transactionService: transactionService)
        defer { cleanUp() }
        let tx = TestDataFactory.createTransaction(id: "pul361-pending-tx")
        coordinator.dataStore.appendTransaction(tx)
        let context = toast().context
        await coordinator.dispatch(.softDeleteTransaction(tx, context))
        #expect(coordinator.mutationQueue.count == 1)

        await coordinator.dispatch(.deleteMonth(confirmLinks: false, context, onDeleted: {}))

        // Committed inside the dispatch (no toast dismissal needed), and the wipe came last.
        #expect(transactionService.deletedIds == [tx.id])
        #expect(coordinator.mutationQueue.isEmpty)
        #expect(cache.get(budgetId: budgetId) == nil)
    }

    @Test("A second confirm while the DELETE is on the wire sends nothing and calls nothing back")
    func deleteMonth_whileInFlight_ignoresASecondConfirm() async {
        let (coordinator, service) = makeCoordinator()
        defer { cleanUp() }
        service.gateDelete()
        var deletions = 0
        let context = toast().context
        let first = Task {
            await coordinator.dispatch(.deleteMonth(confirmLinks: false, context, onDeleted: { deletions += 1 }))
        }
        await waitForCondition { service.deletedBudgets.count == 1 }

        await coordinator.dispatch(.deleteMonth(confirmLinks: false, context, onDeleted: { deletions += 1 }))
        #expect(service.deletedBudgets.count == 1)
        #expect(deletions == 0)

        service.releaseDelete()
        await first.value
        #expect(service.deletedBudgets.count == 1)
        #expect(deletions == 1)
        #expect(!coordinator.isDeletingMonth)
    }

    @Test("A pager swipe mid-flight still deletes the month asked for and still marks the app stores stale")
    func deleteMonth_pagerSwitchMidFlight_keepsTargetAndStaleMarking() async {
        let (coordinator, service) = makeCoordinator()
        defer { cleanUp() }
        var mutations = 0
        coordinator.dataStore.onMutation = { mutations += 1 }
        service.gateDelete()
        let context = toast().context
        let delete = Task {
            await coordinator.dispatch(.deleteMonth(confirmLinks: false, context, onDeleted: {}))
        }
        await waitForCondition { service.deletedBudgets.count == 1 }

        // No cached entry: the store now holds no budget, which is where `syncCache()` bails out.
        coordinator.dataStore.prepareNavigation(to: "pul361-uncached-month")
        #expect(coordinator.dataStore.budget == nil)
        service.releaseDelete()
        await delete.value

        #expect(service.deletedBudgets.map(\.id) == [budgetId])
        #expect(mutations == 1)
    }

    @Test("The impact is read for the open month")
    func monthDeletionImpact_readsTheOpenBudget() async throws {
        let (coordinator, service) = makeCoordinator()
        defer { cleanUp() }
        let stubbed = BudgetDeletionImpact(
            forecastCount: 3,
            movementCount: 1,
            links: .init(
                spreadForecasts: 1,
                savingsGoalForecasts: 0,
                savingsWithdrawalForecasts: 0,
                savingsWithdrawalMovements: 0
            )
        )
        service.stubbedDeletionImpact = stubbed

        let impact = try await coordinator.monthDeletionImpact()

        #expect(impact == stubbed)
        #expect(service.deletionImpactRequests == [budgetId])
    }

    @Test("A failed impact read reaches the caller")
    func monthDeletionImpact_rethrowsTheServiceError() async {
        let (coordinator, service) = makeCoordinator()
        defer { cleanUp() }
        service.deletionImpactError = URLError(.notConnectedToInternet)

        await #expect(throws: URLError.self) {
            _ = try await coordinator.monthDeletionImpact()
        }
    }

    // MARK: - Helpers

    /// A coordinator on a loaded month whose detail, and a neighbour's, sit in the shared cache.
    private func makeCoordinator(
        transactionService: any TransactionServicing = MockTransactionService()
    ) -> (BudgetDetailsCoordinator, MockBudgetService) {
        let budget = TestDataFactory.createBudget(id: budgetId, month: 11, year: 2026)
        let neighbour = TestDataFactory.createBudget(id: neighbourId, month: 12, year: 2026)
        let service = MockBudgetService()
        let coordinator = BudgetDetailsCoordinator(
            budgetId: budgetId,
            budgetService: service,
            transactionService: transactionService
        )
        coordinator.dataStore.setBudget(budget)
        cache.store(budgetId: budgetId, budget: budget, budgetLines: [], transactions: [])
        cache.store(budgetId: neighbourId, budget: neighbour, budgetLines: [], transactions: [])
        return (coordinator, service)
    }

    private func cleanUp() {
        cache.invalidate(budgetId: budgetId)
        cache.invalidate(budgetId: neighbourId)
    }

    private func toast() -> (manager: ToastManager, context: ToastContext) {
        let manager = ToastManager()
        return (manager, ToastContext(toastManager: manager, presentationCurrency: .chf))
    }
}
