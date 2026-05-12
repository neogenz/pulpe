import Foundation
import SwiftUI

/// Side-effects required by some coordinator actions — passed alongside the
/// action so the coordinator stays free of view-layer environment reads.
struct ToastContext {
    let toastManager: ToastManager
    let presentationCurrency: SupportedCurrency
}

/// Single dispatch surface for every BudgetDetails mutation. Views call
/// `coordinator.dispatch(.toggleLine(line))` instead of mutating stores
/// directly; the coordinator is the sole writer of every store.
enum BudgetDetailsAction {
    // Loading + navigation
    case loadDetails(force: Bool)
    case reloadCurrentBudget
    case prepareNavigation(to: String)

    // Filters
    case setCheckedFilter(CheckedFilterOption)
    case setTypeFilter(BudgetLineKindFilter)

    // Toggles — carry `ToastContext` + `amountsHidden` so the coordinator
    // emits the "Pointé" toast internally on success. Views never inspect
    // the toggle's Bool return value.
    case toggleLine(BudgetLine, ToastContext, amountsHidden: Bool)
    case confirmCheckAll(line: BudgetLine, checkAll: Bool, ToastContext, amountsHidden: Bool)
    case toggleTransaction(Transaction)

    // Budget line mutations
    case addBudgetLine(BudgetLine)
    case updateBudgetLine(BudgetLine)
    case softDeleteBudgetLine(BudgetLine, ToastContext)
    case deleteBudgetLine(BudgetLine)

    // Transaction mutations
    case addTransaction(Transaction)
    case updateTransaction(Transaction)
    case softDeleteTransaction(Transaction, ToastContext)
    case deleteTransaction(Transaction)

    // Side-effect: emit "Pointé" toast after a successful toggle
    case showCheckToastIfNeeded(BudgetLine, ToastContext, amountsHidden: Bool)

    // Reset alert state without performing a toggle
    case resetCheckAllState
}
