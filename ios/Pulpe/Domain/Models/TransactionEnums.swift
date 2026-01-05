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

    var icon: String {
        switch self {
        case .income: "arrow.down.circle.fill"
        case .expense: "arrow.up.circle.fill"
        case .saving: "banknote.fill"
        }
    }

    var color: Color {
        switch self {
        case .income: .financialIncome
        case .expense: .financialExpense
        case .saving: .financialSavings
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
