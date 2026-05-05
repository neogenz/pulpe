import SwiftUI

extension BudgetFormulas.EmotionState {
    /// Canonical color for flat UI contexts (cards, borders, text)
    var color: Color {
        switch self {
        case .comfortable: Color.pulpePrimary
        case .tight: Color.financialExpense
        case .deficit: Color.financialOverBudget
        }
    }
}
