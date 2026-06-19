import Foundation

/// One materialized occurrence of a "Lisser" expense (PUL-17, Lot C).
///
/// Returned by `GET /budget-lines/spread/:id`: every budget line that shares the
/// spread group, flattened with its host budget's `month`/`year` so the
/// occurrences sheet can render a month-by-month timeline without resolving each
/// parent budget. Read-only — the sheet never mutates these.
struct SpreadOccurrence: Decodable, Identifiable, Sendable {
    let budgetLineId: String
    let budgetId: String
    let month: Int
    let year: Int
    let name: String
    let amount: Decimal
    let kind: TransactionKind
    let checkedAt: Date?
    let originalAmount: Decimal?

    /// Stable identity for `ForEach` — one line per budget, so the line id is unique.
    var id: String { budgetLineId }

    /// `true` once the user has pointed (checked) this occurrence.
    var isChecked: Bool { checkedAt != nil }

    /// `{year, month}` period this occurrence lives in, for payDay-aware comparison.
    var period: BudgetPeriod { BudgetPeriod(month: month, year: year) }
}
