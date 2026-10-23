import Foundation
@testable import Pulpe
import Testing

@Suite(.serialized)
@MainActor
struct BudgetDetailsNavigationConcurrencyTests {
    @Test(arguments: [false, true], [false, true])
    func rapidNavigation_waitsForCommitAndKeepsLatestMonth(toastStarted: Bool, deleteFails: Bool) async {
        let service = MockTransactionService()
        service.gateDelete()
        if deleteFails { service.deleteError = URLError(.badServerResponse) }
        let coordinator = BudgetDetailsCoordinator(budgetId: "nav-month-a", transactionService: service)
        let toast = ToastManager()
        let transaction = TestDataFactory.createTransaction(id: "nav-pending")
        await coordinator.dispatch(.addTransaction(transaction))
        await coordinator.dispatch(.softDeleteTransaction(
            transaction, ToastContext(toastManager: toast, presentationCurrency: .chf)
        ))

        if toastStarted {
            toast.dismiss()
            await waitForCondition { service.deleteTransactionCallCount == 1 }
        }
        let first = Task { await coordinator.dispatch(.prepareNavigation(to: "nav-month-b")) }
        await waitForCondition { service.deleteTransactionCallCount == 1 }
        var latestStarted = false
        let latest = Task {
            latestStarted = true
            await coordinator.dispatch(.prepareNavigation(to: "nav-month-c"))
        }
        await waitForCondition { latestStarted }
        #expect(coordinator.dataStore.budgetId == "nav-month-a")

        service.releaseDelete()
        await first.value
        await latest.value

        #expect(service.deletedIds == ["nav-pending"])
        #expect(coordinator.dataStore.budgetId == "nav-month-c")
        #expect(coordinator.dataStore.transactions.isEmpty)
        #expect(coordinator.mutationQueue.isEmpty)
        #expect(coordinator.syncStore.error == nil)
        toast.dismiss()
    }

    @Test(arguments: [false, true])
    func oldMonthFailure_doesNotChangeNewMonthLoadingOrError(fullLoad: Bool) async {
        let service = MockBudgetService()
        service.detailsError = URLError(.badServerResponse)
        service.gateDetails()
        let coordinator = BudgetDetailsCoordinator(budgetId: "load-month-a", budgetService: service)
        let oldLoad = Task {
            await coordinator.dispatch(fullLoad ? .loadDetails(force: true) : .reloadCurrentBudget)
        }
        await waitForCondition { service.didEnterDetails }

        await coordinator.dispatch(.prepareNavigation(to: "load-month-b"))
        service.detailsError = nil
        service.stubbedDetails = BudgetDetails(
            budget: TestDataFactory.createBudget(id: "load-month-b"), transactions: [], budgetLines: []
        )
        service.gateSparse()
        let previousSparseCalls = service.getBudgetsSparseCallCount
        let newLoad = Task { await coordinator.dispatch(.loadDetails(force: true)) }
        await waitForCondition { service.getBudgetsSparseCallCount > previousSparseCalls }

        service.releaseDetails()
        await oldLoad.value
        #expect(coordinator.syncStore.isLoading)
        #expect(coordinator.syncStore.error == nil)

        service.releaseSparse()
        await newLoad.value
        #expect(coordinator.dataStore.budget?.id == "load-month-b")
        #expect(!coordinator.syncStore.isLoading)
        #expect(coordinator.syncStore.error == nil)
        BudgetDetailCache.shared.invalidate(budgetId: "load-month-b")
    }
    @Test(arguments: [false, true])
    func confirmedDeletion_doesNotConsumeTheNextUndoWindow(firstStarted: Bool) async {
        let service = MockTransactionService()
        service.gateDelete()
        let coordinator = BudgetDetailsCoordinator(budgetId: "undo-month", transactionService: service)
        let toast = ToastManager(autoDismissDuration: .seconds(60))
        let context = ToastContext(toastManager: toast, presentationCurrency: .chf)
        let first = TestDataFactory.createTransaction(id: "confirmed-a")
        let second = TestDataFactory.createTransaction(id: "undoable-b")
        await coordinator.dispatch(.addTransaction(first))
        await coordinator.dispatch(.addTransaction(second))
        coordinator.softDeleteTransaction(first, context: context)
        toast.dismiss()
        if firstStarted { await waitForCondition { service.deleteTransactionCallCount == 1 } }
        // No suspension here: also cover B arriving before A's toast callback gets its turn.
        coordinator.softDeleteTransaction(second, context: context)
        await waitForCondition { service.deleteTransactionCallCount == 1 }
        #expect(toast.currentToast?.hasUndo == true)

        service.releaseDelete()
        await waitForCondition { coordinator.softDeletionCommit == nil }
        #expect(service.deletedIds == ["confirmed-a"])
        #expect(coordinator.mutationQueue.count == 1)
        toast.executeUndo()
        await waitForCondition { coordinator.dataStore.transactions.contains { $0.id == "undoable-b" } }
        #expect(service.deletedIds == ["confirmed-a"])
        #expect(coordinator.mutationQueue.isEmpty)
    }

    @Test func consumedToast_cannotCommitNewDeletionOfTheSameEntity() async {
        let service = MockTransactionService()
        service.deleteError = URLError(.badServerResponse)
        let coordinator = BudgetDetailsCoordinator(budgetId: "retry-month", transactionService: service)
        let toast = ToastManager(autoDismissDuration: .seconds(60))
        let context = ToastContext(toastManager: toast, presentationCurrency: .chf)
        let transaction = TestDataFactory.createTransaction(id: "retry-a")
        await coordinator.dispatch(.addTransaction(transaction))
        coordinator.softDeleteTransaction(transaction, context: context)
        let oldCompletion = toast.currentToast?.onFinishedWithoutUndo
        await coordinator.commitPendingSoftDeletionsBeforeNavigation()
        #expect(coordinator.dataStore.transactions.contains { $0.id == transaction.id })

        service.deleteError = nil
        coordinator.softDeleteTransaction(transaction, context: context)
        await oldCompletion?()
        #expect(service.deletedIds == [transaction.id])
        #expect(coordinator.mutationQueue.count == 1)
        toast.executeUndo()
        await waitForCondition { coordinator.dataStore.transactions.contains { $0.id == transaction.id } }
        #expect(service.deletedIds == [transaction.id])
        #expect(coordinator.mutationQueue.isEmpty)
    }

    @Test func reselectingCurrentMonth_cancelsThePendingMonthChange() async {
        let service = MockTransactionService()
        service.gateDelete()
        let coordinator = BudgetDetailsCoordinator(budgetId: "selected-a", transactionService: service)
        let toast = ToastManager(autoDismissDuration: .seconds(60))
        let transaction = TestDataFactory.createTransaction(id: "pending-a")
        await coordinator.dispatch(.addTransaction(transaction))
        await coordinator.dispatch(.softDeleteTransaction(
            transaction, ToastContext(toastManager: toast, presentationCurrency: .chf)
        ))
        let pendingNavigation = Task { await coordinator.dispatch(.prepareNavigation(to: "selected-b")) }
        await waitForCondition { service.deleteTransactionCallCount == 1 }

        #expect(coordinator.isNavigating)
        await coordinator.dispatch(.prepareNavigation(to: "selected-a"))
        #expect(!coordinator.isNavigating)
        let next = TestDataFactory.createTransaction(id: "undoable-c")
        await coordinator.dispatch(.addTransaction(next))
        coordinator.softDeleteTransaction(next, context: ToastContext(toastManager: toast, presentationCurrency: .chf))
        service.releaseDelete()
        await pendingNavigation.value

        #expect(coordinator.dataStore.budgetId == "selected-a")
        #expect(service.deletedIds == ["pending-a"])
        #expect(coordinator.mutationQueue.count == 1)
        toast.executeUndo()
        await waitForCondition { coordinator.dataStore.transactions.contains { $0.id == "undoable-c" } }
        #expect(service.deletedIds == ["pending-a"])
        #expect(coordinator.mutationQueue.isEmpty)
    }
}
