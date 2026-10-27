import Foundation

// MARK: - Section + free-transaction builders

/// Pure section/free-item builders for `BudgetDetailsProjector.project(...)`.
/// Split out of the projector to keep every BudgetDetails file ≤350 LOC
/// (feature architecture rule #8). All filtering/mapping stays in the
/// projection layer — never in a view body.
extension BudgetDetailsProjector {
    static func makeSections(
        dataStore: BudgetDataStore,
        filtersStore: FiltersStore,
        syncStore: SyncStateStore,
        searchText: String,
        consumptionByLineId: [String: BudgetFormulas.Consumption]
    ) -> [BudgetDetailsScreenState.Section] {
        let syncing = syncStore.syncingBudgetLineIds
        var sections: [BudgetDetailsScreenState.Section] = []
        let displayed = filtersStore.displayedSections(
            for: dataStore.budgetLines,
            consumptionByLineId: consumptionByLineId
        )
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

    static func makeFreeItems(
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

    static func makePointedAllocatedItems(
        dataStore: BudgetDataStore,
        filtersStore: FiltersStore,
        syncStore: SyncStateStore,
        searchText: String,
        index: (lineById: [String: BudgetLine], consumptionByLineId: [String: BudgetFormulas.Consumption])
    ) -> [BudgetDetailsScreenState.FreeTransactionItem] {
        // Skips building the open-envelope index on every other filter's projection.
        guard filtersStore.checkedFilter == .checked else { return [] }
        let syncing = syncStore.syncingTransactionIds
        let openLineById = index.lineById.filter { _, line in
            !FiltersStore.isEffectivelyChecked(line, consumptionByLineId: index.consumptionByLineId)
        }
        return FiltersStore.pointedAllocatedTransactions(
            dataStore.transactions,
            openLineById: openLineById,
            typeFilter: filtersStore.typeFilter,
            checkedFilter: filtersStore.checkedFilter,
            searchText: searchText
        ).map { tx in
            BudgetDetailsScreenState.FreeTransactionItem(
                transaction: tx,
                isSyncing: syncing.contains(tx.id),
                envelopeName: tx.budgetLineId.flatMap { index.lineById[$0]?.name }
            )
        }
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
