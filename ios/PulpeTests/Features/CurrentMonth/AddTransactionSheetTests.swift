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
        isWithdrawalReady: Bool = true,
        hasConversionFailed: Bool = false
    ) -> AddTransactionSheet.SavingsGoalOrigin {
        AddTransactionSheet.SavingsGoalOrigin(
            kind: kind,
            isEnabled: isEnabled,
            goalId: goalId,
            isWithdrawalReady: isWithdrawalReady,
            hasConversionFailed: hasConversionFailed
        )
    }

    @Test("the date defaults to today")
    func defaults_dateIsToday() {
        let now = Date(timeIntervalSince1970: 1_755_800_000)
        #expect(AddTransactionSheet.Defaults.transactionDate(now: now) == now)
    }

    @Test("the operation is checked by default")
    func defaults_isChecked() {
        #expect(AddTransactionSheet.Defaults.isChecked)
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

    // A refused conversion leaves nothing to weigh the goal's balance against,
    // so the button greys out. The picker cannot say why — it was never handed
    // an amount — and the sheet used to stay silent too.
    @Test("a refused conversion says why the button is greyed out")
    func origin_namesTheRefusedConversion() {
        let blocked = origin(kind: .income, isWithdrawalReady: false, hasConversionFailed: true)

        #expect(blocked.blocksSubmission)
        #expect(blocked.blockingReason == "Le taux de change est indisponible, réessaie dans un instant.")
    }

    @Test("a goal still to be chosen keeps priority over the conversion")
    func origin_namesTheMissingGoalFirst() {
        let noGoal = origin(
            kind: .income,
            goalId: nil,
            isWithdrawalReady: false,
            hasConversionFailed: true
        )

        #expect(noGoal.blockingReason == "Choisis l'objectif utilisé")
    }

    @Test("a withdrawal the picker accepts states no reason of its own")
    func origin_staysSilentWhenReady() {
        #expect(origin(kind: .income).blockingReason == nil)
        #expect(origin(kind: .expense, hasConversionFailed: true).blockingReason == nil)
    }
}
