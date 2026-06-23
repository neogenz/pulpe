import Foundation
@testable import Pulpe
import Testing

/// PUL-17 v1.1 — the coordinator's "lisser un existant" flow: calls the right
/// service, removes the source AFTER the server confirms, grafts the M0 tranche
/// that landed in THIS budget, and leaves the source intact on failure.
@Suite("BudgetDetailsCoordinator — spread from existing", .serialized)
@MainActor
struct SpreadFromExistingCoordinatorTests {
    private let budgetId = "test-budget"

    private func period(_ month: Int) -> SpreadFromExistingPeriod {
        SpreadFromExistingPeriod(year: 2026, month: month)
    }

    private func toast() -> (ToastManager, ToastContext) {
        let manager = ToastManager()
        return (manager, ToastContext(toastManager: manager, presentationCurrency: .chf))
    }

    @Test
    func spreadBudgetLineFromExisting_callsService_withIdAndPeriods() async {
        let mockLine = MockBudgetLineService()
        let coord = BudgetDetailsCoordinator(
            budgetId: budgetId, budgetLineService: mockLine, transactionService: MockTransactionService()
        )
        await coord.dispatch(.addBudgetLine(TestDataFactory.createBudgetLine(id: "line-1", budgetId: budgetId)))
        let (_, ctx) = toast()

        await coord.dispatch(.spreadBudgetLineFromExisting(lineId: "line-1", periods: [period(6), period(7)], ctx))

        #expect(mockLine.spreadFromLineCalls.count == 1)
        #expect(mockLine.spreadFromLineCalls.first?.id == "line-1")
        #expect(mockLine.spreadFromLineCalls.first?.periods.count == 2)
    }

    @Test
    func spreadBudgetLineFromExisting_onSuccess_removesSource_graftsM0_andToasts() async {
        let mockLine = MockBudgetLineService()
        mockLine.stubbedSpreadResponse = BudgetLineSpreadResponse(
            spreadGroupId: UUID(),
            lines: [
                TestDataFactory.createBudgetLine(id: "tranche-m0", budgetId: budgetId),
                TestDataFactory.createBudgetLine(id: "tranche-m1", budgetId: "other-budget"),
            ],
            createdBudgets: [],
            skippedMonths: []
        )
        let coord = BudgetDetailsCoordinator(
            budgetId: budgetId, budgetLineService: mockLine, transactionService: MockTransactionService()
        )
        await coord.dispatch(.addBudgetLine(TestDataFactory.createBudgetLine(id: "line-1", budgetId: budgetId)))
        let (manager, ctx) = toast()

        await coord.dispatch(.spreadBudgetLineFromExisting(lineId: "line-1", periods: [period(6), period(7)], ctx))

        let ids = Set(coord.dataStore.budgetLines.map(\.id))
        #expect(!ids.contains("line-1"))      // source removed
        #expect(ids.contains("tranche-m0"))   // M0 tranche grafted (same budget)
        #expect(!ids.contains("tranche-m1"))  // other-budget tranche NOT grafted here
        #expect(manager.currentToast?.message == "C'est lissé sur 2 mois")
    }

    @Test
    func spreadBudgetLineFromExisting_onError_keepsSource_andShowsErrorToast() async {
        let mockLine = MockBudgetLineService()
        mockLine.spreadError = URLError(.badServerResponse)
        let coord = BudgetDetailsCoordinator(
            budgetId: budgetId, budgetLineService: mockLine, transactionService: MockTransactionService()
        )
        await coord.dispatch(.addBudgetLine(TestDataFactory.createBudgetLine(id: "line-1", budgetId: budgetId)))
        let (manager, ctx) = toast()

        await coord.dispatch(.spreadBudgetLineFromExisting(lineId: "line-1", periods: [period(6), period(7)], ctx))

        let sourceIntact = coord.dataStore.budgetLines.contains { $0.id == "line-1" }
        #expect(sourceIntact)  // untouched
        #expect(manager.currentToast?.message == "Le lissage n'a pas pu aboutir")
    }

    @Test
    func spreadTransactionFromExisting_onSuccess_removesTransaction_graftsLine() async {
        let mockTx = MockTransactionService()
        mockTx.stubbedSpreadResponse = BudgetLineSpreadResponse(
            spreadGroupId: UUID(),
            lines: [TestDataFactory.createBudgetLine(id: "tranche-m0", budgetId: budgetId)],
            createdBudgets: [],
            skippedMonths: []
        )
        let coord = BudgetDetailsCoordinator(
            budgetId: budgetId, budgetLineService: MockBudgetLineService(), transactionService: mockTx
        )
        await coord.dispatch(.addTransaction(
            TestDataFactory.createTransaction(id: "tx-1", budgetId: budgetId, budgetLineId: nil)
        ))
        let (manager, ctx) = toast()

        await coord.dispatch(.spreadTransactionFromExisting(txId: "tx-1", periods: [period(6), period(7)], ctx))

        #expect(coord.dataStore.transactions.isEmpty)
        let graftedM0 = coord.dataStore.budgetLines.contains { $0.id == "tranche-m0" }
        #expect(graftedM0)
        #expect(mockTx.spreadFromTxnCalls.first?.id == "tx-1")
        #expect(manager.currentToast?.message == "C'est lissé sur 2 mois")
    }
}
