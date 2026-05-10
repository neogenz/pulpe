// swiftlint:disable file_length
import Foundation
@testable import Pulpe
import Testing

@Suite(.serialized)
@MainActor
// swiftlint:disable:next type_body_length
struct BudgetDetailsCoordinatorMutationTests {
    // MARK: - Add Mutations

    @Test
    func addBudgetLine_appendsToList() async {
        let coord = BudgetDetailsCoordinator(budgetId: "test-budget")
        let line = TestDataFactory.createBudgetLine(id: "line-1", name: "Test Line")

        await coord.dispatch(.addBudgetLine(line))

        #expect(coord.dataStore.budgetLines.count == 1)
        #expect(coord.dataStore.budgetLines.first?.id == "line-1")
        #expect(coord.dataStore.budgetLines.first?.name == "Test Line")
    }

    @Test
    func addBudgetLine_multipleLines_appendsAll() async {
        let coord = BudgetDetailsCoordinator(budgetId: "test-budget")
        let line1 = TestDataFactory.createBudgetLine(id: "line-1")
        let line2 = TestDataFactory.createBudgetLine(id: "line-2")
        let line3 = TestDataFactory.createBudgetLine(id: "line-3")

        await coord.dispatch(.addBudgetLine(line1))
        await coord.dispatch(.addBudgetLine(line2))
        await coord.dispatch(.addBudgetLine(line3))

        #expect(coord.dataStore.budgetLines.count == 3)
        #expect(coord.dataStore.budgetLines[0].id == "line-1")
        #expect(coord.dataStore.budgetLines[1].id == "line-2")
        #expect(coord.dataStore.budgetLines[2].id == "line-3")
    }

    @Test
    func addTransaction_appendsToList() async {
        let coord = BudgetDetailsCoordinator(budgetId: "test-budget")
        let tx = TestDataFactory.createTransaction(id: "tx-1", name: "Test Transaction")

        await coord.dispatch(.addTransaction(tx))

        #expect(coord.dataStore.transactions.count == 1)
        #expect(coord.dataStore.transactions.first?.id == "tx-1")
    }

    @Test
    func addTransaction_multipleTransactions_appendsAll() async {
        let coord = BudgetDetailsCoordinator(budgetId: "test-budget")
        let tx1 = TestDataFactory.createTransaction(id: "tx-1")
        let tx2 = TestDataFactory.createTransaction(id: "tx-2")
        let tx3 = TestDataFactory.createTransaction(id: "tx-3")

        await coord.dispatch(.addTransaction(tx1))
        await coord.dispatch(.addTransaction(tx2))
        await coord.dispatch(.addTransaction(tx3))

        #expect(coord.dataStore.transactions.count == 3)
    }

    // MARK: - Toggle logic: unchecked line with unchecked transactions

    @Test
    func toggleBudgetLine_withUncheckedTransactions_showsCheckAllAlert() async {
        let coord = BudgetDetailsCoordinator(budgetId: "test-budget")
        let line = TestDataFactory.createBudgetLine(id: "line-1", isChecked: false)
        let linkedTx = TestDataFactory.createTransaction(
            id: "tx-1",
            budgetLineId: "line-1",
            isChecked: false
        )
        await coord.dispatch(.addBudgetLine(line))
        await coord.dispatch(.addTransaction(linkedTx))

        let result = await coord.toggleBudgetLine(line)

        #expect(result == false)
        #expect(coord.syncStore.showCheckAllTransactionsAlert == true)
        #expect(coord.syncStore.budgetLineToCheckAll?.id == "line-1")
    }

    @Test
    func toggleBudgetLine_withUncheckedTransactions_doesNotToggleLine() async {
        let coord = BudgetDetailsCoordinator(budgetId: "test-budget")
        let line = TestDataFactory.createBudgetLine(id: "line-1", isChecked: false)
        let linkedTx = TestDataFactory.createTransaction(
            id: "tx-1",
            budgetLineId: "line-1",
            isChecked: false
        )
        await coord.dispatch(.addBudgetLine(line))
        await coord.dispatch(.addTransaction(linkedTx))

        _ = await coord.toggleBudgetLine(line)

        #expect(coord.dataStore.budgetLines.first?.isChecked == false)
    }

    @Test
    func toggleBudgetLine_withMultipleUncheckedTransactions_showsAlert() async {
        let coord = BudgetDetailsCoordinator(budgetId: "test-budget")
        let line = TestDataFactory.createBudgetLine(id: "line-1", isChecked: false)
        let tx1 = TestDataFactory.createTransaction(id: "tx-1", budgetLineId: "line-1", isChecked: false)
        let tx2 = TestDataFactory.createTransaction(id: "tx-2", budgetLineId: "line-1", isChecked: false)
        await coord.dispatch(.addBudgetLine(line))
        await coord.dispatch(.addTransaction(tx1))
        await coord.dispatch(.addTransaction(tx2))

        let result = await coord.toggleBudgetLine(line)

        #expect(result == false)
        #expect(coord.syncStore.showCheckAllTransactionsAlert == true)
    }

    @Test
    func toggleBudgetLine_withAllTransactionsChecked_doesNotShowAlert() async {
        let coord = BudgetDetailsCoordinator(budgetId: "test-budget")
        let line = TestDataFactory.createBudgetLine(id: "line-1", isChecked: false)
        let linkedTx = TestDataFactory.createTransaction(
            id: "tx-1",
            budgetLineId: "line-1",
            isChecked: true
        )
        await coord.dispatch(.addBudgetLine(line))
        await coord.dispatch(.addTransaction(linkedTx))

        _ = await coord.toggleBudgetLine(line)

        #expect(coord.syncStore.showCheckAllTransactionsAlert == false)
        #expect(coord.syncStore.budgetLineToCheckAll == nil)
    }

    @Test
    func toggleBudgetLine_withNoLinkedTransactions_doesNotShowAlert() async {
        let coord = BudgetDetailsCoordinator(budgetId: "test-budget")
        let line = TestDataFactory.createBudgetLine(id: "line-1", isChecked: false)
        await coord.dispatch(.addBudgetLine(line))

        _ = await coord.toggleBudgetLine(line)

        #expect(coord.syncStore.showCheckAllTransactionsAlert == false)
    }

    @Test
    func toggleBudgetLine_withMixedTransactionStates_showsAlert() async {
        let coord = BudgetDetailsCoordinator(budgetId: "test-budget")
        let line = TestDataFactory.createBudgetLine(id: "line-1", isChecked: false)
        let checkedTx = TestDataFactory.createTransaction(
            id: "tx-1",
            budgetLineId: "line-1",
            isChecked: true
        )
        let uncheckedTx = TestDataFactory.createTransaction(
            id: "tx-2",
            budgetLineId: "line-1",
            isChecked: false
        )
        await coord.dispatch(.addBudgetLine(line))
        await coord.dispatch(.addTransaction(checkedTx))
        await coord.dispatch(.addTransaction(uncheckedTx))

        let result = await coord.toggleBudgetLine(line)

        #expect(result == false)
        #expect(coord.syncStore.showCheckAllTransactionsAlert == true)
    }

    // MARK: - Rollover lines

    @Test
    func toggleBudgetLine_rolloverLine_returnsFalse() async {
        let coord = BudgetDetailsCoordinator(budgetId: "test-budget")
        let rolloverLine = TestDataFactory.createBudgetLine(
            id: "line-rollover",
            isChecked: false,
            isRollover: true
        )
        await coord.dispatch(.addBudgetLine(rolloverLine))

        let result = await coord.toggleBudgetLine(rolloverLine)

        #expect(result == false)
        #expect(coord.dataStore.budgetLines.first?.isChecked == false)
    }

    @Test
    func toggleBudgetLine_rolloverLine_noAlertShown() async {
        let coord = BudgetDetailsCoordinator(budgetId: "test-budget")
        let rolloverLine = TestDataFactory.createBudgetLine(
            id: "line-rollover",
            isChecked: false,
            isRollover: true
        )
        await coord.dispatch(.addBudgetLine(rolloverLine))

        _ = await coord.toggleBudgetLine(rolloverLine)

        #expect(coord.syncStore.showCheckAllTransactionsAlert == false)
    }

    // MARK: - Check all state management

    @Test
    func resetCheckAllState_clearsAlertState() async throws {
        let coord = BudgetDetailsCoordinator(budgetId: "test-budget")
        let line = TestDataFactory.createBudgetLine(id: "line-1", isChecked: false)
        let tx = TestDataFactory.createTransaction(
            id: "tx-1",
            budgetLineId: "line-1",
            isChecked: false
        )
        await coord.dispatch(.addBudgetLine(line))
        await coord.dispatch(.addTransaction(tx))

        _ = await coord.toggleBudgetLine(line)
        try #require(coord.syncStore.showCheckAllTransactionsAlert == true)
        try #require(coord.syncStore.budgetLineToCheckAll != nil)

        await coord.dispatch(.resetCheckAllState)

        #expect(coord.syncStore.showCheckAllTransactionsAlert == false)
        #expect(coord.syncStore.budgetLineToCheckAll == nil)
    }

    @Test
    func resetCheckAllState_fromCleanState_remainsClean() async {
        let coord = BudgetDetailsCoordinator(budgetId: "test-budget")

        await coord.dispatch(.resetCheckAllState)

        #expect(coord.syncStore.showCheckAllTransactionsAlert == false)
        #expect(coord.syncStore.budgetLineToCheckAll == nil)
    }

    @Test
    func confirmToggle_clearsStateViaDefer() async throws {
        let coord = BudgetDetailsCoordinator(budgetId: "test-budget")
        let line = TestDataFactory.createBudgetLine(id: "line-1", isChecked: false)
        let tx = TestDataFactory.createTransaction(
            id: "tx-1",
            budgetLineId: "line-1",
            isChecked: false
        )
        await coord.dispatch(.addBudgetLine(line))
        await coord.dispatch(.addTransaction(tx))

        _ = await coord.toggleBudgetLine(line)
        try #require(coord.syncStore.showCheckAllTransactionsAlert == true)

        // confirmToggle clears state via defer (network call may fail but
        // the alert state must reset regardless).
        _ = await coord.confirmToggle(for: line, checkAll: false)

        #expect(coord.syncStore.showCheckAllTransactionsAlert == false)
        #expect(coord.syncStore.budgetLineToCheckAll == nil)
    }

    @Test
    func toggleBudgetLine_checkedLine_bypassesAlert() async {
        let coord = BudgetDetailsCoordinator(budgetId: "test-budget")
        let line = TestDataFactory.createBudgetLine(id: "line-1", isChecked: true)
        let uncheckedTx = TestDataFactory.createTransaction(
            id: "tx-1",
            budgetLineId: "line-1",
            isChecked: false
        )
        await coord.dispatch(.addBudgetLine(line))
        await coord.dispatch(.addTransaction(uncheckedTx))

        _ = await coord.toggleBudgetLine(line)

        #expect(coord.syncStore.showCheckAllTransactionsAlert == false)
    }

    // MARK: - Soft delete

    @Test
    func softDeleteTransaction_removesFromListImmediately() async {
        let coord = BudgetDetailsCoordinator(budgetId: "test-budget")
        let tx = TestDataFactory.createTransaction(id: "tx-1", name: "To Delete")
        await coord.dispatch(.addTransaction(tx))

        let toastManager = ToastManager()
        let ctx = ToastContext(toastManager: toastManager, presentationCurrency: .chf)
        await coord.dispatch(.softDeleteTransaction(tx, ctx))

        #expect(coord.dataStore.transactions.isEmpty)
    }

    @Test
    func softDeleteTransaction_twoConsecutive_undoTwice_restoresInLIFOOrder() async {
        let coord = BudgetDetailsCoordinator(budgetId: "test-budget")
        let tx1 = TestDataFactory.createTransaction(id: "tx-1", name: "First")
        let tx2 = TestDataFactory.createTransaction(id: "tx-2", name: "Second")
        await coord.dispatch(.addTransaction(tx1))
        await coord.dispatch(.addTransaction(tx2))

        let toastManager = ToastManager()
        let ctx = ToastContext(toastManager: toastManager, presentationCurrency: .chf)
        await coord.dispatch(.softDeleteTransaction(tx1, ctx))
        await coord.dispatch(.softDeleteTransaction(tx2, ctx))

        #expect(coord.dataStore.transactions.isEmpty)
        #expect(toastManager.currentToast?.message == "2 transactions supprimées")

        toastManager.executeUndo()
        try? await Task.sleep(for: .milliseconds(150))
        #expect(coord.dataStore.transactions.count == 1)
        #expect(coord.dataStore.transactions.first?.id == "tx-2")

        toastManager.executeUndo()
        try? await Task.sleep(for: .milliseconds(150))
        #expect(coord.dataStore.transactions.count == 2)
        let ids = Set(coord.dataStore.transactions.map(\.id))
        #expect(ids == ["tx-1", "tx-2"])
    }

    @Test
    func softDeleteBudgetLine_removesFromListImmediately() async {
        let coord = BudgetDetailsCoordinator(budgetId: "test-budget")
        let line = TestDataFactory.createBudgetLine(id: "line-1", name: "To Delete")
        await coord.dispatch(.addBudgetLine(line))

        let toastManager = ToastManager()
        let ctx = ToastContext(toastManager: toastManager, presentationCurrency: .chf)
        await coord.dispatch(.softDeleteBudgetLine(line, ctx))

        #expect(coord.dataStore.budgetLines.isEmpty)
    }

    @Test
    func softDeleteBudgetLine_twoConsecutive_undoTwice_restoresInLIFOOrder() async {
        let coord = BudgetDetailsCoordinator(budgetId: "test-budget")
        let line1 = TestDataFactory.createBudgetLine(id: "line-1", name: "First")
        let line2 = TestDataFactory.createBudgetLine(id: "line-2", name: "Second")
        await coord.dispatch(.addBudgetLine(line1))
        await coord.dispatch(.addBudgetLine(line2))

        let toastManager = ToastManager()
        let ctx = ToastContext(toastManager: toastManager, presentationCurrency: .chf)
        await coord.dispatch(.softDeleteBudgetLine(line1, ctx))
        await coord.dispatch(.softDeleteBudgetLine(line2, ctx))

        #expect(coord.dataStore.budgetLines.isEmpty)
        #expect(toastManager.currentToast?.message == "2 prévisions supprimées")

        toastManager.executeUndo()
        try? await Task.sleep(for: .milliseconds(150))
        #expect(coord.dataStore.budgetLines.count == 1)
        #expect(coord.dataStore.budgetLines.first?.id == "line-2")

        toastManager.executeUndo()
        try? await Task.sleep(for: .milliseconds(150))
        #expect(coord.dataStore.budgetLines.count == 2)
    }

    @Test
    func softDelete_mixedTransactionThenBudgetLine_undoTwice_restoresInLIFOOrder() async {
        let coord = BudgetDetailsCoordinator(budgetId: "test-budget")
        let tx = TestDataFactory.createTransaction(id: "tx-1", name: "Spend")
        let line = TestDataFactory.createBudgetLine(id: "line-1", name: "Forecast")
        await coord.dispatch(.addTransaction(tx))
        await coord.dispatch(.addBudgetLine(line))

        let toastManager = ToastManager()
        let ctx = ToastContext(toastManager: toastManager, presentationCurrency: .chf)
        await coord.dispatch(.softDeleteTransaction(tx, ctx))
        await coord.dispatch(.softDeleteBudgetLine(line, ctx))

        #expect(coord.dataStore.transactions.isEmpty)
        #expect(coord.dataStore.budgetLines.isEmpty)
        #expect(toastManager.currentToast?.message == "2 éléments supprimés")

        toastManager.executeUndo()
        try? await Task.sleep(for: .milliseconds(150))
        #expect(coord.dataStore.budgetLines.count == 1)
        #expect(coord.dataStore.budgetLines.first?.id == "line-1")
        #expect(coord.dataStore.transactions.isEmpty)

        toastManager.executeUndo()
        try? await Task.sleep(for: .milliseconds(150))
        #expect(coord.dataStore.budgetLines.count == 1)
        #expect(coord.dataStore.transactions.count == 1)
        #expect(coord.dataStore.transactions.first?.id == "tx-1")
    }

    @Test
    func softDeleteBudgetLine_rolloverLine_doesNothing() async {
        let coord = BudgetDetailsCoordinator(budgetId: "test-budget")
        let rolloverLine = TestDataFactory.createBudgetLine(
            id: "line-rollover",
            name: "Rollover",
            isRollover: true
        )
        await coord.dispatch(.addBudgetLine(rolloverLine))

        let toastManager = ToastManager()
        let ctx = ToastContext(toastManager: toastManager, presentationCurrency: .chf)
        await coord.dispatch(.softDeleteBudgetLine(rolloverLine, ctx))

        #expect(coord.dataStore.budgetLines.count == 1)
        #expect(coord.dataStore.budgetLines.first?.id == "line-rollover")
    }

    @Test
    func toggleBudgetLine_ignoresFreeTransactions() async {
        let coord = BudgetDetailsCoordinator(budgetId: "test-budget")
        let line = TestDataFactory.createBudgetLine(id: "line-1", isChecked: false)
        let freeTx = TestDataFactory.createTransaction(
            id: "tx-free",
            budgetLineId: nil,
            isChecked: false
        )
        await coord.dispatch(.addBudgetLine(line))
        await coord.dispatch(.addTransaction(freeTx))

        _ = await coord.toggleBudgetLine(line)

        #expect(coord.syncStore.showCheckAllTransactionsAlert == false)
    }
}

// MARK: - Toast tests

@Suite("BudgetDetailsCoordinator — showCheckToastIfNeeded")
@MainActor
struct BudgetDetailsCoordinatorToastTests {
    @Test
    func showCheckToast_defaultBranch_formatsWithEURSymbolAndFrenchLocale() async throws {
        let coord = BudgetDetailsCoordinator(budgetId: "test-budget")
        let line = TestDataFactory.createBudgetLine(id: "line-1", amount: 1234.56, kind: .expense)
        await coord.dispatch(.addBudgetLine(line))
        let toastManager = ToastManager()
        let ctx = ToastContext(toastManager: toastManager, presentationCurrency: .eur)

        await coord.dispatch(.showCheckToastIfNeeded(line, ctx, amountsHidden: false))

        let message = try #require(toastManager.currentToast?.message)
        #expect(message.hasPrefix("Pointé · "))
        #expect(message.hasSuffix(" €"))
        #expect(message.contains(",56"))
        #expect(!message.contains("CHF"))
    }

    @Test
    func showCheckToast_defaultBranch_formatsWithCHFCodeAndSwissLocale() async throws {
        let coord = BudgetDetailsCoordinator(budgetId: "test-budget")
        let line = TestDataFactory.createBudgetLine(id: "line-1", amount: 1234.56, kind: .expense)
        await coord.dispatch(.addBudgetLine(line))
        let toastManager = ToastManager()
        let ctx = ToastContext(toastManager: toastManager, presentationCurrency: .chf)

        await coord.dispatch(.showCheckToastIfNeeded(line, ctx, amountsHidden: false))

        let message = try #require(toastManager.currentToast?.message)
        #expect(message.hasPrefix("Pointé · "))
        #expect(message.hasSuffix(" CHF"))
        #expect(message.contains(".56"))
        #expect(containsSwissGroupingSeparator(message))
        #expect(!message.contains("€"))
    }

    @Test
    func showCheckToast_amountsHidden_emitsShortMessageWithoutCurrency() async throws {
        let coord = BudgetDetailsCoordinator(budgetId: "test-budget")
        let line = TestDataFactory.createBudgetLine(id: "line-1", amount: 1234.56, kind: .expense)
        await coord.dispatch(.addBudgetLine(line))
        let toastManager = ToastManager()
        let ctx = ToastContext(toastManager: toastManager, presentationCurrency: .chf)

        await coord.dispatch(.showCheckToastIfNeeded(line, ctx, amountsHidden: true))

        let message = try #require(toastManager.currentToast?.message)
        #expect(message == "Pointé")
    }

    @Test(
        "pessimistic branch surfaces consumed and effective with the active currency",
        arguments: [
            (SupportedCurrency.chf, "CHF"),
            (SupportedCurrency.eur, "€"),
        ]
    )
    func showCheckToast_pessimistic_includesConsumedAndEffective(
        currency: SupportedCurrency,
        symbol: String
    ) async throws {
        let coord = BudgetDetailsCoordinator(budgetId: "test-budget")
        let line = TestDataFactory.createBudgetLine(id: "line-1", amount: 200, kind: .expense)
        let consumedTx = TestDataFactory.createTransaction(
            id: "tx-1",
            budgetLineId: "line-1",
            amount: 120,
            kind: .expense,
            isChecked: true
        )
        await coord.dispatch(.addBudgetLine(line))
        await coord.dispatch(.addTransaction(consumedTx))
        let toastManager = ToastManager()
        let ctx = ToastContext(toastManager: toastManager, presentationCurrency: currency)

        await coord.dispatch(.showCheckToastIfNeeded(line, ctx, amountsHidden: false))

        let message = try #require(toastManager.currentToast?.message)
        #expect(message.hasPrefix("Pointé · "))
        #expect(message.hasSuffix(" prévus"))
        #expect(message.contains(" — "))
        #expect(message.contains("120"))
        #expect(message.contains("200"))
        #expect(message.components(separatedBy: symbol).count - 1 == 2)
    }

    @Test
    func showCheckToast_onCheckedLine_emitsNoToast() async {
        let coord = BudgetDetailsCoordinator(budgetId: "test-budget")
        let line = TestDataFactory.createBudgetLine(id: "line-1", kind: .expense, isChecked: true)
        await coord.dispatch(.addBudgetLine(line))
        let toastManager = ToastManager()
        let ctx = ToastContext(toastManager: toastManager, presentationCurrency: .chf)

        await coord.dispatch(.showCheckToastIfNeeded(line, ctx, amountsHidden: false))

        #expect(toastManager.currentToast == nil)
    }

    @Test
    func showCheckToast_onIncomeLine_emitsNoToast() async {
        let coord = BudgetDetailsCoordinator(budgetId: "test-budget")
        let line = TestDataFactory.createBudgetLine(id: "line-1", kind: .income)
        await coord.dispatch(.addBudgetLine(line))
        let toastManager = ToastManager()
        let ctx = ToastContext(toastManager: toastManager, presentationCurrency: .chf)

        await coord.dispatch(.showCheckToastIfNeeded(line, ctx, amountsHidden: false))

        #expect(toastManager.currentToast == nil)
    }
}
