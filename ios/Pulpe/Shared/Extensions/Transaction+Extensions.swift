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
