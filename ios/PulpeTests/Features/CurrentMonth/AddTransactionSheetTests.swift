import Foundation
@testable import Pulpe
import Testing

/// The savings-goal origin rule of the add sheet (PUL-329): who may be offered
/// it, what gets sent, and what blocks the button.
struct AddTransactionSheetTests {
    private func origin(
        kind: TransactionKind,
        isEnabled: Bool = true,
        goalId: String? = "goal-1",
        isWithdrawalReady: Bool = true
    ) -> AddTransactionSheet.SavingsGoalOrigin {
        AddTransactionSheet.SavingsGoalOrigin(
            kind: kind,
            isEnabled: isEnabled,
            goalId: goalId,
            isWithdrawalReady: isWithdrawalReady
        )
    }

    @Test("the origin is offered to an income only", arguments: TransactionKind.allCases)
    func origin_isOfferedToIncomeOnly(kind: TransactionKind) {
        #expect(origin(kind: kind).isOffered == (kind == .income))
    }

    @Test("an income that opted in sends the chosen goal")
    func origin_sendsTheChosenGoal() {
        #expect(origin(kind: .income).sourceSavingsGoalId == "goal-1")
    }

    @Test("a goal left over from another kind is never sent")
    func origin_dropsTheGoalOnAnotherKind() {
        let expense = origin(kind: .expense)

        #expect(expense.sourceSavingsGoalId == nil)
        #expect(!expense.blocksSubmission)
    }

    @Test("opting out sends nothing and blocks nothing")
    func origin_optedOutSendsNothing() {
        let optedOut = origin(kind: .income, isEnabled: false, isWithdrawalReady: false)

        #expect(optedOut.sourceSavingsGoalId == nil)
        #expect(!optedOut.blocksSubmission)
    }

    @Test("an unusable withdrawal blocks the submission")
    func origin_blocksWhenTheWithdrawalIsNotReady() {
        #expect(origin(kind: .income, isWithdrawalReady: false).blocksSubmission)
        #expect(origin(kind: .income, goalId: nil, isWithdrawalReady: false).blocksSubmission)
    }
}
