import SwiftUI

enum OnboardingStep: String, CaseIterable, Identifiable {
    case welcome
    case firstName
    case registration
    case income
    case charges
    case savings
    case budgetPreview

    var id: String { rawValue }

    var analyticsName: String {
        switch self {
        case .welcome: "welcome"
        case .firstName: "first_name"
        case .income: "income"
        case .charges: "charges"
        case .savings: "savings"
        case .budgetPreview: "budget_preview"
        case .registration: "registration"
        }
    }

    var title: String {
        switch self {
        case .welcome: "Bienvenue"
        case .firstName: "Comment tu t'appelles ?"
        case .income: "Tes revenus"
        case .charges: "Tes dépenses"
        case .savings: "Ton épargne"
        case .budgetPreview: "Ton budget"
        case .registration: "Crée ton compte"
        }
    }

    var subtitle: String {
        switch self {
        case .welcome: "Reprends le contrôle de tes finances"
        case .firstName: "Juste ton prénom"
        case .income: "Ton salaire et tes autres revenus"
        case .charges: "Renseigne ce que tu connais — le reste peut attendre"
        case .savings: "Ce que tu mets de côté chaque mois"
        case .budgetPreview: "Voici ce que ça donne"
        case .registration: "Sécurise ton accès"
        }
    }

    var isOptional: Bool {
        switch self {
        case .charges, .savings:
            return true
        default:
            return false
        }
    }

    var showProgressBar: Bool {
        self != .welcome
    }

    var iconName: String {
        switch self {
        case .welcome: "sparkles"
        case .firstName: "person.circle.fill"
        case .income: "arrow.down.circle.fill"
        case .charges: "house.fill"
        case .savings: "building.columns"
        case .budgetPreview: "chart.pie.fill"
        case .registration: "checkmark.seal.fill"
        }
    }

    var iconColor: Color {
        switch self {
        case .welcome: .pulpePrimary
        case .firstName: .pulpePrimary
        case .income: .financialIncome
        case .charges: .stepHousing
        case .savings: .financialSavings
        case .budgetPreview: .pulpePrimary
        case .registration: .pulpePrimary
        }
    }
}
