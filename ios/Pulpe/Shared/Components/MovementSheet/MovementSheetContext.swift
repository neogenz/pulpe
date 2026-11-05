import Foundation

/// Everything the movement sheet needs to know about the month it writes into. The hosts
/// (accueil, budget page, widget) own the stores; the sheet only reads this snapshot.
struct MovementSheetContext {
    var ledger: MonthLedger { MonthLedger(lines: budgetLines, transactions: transactions, rollover: rollover) }

    let budgetId: String
    let budgetLines: [BudgetLine]
    let transactions: [Transaction]
    let rollover: Decimal
    /// The prévision the movement starts under ("Noter un montant" on a prévision).
    var preselectedLineId: String?
    /// The movement being edited: switches the sheet to its "Modifier" variant.
    var editing: Transaction?
    /// Which control opened the sheet, for `first_transaction_created` (PUL-306).
    var source: FirstTransactionTracker.Source = .addButton
}

/// The two ways a movement leaves the sheet besides saving, both owned by the host: the
/// sheet itself never talks to a feature's coordinator.
struct MovementSheetEditActions {
    /// Sends the PATCH and applies it locally. Throws so the sheet keeps its form on failure.
    let save: (String, TransactionUpdate) async throws -> Void
    let delete: (Transaction) -> Void
    /// `nil` where spreading a free movement has no sheet to open.
    let spread: ((Transaction) -> Void)?
}

extension MovementSheetContext {
    /// The accueil's month as the sheet reads it. Lines and movements stay empty when the store
    /// holds another month (the widget can open before the accueil has loaded).
    @MainActor
    init(
        store: CurrentMonthStore,
        budgetId: String,
        source: FirstTransactionTracker.Source,
        preselectedLineId: String? = nil,
        editing: Transaction? = nil
    ) {
        let isLoaded = store.budget?.id == budgetId
        self.init(
            budgetId: budgetId,
            budgetLines: isLoaded ? store.budgetLines : [],
            transactions: isLoaded ? store.transactions : [],
            rollover: isLoaded ? store.budget?.rollover.orZero ?? 0 : 0,
            preselectedLineId: preselectedLineId,
            editing: editing,
            source: source
        )
    }
}
