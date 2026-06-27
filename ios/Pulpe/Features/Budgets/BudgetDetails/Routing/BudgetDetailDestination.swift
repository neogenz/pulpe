import Foundation

/// Identifiable wrapper around a previous-budget id, used as the payload of
/// `BudgetDetailDestination.previousBudget`.
struct PreviousBudgetItem: Identifiable {
    let id: String
}

/// Source of a total-preserving "lisser un existant" (PUL-17 v1.1): an existing
/// prévision (`budgetLine`) or a free `transaction`, with its locked total and
/// anchor month (M0). `kind` (expense/saving) drives the sheet's accent color.
struct SpreadExistingSource: Identifiable, Hashable, Sendable {
    enum SourceType: Hashable, Sendable { case budgetLine, transaction }

    let id: String
    let sourceType: SourceType
    let kind: TransactionKind
    let name: String
    let total: Decimal
    let month: Int
    let year: Int
}

/// Sheet destinations for `BudgetDetailsView`.
///
/// Single source of truth for sheet presentation. Apple's guidance is to
/// drive sheet presentation from a single `.sheet(item:)` modifier rather
/// than stacking multiple `.sheet(...)` siblings — chained presentations
/// only animate cleanly when the system owns the transition.
enum BudgetDetailDestination: Identifiable {
    case addBudgetLine
    case editBudgetLine(BudgetLine)
    case previousBudget(PreviousBudgetItem)
    case realizedBalance
    /// Read-only timeline of every month a "Lisser" expense touches (PUL-17 Lot C).
    case spreadOccurrences(spreadGroupId: String)
    /// Total-preserving "lisser un existant" config sheet (PUL-17 v1.1).
    case spreadExisting(SpreadExistingSource)

    var id: String {
        switch self {
        case .addBudgetLine: "addBudgetLine"
        case .editBudgetLine(let line): "editBudgetLine-\(line.id)"
        case .previousBudget(let item): "previousBudget-\(item.id)"
        case .realizedBalance: "realizedBalance"
        case .spreadOccurrences(let groupId): "spreadOccurrences-\(groupId)"
        case .spreadExisting(let source): "spreadExisting-\(source.id)"
        }
    }
}
