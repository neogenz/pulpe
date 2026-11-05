import Foundation

// MARK: - Search and movement filters

/// Split out of `FiltersStore` to keep it under the feature's 350-LOC budget.
extension FiltersStore {
    /// Filters budget lines by name or by linked transaction names (accent and
    /// case insensitive). Amounts match the value **as displayed** to the user
    /// (see `amountMatches`). O(n+m) with Dictionary indexing.
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

        let amountNeedle = amountSearchKey(searchText)

        return lines.filter { line in
            line.name.localizedStandardContains(searchText) ||
                amountMatches(line.amount, needle: amountNeedle) ||
                (transactionsByLineId[line.id]?.contains {
                    $0.name.localizedStandardContains(searchText) ||
                        amountMatches($0.amount, needle: amountNeedle)
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
        case .over:
            // A movement without a prévision has no plan to go over.
            return []
        }

        guard !searchText.isEmpty else { return result }
        let amountNeedle = amountSearchKey(searchText)
        return result.filter {
            $0.name.localizedStandardContains(searchText) ||
                amountMatches($0.amount, needle: amountNeedle)
        }
    }

    /// Pointed allocated transactions the "Pointé" filter would otherwise hide:
    /// only their envelope can appear in a section, and an envelope still to point
    /// is filtered out. `openLineById` holds only those envelopes — a pointed
    /// envelope's row already stands for its transactions. Empty under any other
    /// checked filter.
    static func pointedAllocatedTransactions(
        _ transactions: [Transaction],
        openLineById: [String: BudgetLine],
        typeFilter: BudgetLineKindFilter,
        checkedFilter: CheckedFilterOption,
        searchText: String
    ) -> [Transaction] {
        guard checkedFilter == .checked else { return [] }
        let amountNeedle = amountSearchKey(searchText)
        return transactions.filter { tx in
            guard tx.checkedAt != nil,
                  let line = tx.budgetLineId.flatMap({ openLineById[$0] })
            else { return false }
            let matchesType = switch typeFilter {
            case .all: true
            case .income: line.kind == .income
            case .saving: line.kind == .saving
            case .expense: line.kind == .expense
            }
            guard matchesType else { return false }
            return searchText.isEmpty
                || tx.name.localizedStandardContains(searchText)
                || line.name.localizedStandardContains(searchText)
                || amountMatches(tx.amount, needle: amountNeedle)
        }
        .sorted { $0.transactionDate > $1.transactionDate }
    }

    // MARK: - Amount search matching (PUL-247)

    /// Canonicalises an amount string for search: maps the locale decimal
    /// separator (`,` in fr-FR/EUR) to `.`, then keeps only digits and `.`.
    /// This drops grouping separators (apostrophe, spaces, NBSP) and the currency
    /// symbol, so the user's input and the displayed amount are compared on the
    /// same footing regardless of locale. Returns `""` when no digit is present
    /// (e.g. a lone space) so we never match every row.
    private static func amountSearchKey(_ text: String) -> String {
        let key = text
            .replacingOccurrences(of: ",", with: ".")
            .filter { $0.isNumber || $0 == "." }
        return key.contains(where: \.isNumber) ? key : ""
    }

    /// Matches a needle against the amount **as the user sees it**. Both sides
    /// are reduced to `amountSearchKey` form, which strips grouping and locale
    /// decimal separators — so the displayed value's key is currency-independent
    /// (`1'500.00` CHF and `1 500,00` EUR both reduce to `1500.00`). We therefore
    /// format with an arbitrary fixed currency. Result: `1500`, `1'500`, `1 500`,
    /// `1500.00` and `1 500,00` all match the `1500` amount.
    private static func amountMatches(_ amount: Decimal, needle: String) -> Bool {
        guard !needle.isEmpty else { return false }
        return amountSearchKey(amount.asAmount(for: .chf)).contains(needle)
    }
}
