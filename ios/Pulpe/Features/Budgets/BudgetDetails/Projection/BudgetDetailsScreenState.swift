import Foundation

/// Pre-shaped, immutable, indexed snapshot of the BudgetDetails screen.
///
/// Built by `BudgetDetailsProjector.project(...)` from the source state held
/// by `BudgetDetailsViewModel`. The view reads ONLY this DTO — no `.filter`,
/// `.sorted`, `.map` or `BudgetFormulas.*` runs in any view body.
///
/// All collection-shaping happens once per source-state change (driven by
/// Swift Observation tracking), not per body re-eval.
///
/// **Sendable note** — most nested types (`BudgetLine`, `Transaction`,
/// `BudgetFormulas.Metrics`, `BudgetFormulas.Consumption`, the filter enums,
/// `TransactionKind`) already conform to `Sendable`. The screen state itself
/// is owned by a `@MainActor`-bound projector, so cross-isolation hops are
/// avoided in practice. We declare `Equatable` (cheap, lets the projector
/// short-circuit re-publish on identical projections) and skip `Sendable`
/// because nothing crosses an isolation boundary.
struct BudgetDetailsScreenState: Equatable {
    /// Budget id this screen state describes. Diverges from a stale projection
    /// during a month switch — views key animations off this so transitions
    /// don't replay between adjacent months.
    let budgetId: String

    /// Localized "Mois Année" header shown in the navigation title. Empty when
    /// the underlying budget hasn't loaded yet.
    let monthYear: String

    let isLoading: Bool

    /// True only when the error path should replace the entire content
    /// (skeleton + content branches removed). Mirrors the VM rule
    /// "error visible AND budget == nil → ErrorView".
    let errorIsTerminal: Bool

    let hero: HeroState
    let rollover: RolloverInfo?

    /// Sections in canonical order (income → saving → expense). Empty kinds
    /// are dropped so the view never renders a header without rows.
    let sections: [Section]

    /// Free (unallocated) transactions matching the current checked + search
    /// filters, in source order.
    let free: [FreeTransactionItem]

    let kindCounts: BudgetLineKindCounts
    let checkedCounts: CheckedFilterCounts
    let pagerMonths: [PagerMonth]

    let typeFilter: BudgetLineKindFilter
    let checkedFilter: CheckedFilterOption
    let isShowingOnlyUnchecked: Bool

    /// Kind of the first non-empty section after all filters. Drives the
    /// "first section gets the gestures tip" rule.
    let firstSectionKind: TransactionKind?

    /// True when the user has the "À pointer" filter active, search is empty,
    /// nothing is left to point AND there were items to begin with — i.e. the
    /// "Tout est pointé" empty state should render.
    let canShowEmptyChecked: Bool

    /// O(1) lookup so `BudgetLineDetailPage` (or any other consumer) can grab
    /// a precomputed consumption for any line in the current source state,
    /// even ones currently filtered out.
    let consumptionByLineId: [String: BudgetFormulas.Consumption]

    /// Transactions grouped by parent budget line, pre-sorted newest-first.
    /// Drives `BudgetLineDetailPage` without calling `.filter`/`.sorted` in
    /// the view body.
    let transactionsByLineId: [String: [Transaction]]

    /// Cheap value that changes if-and-only-if any item's `isChecked` flag
    /// flips. Used as the `value:` of the list-level `.animation(_:value:)`
    /// modifier so the animation does not allocate per body re-eval.
    let checkedTickHash: Int

    // MARK: - Empty (used as the projector seed before the first project pass)

    static let empty = BudgetDetailsScreenState(
        budgetId: "",
        monthYear: "",
        isLoading: false,
        errorIsTerminal: false,
        hero: HeroState.empty,
        rollover: nil,
        sections: [],
        free: [],
        kindCounts: .zero,
        checkedCounts: .zero,
        pagerMonths: [],
        typeFilter: .all,
        checkedFilter: .unchecked,
        isShowingOnlyUnchecked: true,
        firstSectionKind: nil,
        canShowEmptyChecked: false,
        consumptionByLineId: [:],
        transactionsByLineId: [:],
        checkedTickHash: 0
    )

    // MARK: - Nested

    /// Hero block payload. Carries `month` / `year` (not `timeElapsedPercentage`)
    /// so the projector stays independent of `UserSettingsStore.payDayOfMonth`
    /// — the view computes the elapsed percentage itself from the env-injected
    /// pay day, which keeps the projection layer pure of user-settings reads.
    struct HeroState: Equatable {
        let metrics: BudgetFormulas.Metrics
        /// Calendar month the budget covers, when known.
        let month: Int?
        /// Calendar year the budget covers, when known.
        let year: Int?

        static let empty = HeroState(
            metrics: BudgetFormulas.Metrics(
                totalIncome: 0,
                totalExpenses: 0,
                totalSavings: 0,
                available: 0,
                endingBalance: 0,
                remaining: 0,
                rollover: 0
            ),
            month: nil,
            year: nil
        )
    }

    struct RolloverInfo: Equatable {
        let amount: Decimal
        let previousBudgetId: String?
        let previousBudgetMonth: String?
    }

    struct Section: Identifiable, Equatable {
        let kind: TransactionKind
        let items: [LineItem]
        var id: TransactionKind { kind }
    }

    struct LineItem: Identifiable, Equatable {
        let line: BudgetLine
        let consumption: BudgetFormulas.Consumption
        let isSyncing: Bool
        var id: String { line.id }
    }

    struct FreeTransactionItem: Identifiable, Equatable {
        let transaction: Transaction
        let isSyncing: Bool
        var id: String { transaction.id }
    }

    struct PagerMonth: Identifiable, Equatable {
        let id: String
        let month: Int
        let year: Int
    }
}
