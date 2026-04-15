// swiftlint:disable file_length
import Foundation
@testable import Pulpe
import Testing

@Suite(.serialized)
@MainActor
// swiftlint:disable:next type_body_length
struct BudgetDetailsViewModelMutationTests {
    // MARK: - Add Mutations

    @Test
    func addBudgetLine_appendsToList() {
        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        let line = TestDataFactory.createBudgetLine(id: "line-1", name: "Test Line")

        viewModel.addBudgetLine(line)

        #expect(viewModel.budgetLines.count == 1)
        #expect(viewModel.budgetLines.first?.id == "line-1")
        #expect(viewModel.budgetLines.first?.name == "Test Line")
    }

    @Test
    func addBudgetLine_multipleLines_appendsAll() {
        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        let line1 = TestDataFactory.createBudgetLine(id: "line-1")
        let line2 = TestDataFactory.createBudgetLine(id: "line-2")
        let line3 = TestDataFactory.createBudgetLine(id: "line-3")

        viewModel.addBudgetLine(line1)
        viewModel.addBudgetLine(line2)
        viewModel.addBudgetLine(line3)

        #expect(viewModel.budgetLines.count == 3)
        #expect(viewModel.budgetLines[0].id == "line-1")
        #expect(viewModel.budgetLines[1].id == "line-2")
        #expect(viewModel.budgetLines[2].id == "line-3")
    }

    @Test
    func addTransaction_appendsToList() {
        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        let tx = TestDataFactory.createTransaction(id: "tx-1", name: "Test Transaction")

        viewModel.addTransaction(tx)

        #expect(viewModel.transactions.count == 1)
        #expect(viewModel.transactions.first?.id == "tx-1")
        #expect(viewModel.transactions.first?.name == "Test Transaction")
    }

    @Test
    func addTransaction_multipleTransactions_appendsAll() {
        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        let tx1 = TestDataFactory.createTransaction(id: "tx-1")
        let tx2 = TestDataFactory.createTransaction(id: "tx-2")
        let tx3 = TestDataFactory.createTransaction(id: "tx-3")

        viewModel.addTransaction(tx1)
        viewModel.addTransaction(tx2)
        viewModel.addTransaction(tx3)

        #expect(viewModel.transactions.count == 3)
        #expect(viewModel.transactions[0].id == "tx-1")
        #expect(viewModel.transactions[1].id == "tx-2")
        #expect(viewModel.transactions[2].id == "tx-3")
    }

    // MARK: - Update Mutations

    @Test
    func updateBudgetLine_updatesInPlace() async {
        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        let originalLine = TestDataFactory.createBudgetLine(id: "line-1", name: "Original", amount: 1000)
        viewModel.addBudgetLine(originalLine)

        let modifiedLine = TestDataFactory.createBudgetLine(
            id: "line-1",
            name: "Modified",
            amount: 2000
        )
        await viewModel.updateBudgetLine(modifiedLine)

        #expect(viewModel.budgetLines.count == 1)
        #expect(viewModel.budgetLines.first?.name == "Modified")
        #expect(viewModel.budgetLines.first?.amount == 2000)
    }

    @Test
    func updateBudgetLine_withDifferentKind_updatesProperty() async {
        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        let originalLine = TestDataFactory.createBudgetLine(
            id: "line-1",
            amount: 1000,
            kind: .expense
        )
        viewModel.addBudgetLine(originalLine)

        let modifiedLine = TestDataFactory.createBudgetLine(
            id: "line-1",
            amount: 1000,
            kind: .saving
        )
        await viewModel.updateBudgetLine(modifiedLine)

        #expect(viewModel.budgetLines.first?.kind == .saving)
    }

    @Test
    func updateBudgetLine_doesNotAffectOtherLines() async {
        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        let line1 = TestDataFactory.createBudgetLine(id: "line-1", name: "Line 1")
        let line2 = TestDataFactory.createBudgetLine(id: "line-2", name: "Line 2")
        viewModel.addBudgetLine(line1)
        viewModel.addBudgetLine(line2)

        let modifiedLine1 = TestDataFactory.createBudgetLine(id: "line-1", name: "Modified 1")
        await viewModel.updateBudgetLine(modifiedLine1)

        #expect(viewModel.budgetLines[0].name == "Modified 1")
        #expect(viewModel.budgetLines[1].name == "Line 2")
    }

    @Test
    func updateTransaction_updatesInPlace() async {
        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        let originalTx = TestDataFactory.createTransaction(id: "tx-1", name: "Original", amount: 100)
        viewModel.addTransaction(originalTx)

        let modifiedTx = TestDataFactory.createTransaction(id: "tx-1", name: "Modified", amount: 200)
        await viewModel.updateTransaction(modifiedTx)

        #expect(viewModel.transactions.count == 1)
        #expect(viewModel.transactions.first?.name == "Modified")
        #expect(viewModel.transactions.first?.amount == 200)
    }

    @Test
    func updateTransaction_withDifferentKind_updatesProperty() async {
        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        let originalTx = TestDataFactory.createTransaction(id: "tx-1", amount: 100, kind: .expense)
        viewModel.addTransaction(originalTx)

        let modifiedTx = TestDataFactory.createTransaction(id: "tx-1", amount: 100, kind: .income)
        await viewModel.updateTransaction(modifiedTx)

        #expect(viewModel.transactions.first?.kind == .income)
    }

    @Test
    func updateTransaction_doesNotAffectOtherTransactions() async {
        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        let tx1 = TestDataFactory.createTransaction(id: "tx-1", name: "TX 1")
        let tx2 = TestDataFactory.createTransaction(id: "tx-2", name: "TX 2")
        viewModel.addTransaction(tx1)
        viewModel.addTransaction(tx2)

        let modifiedTx1 = TestDataFactory.createTransaction(id: "tx-1", name: "Modified TX 1")
        await viewModel.updateTransaction(modifiedTx1)

        #expect(viewModel.transactions[0].name == "Modified TX 1")
        #expect(viewModel.transactions[1].name == "TX 2")
    }

    // MARK: - Toggle Logic: Unchecked Line with Unchecked Transactions

    @Test
    func toggleBudgetLine_withUncheckedTransactions_showsCheckAllAlert() async {
        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        let line = TestDataFactory.createBudgetLine(id: "line-1", isChecked: false)
        let linkedTx = TestDataFactory.createTransaction(
            id: "tx-1",
            budgetLineId: "line-1",
            isChecked: false
        )
        viewModel.addBudgetLine(line)
        viewModel.addTransaction(linkedTx)

        let result = await viewModel.toggleBudgetLine(line)

        #expect(result == false)
        #expect(viewModel.showCheckAllTransactionsAlert == true)
        #expect(viewModel.budgetLineToCheckAll?.id == "line-1")
    }

    @Test
    func toggleBudgetLine_withUncheckedTransactions_doesNotToggleLine() async {
        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        let line = TestDataFactory.createBudgetLine(id: "line-1", isChecked: false)
        let linkedTx = TestDataFactory.createTransaction(
            id: "tx-1",
            budgetLineId: "line-1",
            isChecked: false
        )
        viewModel.addBudgetLine(line)
        viewModel.addTransaction(linkedTx)

        _ = await viewModel.toggleBudgetLine(line)

        #expect(viewModel.budgetLines.first?.isChecked == false)
    }

    @Test
    func toggleBudgetLine_withMultipleUncheckedTransactions_showsAlert() async {
        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        let line = TestDataFactory.createBudgetLine(id: "line-1", isChecked: false)
        let tx1 = TestDataFactory.createTransaction(
            id: "tx-1",
            budgetLineId: "line-1",
            isChecked: false
        )
        let tx2 = TestDataFactory.createTransaction(
            id: "tx-2",
            budgetLineId: "line-1",
            isChecked: false
        )
        viewModel.addBudgetLine(line)
        viewModel.addTransaction(tx1)
        viewModel.addTransaction(tx2)

        let result = await viewModel.toggleBudgetLine(line)

        #expect(result == false)
        #expect(viewModel.showCheckAllTransactionsAlert == true)
    }

    // MARK: - Toggle Logic: All Transactions Checked

    @Test
    func toggleBudgetLine_withAllTransactionsChecked_doesNotShowAlert() async {
        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        let line = TestDataFactory.createBudgetLine(id: "line-1", isChecked: false)
        let linkedTx = TestDataFactory.createTransaction(
            id: "tx-1",
            budgetLineId: "line-1",
            isChecked: true
        )
        viewModel.addBudgetLine(line)
        viewModel.addTransaction(linkedTx)

        let result = await viewModel.toggleBudgetLine(line)

        #expect(viewModel.showCheckAllTransactionsAlert == false)
        #expect(viewModel.budgetLineToCheckAll == nil)
    }

    @Test
    func toggleBudgetLine_withNoLinkedTransactions_doesNotShowAlert() async {
        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        let line = TestDataFactory.createBudgetLine(id: "line-1", isChecked: false)
        viewModel.addBudgetLine(line)

        let result = await viewModel.toggleBudgetLine(line)

        #expect(viewModel.showCheckAllTransactionsAlert == false)
        #expect(viewModel.budgetLineToCheckAll == nil)
    }

    @Test
    func toggleBudgetLine_withMixedTransactionStates_showsAlert() async {
        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
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
        viewModel.addBudgetLine(line)
        viewModel.addTransaction(checkedTx)
        viewModel.addTransaction(uncheckedTx)

        let result = await viewModel.toggleBudgetLine(line)

        #expect(result == false)
        #expect(viewModel.showCheckAllTransactionsAlert == true)
    }

    // MARK: - Rollover Lines

    @Test
    func toggleBudgetLine_rolloverLine_returnsFalse() async {
        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        let rolloverLine = TestDataFactory.createBudgetLine(
            id: "line-rollover",
            isChecked: false,
            isRollover: true
        )
        viewModel.addBudgetLine(rolloverLine)

        let result = await viewModel.toggleBudgetLine(rolloverLine)

        #expect(result == false)
        #expect(viewModel.budgetLines.first?.isChecked == false)
    }

    @Test
    func toggleBudgetLine_rolloverLine_noAlertShown() async {
        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        let rolloverLine = TestDataFactory.createBudgetLine(
            id: "line-rollover",
            isChecked: false,
            isRollover: true
        )
        viewModel.addBudgetLine(rolloverLine)

        _ = await viewModel.toggleBudgetLine(rolloverLine)

        #expect(viewModel.showCheckAllTransactionsAlert == false)
        #expect(viewModel.budgetLineToCheckAll == nil)
    }

    // MARK: - Check All State Management

    @Test
    func resetCheckAllState_clearsAlertState() async throws {
        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        let line = TestDataFactory.createBudgetLine(id: "line-1", isChecked: false)
        let tx = TestDataFactory.createTransaction(id: "tx-1", budgetLineId: "line-1", isChecked: false)
        viewModel.addBudgetLine(line)
        viewModel.addTransaction(tx)

        // Trigger the alert via toggleBudgetLine (sets budgetLineToCheckAll and showCheckAllTransactionsAlert)
        _ = await viewModel.toggleBudgetLine(line)
        try #require(viewModel.showCheckAllTransactionsAlert == true, "Setup: alert should be triggered")
        try #require(viewModel.budgetLineToCheckAll != nil, "Setup: budgetLineToCheckAll should be set")

        viewModel.resetCheckAllState()

        #expect(viewModel.showCheckAllTransactionsAlert == false)
        #expect(viewModel.budgetLineToCheckAll == nil)
    }

    @Test
    func resetCheckAllState_fromCleanState_remainsClean() {
        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")

        viewModel.resetCheckAllState()

        #expect(viewModel.showCheckAllTransactionsAlert == false)
        #expect(viewModel.budgetLineToCheckAll == nil)
    }

    @Test
    func confirmToggle_clearsStateViaDefer() async throws {
        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        let line = TestDataFactory.createBudgetLine(id: "line-1", isChecked: false)
        let tx = TestDataFactory.createTransaction(id: "tx-1", budgetLineId: "line-1", isChecked: false)
        viewModel.addBudgetLine(line)
        viewModel.addTransaction(tx)

        // Trigger alert state via toggleBudgetLine
        _ = await viewModel.toggleBudgetLine(line)
        try #require(viewModel.showCheckAllTransactionsAlert == true, "Setup: alert should be triggered")

        // confirmToggle clears the state via defer
        _ = await viewModel.confirmToggle(for: line, checkAll: false)

        #expect(viewModel.showCheckAllTransactionsAlert == false)
        #expect(viewModel.budgetLineToCheckAll == nil)
    }

    // MARK: - Toggle with Checked Line

    @Test
    func toggleBudgetLine_checkedLine_bypassesAlert() async {
        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        let line = TestDataFactory.createBudgetLine(id: "line-1", isChecked: true)
        let uncheckedTx = TestDataFactory.createTransaction(
            id: "tx-1",
            budgetLineId: "line-1",
            isChecked: false
        )
        viewModel.addBudgetLine(line)
        viewModel.addTransaction(uncheckedTx)

        _ = await viewModel.toggleBudgetLine(line)

        #expect(viewModel.showCheckAllTransactionsAlert == false)
    }

    // MARK: - Soft Delete (Optimistic Removal)

    @Test
    func softDeleteTransaction_removesFromListImmediately() {
        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        let tx = TestDataFactory.createTransaction(id: "tx-1", name: "To Delete")
        viewModel.addTransaction(tx)

        let toastManager = ToastManager()
        viewModel.softDeleteTransaction(tx, toastManager: toastManager, presentationCurrency: .chf)

        #expect(viewModel.transactions.isEmpty)
    }

    @Test
    func softDeleteTransaction_twoConsecutive_undoTwice_restoresInLIFOOrder() async {
        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        let tx1 = TestDataFactory.createTransaction(id: "tx-1", name: "First")
        let tx2 = TestDataFactory.createTransaction(id: "tx-2", name: "Second")
        viewModel.addTransaction(tx1)
        viewModel.addTransaction(tx2)

        let toastManager = ToastManager()
        viewModel.softDeleteTransaction(tx1, toastManager: toastManager, presentationCurrency: .chf)
        viewModel.softDeleteTransaction(tx2, toastManager: toastManager, presentationCurrency: .chf)

        #expect(viewModel.transactions.isEmpty)
        #expect(toastManager.currentToast?.message == "2 transactions supprimées")

        toastManager.executeUndo()
        try? await Task.sleep(for: .milliseconds(150))
        #expect(viewModel.transactions.count == 1)
        #expect(viewModel.transactions.first?.id == "tx-2")

        toastManager.executeUndo()
        try? await Task.sleep(for: .milliseconds(150))
        #expect(viewModel.transactions.count == 2)
        let ids = Set(viewModel.transactions.map(\.id))
        #expect(ids == ["tx-1", "tx-2"])
    }

    @Test
    func softDeleteBudgetLine_removesFromListImmediately() {
        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        let line = TestDataFactory.createBudgetLine(id: "line-1", name: "To Delete")
        viewModel.addBudgetLine(line)

        let toastManager = ToastManager()
        viewModel.softDeleteBudgetLine(line, toastManager: toastManager, presentationCurrency: .chf)

        #expect(viewModel.budgetLines.isEmpty)
    }

    @Test
    func softDeleteBudgetLine_twoConsecutive_undoTwice_restoresInLIFOOrder() async {
        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        let line1 = TestDataFactory.createBudgetLine(id: "line-1", name: "First")
        let line2 = TestDataFactory.createBudgetLine(id: "line-2", name: "Second")
        viewModel.addBudgetLine(line1)
        viewModel.addBudgetLine(line2)

        let toastManager = ToastManager()
        viewModel.softDeleteBudgetLine(line1, toastManager: toastManager, presentationCurrency: .chf)
        viewModel.softDeleteBudgetLine(line2, toastManager: toastManager, presentationCurrency: .chf)

        #expect(viewModel.budgetLines.isEmpty)
        #expect(toastManager.currentToast?.message == "2 prévisions supprimées")

        toastManager.executeUndo()
        try? await Task.sleep(for: .milliseconds(150))
        #expect(viewModel.budgetLines.count == 1)
        #expect(viewModel.budgetLines.first?.id == "line-2")

        toastManager.executeUndo()
        try? await Task.sleep(for: .milliseconds(150))
        #expect(viewModel.budgetLines.count == 2)
        let ids = Set(viewModel.budgetLines.map(\.id))
        #expect(ids == ["line-1", "line-2"])
    }

    @Test
    func softDelete_mixedTransactionThenBudgetLine_undoTwice_restoresInLIFOOrder() async {
        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        let tx = TestDataFactory.createTransaction(id: "tx-1", name: "Spend")
        let line = TestDataFactory.createBudgetLine(id: "line-1", name: "Forecast")
        viewModel.addTransaction(tx)
        viewModel.addBudgetLine(line)

        let toastManager = ToastManager()
        viewModel.softDeleteTransaction(tx, toastManager: toastManager, presentationCurrency: .chf)
        viewModel.softDeleteBudgetLine(line, toastManager: toastManager, presentationCurrency: .chf)

        #expect(viewModel.transactions.isEmpty)
        #expect(viewModel.budgetLines.isEmpty)
        #expect(toastManager.currentToast?.message == "2 éléments supprimés")

        toastManager.executeUndo()
        try? await Task.sleep(for: .milliseconds(150))
        #expect(viewModel.budgetLines.count == 1)
        #expect(viewModel.budgetLines.first?.id == "line-1")
        #expect(viewModel.transactions.isEmpty)

        toastManager.executeUndo()
        try? await Task.sleep(for: .milliseconds(150))
        #expect(viewModel.budgetLines.count == 1)
        #expect(viewModel.transactions.count == 1)
        #expect(viewModel.transactions.first?.id == "tx-1")
    }

    @Test
    func softDeleteBudgetLine_rolloverLine_doesNothing() {
        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        let rolloverLine = TestDataFactory.createBudgetLine(
            id: "line-rollover",
            name: "Rollover",
            isRollover: true
        )
        viewModel.addBudgetLine(rolloverLine)

        let toastManager = ToastManager()
        viewModel.softDeleteBudgetLine(rolloverLine, toastManager: toastManager, presentationCurrency: .chf)

        #expect(viewModel.budgetLines.count == 1)
        #expect(viewModel.budgetLines.first?.id == "line-rollover")
    }

    // MARK: - Free Transactions (No budgetLineId)

    @Test
    func toggleBudgetLine_ignoresFreeTransactions() async {
        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        let line = TestDataFactory.createBudgetLine(id: "line-1", isChecked: false)
        let freeTx = TestDataFactory.createTransaction(
            id: "tx-free",
            budgetLineId: nil,
            isChecked: false
        )
        viewModel.addBudgetLine(line)
        viewModel.addTransaction(freeTx)

        _ = await viewModel.toggleBudgetLine(line)

        #expect(viewModel.showCheckAllTransactionsAlert == false)
    }
}
