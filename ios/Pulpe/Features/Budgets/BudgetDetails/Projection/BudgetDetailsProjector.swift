import Foundation
import SwiftUI

/// Projects the four BudgetDetails stores into a pre-shaped
/// `BudgetDetailsScreenState` for the view layer to consume.
///
/// All `.filter` / `.sorted` / `.map` operations and every `BudgetFormulas.*`
/// call for this feature live in this file or in the State layer. Views read
/// `screenState.X` directly — no derivation runs in any view body.
///
/// Re-projection is driven by Swift Observation's `withObservationTracking`:
/// the projector touches every store property that influences screen state,
/// then re-arms tracking after each pass. A mutation on any tracked property
/// fires `onChange`, which schedules another `applyProjection()` call — once
/// per source change, not once per body re-eval.
@Observable @MainActor
final class BudgetDetailsProjector {
    private(set) var screenState: BudgetDetailsScreenState

    /// Strong references — projectors live as `@State` inside the parent view
    /// so they share its lifetime. `@ObservationIgnored` because reads happen
    /// explicitly inside `withObservationTracking { ... }`; we do NOT want
    /// the projector observing its own `dataStore` property.
    @ObservationIgnored private let dataStore: BudgetDataStore
    @ObservationIgnored private let filtersStore: FiltersStore
    @ObservationIgnored private let syncStore: SyncStateStore

    /// Search text owned by the view; pushed into the projector via
    /// `setSearchText(_:)` so a re-projection runs synchronously on each
    /// keystroke. Search-filtering otherwise bypasses Observation tracking.
    @ObservationIgnored private var searchText: String = ""

    init(
        dataStore: BudgetDataStore,
        filtersStore: FiltersStore,
        syncStore: SyncStateStore
    ) {
        self.dataStore = dataStore
        self.filtersStore = filtersStore
        self.syncStore = syncStore
        // Seed with empty so the property is non-optional; the first arm cycle
        // immediately overwrites it with the real projection.
        self.screenState = .empty
        applyProjection()
    }

    /// Pushes new search text from the view and re-projects synchronously.
    /// Cheap on cached source state — the heavy index work lives in
    /// `project(...)` which is O(n+m) over `budgetLines × transactions`.
    func setSearchText(_ text: String) {
        guard text != searchText else { return }
        searchText = text
        applyProjection()
    }

    // MARK: - Observation arming + apply

    private func applyProjection() {
        let next = withObservationTracking { [dataStore, filtersStore, syncStore, searchText] in
            BudgetDetailsProjector.project(
                dataStore: dataStore,
                filtersStore: filtersStore,
                syncStore: syncStore,
                searchText: searchText
            )
        } onChange: { [weak self] in
            // Observation fires onChange off the calling actor; hop back to
            // MainActor before mutating @Observable state.
            Task { @MainActor [weak self] in
                self?.applyProjection()
            }
        }

        if next != screenState {
            screenState = next
        }
    }

    // MARK: - Pure projection

    /// Pure derivation. All filtering, sorting, mapping and BudgetFormulas
    /// invocations for this feature live here or in the store layer.
    static func project(
        dataStore: BudgetDataStore,
        filtersStore: FiltersStore,
        syncStore: SyncStateStore,
        searchText: String
    ) -> BudgetDetailsScreenState {
        let consumptionByLineId = makeConsumptionIndex(
            budgetLines: dataStore.budgetLines,
            transactions: dataStore.transactions
        )
        let transactionsByLineId = makeTransactionsByLineIdIndex(
            transactions: dataStore.transactions
        )
        let sections = makeSections(
            dataStore: dataStore,
            filtersStore: filtersStore,
            syncStore: syncStore,
            searchText: searchText,
            consumptionByLineId: consumptionByLineId
        )
        let free = makeFreeItems(
            dataStore: dataStore,
            filtersStore: filtersStore,
            syncStore: syncStore,
            searchText: searchText
        )
        return assembleScreenState(
            AssemblyContext(
                dataStore: dataStore,
                filtersStore: filtersStore,
                syncStore: syncStore,
                searchText: searchText,
                sections: sections,
                free: free,
                consumptionByLineId: consumptionByLineId,
                transactionsByLineId: transactionsByLineId
            )
        )
    }

    /// Bundle of inputs to `assembleScreenState`. Avoids a long parameter
    /// list (SwiftLint's `function_parameter_count` budget is 5).
    private struct AssemblyContext {
        let dataStore: BudgetDataStore
        let filtersStore: FiltersStore
        let syncStore: SyncStateStore
        let searchText: String
        let sections: [BudgetDetailsScreenState.Section]
        let free: [BudgetDetailsScreenState.FreeTransactionItem]
        let consumptionByLineId: [String: BudgetFormulas.Consumption]
        let transactionsByLineId: [String: [Transaction]]
    }

    private static func assembleScreenState(
        _ ctx: AssemblyContext
    ) -> BudgetDetailsScreenState {
        BudgetDetailsScreenState(
            budgetId: ctx.dataStore.budgetId,
            monthYear: ctx.dataStore.budget?.monthYear ?? "",
            isLoading: ctx.syncStore.isLoading,
            errorIsTerminal: ctx.syncStore.error != nil && ctx.dataStore.budget == nil,
            hero: BudgetDetailsScreenState.HeroState(
                metrics: ctx.dataStore.metrics,
                month: ctx.dataStore.budget?.month,
                year: ctx.dataStore.budget?.year
            ),
            rollover: makeRollover(dataStore: ctx.dataStore),
            sections: ctx.sections,
            free: ctx.free,
            kindCounts: ctx.filtersStore.kindCounts(for: ctx.dataStore.budgetLines),
            checkedCounts: ctx.filtersStore.checkedCounts(for: ctx.dataStore.budgetLines),
            pagerMonths: makePagerMonths(from: ctx.dataStore.pagerMonths),
            typeFilter: ctx.filtersStore.typeFilter,
            checkedFilter: ctx.filtersStore.checkedFilter,
            isShowingOnlyUnchecked: ctx.filtersStore.isShowingOnlyUnchecked,
            firstSectionKind: ctx.sections.first?.kind,
            canShowEmptyChecked: makeCanShowEmptyChecked(
                dataStore: ctx.dataStore,
                filtersStore: ctx.filtersStore,
                searchText: ctx.searchText,
                sections: ctx.sections,
                free: ctx.free
            ),
            consumptionByLineId: ctx.consumptionByLineId,
            transactionsByLineId: ctx.transactionsByLineId,
            checkedTickHash: makeCheckedTickHash(
                budgetLines: ctx.dataStore.budgetLines,
                transactions: ctx.dataStore.transactions
            )
        )
    }

    private static func makeSections(
        dataStore: BudgetDataStore,
        filtersStore: FiltersStore,
        syncStore: SyncStateStore,
        searchText: String,
        consumptionByLineId: [String: BudgetFormulas.Consumption]
    ) -> [BudgetDetailsScreenState.Section] {
        let syncing = syncStore.syncingBudgetLineIds
        var sections: [BudgetDetailsScreenState.Section] = []
        let displayed = filtersStore.displayedSections(for: dataStore.budgetLines)
        sections.reserveCapacity(displayed.count)
        for section in displayed {
            let searchFiltered = filtersStore.filteredLines(
                section.items,
                searchText: searchText,
                transactions: dataStore.transactions
            )
            guard !searchFiltered.isEmpty else { continue }
            let items = searchFiltered.map { line in
                BudgetDetailsScreenState.LineItem(
                    line: line,
                    consumption: consumptionByLineId[line.id] ?? zeroConsumption(for: line),
                    isSyncing: syncing.contains(line.id)
                )
            }
            sections.append(
                BudgetDetailsScreenState.Section(kind: section.kind, items: items)
            )
        }
        return sections
    }

    private static func makeFreeItems(
        dataStore: BudgetDataStore,
        filtersStore: FiltersStore,
        syncStore: SyncStateStore,
        searchText: String
    ) -> [BudgetDetailsScreenState.FreeTransactionItem] {
        let syncing = syncStore.syncingTransactionIds
        return filtersStore.combinedFilteredFreeTransactions(
            dataStore.freeTransactions,
            searchText: searchText
        ).map { tx in
            BudgetDetailsScreenState.FreeTransactionItem(
                transaction: tx,
                isSyncing: syncing.contains(tx.id)
            )
        }
    }

    private static func makeRollover(
        dataStore: BudgetDataStore
    ) -> BudgetDetailsScreenState.RolloverInfo? {
        guard let info = dataStore.rolloverInfo else { return nil }
        return BudgetDetailsScreenState.RolloverInfo(
            amount: info.amount,
            previousBudgetId: info.previousBudgetId,
            previousBudgetMonth: dataStore.previousBudgetMonth
        )
    }

    private static func makeCanShowEmptyChecked(
        dataStore: BudgetDataStore,
        filtersStore: FiltersStore,
        searchText: String,
        sections: [BudgetDetailsScreenState.Section],
        free: [BudgetDetailsScreenState.FreeTransactionItem]
    ) -> Bool {
        searchText.isEmpty
            && filtersStore.isShowingOnlyUnchecked
            && sections.isEmpty
            && free.isEmpty
            && (!dataStore.budgetLines.isEmpty || !dataStore.transactions.isEmpty)
    }

    // MARK: - Index builders (private helpers)

    private static func makeConsumptionIndex(
        budgetLines: [BudgetLine],
        transactions: [Transaction]
    ) -> [String: BudgetFormulas.Consumption] {
        var index: [String: BudgetFormulas.Consumption] = [:]
        index.reserveCapacity(budgetLines.count)
        for line in budgetLines {
            index[line.id] = BudgetFormulas.calculateConsumption(
                for: line,
                transactions: transactions
            )
        }
        return index
    }

    private static func makeTransactionsByLineIdIndex(
        transactions: [Transaction]
    ) -> [String: [Transaction]] {
        let allocated = transactions.filter { $0.budgetLineId != nil }
        let grouped = Dictionary(grouping: allocated) { tx -> String in
            // Forced unwrap is safe because the filter above rejected nils.
            // swiftlint:disable:next force_unwrapping
            tx.budgetLineId!
        }
        return grouped.mapValues { txs in
            txs.sorted { $0.transactionDate > $1.transactionDate }
        }
    }

    private static func makePagerMonths(
        from sparse: [BudgetSparse]
    ) -> [BudgetDetailsScreenState.PagerMonth] {
        sparse.compactMap { item in
            guard let month = item.month, let year = item.year else { return nil }
            return BudgetDetailsScreenState.PagerMonth(
                id: item.id,
                month: month,
                year: year
            )
        }
    }

    /// Cheap, order-independent hash of every `isChecked` flag in source.
    /// Stable as long as the set of `(id, isChecked)` pairs is stable, so it
    /// only changes when a check flips. Used as the `value:` of the list
    /// `.animation(_:value:)` modifier without allocating a new array per
    /// body re-eval.
    private static func makeCheckedTickHash(
        budgetLines: [BudgetLine],
        transactions: [Transaction]
    ) -> Int {
        var hasher = Hasher()
        for line in budgetLines {
            hasher.combine(line.id)
            hasher.combine(line.isChecked)
        }
        for tx in transactions {
            hasher.combine(tx.id)
            hasher.combine(tx.isChecked)
        }
        return hasher.finalize()
    }

    private static func zeroConsumption(
        for line: BudgetLine
    ) -> BudgetFormulas.Consumption {
        BudgetFormulas.Consumption(
            allocated: 0,
            available: line.amount,
            percentage: 0
        )
    }
}
