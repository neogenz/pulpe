import Foundation
import TipKit

/// PUL-306 — the step the retention funnel loses: the account's first budget, with nothing
/// recorded in it yet. Same rule as the web dashboard's `isAwaitingFirstTransaction`.
enum FirstExpenseActivation {
    /// Which home control opened the add sheet — the value space of `source` on
    /// `first_transaction_created`, shared with the web.
    enum Source: String {
        case activationPrompt = "activation_prompt"
        case addButton = "add_button"
    }

    /// "First" means no budget sits in an earlier period; later months may already be
    /// planned. Until the budget list has loaded the answer is no, so an established
    /// account never sees the invitation flash in and out.
    static func isAwaiting(
        budget: Budget?,
        hasTransactions: Bool,
        budgets: [BudgetSparse],
        hasLoadedBudgets: Bool
    ) -> Bool {
        guard let budget, !hasTransactions, hasLoadedBudgets else { return false }
        let period = budget.year * 12 + budget.month
        let hasEarlierBudget = budgets.contains { sparse in
            guard let year = sparse.year, let month = sparse.month else { return false }
            return year * 12 + month < period
        }
        return !hasEarlierBudget
    }
}

@MainActor
extension FirstExpenseActivation {
    /// The rule as the home reads it, plus the flag that keeps it retired once an entry
    /// went through — even one deleted afterwards, which empties the first budget again.
    static func applies(
        home: CurrentMonthStore,
        budgets: BudgetListStore,
        flags: PostOnboardingFlagsStore = PostOnboardingFlagsStore()
    ) -> Bool {
        !flags.hasRecordedFirstTransaction && isAwaiting(
            budget: home.budget,
            hasTransactions: !home.transactions.isEmpty,
            budgets: budgets.budgets,
            hasLoadedBudgets: budgets.hasLoadedOnce
        )
    }

    /// Hands an entry recorded from the home to its store, marking it first when it ends
    /// the activation. Read before the store takes it: once it lands the month is no
    /// longer empty.
    static func add(
        _ transaction: Transaction,
        from source: Source,
        to home: CurrentMonthStore,
        budgets: BudgetListStore,
        flags: PostOnboardingFlagsStore = PostOnboardingFlagsStore()
    ) {
        if applies(home: home, budgets: budgets, flags: flags) {
            AnalyticsService.shared.capture(
                .firstTransactionCreated,
                properties: ["type": transaction.kind.rawValue, "source": source.rawValue]
            )
        }
        if !flags.hasRecordedFirstTransaction {
            flags.setHasRecordedFirstTransaction()
            ProductTips.firstExpense.invalidate(reason: .actionPerformed)
        }
        home.addTransaction(transaction)
    }
}
