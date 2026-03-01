import Foundation

extension Transaction {
    /// Signed amount for display: positive for income, negative for expenses/savings
    var signedAmount: Decimal {
        switch kind {
        case .income: amount
        case .expense, .saving: -amount
        }
    }
}

extension Array where Element == Transaction {
    /// Transactions not allocated to any budget line, sorted by date (newest first)
    var unallocated: [Transaction] {
        filter { $0.budgetLineId == nil }.sorted { $0.transactionDate > $1.transactionDate }
    }
}
