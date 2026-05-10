import Foundation
import SwiftUI

/// Projects `BudgetDetailsViewModel` source state into a pre-shaped
/// `BudgetDetailsScreenState` for the view layer to consume.
///
/// All `.filter` / `.sorted` / `.map` operations and every `BudgetFormulas.*`
/// call for this feature live in this file. Views read `screenState.X`
/// directly — no derivation runs in any view body.
///
/// Re-projection is driven by Swift Observation's `withObservationTracking`:
/// the projector touches every VM property that influences screen state, then
/// re-arms tracking after each pass. A mutation on any tracked property fires
/// `onChange`, which schedules another `applyProjection()` call — once per
/// source change, not once per body re-eval.
@Observable @MainActor
final class BudgetDetailsProjector {
    private(set) var screenState: BudgetDetailsScreenState

    /// Strong reference is fine here: the projector lives as `@State` inside
    /// `BudgetDetailsView`, so it shares the view's lifetime. Marked
    /// `@ObservationIgnored` because reads of the VM happen explicitly
    /// inside `withObservationTracking { ... }` — we do NOT want auto-track
    /// on the projector itself observing its own `vm` property.
    @ObservationIgnored private let viewModel: BudgetDetailsViewModel

    /// Search text owned by the view; pushed into the projector via
    /// `setSearchText(_:)` so a re-projection runs synchronously on each
    /// keystroke. Search-filtering otherwise bypasses Observation tracking.
    @ObservationIgnored private var searchText: String = ""

    init(viewModel: BudgetDetailsViewModel) {
        self.viewModel = viewModel
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
        // Re-arm Observation tracking and re-derive on any source change.
        // Touching every VM property that contributes to the projection
        // here means a mutation on any of them fires onChange exactly once,
        // and the next applyProjection() call re-arms for the next change.
        let next = withObservationTracking { [viewModel, searchText] in
            BudgetDetailsProjector.project(from: viewModel, searchText: searchText)
        } onChange: { [weak self] in
            // Observation fires onChange off the calling actor; hop back to
            // MainActor before mutating @Observable state. `Task { @MainActor }`
            // is the standard idiom — we don't need to await anything else.
            Task { @MainActor [weak self] in
                self?.applyProjection()
            }
        }

        // Equatable short-circuit: if the projection is identical to what we
        // already published, skip the publish. This collapses the rare case
        // where Observation fires onChange for an irrelevant write.
        if next != screenState {
            screenState = next
        }
    }

    // MARK: - Pure projection

    /// Pure derivation. All filtering, sorting, mapping and BudgetFormulas
    /// invocations for this feature live here.
    static func project(
        from vm: BudgetDetailsViewModel,
        searchText: String
    ) -> BudgetDetailsScreenState {
        let consumptionByLineId = makeConsumptionIndex(
            budgetLines: vm.budgetLines,
            transactions: vm.transactions
        )
        let transactionsByLineId = makeTransactionsByLineIdIndex(
            transactions: vm.transactions
        )
        let sections = makeSections(
            vm: vm,
            searchText: searchText,
            consumptionByLineId: consumptionByLineId
        )
        let free = makeFreeItems(vm: vm, searchText: searchText)

        return BudgetDetailsScreenState(
            budgetId: vm.budgetId,
            monthYear: vm.budget?.monthYear ?? "",
            isLoading: vm.isLoading,
            errorIsTerminal: vm.error != nil && vm.budget == nil,
            hero: BudgetDetailsScreenState.HeroState(
                metrics: vm.metrics,
                month: vm.budget?.month,
                year: vm.budget?.year
            ),
            rollover: makeRollover(vm: vm),
            sections: sections,
            free: free,
            kindCounts: vm.kindCounts,
            checkedCounts: vm.checkedCounts,
            pagerMonths: makePagerMonths(from: vm.pagerMonths),
            typeFilter: vm.typeFilter,
            checkedFilter: vm.checkedFilter,
            isShowingOnlyUnchecked: vm.isShowingOnlyUnchecked,
            firstSectionKind: sections.first?.kind,
            canShowEmptyChecked: makeCanShowEmptyChecked(
                vm: vm,
                searchText: searchText,
                sections: sections,
                free: free
            ),
            consumptionByLineId: consumptionByLineId,
            transactionsByLineId: transactionsByLineId,
            checkedTickHash: makeCheckedTickHash(
                budgetLines: vm.budgetLines,
                transactions: vm.transactions
            )
        )
    }

    private static func makeSections(
        vm: BudgetDetailsViewModel,
        searchText: String,
        consumptionByLineId: [String: BudgetFormulas.Consumption]
    ) -> [BudgetDetailsScreenState.Section] {
        let syncing = vm.syncingBudgetLineIds
        var sections: [BudgetDetailsScreenState.Section] = []
        sections.reserveCapacity(vm.displayedSections.count)
        for section in vm.displayedSections {
            let searchFiltered = vm.filteredLines(section.items, searchText: searchText)
            guard !searchFiltered.isEmpty else { continue }
            let items = searchFiltered.map { line in
                BudgetDetailsScreenState.LineItem(
                    line: line,
                    consumption: consumptionByLineId[line.id]
                        ?? zeroConsumption(for: line),
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
        vm: BudgetDetailsViewModel,
        searchText: String
    ) -> [BudgetDetailsScreenState.FreeTransactionItem] {
        let syncing = vm.syncingTransactionIds
        return vm.combinedFilteredFreeTransactions(searchText: searchText).map { tx in
            BudgetDetailsScreenState.FreeTransactionItem(
                transaction: tx,
                isSyncing: syncing.contains(tx.id)
            )
        }
    }

    private static func makeRollover(
        vm: BudgetDetailsViewModel
    ) -> BudgetDetailsScreenState.RolloverInfo? {
        guard let info = vm.rolloverInfo else { return nil }
        return BudgetDetailsScreenState.RolloverInfo(
            amount: info.amount,
            previousBudgetId: info.previousBudgetId,
            previousBudgetMonth: vm.previousBudgetMonth
        )
    }

    private static func makeCanShowEmptyChecked(
        vm: BudgetDetailsViewModel,
        searchText: String,
        sections: [BudgetDetailsScreenState.Section],
        free: [BudgetDetailsScreenState.FreeTransactionItem]
    ) -> Bool {
        searchText.isEmpty
            && vm.isShowingOnlyUnchecked
            && sections.isEmpty
            && free.isEmpty
            && (!vm.budgetLines.isEmpty || !vm.transactions.isEmpty)
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
    /// body re-eval (the previous shape did `flatMap { items.map(\.isChecked) }`
    /// which built a new array on every access).
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
