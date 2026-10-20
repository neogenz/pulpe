import Foundation

extension AddTransactionSheet {
    /// Whether an income is funded by a savings goal (PUL-329), and what that
    /// implies for the form. A value type so the rule can be tested on its own.
    struct SavingsGoalOrigin: Equatable {
        let kind: TransactionKind
        let isEnabled: Bool
        let goalId: String?
        let isWithdrawalReady: Bool
        /// The typed amount could not be converted into the account currency, so
        /// there is nothing to weigh the goal's balance against (RG-009).
        let hasConversionFailed: Bool
        /// Which savings, once the income comes from savings. « À remettre » leaves
        /// this sheet for the budget page's withdrawal preview (PUL-292).
        var origin: SavingsOrigin = .goal

        /// Only an income can come out of savings.
        var isOffered: Bool { kind == .income }

        /// The goal path: the income is created here, drawn from the chosen goal.
        var isActive: Bool { isOffered && isEnabled && origin == .goal }

        /// The repay path: nothing is created here, the request is handed over.
        var routesToWithdrawal: Bool { isOffered && isEnabled && origin == .repay }

        /// The id sent on creation — never sent for a kind that cannot carry one.
        var sourceSavingsGoalId: String? { isActive ? goalId : nil }

        var blocksSubmission: Bool { isActive && !isWithdrawalReady }

        /// Why this block holds the submission back, when the reason is its own.
        /// A chosen goal that the picker refuses states itself down there; what
        /// the picker cannot see is that it was never handed an amount to judge.
        var blockingReason: String? {
            guard isActive else { return nil }
            if goalId == nil { return AppLocale.string("Choisis l'objectif utilisé") }
            if hasConversionFailed {
                return AppLocale.string("Le taux de change est indisponible, réessaie dans un instant.")
            }
            return nil
        }
    }
}
