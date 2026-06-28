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
    /// Réalisé (PUL-17 tracker): `consumed` = Σ of this occurrence's
    /// sub-transactions (decrypted server-side); `transactionCount` lets the
    /// client pick consommé vs prévu. Both default to 0 — the wire field is
    /// `.default(0)` (additive contract), so a payload omitting them decodes to 0.
    let consumed: Decimal
    let transactionCount: Int

    /// Stable identity for `ForEach` — one line per budget, so the line id is unique.
    var id: String { budgetLineId }

    /// `true` once the user has pointed (checked) this occurrence.
    var isChecked: Bool { checkedAt != nil }

    /// `{year, month}` period this occurrence lives in, for payDay-aware comparison.
    var period: BudgetPeriod { BudgetPeriod(month: month, year: year) }

    /// The amount that actually counts for this month: the real consommé once
    /// any sub-transaction exists, else the planned prévu tranche. Mirrors the
    /// web `spreadOccurrenceRealizedAmount`.
    var realizedAmount: Decimal { transactionCount > 0 ? consumed : amount }
}

extension SpreadOccurrence {
    private enum CodingKeys: String, CodingKey {
        case budgetLineId, budgetId, month, year, name, amount, kind
        case checkedAt, originalAmount, consumed, transactionCount
    }

    // Custom decoder so `consumed`/`transactionCount` fall back to 0 when a
    // payload omits them (additive `.default(0)` contract). Lives in an
    // extension to preserve the struct's memberwise initializer for tests.
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        budgetLineId = try container.decode(String.self, forKey: .budgetLineId)
        budgetId = try container.decode(String.self, forKey: .budgetId)
        month = try container.decode(Int.self, forKey: .month)
        year = try container.decode(Int.self, forKey: .year)
        name = try container.decode(String.self, forKey: .name)
        amount = try container.decode(Decimal.self, forKey: .amount)
        kind = try container.decode(TransactionKind.self, forKey: .kind)
        checkedAt = try container.decodeIfPresent(Date.self, forKey: .checkedAt)
        originalAmount = try container.decodeIfPresent(Decimal.self, forKey: .originalAmount)
        consumed = try container.decodeIfPresent(Decimal.self, forKey: .consumed) ?? 0
        transactionCount = try container.decodeIfPresent(Int.self, forKey: .transactionCount) ?? 0
    }
}
