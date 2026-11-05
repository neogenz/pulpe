import Foundation

/// « Rattraper » (V2 `Rattraper`): what overruns this month, and which dépense still has margin
/// to take it back. Taking it back lowers that prévision by min(overrun, reste), so the
/// disponible gets back what the overrun took, as far as the margin goes.
struct CatchUpPlan: Equatable {
    struct Overrun: Equatable {
        let name: String
        let amount: Decimal
    }

    struct Choice: Equatable, Identifiable {
        let line: BudgetLine
        let remaining: Decimal
        /// The prévision once it takes back what it can.
        let newAmount: Decimal
        /// `false`: the margin covers only part of the overrun.
        let coversAll: Bool

        var id: String { line.id }
    }

    let overruns: [Overrun]
    /// Most margin first.
    let choices: [Choice]

    var total: Decimal { overruns.reduce(0) { $0 + $1.amount } }

    /// The first prévision that covers the whole overrun, else the one with the most margin.
    var defaultChoiceId: String? {
        (choices.first { $0.coversAll } ?? choices.first)?.id
    }

    /// `focusLineId`: opened from one prévision, only its overrun is taken back.
    /// Lines typed in another currency are left out: re-planning them needs a conversion.
    static func make(ledger: MonthLedger, focusLineId: String?, userCurrency: SupportedCurrency) -> CatchUpPlan {
        let expenses = ledger.lines.filter { line in
            line.kind == .expense && !(line.isRollover ?? false) && line.savingsGoalId == nil
        }
        let reste = Dictionary(uniqueKeysWithValues: expenses.map { line in
            (line.id, BudgetFormulas.calculateConsumption(for: line, transactions: ledger.transactions).available)
        })
        let overruns = expenses
            .filter { (reste[$0.id] ?? 0) < 0 && (focusLineId == nil || $0.id == focusLineId) }
            .map { Overrun(name: $0.name, amount: -(reste[$0.id] ?? 0)) }
        let total = overruns.reduce(Decimal.zero) { $0 + $1.amount }
        guard total > 0 else { return CatchUpPlan(overruns: [], choices: []) }

        let choices = expenses
            .filter { (reste[$0.id] ?? 0) > 0 }
            .filter { !EditBudgetLineSheet.shouldShowAlternateCurrency(for: $0, userCurrency: userCurrency) }
            .map { line in
                let remaining = reste[line.id] ?? 0
                return Choice(
                    line: line,
                    remaining: remaining,
                    newAmount: line.amount - min(total, remaining),
                    coversAll: remaining >= total
                )
            }
            .sorted { $0.remaining > $1.remaining }
        return CatchUpPlan(overruns: overruns, choices: choices)
    }

    /// What taking it back on `choice` does to the disponible.
    static func impact(of choice: Choice, in ledger: MonthLedger) -> MovementImpact {
        .between(ledger, ledger.replacing(lineId: choice.line.id, amount: choice.newAmount))
    }
}
