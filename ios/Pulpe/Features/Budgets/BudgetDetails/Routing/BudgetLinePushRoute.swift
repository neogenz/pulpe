import Foundation

/// Push destinations within `BudgetDetailsView`'s NavigationStack branch.
///
/// Routes are id-based so pushed pages re-resolve their model reactively from
/// the shared source state — when the underlying line or transaction is
/// removed (delete commit, sync), the page auto-pops via `AutoPopView` /
/// `dismiss()` from the empty branch.
enum BudgetLinePushRoute: Hashable {
    case lineDetail(lineId: String)
    case addAllocatedTx(lineId: String)
    case editTx(transactionId: String)
}
