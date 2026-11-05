import Foundation
@testable import Pulpe
import Testing

/// V2 `Prevision-supprimee`: during the undo window a deleted prévision's movements read as
/// Hors prévision (the server's `ON DELETE SET NULL`), and regroup under it on undo or when
/// the DELETE fails. Before the fix they vanished from the screen and from the disponible.
@Suite(.serialized)
@MainActor
struct BudgetDetailsSoftDeleteLedgerTests {
    private let line = TestDataFactory.createBudgetLine(id: "groceries", name: "Courses", amount: 600)
    private let migros = TestDataFactory.createTransaction(id: "migros", budgetLineId: "groceries", amount: 400)
    private let coop = TestDataFactory.createTransaction(id: "coop", budgetLineId: "groceries", amount: 264.20)
    private let cafe = TestDataFactory.createTransaction(id: "cafe", amount: 6.50)

    private func freeIds(_ coord: BudgetDetailsCoordinator) -> Set<String> {
        let state = BudgetDetailsProjector.project(
            dataStore: coord.dataStore,
            filtersStore: coord.filtersStore,
            syncStore: coord.syncStore,
            searchText: ""
        )
        return Set(state.free.map(\.transaction.id))
    }

    private func makeCoordinator(service: MockBudgetLineService) async -> BudgetDetailsCoordinator {
        let coord = BudgetDetailsCoordinator(budgetId: "test-budget-1", budgetLineService: service)
        await coord.dispatch(.addBudgetLine(line))
        for tx in [migros, coop, cafe] {
            await coord.dispatch(.addTransaction(tx))
        }
        return coord
    }

    @Test("Pending deletion lists the line's movements Hors prévision, disponible unchanged; undo regroups them")
    func pendingDeletion_movesMovementsUnplanned_undoBringsThemBack() async {
        let toastManager = ToastManager()
        let coord = await makeCoordinator(service: MockBudgetLineService())
        let disponible = coord.dataStore.metrics.remaining
        #expect(freeIds(coord) == ["cafe"])

        let ctx = ToastContext(toastManager: toastManager, presentationCurrency: .chf)
        await coord.dispatch(.softDeleteBudgetLine(line, ctx))

        #expect(freeIds(coord) == ["cafe", "migros", "coop"])
        // 664.20 spent over 600 planned: the overspend already counted, nothing moves.
        #expect(coord.dataStore.metrics.remaining == disponible)

        toastManager.executeUndo()

        await waitForCondition { coord.dataStore.budgetLines.count == 1 }
        #expect(freeIds(coord) == ["cafe"])
        #expect(coord.dataStore.metrics.remaining == disponible)
    }

    @Test("A failed DELETE puts the line back with its movements under it")
    func failedCommit_regroupsMovementsUnderTheLine() async {
        let service = MockBudgetLineService()
        service.deleteError = APIError.networkError(URLError(.notConnectedToInternet))
        let toastManager = ToastManager()
        let coord = await makeCoordinator(service: service)

        let ctx = ToastContext(toastManager: toastManager, presentationCurrency: .chf)
        await coord.dispatch(.softDeleteBudgetLine(line, ctx))
        #expect(freeIds(coord).contains("migros"))

        toastManager.dismiss()

        await waitForCondition { service.deleteBudgetLineCallCount == 1 && coord.dataStore.budgetLines.count == 1 }
        #expect(freeIds(coord) == ["cafe"])
    }

    @Test("An overspent line leaves the disponible unchanged once its movements are unplanned")
    func impactOfRemoving_countsMovementsAsUnplanned() async {
        let coord = await makeCoordinator(service: MockBudgetLineService())

        #expect(coord.dataStore.impactOfRemoving(lineId: "groceries").delta == 0)
    }
}
