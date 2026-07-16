import Foundation
@testable import Pulpe
import Testing

/// PUL-292 — the coordinator's graft of the "piocher dans son épargne" income
/// line: the sheet awaited the server (FX frozen, idempotency key), then hands
/// back the confirmed income line. The coordinator grafts it into the OPEN
/// budget M so its disponible updates instantly; the paired saving lands in M+1
/// (not owned here) and is picked up on navigation via the cache wipe.
@Suite("BudgetDetailsCoordinator — savings withdrawal", .serialized)
@MainActor
struct SavingsWithdrawalCoordinatorTests {
    private let budgetId = "test-budget"

    @Test
    func createSavingsWithdrawal_graftsIncomeLine_intoOpenBudget() async {
        let coord = BudgetDetailsCoordinator(
            budgetId: budgetId,
            budgetLineService: MockBudgetLineService(),
            transactionService: MockTransactionService()
        )
        let income = TestDataFactory.createBudgetLine(id: "income-m", budgetId: budgetId, kind: .income)

        await coord.dispatch(.createSavingsWithdrawal(incomeLine: income))

        let grafted = coord.dataStore.budgetLines.contains { $0.id == "income-m" }
        #expect(grafted)
    }

    @Test
    func createSavingsWithdrawal_ignoresIncomeLine_fromAnotherBudget() async {
        // Defensive guard: only the M line belongs to the open budget. A line
        // stamped for a different budget must never be grafted here.
        let coord = BudgetDetailsCoordinator(
            budgetId: budgetId,
            budgetLineService: MockBudgetLineService(),
            transactionService: MockTransactionService()
        )
        let foreign = TestDataFactory.createBudgetLine(id: "income-other", budgetId: "other-budget", kind: .income)

        await coord.dispatch(.createSavingsWithdrawal(incomeLine: foreign))

        let grafted = coord.dataStore.budgetLines.contains { $0.id == "income-other" }
        #expect(grafted == false)
    }
}
