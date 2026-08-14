import SwiftUI

/// Type of financial flow
enum TransactionKind: String, Codable, CaseIterable, Sendable {
    case income
    case expense
    case saving

    var label: String {
        switch self {
        case .income: AppLocale.string("Revenu")
        case .expense: AppLocale.string("Dépense")
        case .saving: AppLocale.string("Épargne")
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
        case .expense: AppLocale.string("Ex : Courses, Restaurant...")
        case .income: AppLocale.string("Ex : Salaire, Remboursement...")
        case .saving: AppLocale.string("Ex : Vacances, Fonds d'urgence...")
        }
    }

    /// The verb carries the tense: here a fact already on the account, on the
    /// forecast side an intention still to come. "Nouvelle dépense" named
    /// neither — it only said something was about to exist.
    ///
    /// Whole sentences rather than a verb interpolated with an article: French puts the
    /// verb first and German puts it last, so a "Noter %@" template would force the
    /// French word order on every language.
    var newTransactionTitle: String {
        switch self {
        case .expense: AppLocale.string("Noter une dépense")
        case .income: AppLocale.string("Noter un revenu")
        case .saving: AppLocale.string("Noter une épargne")
        }
    }

    var newBudgetLineTitle: String {
        switch self {
        case .expense: AppLocale.string("Prévoir une dépense")
        case .income: AppLocale.string("Prévoir un revenu")
        case .saving: AppLocale.string("Prévoir une épargne")
        }
    }

    var editBudgetLineTitle: String {
        switch self {
        case .expense: AppLocale.string("Modifier la dépense")
        case .income: AppLocale.string("Modifier le revenu")
        case .saving: AppLocale.string("Modifier l'épargne")
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
        case .fixed: AppLocale.string("Récurrent")
        // French says "Prévu" for this type AND for the planned aggregate; the other
        // languages split them (One-off vs Planned), so this sense needs its own key —
        // the bare "Prévu" key stays the aggregate (docs/I18N.md, deliberate divergence 1).
        case .oneOff: AppLocale.string("recurrence.oneOff")
        }
    }

    var longLabel: String {
        switch self {
        case .fixed: AppLocale.string("Tous les mois")
        case .oneOff: AppLocale.string("Une seule fois")
        }
    }

    var icon: String {
        switch self {
        case .fixed: "repeat"
        case .oneOff: "1.circle"
        }
    }
}
