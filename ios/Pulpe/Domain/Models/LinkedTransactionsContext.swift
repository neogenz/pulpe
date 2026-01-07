import Foundation

/// Context for displaying linked transactions for a budget line
struct LinkedTransactionsContext: Identifiable {
    let id = UUID()
    let budgetLine: BudgetLine
    let transactions: [Transaction]
}
