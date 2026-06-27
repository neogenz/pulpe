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
        // Line ids carrying at least one allocated transaction — folds the
        // PUL-22 CA7 "no allocated tx" check into per-line eligibility below.
        let allocatedLineIds = Set(dataStore.transactions.compactMap(\.budgetLineId))
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
                    isSyncing: syncing.contains(line.id),
                    isPostponeEligible: line.isPostponeEligible(
                        hasAllocatedTransactions: allocatedLineIds.contains(line.id)
                    )
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
                isSyncing: syncing.contains(tx.id),
                // Free transactions are unallocated by construction; eligibility
                // reduces to "unchecked", mirroring `LineItem.isPostponeEligible`.
                isPostponeEligible: tx.checkedAt == nil
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
