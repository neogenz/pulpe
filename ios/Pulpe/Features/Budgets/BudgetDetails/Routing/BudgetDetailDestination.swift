import Foundation

/// Identifiable wrapper around a previous-budget id, used as the payload of
/// `BudgetDetailDestination.previousBudget`.
struct PreviousBudgetItem: Identifiable {
    let id: String
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

    var id: String {
        switch self {
        case .addBudgetLine: "addBudgetLine"
        case .editBudgetLine(let line): "editBudgetLine-\(line.id)"
        case .previousBudget(let item): "previousBudget-\(item.id)"
        case .realizedBalance: "realizedBalance"
        }
    }
}
