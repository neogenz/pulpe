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

    /// Short subtitle for budget cards — aligned with DA emotional tone
    var subtitle: String {
        switch self {
        case .comfortable: "Cap sur l'indépendance"
        case .tight: "Serré mais maîtrisé"
        case .deficit: "Tu le sais — c'est déjà ça"
        }
    }
}
