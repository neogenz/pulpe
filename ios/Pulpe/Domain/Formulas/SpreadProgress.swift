import Foundation

/// PUL-17 — per-occurrence display metadata for a spread group, computed
/// CLIENT-SIDE (no stored fields). Mirrors the web `SpreadOccurrenceViewModel` /
/// `buildSpreadOccurrenceViewModels` so iOS and webapp resolve the same
/// past/current/realized state.
///
/// Two distinct axes:
/// - DISPLAY (`isPast` / `isCurrent`): vs the VIEWED budget period — drives
///   dimming and the "Ce mois" / "Ici" marker.
/// - REALIZATION (`isClosed`): vs TODAY's live period — a month genuinely
///   elapsed, independent of which month is being viewed. Drives the tracker
///   cumulé so viewing a FUTURE budget never fabricates progress.
struct SpreadOccurrenceItem: Identifiable, Sendable {
    let occurrence: SpreadOccurrence
    let isPast: Bool
    let isCurrent: Bool
    let isChecked: Bool
    let isClosed: Bool

    var id: String { occurrence.id }
}

/// PUL-17 — derived progress of a smoothed expense. All fields are pure
/// functions of the occurrence list (mirrors the web `SpreadTracker`):
/// `cumulatedAmount` sums REALIZED occurrences only (closed OR pointé) of their
/// realized amount (consommé if sub-transactions, else prévu) — never
/// `index × perMonth`.
struct SpreadTracker: Equatable, Sendable {
    let count: Int
    let currentIndex: Int
    let cumulatedAmount: Decimal
    let totalAmount: Decimal
    let perMonthAmount: Decimal
    let progressPercent: Double
}

/// Pure derivation of the spread occurrence items + progress tracker. Port of
/// the web `spread-occurrence.view-model.ts` builders — kept in `Domain/Formulas`
/// (not the view) so it stays unit-testable and identical across platforms.
enum SpreadProgress {
    /// Builds the per-occurrence items, sorted by period ascending. Display
    /// flags (`isPast` / `isCurrent`) are payDay-aware vs `referencePeriod` (the
    /// VIEWED budget); realization (`isClosed`) is vs `livePeriod` (today).
    static func buildItems(
        occurrences: [SpreadOccurrence],
        referencePeriod: BudgetPeriod,
        livePeriod: BudgetPeriod
    ) -> [SpreadOccurrenceItem] {
        occurrences
            .map { occurrence in
                let comparison = BudgetPeriodCalculator.comparePeriods(occurrence.period, referencePeriod)
                return SpreadOccurrenceItem(
                    occurrence: occurrence,
                    isPast: comparison < 0,
                    isCurrent: comparison == 0,
                    isChecked: occurrence.isChecked,
                    isClosed: BudgetPeriodCalculator.comparePeriods(occurrence.period, livePeriod) < 0
                )
            }
            .sorted {
                BudgetPeriodCalculator.comparePeriods($0.occurrence.period, $1.occurrence.period) < 0
            }
    }

    /// Derives the progress tracker from the items, or `nil` for an empty group.
    /// - `currentIndex`: 1-based rank of the VIEWED month among the occurrences
    ///   (count of past || current). 0 when the viewed month precedes them all.
    /// - `cumulatedAmount`: Σ realized amount over REALIZED items (closed || checked).
    /// - `totalAmount`: Σ of every occurrence amount (= the source total T).
    /// - `perMonthAmount`: the viewed month's amount, else the last tranche.
    /// - `progressPercent`: realized / total, clamped to [0, 100].
    static func buildTracker(from items: [SpreadOccurrenceItem]) -> SpreadTracker? {
        guard !items.isEmpty else { return nil }

        let currentIndex = items.enumerated().reduce(0) { rank, entry in
            (entry.element.isPast || entry.element.isCurrent) ? entry.offset + 1 : rank
        }
        let cumulatedAmount = items
            .filter { $0.isClosed || $0.isChecked }
            .reduce(Decimal.zero) { $0 + $1.occurrence.realizedAmount }
        let totalAmount = items.reduce(Decimal.zero) { $0 + $1.occurrence.amount }
        let perMonthAmount = items.first(where: { $0.isCurrent })?.occurrence.amount
            ?? items.last?.occurrence.amount
            ?? Decimal.zero

        let progressPercent: Double
        if totalAmount > 0 {
            let ratio = NSDecimalNumber(decimal: cumulatedAmount / totalAmount).doubleValue * 100
            progressPercent = min(100, max(0, ratio))
        } else {
            progressPercent = 0
        }

        return SpreadTracker(
            count: items.count,
            currentIndex: currentIndex,
            cumulatedAmount: cumulatedAmount,
            totalAmount: totalAmount,
            perMonthAmount: perMonthAmount,
            progressPercent: progressPercent
        )
    }
}
