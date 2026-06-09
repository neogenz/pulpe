import Foundation
@testable import Pulpe
import Testing

/// Regression harness for PUL-259 — bulk-check ("check all") of a budget line's
/// transactions must surface a feedback toast when some server calls fail.
///
/// Before the fix `checkAllAllocatedTransactions` set `hadFailure`, reloaded the
/// budget (silently reverting the user's optimistic checks), but emitted no
/// feedback — and because the line toggle itself succeeded, the dispatcher even
/// fired the "Pointé" success toast, masking the partial failure. These tests
/// inject the `TransactionServicing` / `BudgetLineServicing` seam so the failure
/// is deterministic, and assert the dispatcher picks the error toast (not the
/// success one) on partial failure, while keeping the success toast on the
/// all-succeed path.
@Suite(.serialized)
@MainActor
struct BudgetDetailsCoordinatorBulkCheckTests {
    @Test
    func confirmCheckAll_partialTransactionFailure_showsErrorToastNotSuccess() async throws {
        let lineService = MockBudgetLineService()
        let txService = MockTransactionService()
        // tx-2 fails server-side; tx-1 succeeds → genuine partial failure.
        txService.failingToggleIds = ["tx-2"]
        let coord = BudgetDetailsCoordinator(
            budgetId: "test-budget",
            budgetLineService: lineService,
            transactionService: txService
        )
        let line = TestDataFactory.createBudgetLine(id: "line-1", kind: .expense, isChecked: false)
        let tx1 = TestDataFactory.createTransaction(id: "tx-1", budgetLineId: "line-1", isChecked: false)
        let tx2 = TestDataFactory.createTransaction(id: "tx-2", budgetLineId: "line-1", isChecked: false)
        await coord.dispatch(.addBudgetLine(line))
        await coord.dispatch(.addTransaction(tx1))
        await coord.dispatch(.addTransaction(tx2))

        let toastManager = ToastManager()
        let ctx = ToastContext(toastManager: toastManager, presentationCurrency: .chf)
        await coord.dispatch(.confirmCheckAll(line: line, checkAll: true, ctx, amountsHidden: false))

        let toast = try #require(toastManager.currentToast)
        #expect(toast.message == "Certaines transactions n'ont pas pu être pointées")
        #expect(toast.type == .error)
        // The success toast must not have overwritten the error.
        #expect(!toast.message.hasPrefix("Pointé"))
    }

    @Test
    func confirmCheckAll_allTransactionsSucceed_showsSuccessToast() async throws {
        let lineService = MockBudgetLineService()
        let txService = MockTransactionService()
        let coord = BudgetDetailsCoordinator(
            budgetId: "test-budget",
            budgetLineService: lineService,
            transactionService: txService
        )
        let line = TestDataFactory.createBudgetLine(id: "line-1", amount: 100, kind: .expense, isChecked: false)
        let tx1 = TestDataFactory.createTransaction(id: "tx-1", budgetLineId: "line-1", isChecked: false)
        await coord.dispatch(.addBudgetLine(line))
        await coord.dispatch(.addTransaction(tx1))

        let toastManager = ToastManager()
        let ctx = ToastContext(toastManager: toastManager, presentationCurrency: .chf)
        await coord.dispatch(.confirmCheckAll(line: line, checkAll: true, ctx, amountsHidden: false))

        let toast = try #require(toastManager.currentToast)
        #expect(toast.message.hasPrefix("Pointé"))
        #expect(toast.type == .success)
    }
}
