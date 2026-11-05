import Foundation

/// The month as the disponible reads it. A movement whose prévision is not in the month
/// (pending deletion in the undo window) counts as Hors prévision, as the server's
/// `ON DELETE SET NULL` makes it once the deletion commits. The stored rows keep their link,
/// so an undo or a failed commit puts the prévision back and its movements regroup under it.
extension BudgetDataStore {
    var ledgerTransactions: [Transaction] {
        Self.transactions(transactions, asLedgerOf: budgetLines)
    }

    /// What taking one prévision out of the month does to the disponible. Its movements stay,
    /// Hors prévision: the same reading the screen shows once a deletion is pending.
    func impactOfRemoving(lineId: String) -> MovementImpact {
        let rollover = budget?.rollover.orZero ?? 0
        let remaining = budgetLines.filter { $0.id != lineId }
        return .between(
            MonthLedger(lines: budgetLines, transactions: ledgerTransactions, rollover: rollover),
            MonthLedger(
                lines: remaining,
                transactions: Self.transactions(transactions, asLedgerOf: remaining),
                rollover: rollover
            )
        )
    }

    private static func transactions(_ rows: [Transaction], asLedgerOf lines: [BudgetLine]) -> [Transaction] {
        let lineIds = Set(lines.map(\.id))
        return rows.map { tx in
            guard let lineId = tx.budgetLineId, !lineIds.contains(lineId) else { return tx }
            var orphan = tx
            orphan.budgetLineId = nil
            return orphan
        }
    }
}
