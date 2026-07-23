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

    // MARK: - Grouped delete (CA9) — interception + scopes

    @Test
    func softDeleteBudgetLine_linkedLine_raisesChoice_andKeepsLine() async {
        let coord = makeCoordinator()
        let linked = linkedLine(id: "income-m", kind: .income)
        await coord.dispatch(.addBudgetLine(linked))
        let (_, ctx) = toast()

        await coord.dispatch(.softDeleteBudgetLine(linked, ctx))

        #expect(coord.syncStore.showSavingsWithdrawalDeleteChoice)
        #expect(coord.syncStore.budgetLineToDeleteWithdrawal?.id == "income-m")
        let stillPresent = coord.dataStore.budgetLines.contains { $0.id == "income-m" }
        #expect(stillPresent) // CA9 — never silently soft-deleted as a single line
    }

    @Test
    func softDeleteBudgetLine_unlinkedLine_usesLegacySoftDelete() async {
        let coord = makeCoordinator()
        let plain = TestDataFactory.createBudgetLine(id: "plain", budgetId: budgetId, kind: .expense)
        await coord.dispatch(.addBudgetLine(plain))
        let (_, ctx) = toast()

        await coord.dispatch(.softDeleteBudgetLine(plain, ctx))

        #expect(coord.syncStore.showSavingsWithdrawalDeleteChoice == false)
        let removed = coord.dataStore.budgetLines.contains { $0.id == "plain" } == false
        #expect(removed) // legacy optimistic soft-delete untouched
    }

    @Test
    func deleteSavingsWithdrawal_pair_callsServiceWithScope_andRemovesLine() async {
        let mock = MockBudgetLineService()
        let coord = makeCoordinator(budgetLineService: mock)
        let groupId = UUID()
        let income = linkedLine(id: "income-m", kind: .income, groupId: groupId)
        await coord.dispatch(.addBudgetLine(income))
        let (_, ctx) = toast()

        await coord.dispatch(.deleteSavingsWithdrawal(line: income, scope: .pair, ctx))

        #expect(mock.deletedWithdrawals.first?.scope == .pair)
        #expect(mock.deletedWithdrawals.first?.groupId == groupId.uuidString.lowercased())
        let removed = coord.dataStore.budgetLines.contains { $0.id == "income-m" } == false
        #expect(removed)
    }

    @Test
    func deleteSavingsWithdrawal_repaymentOnIncome_keepsIncomeBadged() async {
        let mock = MockBudgetLineService()
        let coord = makeCoordinator(budgetLineService: mock)
        let income = linkedLine(id: "income-m", kind: .income)
        await coord.dispatch(.addBudgetLine(income))
        let (_, ctx) = toast()

        await coord.dispatch(.deleteSavingsWithdrawal(line: income, scope: .repayment, ctx))

        #expect(mock.deletedWithdrawals.first?.scope == .repayment)
        let kept = coord.dataStore.budgetLines.contains { $0.id == "income-m" }
        #expect(kept) // repayment deletes only the M+1 saving; income stays
    }

    @Test
    func deleteSavingsWithdrawal_repaymentOnSaving_removesSaving() async {
        let coord = makeCoordinator()
        let saving = linkedLine(id: "saving-m1", kind: .saving)
        await coord.dispatch(.addBudgetLine(saving))
        let (_, ctx) = toast()

        await coord.dispatch(.deleteSavingsWithdrawal(line: saving, scope: .repayment, ctx))

        let removed = coord.dataStore.budgetLines.contains { $0.id == "saving-m1" } == false
        #expect(removed)
    }

    @Test
    func deleteSavingsWithdrawal_onError_keepsLine_andShowsErrorToast() async {
        let mock = MockBudgetLineService()
        mock.deleteWithdrawalError = URLError(.badServerResponse)
        let coord = makeCoordinator(budgetLineService: mock)
        let income = linkedLine(id: "income-m", kind: .income)
        await coord.dispatch(.addBudgetLine(income))
        let (manager, ctx) = toast()

        await coord.dispatch(.deleteSavingsWithdrawal(line: income, scope: .pair, ctx))

        let intact = coord.dataStore.budgetLines.contains { $0.id == "income-m" }
        #expect(intact) // no optimistic removal — state untouched on failure
        #expect(manager.currentToast?.message == "La suppression n'a pas pu aboutir")
    }

    // MARK: - Helpers

    private func makeCoordinator(
        budgetLineService: MockBudgetLineService = MockBudgetLineService()
    ) -> BudgetDetailsCoordinator {
        BudgetDetailsCoordinator(
            budgetId: budgetId,
            budgetLineService: budgetLineService,
            transactionService: MockTransactionService()
        )
    }

    private func linkedLine(id: String, kind: TransactionKind, groupId: UUID = UUID()) -> BudgetLine {
        var line = TestDataFactory.createBudgetLine(id: id, budgetId: budgetId, kind: kind)
        line.savingsWithdrawalGroupId = groupId
        return line
    }

    private func toast() -> (ToastManager, ToastContext) {
        let manager = ToastManager()
        return (manager, ToastContext(toastManager: manager, presentationCurrency: .chf))
    }
}
