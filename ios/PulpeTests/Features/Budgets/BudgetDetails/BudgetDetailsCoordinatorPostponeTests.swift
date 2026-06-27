import Foundation
@testable import Pulpe
import Testing

/// Coverage for PUL-22 — "Reporter une dépense non pointée au mois suivant".
/// Locks the coordinator postpone path (optimistic remove → server call →
/// rollback on failure, plus toast) and the CA5 calendar-adjacency guard that
/// the view reads to gate the action.
@Suite(.serialized)
@MainActor
struct BudgetDetailsCoordinatorPostponeTests {
    private func makeContext() -> ToastContext {
        ToastContext(toastManager: ToastManager(), presentationCurrency: .chf)
    }

    // MARK: - Budget line postpone

    @Test
    func postponeBudgetLine_happyPath_removesLineAndCallsService() async {
        let lineService = MockBudgetLineService()
        let coord = BudgetDetailsCoordinator(
            budgetId: "test-budget",
            budgetLineService: lineService
        )
        let line = TestDataFactory.createBudgetLine(
            id: "line-1",
            kind: .expense,
            recurrence: .oneOff
        )
        await coord.dispatch(.addBudgetLine(line))

        await coord.dispatch(.postponeBudgetLine(line, makeContext()))

        #expect(coord.dataStore.budgetLines.isEmpty)
        #expect(lineService.postponeCallCount == 1)
        #expect(lineService.postponedIds == ["line-1"])
    }

    @Test
    func postponeBudgetLine_serverFailure_restoresLine() async {
        let lineService = MockBudgetLineService()
        lineService.postponeError = URLError(.badServerResponse)
        let coord = BudgetDetailsCoordinator(
            budgetId: "test-budget",
            budgetLineService: lineService
        )
        let line = TestDataFactory.createBudgetLine(id: "line-1", recurrence: .oneOff)
        await coord.dispatch(.addBudgetLine(line))

        await coord.dispatch(.postponeBudgetLine(line, makeContext()))

        // Optimistic remove rolled back after the server rejected the move.
        #expect(coord.dataStore.budgetLines.map(\.id) == ["line-1"])
        #expect(lineService.postponeCallCount == 1)
    }

    @Test
    func postponeBudgetLine_returnsTrueOnSuccess() async {
        let lineService = MockBudgetLineService()
        let coord = BudgetDetailsCoordinator(
            budgetId: "test-budget",
            budgetLineService: lineService
        )
        let line = TestDataFactory.createBudgetLine(id: "line-1", recurrence: .oneOff)
        await coord.dispatch(.addBudgetLine(line))

        let succeeded = await coord.postponeBudgetLine(line, context: makeContext())

        // The view gates its success haptic on this Bool — true only when the
        // server move landed, not on a rollback.
        #expect(succeeded)
    }

    @Test
    func postponeBudgetLine_returnsFalseWhenServiceThrows() async {
        let lineService = MockBudgetLineService()
        lineService.postponeError = URLError(.badServerResponse)
        let coord = BudgetDetailsCoordinator(
            budgetId: "test-budget",
            budgetLineService: lineService
        )
        let line = TestDataFactory.createBudgetLine(id: "line-1", recurrence: .oneOff)
        await coord.dispatch(.addBudgetLine(line))

        let succeeded = await coord.postponeBudgetLine(line, context: makeContext())

        // Rejected move → false → the view must NOT fire the success haptic.
        #expect(!succeeded)
    }

    // MARK: - Transaction postpone

    @Test
    func postponeTransaction_happyPath_removesTransactionAndCallsService() async {
        let txService = MockTransactionService()
        let coord = BudgetDetailsCoordinator(
            budgetId: "test-budget",
            transactionService: txService
        )
        let tx = TestDataFactory.createTransaction(id: "tx-1")
        await coord.dispatch(.addTransaction(tx))

        await coord.dispatch(.postponeTransaction(tx, makeContext()))

        #expect(coord.dataStore.transactions.isEmpty)
        #expect(txService.postponeCallCount == 1)
        #expect(txService.postponedIds == ["tx-1"])
    }

    @Test
    func postponeTransaction_serverFailure_restoresTransaction() async {
        let txService = MockTransactionService()
        txService.postponeError = URLError(.badServerResponse)
        let coord = BudgetDetailsCoordinator(
            budgetId: "test-budget",
            transactionService: txService
        )
        let tx = TestDataFactory.createTransaction(id: "tx-1")
        await coord.dispatch(.addTransaction(tx))

        await coord.dispatch(.postponeTransaction(tx, makeContext()))

        #expect(coord.dataStore.transactions.map(\.id) == ["tx-1"])
        #expect(txService.postponeCallCount == 1)
    }

    @Test
    func postponeTransaction_returnsTrueOnSuccess() async {
        let txService = MockTransactionService()
        let coord = BudgetDetailsCoordinator(
            budgetId: "test-budget",
            transactionService: txService
        )
        let tx = TestDataFactory.createTransaction(id: "tx-1")
        await coord.dispatch(.addTransaction(tx))

        let succeeded = await coord.postponeTransaction(tx, context: makeContext())

        #expect(succeeded)
    }

    @Test
    func postponeTransaction_returnsFalseWhenServiceThrows() async {
        let txService = MockTransactionService()
        txService.postponeError = URLError(.badServerResponse)
        let coord = BudgetDetailsCoordinator(
            budgetId: "test-budget",
            transactionService: txService
        )
        let tx = TestDataFactory.createTransaction(id: "tx-1")
        await coord.dispatch(.addTransaction(tx))

        let succeeded = await coord.postponeTransaction(tx, context: makeContext())

        #expect(!succeeded)
    }

    // MARK: - CA5: calendar-adjacency guard (hasNextMonthBudget / nextMonthLabel)

    @Test
    func hasNextMonthBudget_whenNextCalendarMonthExists_isTrue() {
        BudgetDetailCache.shared.invalidateAll()
        let store = BudgetDataStore(budgetId: "june")
        store.setBudget(TestDataFactory.createBudget(id: "june", month: 6, year: 2025))
        store.applyAllBudgets([
            TestDataFactory.createBudgetSparse(id: "june", month: 6, year: 2025),
            TestDataFactory.createBudgetSparse(id: "july", month: 7, year: 2025),
        ])

        #expect(store.hasNextMonthBudget)
        #expect(store.nextMonthLabel == "juillet")
    }

    @Test
    func hasNextMonthBudget_whenNextCalendarMonthMissing_isFalse() {
        // A LIST-adjacent budget exists (September), but the literal next
        // calendar month (July) does not — CA5 must reject the postpone.
        BudgetDetailCache.shared.invalidateAll()
        let store = BudgetDataStore(budgetId: "june")
        store.setBudget(TestDataFactory.createBudget(id: "june", month: 6, year: 2025))
        store.applyAllBudgets([
            TestDataFactory.createBudgetSparse(id: "june", month: 6, year: 2025),
            TestDataFactory.createBudgetSparse(id: "sept", month: 9, year: 2025),
        ])

        #expect(!store.hasNextMonthBudget)
        #expect(store.nextMonthLabel == "juillet")
    }

    @Test
    func nextCalendarMonth_inDecember_rollsToJanuaryNextYear() {
        BudgetDetailCache.shared.invalidateAll()
        let store = BudgetDataStore(budgetId: "dec")
        store.setBudget(TestDataFactory.createBudget(id: "dec", month: 12, year: 2025))
        store.applyAllBudgets([
            TestDataFactory.createBudgetSparse(id: "dec", month: 12, year: 2025),
            TestDataFactory.createBudgetSparse(id: "jan", month: 1, year: 2026),
        ])

        #expect(store.hasNextMonthBudget)
        #expect(store.nextMonthLabel == "janvier")
    }
}
