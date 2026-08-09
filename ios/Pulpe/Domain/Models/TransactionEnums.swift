import SwiftUI

/// Type of financial flow
enum TransactionKind: String, Codable, CaseIterable, Sendable {
    case income
    case expense
    case saving

    var label: String {
        switch self {
        case .income: "Revenu"
        case .expense: "Dépense"
        case .saving: "Épargne"
        }
    }

    /// SF Symbol name for savings (bank icon, used everywhere)
    static let savingsIcon = "building.columns"

    var icon: String {
        switch self {
        case .income: "arrow.down.left"
        case .expense: "arrow.up.right"
        case .saving: Self.savingsIcon
        }
    }

    var color: Color {
        switch self {
        case .income: .financialIncome
        case .expense: .financialExpense
        case .saving: .financialSavings
        }
    }

    var descriptionPlaceholder: String {
        switch self {
        case .expense: "Ex : Courses, Restaurant..."
        case .income: "Ex : Salaire, Remboursement..."
        case .saving: "Ex : Vacances, Fonds d'urgence..."
        }
    }

    /// The article travels with the word, so a title only ever prefixes a verb:
    /// "Noter" + "une dépense". Holding the two halves in one property is what
    /// keeps them from drifting apart as titles are added.
    var indefiniteLabel: String {
        switch self {
        case .expense: "une dépense"
        case .income: "un revenu"
        case .saving: "une épargne"
        }
    }

    /// The verb carries the tense: here a fact already on the account, on the
    /// forecast side an intention still to come. "Nouvelle dépense" named
    /// neither — it only said something was about to exist.
    var newTransactionTitle: String { "Noter \(indefiniteLabel)" }

    var newBudgetLineTitle: String { "Prévoir \(indefiniteLabel)" }

    var editBudgetLineTitle: String {
        switch self {
        case .expense: "Modifier la dépense"
        case .income: "Modifier le revenu"
        case .saving: "Modifier l'épargne"
        }
    }

    /// For calculations, savings are treated as expenses
    var isOutflow: Bool {
        self == .expense || self == .saving
    }
}

/// Recurrence type for budget lines
enum TransactionRecurrence: String, Codable, CaseIterable, Sendable {
    case fixed
    case oneOff = "one_off"

    var label: String {
        switch self {
        case .fixed: "Récurrent"
        case .oneOff: "Prévu"
        }
    }

    var longLabel: String {
        switch self {
        case .fixed: "Tous les mois"
        case .oneOff: "Une seule fois"
        }
    }

    var icon: String {
        switch self {
        case .fixed: "repeat"
        case .oneOff: "1.circle"
        }
    }
}
