import Foundation

/// What re-planning a prévision does to the disponible (V2 `Prevision-modifier`). The budget
/// counts a prévision at max(prévu, dépensé), so only the part above what is already spent
/// moves the disponible: max(new, spent) − max(old, spent), read through the same formula.
struct BudgetLineEditImpact: Equatable {
    let figures: MovementImpact
    /// Already spent on the prévision; zero unless it stays a dépense.
    let spent: Decimal
    /// Whether the spending absorbs part of the change (the note has something to say).
    let isCutBySpending: Bool

    static func compute(
        ledger: MonthLedger,
        line: BudgetLine,
        amount: Decimal,
        kind: TransactionKind
    ) -> BudgetLineEditImpact {
        let spent = line.kind == .expense && kind == .expense
            ? BudgetFormulas.calculateConsumption(for: line, transactions: ledger.transactions).allocated
            : 0
        return BudgetLineEditImpact(
            figures: .between(ledger, ledger.replacing(lineId: line.id, amount: amount, kind: kind)),
            spent: spent,
            isCutBySpending: amount != line.amount && spent > min(line.amount, amount)
        )
    }

    /// « 664.20 sont déjà dépensés : seuls 35.80 de plus sortent. » `nil` when the spending
    /// changes nothing to the move.
    func note(currency: SupportedCurrency) -> String? {
        guard isCutBySpending else { return nil }
        let spentText = spent.asAmount(for: currency)
        let step = abs(figures.delta).asAmount(for: currency)
        return switch figures.tone {
        case .over: AppLocale.string("\(spentText) sont déjà dépensés : seuls \(step) de plus sortent.")
        case .ok: AppLocale.string("\(spentText) sont déjà dépensés : seuls \(step) reviennent.")
        case .neutral: AppLocale.string("\(spentText) sont déjà dépensés : ton disponible ne bouge pas.")
        }
    }
}
