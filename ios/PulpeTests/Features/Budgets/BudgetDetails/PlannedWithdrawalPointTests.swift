import Foundation
@testable import Pulpe
import Testing

/// Pointing an announced withdrawal (PUL-329) with the ordinary gesture: ON realizes
/// what is left in one Réel, OFF deletes the one Réel after confirmation, and the
/// line's own `checkedAt` is never touched.
@Suite(.serialized)
@MainActor
struct PlannedWithdrawalPointTests {
    private func announcedLine() -> BudgetLine {
        BudgetLine(
            id: "line-1", budgetId: "budget-1", templateLineId: nil, savingsGoalId: nil,
            name: "Apport cuisine", amount: 500, kind: .income, recurrence: .oneOff,
            isManuallyAdjusted: false, checkedAt: nil,
            createdAt: TestDataFactory.fixedDate, updatedAt: TestDataFactory.fixedDate,
            sourceSavingsGoalId: "goal-1", sourceSavingsGoalName: "Fonds d'urgence"
        )
    }

    private func realization(id: String, amount: Decimal) -> Transaction {
        TestDataFactory.createTransaction(
            id: id, budgetId: "budget-1", budgetLineId: "line-1",
            amount: amount, kind: .income, isChecked: true
        )
    }

    private func makeCoordinator(
        txService: MockTransactionService,
        transactions: [Transaction] = []
    ) async -> BudgetDetailsCoordinator {
        let coord = BudgetDetailsCoordinator(
            budgetId: "planned-withdrawal-point-budget",
            budgetLineService: MockBudgetLineService(),
            transactionService: txService
        )
        await coord.dispatch(.addBudgetLine(announcedLine()))
        for tx in transactions { await coord.dispatch(.addTransaction(tx)) }
        return coord
    }

    private func context(_ toastManager: ToastManager = ToastManager()) -> ToastContext {
        ToastContext(toastManager: toastManager, presentationCurrency: .chf)
    }

    @Test("Point ON creates the pointed remainder, never checks the line")
    func pointOn_createsTheRemainder() async throws {
        let txService = MockTransactionService()
        txService.stubbedCreated = realization(id: "tx-new", amount: 200)
        let coord = await makeCoordinator(txService: txService, transactions: [realization(id: "tx-1", amount: 300)])

        let outcome = await coord.pointPlannedWithdrawal(announcedLine(), context: context())

        #expect(outcome == .handled)
        let payload = try #require(txService.createdPayloads.first)
        #expect(txService.createdPayloads.count == 1)
        #expect(payload.amount == 200)
        #expect(payload.name == "Apport cuisine")
        #expect(payload.kind == .income)
        #expect(payload.budgetLineId == "line-1")
        #expect(payload.checkedAt != nil)
        let landed = coord.dataStore.transactions.map(\.id)
        #expect(landed == ["tx-1", "tx-new"])
        #expect(coord.dataStore.budgetLines.first?.checkedAt == nil)
        #expect(!coord.syncStore.isSyncing(lineId: "line-1"))
    }

    @Test("A refused realization toasts the error and falls back to the form")
    func pointOn_failureOpensTheForm() async throws {
        let txService = MockTransactionService()
        txService.createError = URLError(.notConnectedToInternet)
        let coord = await makeCoordinator(txService: txService)
        let toastManager = ToastManager()

        let outcome = await coord.pointPlannedWithdrawal(announcedLine(), context: context(toastManager))

        #expect(outcome == .openRealizationForm)
        #expect(try #require(toastManager.currentToast).type == .error)
        #expect(coord.dataStore.transactions.isEmpty)
        #expect(!coord.syncStore.isSyncing(lineId: "line-1"))
    }

    @Test("Point OFF with one Réel asks first, then deletes it")
    func pointOff_singleRealizationAsksThenDeletes() async throws {
        let txService = MockTransactionService()
        let coord = await makeCoordinator(txService: txService, transactions: [realization(id: "tx-1", amount: 500)])

        let outcome = await coord.pointPlannedWithdrawal(announcedLine(), context: context())

        #expect(outcome == .handled)
        #expect(coord.syncStore.showPlannedWithdrawalUndo)
        let undo = try #require(coord.syncStore.plannedWithdrawalUndo)
        #expect(undo.realization.id == "tx-1")
        #expect(undo.goalName == "Fonds d'urgence")
        // Nothing is deleted until the user confirms.
        #expect(coord.dataStore.transactions.count == 1)
        #expect(txService.createdPayloads.isEmpty)

        await coord.dispatch(.softDeleteTransaction(undo.realization, context()))
        #expect(coord.dataStore.transactions.isEmpty)
    }

    @Test("Point OFF with several Réels opens the line instead of deleting")
    func pointOff_severalRealizationsOpenTheDetail() async {
        let txService = MockTransactionService()
        let coord = await makeCoordinator(
            txService: txService,
            transactions: [realization(id: "tx-1", amount: 300), realization(id: "tx-2", amount: 200)]
        )

        let outcome = await coord.pointPlannedWithdrawal(announcedLine(), context: context())

        #expect(outcome == .openLineDetail)
        #expect(!coord.syncStore.showPlannedWithdrawalUndo)
        #expect(coord.dataStore.transactions.count == 2)
    }

    @Test("Its Réels never raise the point-all alert")
    func prepare_skipsTheCheckAllAlert() async {
        let unchecked = TestDataFactory.createTransaction(
            id: "tx-1", budgetId: "budget-1", budgetLineId: "line-1", amount: 100, kind: .income
        )
        let coord = await makeCoordinator(txService: MockTransactionService(), transactions: [unchecked])

        #expect(coord.prepareToggleBudgetLine(announcedLine()))
        #expect(!coord.syncStore.showCheckAllTransactionsAlert)
    }
}
