import Foundation

/// Reactive state for the "Lisser sur plusieurs mois" flow (PUL-17, interpretation B).
///
/// The user picks an amount-per-month and a `De → À` window; every month in the
/// window starts selected and can be individually deselected. The total is simply
/// `amountPerMonth × selectedCount` — no division, no rounding (RG: interpretation B).
/// `buildTranches(amount:)` emits one concrete tranche per selected month.
@Observable @MainActor
final class SpreadCalculator {
    /// Maximum number of tranches accepted by the backend (mirrors `MAX_SPREAD_TRANCHES`).
    static let maxMonths = 36

    private(set) var start: SpreadMonth
    private(set) var end: SpreadMonth

    /// Months the user has explicitly removed from the window. Identified by ordinal.
    private(set) var deselectedOrdinals: Set<Int> = []

    init(anchorMonth: Int, anchorYear: Int) {
        let anchor = SpreadMonth(year: anchorYear, month: anchorMonth)
        self.start = anchor
        // Default window: the anchor month plus the two following months (3 months).
        self.end = SpreadMonth.from(ordinal: anchor.ordinal + 2)
    }

    // MARK: - Derived state

    /// Every month in `[start, end]` (ascending). Empty when the window is inverted.
    var windowMonths: [SpreadMonth] {
        SpreadMonth.range(from: start, to: end)
    }

    /// Window months minus the user's deselections.
    var selectedMonths: [SpreadMonth] {
        windowMonths.filter { !deselectedOrdinals.contains($0.ordinal) }
    }

    var selectedCount: Int { selectedMonths.count }

    var isSelected: (SpreadMonth) -> Bool {
        { [deselectedOrdinals] month in !deselectedOrdinals.contains(month.ordinal) }
    }

    /// `amountPerMonth × selectedCount`.
    func total(amountPerMonth: Decimal) -> Decimal {
        amountPerMonth * Decimal(selectedCount)
    }

    // MARK: - Validation

    /// `nil` when the window is valid; otherwise the inline message to surface.
    var validationMessage: String? {
        if end.ordinal < start.ordinal {
            return "Le mois de fin précède le mois de début"
        }
        if windowMonths.count > Self.maxMonths {
            return "36 mois maximum"
        }
        if selectedCount == 0 {
            return "Sélectionne au moins un mois"
        }
        return nil
    }

    var isValid: Bool { validationMessage == nil }

    // MARK: - Mutations

    func setStart(_ month: SpreadMonth) {
        start = month
        pruneDeselections()
    }

    func setEnd(_ month: SpreadMonth) {
        end = month
        pruneDeselections()
    }

    func toggle(_ month: SpreadMonth) {
        if deselectedOrdinals.contains(month.ordinal) {
            deselectedOrdinals.remove(month.ordinal)
        } else {
            deselectedOrdinals.insert(month.ordinal)
        }
    }

    /// Forget deselections that no longer fall inside the current window.
    private func pruneDeselections() {
        let windowOrdinals = Set(windowMonths.map(\.ordinal))
        deselectedOrdinals.formIntersection(windowOrdinals)
    }

    // MARK: - Output

    /// One tranche per selected month. `originalAmount` is set only for full-FX spreads.
    func buildTranches(amount: Decimal, originalAmount: Decimal? = nil) -> [BudgetLineSpreadTranche] {
        selectedMonths.map { month in
            BudgetLineSpreadTranche(
                year: month.year,
                month: month.month,
                amount: amount,
                originalAmount: originalAmount
            )
        }
    }
}
