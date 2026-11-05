import Foundation

/// What a movement does to the disponible, judged by the same formula the budget uses:
/// `calculateAllMetrics` before and after the draft joins the ledger. No new rule.
struct MovementImpact: Equatable {
    enum Tone: Equatable { case neutral, over, ok }

    /// The movement being typed. `lineId == nil` is a movement no prévision covers.
    struct Draft: Equatable {
        let kind: TransactionKind
        let amount: Decimal
        let lineId: String?
    }

    let before: Decimal
    let after: Decimal
    /// What is left on the chosen prévision, before and after. `nil` without a prévision.
    let lineBefore: Decimal?
    let lineAfter: Decimal?

    var delta: Decimal { (after - before).rounded(2) }

    var tone: Tone {
        if delta == 0 { return .neutral }
        return delta < 0 ? .over : .ok
    }

    /// `replacing` is the id of the movement being edited: it leaves the "after" ledger
    /// for the draft to take its place.
    static func compute(
        lines: [BudgetLine],
        transactions: [Transaction],
        rollover: Decimal,
        replacing editedId: String? = nil,
        draft: Draft
    ) -> MovementImpact {
        let before = BudgetFormulas.calculateAllMetrics(
            budgetLines: lines, transactions: transactions, rollover: rollover
        ).remaining
        let kept = transactions.filter { $0.id != editedId }
        let drafted = kept + [draftTransaction(draft, budgetId: lines.first?.budgetId ?? "")]
        let after = BudgetFormulas.calculateAllMetrics(
            budgetLines: lines, transactions: drafted, rollover: rollover
        ).remaining

        let line = lines.first { $0.id == draft.lineId }
        return MovementImpact(
            before: before,
            after: after,
            lineBefore: line.map { BudgetFormulas.calculateConsumption(for: $0, transactions: transactions).available },
            lineAfter: line.map { BudgetFormulas.calculateConsumption(for: $0, transactions: drafted).available }
        )
    }

    private static func draftTransaction(_ draft: Draft, budgetId: String) -> Transaction {
        Transaction(
            id: "draft",
            budgetId: budgetId,
            budgetLineId: draft.lineId,
            name: "",
            amount: draft.amount,
            kind: draft.kind,
            transactionDate: Date(),
            category: nil,
            checkedAt: nil,
            createdAt: Date(),
            updatedAt: Date()
        )
    }
}

/// The month a prévision or a movement is judged against.
struct MonthLedger {
    let lines: [BudgetLine]
    let transactions: [Transaction]
    let rollover: Decimal
}

extension MovementImpact {
    /// What a new prévision does to the disponible: the same formula, with the line appended.
    static func forecast(
        ledger: MonthLedger, budgetId: String, kind: TransactionKind, amount: Decimal
    ) -> MovementImpact {
        let before = BudgetFormulas.calculateAllMetrics(
            budgetLines: ledger.lines, transactions: ledger.transactions, rollover: ledger.rollover
        ).remaining
        let draft = BudgetLine(
            id: "draft",
            budgetId: budgetId,
            templateLineId: nil,
            savingsGoalId: nil,
            name: "",
            amount: amount,
            kind: kind,
            recurrence: .oneOff,
            isManuallyAdjusted: false,
            checkedAt: nil,
            createdAt: Date(),
            updatedAt: Date()
        )
        let after = BudgetFormulas.calculateAllMetrics(
            budgetLines: ledger.lines + [draft], transactions: ledger.transactions, rollover: ledger.rollover
        ).remaining
        return MovementImpact(before: before, after: after, lineBefore: nil, lineAfter: nil)
    }
}
