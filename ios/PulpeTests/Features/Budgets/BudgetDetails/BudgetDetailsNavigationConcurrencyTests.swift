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
}
