import Foundation
import SwiftUI

/// Filter state for the BudgetDetails screen — type filter (all/income/saving/expense)
/// and checked filter (all/unchecked/checked). Persists across launches via
/// `UserDefaults`.
///
/// Migration: when the user upgrades from a build that only knew the legacy
/// Bool key, the init falls back to it so the prior preference is preserved.
/// On every set we keep the legacy Bool key in sync so any older code path
/// (widget App Group, etc.) still reads a meaningful value.
@Observable @MainActor
final class FiltersStore {
    private(set) var typeFilter: BudgetLineKindFilter = .all
    private(set) var checkedFilter: CheckedFilterOption

    @ObservationIgnored private let defaults: UserDefaults

    var isShowingOnlyUnchecked: Bool { checkedFilter == .unchecked }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults

        // Prefer the new String key so all three states (.unchecked / .checked /
        // .all) survive a relaunch. Fall back to the legacy Bool key for users
        // upgrading from earlier builds.
        if let raw = defaults.string(forKey: Keys.checkedFilter),
           let restored = CheckedFilterOption(rawValue: raw) {
            self.checkedFilter = restored
        } else {
            let showOnlyUnchecked = defaults.object(forKey: Keys.showOnlyUnchecked) as? Bool ?? true
            self.checkedFilter = showOnlyUnchecked ? .unchecked : .all
        }

        if let raw = defaults.string(forKey: Keys.typeFilter),
           let restored = BudgetLineKindFilter(rawValue: raw) {
            self.typeFilter = restored
        }
    }

    func setCheckedFilter(_ filter: CheckedFilterOption) {
        checkedFilter = filter
        defaults.set(filter.rawValue, forKey: Keys.checkedFilter)
        // Keep the legacy Bool key in sync so any older code path (e.g. widget
        // sharing the App Group) still reads a meaningful value.
        defaults.set(filter == .unchecked, forKey: Keys.showOnlyUnchecked)
    }

    func setTypeFilter(_ filter: BudgetLineKindFilter) {
        typeFilter = filter
        defaults.set(filter.rawValue, forKey: Keys.typeFilter)
    }

    // MARK: - Pure derivations

    /// Filters budget lines based on the checked filter preference.
    static func applyCheckedFilter(
        _ lines: [BudgetLine],
        filter: CheckedFilterOption
    ) -> [BudgetLine] {
        switch filter {
        case .all:
            return lines
        case .unchecked:
            return lines.filter { $0.checkedAt == nil }
        case .checked:
            return lines.filter { $0.checkedAt != nil }
        }
    }

    /// Sections to display after applying BOTH filters (checked + type), in
    /// canonical order. Empty kinds are skipped so the view doesn't render
    /// empty section headers.
    static func displayedSections(
        for budgetLines: [BudgetLine],
        typeFilter: BudgetLineKindFilter,
        checkedFilter: CheckedFilterOption
    ) -> [(kind: TransactionKind, items: [BudgetLine])] {
        let order: [TransactionKind] = [.income, .saving, .expense]
        let allowed: TransactionKind? = switch typeFilter {
        case .all: nil
        case .income: .income
        case .saving: .saving
        case .expense: .expense
        }
        return order.compactMap { kind in
            if let allowed, allowed != kind { return nil }
            let kindLines = budgetLines.byKind(kind)
            let items = applyCheckedFilter(kindLines, filter: checkedFilter)
            guard !items.isEmpty else { return nil }
            return (kind: kind, items: items)
        }
    }

    /// Per-kind counts AFTER applying ONLY the checked filter (not the type
    /// filter). Drives the type-filter pill counts so each pill reflects
    /// "what tapping this would show" against the active checked filter.
    static func kindCounts(
        for budgetLines: [BudgetLine],
        checkedFilter: CheckedFilterOption
    ) -> BudgetLineKindCounts {
        let filtered = applyCheckedFilter(budgetLines, filter: checkedFilter)
        var income = 0
        var expense = 0
        var saving = 0
        for line in filtered {
            switch line.kind {
            case .income: income += 1
            case .expense: expense += 1
            case .saving: saving += 1
            }
        }
        return BudgetLineKindCounts(
            all: filtered.count,
            income: income,
            saving: saving,
            expense: expense
        )
    }

    /// Per-état counts AFTER applying ONLY the type filter (not the checked
    /// filter). Drives the état icon menu so each option reflects "what
    /// tapping this would show" against the active type filter.
    static func checkedCounts(
        for budgetLines: [BudgetLine],
        typeFilter: BudgetLineKindFilter
    ) -> CheckedFilterCounts {
        let typeFiltered: [BudgetLine] = switch typeFilter {
        case .all: budgetLines
        case .income: budgetLines.byKind(.income)
        case .saving: budgetLines.byKind(.saving)
        case .expense: budgetLines.byKind(.expense)
        }
        let unchecked = typeFiltered.filter { $0.checkedAt == nil }.count
        let checked = typeFiltered.filter { $0.checkedAt != nil }.count
        return CheckedFilterCounts(
            unchecked: unchecked,
            checked: checked,
            all: typeFiltered.count
        )
    }

    /// Filters budget lines by name or by linked transaction names (accent and
    /// case insensitive). O(n+m) with Dictionary indexing.
    static func filteredLines(
        _ lines: [BudgetLine],
        searchText: String,
        transactions: [Transaction]
    ) -> [BudgetLine] {
        guard !searchText.isEmpty else { return lines }

        let transactionsByLineId = Dictionary(
            grouping: transactions,
            by: { $0.budgetLineId ?? "" }
        )

        return lines.filter { line in
            line.name.localizedStandardContains(searchText) ||
                "\(line.amount)".contains(searchText) ||
                (transactionsByLineId[line.id]?.contains {
                    $0.name.localizedStandardContains(searchText) ||
                        "\($0.amount)".contains(searchText)
                } ?? false)
        }
    }

    /// Combines checked filter + search filter for free transactions.
    static func combinedFilteredFreeTransactions(
        _ freeTransactions: [Transaction],
        searchText: String,
        checkedFilter: CheckedFilterOption
    ) -> [Transaction] {
        var result = freeTransactions

        switch checkedFilter {
        case .all:
            break
        case .unchecked:
            result = result.filter { $0.checkedAt == nil }
        case .checked:
            result = result.filter { $0.checkedAt != nil }
        }

        guard !searchText.isEmpty else { return result }
        return result.filter {
            $0.name.localizedStandardContains(searchText) ||
                "\($0.amount)".contains(searchText)
        }
    }

    // MARK: - Instance forwarders (use store's current filters)

    func displayedSections(for budgetLines: [BudgetLine]) -> [(kind: TransactionKind, items: [BudgetLine])] {
        Self.displayedSections(
            for: budgetLines,
            typeFilter: typeFilter,
            checkedFilter: checkedFilter
        )
    }

    func kindCounts(for budgetLines: [BudgetLine]) -> BudgetLineKindCounts {
        Self.kindCounts(for: budgetLines, checkedFilter: checkedFilter)
    }

    func checkedCounts(for budgetLines: [BudgetLine]) -> CheckedFilterCounts {
        Self.checkedCounts(for: budgetLines, typeFilter: typeFilter)
    }

    func filteredLines(_ lines: [BudgetLine], searchText: String, transactions: [Transaction]) -> [BudgetLine] {
        Self.filteredLines(lines, searchText: searchText, transactions: transactions)
    }

    func combinedFilteredFreeTransactions(
        _ freeTransactions: [Transaction],
        searchText: String
    ) -> [Transaction] {
        Self.combinedFilteredFreeTransactions(
            freeTransactions,
            searchText: searchText,
            checkedFilter: checkedFilter
        )
    }

    // MARK: - UserDefaults keys

    private enum Keys {
        /// Legacy Bool key — kept for migration only. Stored true → `.unchecked`,
        /// false → `.all`. New persistence uses `checkedFilter` rawValue to
        /// support the third state `.checked`.
        static let showOnlyUnchecked = "pulpe-budget-show-only-unchecked"
        static let checkedFilter = "pulpe-budget-checked-filter"
        static let typeFilter = "pulpe-budget-line-type-filter"
    }
}
