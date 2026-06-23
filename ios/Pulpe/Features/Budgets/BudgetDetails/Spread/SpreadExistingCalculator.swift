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
    var isLocked: (SpreadMonth) -> Bool {
        { [start] month in month.ordinal == start.ordinal }
    }

    // MARK: - Validation

    var validationMessage: String? {
        if end.ordinal < start.ordinal { return "Le mois de fin précède le mois de début" }
        if windowMonths.count > Self.maxMonths { return "36 mois maximum" }
        if selectedCount < Self.minMonths { return "Choisis au moins deux mois" }
        return nil
    }

    var isValid: Bool { validationMessage == nil }

    // MARK: - Mutations

    func setEnd(_ month: SpreadMonth) {
        end = month
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

    /// The chosen periods (ascending, M0 included), for the API call.
    func periods() -> [SpreadFromExistingPeriod] {
        selectedMonths.map { SpreadFromExistingPeriod(year: $0.year, month: $0.month) }
    }
}
