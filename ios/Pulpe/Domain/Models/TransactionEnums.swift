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

    var shortLabel: String {
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
        case .income: "arrow.down"
        case .expense: "arrow.up"
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

    var newTransactionTitle: String {
        switch self {
        case .expense: "Nouvelle dépense"
        case .income: "Nouveau revenu"
        case .saving: "Nouvelle épargne"
        }
    }

    var newBudgetLineTitle: String {
        switch self {
        case .expense: "Nouvelle prévision"
        case .income: "Nouvelle prévision"
        case .saving: "Nouvelle prévision"
        }
    }

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
