import Foundation

/// Reactive state for "lisser une dépense existante" (PUL-17 v1.1 — total
/// preserving). Distinct from the additive `SpreadCalculator` (amount × N): here
/// the source total `T` is LOCKED and redistributed into `T/N` via
/// `SpreadSplit.splitTotalPreserving`.
///
/// The source month M0 (`start`) is fixed — only `end` moves (forward only).
/// Every month in `[M0, end]` starts selected; any month EXCEPT M0 can be
/// deselected (M0 always carries a tranche). N ≥ 2 — lisser sur un seul mois est
/// un no-op.
@Observable @MainActor
final class SpreadExistingCalculator {
    /// Backend cap (mirrors `MAX_SPREAD_TRANCHES`).
    static let maxMonths = SpreadCalculator.maxMonths
    static let minMonths = 2

    let start: SpreadMonth
    private(set) var end: SpreadMonth
    private(set) var deselectedOrdinals: Set<Int> = []

    init(anchorMonth: Int, anchorYear: Int) {
        let anchor = SpreadMonth(year: anchorYear, month: anchorMonth)
        self.start = anchor
        // Default window: M0 + 2 (3 months) — same default as the additive flow.
        self.end = SpreadMonth.from(ordinal: anchor.ordinal + 2)
    }

    // MARK: - Derived state

    var windowMonths: [SpreadMonth] { SpreadMonth.range(from: start, to: end) }

    var selectedMonths: [SpreadMonth] {
        windowMonths.filter { !deselectedOrdinals.contains($0.ordinal) }
    }

    var selectedCount: Int { selectedMonths.count }

    func isSelected(_ month: SpreadMonth) -> Bool {
        !deselectedOrdinals.contains(month.ordinal)
    }

    /// M0 is never deselectable; other months toggle in/out of the window.
    func isLocked(_ month: SpreadMonth) -> Bool {
        month.ordinal == start.ordinal
    }

    // MARK: - Validation

    var validationMessage: String? {
        // `<=`: end == start leaves only the locked M0 in the window, so the grid
        // offers nothing to toggle — point at the date, not at "choose two months".
        if end.ordinal <= start.ordinal {
            return AppLocale.string("Le mois de fin doit suivre le mois de début")
        }
        if selectedCount > Self.maxMonths { return AppLocale.string("36 mois maximum") }
        if selectedCount < Self.minMonths { return AppLocale.string("Choisis au moins deux mois") }
        return nil
    }

    var isValid: Bool { validationMessage == nil }

    // MARK: - Mutations

    func setEnd(_ month: SpreadMonth) {
        end = month
        // A temporarily-invalid window must not wipe the user's deselections; only
        // purge ordinals that fell out of a VALID window. Strict `>`: end == start
        // leaves only the locked M0 in the window, so intersecting against {M0}
        // would clear every deselection the user made.
        guard end.ordinal > start.ordinal else { return }
        let windowOrdinals = Set(windowMonths.map(\.ordinal))
        deselectedOrdinals.formIntersection(windowOrdinals)
    }

    func toggle(_ month: SpreadMonth) {
        guard month.ordinal != start.ordinal else { return }
        if deselectedOrdinals.contains(month.ordinal) {
            deselectedOrdinals.remove(month.ordinal)
        } else {
            deselectedOrdinals.insert(month.ordinal)
        }
    }

    // MARK: - Total-preserving split

    /// Per-month tranches for `total`, exact to the cent (remainder on the first
    /// months). Empty until the window is valid (N ≥ 2).
    func split(total: Decimal) -> [Decimal] {
        guard selectedCount >= Self.minMonths else { return [] }
        return SpreadSplit.splitTotalPreserving(total: total, partCount: selectedCount)
    }

    /// Representative "X par mois" — the base (non-remainder) tranche.
    func perMonth(total: Decimal) -> Decimal {
        split(total: total).last ?? 0
    }

    /// Name of the last month carrying a remainder cent, or `nil` for an exact
    /// split. Surfaced as the honesty hint ("quelques centimes en plus").
    func remainderMonthName(total: Decimal) -> String? {
        let parts = split(total: total)
        guard let base = parts.last else { return nil }
        let remainderCount = parts.filter { $0 != base }.count
        guard remainderCount > 0 else { return nil }
        return selectedMonths.prefix(remainderCount).last?.name
    }

    /// What `month`'s tile carries: its tranche when selected, `nil` when skipped.
    func amount(for month: SpreadMonth, total: Decimal) -> Decimal? {
        guard let index = selectedMonths.firstIndex(of: month) else { return nil }
        let parts = split(total: total)
        return parts.indices.contains(index) ? parts[index] : nil
    }

    /// The chosen periods (ascending, M0 included), for the API call.
    func periods() -> [SpreadFromExistingPeriod] {
        selectedMonths.map { SpreadFromExistingPeriod(year: $0.year, month: $0.month) }
    }
}

extension BudgetLine {
    /// A prévision is spreadable only when it's a one-off expense/épargne that isn't already
    /// lissée, isn't a rollover, and isn't half of a withdrawal couple: spreading that deletes
    /// the source server-side and orphans it (CA9).
    var isSpreadable: Bool {
        kind != .income
            && recurrence == .oneOff
            && spreadGroupId == nil
            && savingsWithdrawalGroupId == nil
            && !(isRollover ?? false)
    }
}

extension SpreadExistingSource {
    /// What spreading this source does to M0's disponible: the source leaves the month and
    /// only M0's tranche (`share`) stays, as a prévision. Same formula as the budget.
    func impact(share: Decimal, on ledger: MonthLedger) -> MovementImpact {
        switch sourceType {
        case .budgetLine:
            // The server deletes the source: its Réels survive unlinked (`ON DELETE SET NULL`).
            let planned = ledger.replacing(lineId: id, amount: share)
            let unlinked = planned.transactions.map { tx -> Transaction in
                guard tx.budgetLineId == id else { return tx }
                var free = tx
                free.budgetLineId = nil
                return free
            }
            let after = MonthLedger(lines: planned.lines, transactions: unlinked, rollover: planned.rollover)
            return .between(ledger, after)
        case .transaction:
            let withoutSource = MonthLedger(
                lines: ledger.lines,
                transactions: ledger.transactions.filter { $0.id != id },
                rollover: ledger.rollover
            )
            let planned = MovementImpact.forecast(
                ledger: withoutSource, budgetId: ledger.lines.first?.budgetId ?? "", kind: kind, amount: share
            )
            return MovementImpact(
                before: MovementImpact.between(ledger, ledger).before,
                after: planned.after,
                lineBefore: nil,
                lineAfter: nil
            )
        }
    }

    /// « Plutôt lisser » on a short month: its largest spreadable one-off dépense, if any.
    static func largestSpreadableExpense(in ledger: MonthLedger, month: Int, year: Int) -> SpreadExistingSource? {
        ledger.lines
            .filter { $0.kind == .expense && $0.isSpreadable }
            .max { $0.amount < $1.amount }
            .map {
                SpreadExistingSource(
                    id: $0.id, sourceType: .budgetLine, kind: $0.kind, name: $0.name,
                    total: $0.amount, month: month, year: year
                )
            }
    }
}
