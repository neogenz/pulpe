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
        case .welcome: AppLocale.string("Bienvenue")
        case .firstName: AppLocale.string("Comment tu t'appelles ?")
        case .income: AppLocale.string("Tes revenus")
        case .charges: AppLocale.string("Tes dépenses")
        case .savings: AppLocale.string("Ton épargne")
        case .budgetPreview: AppLocale.string("Ton budget")
        case .registration: AppLocale.string("Crée ton compte")
        }
    }

    var subtitle: String {
        switch self {
        case .welcome: AppLocale.string("Reprends le contrôle de tes finances")
        case .firstName: AppLocale.string("Juste ton prénom")
        case .income: AppLocale.string("Ce qui tombe sur ton compte chaque mois")
        case .charges: AppLocale.string("Renseigne ce que tu connais — le reste peut attendre")
        case .savings: AppLocale.string("Ce que tu mets de côté chaque mois")
        case .budgetPreview: AppLocale.string("Voici ce que ça donne")
        case .registration: AppLocale.string("Pour retrouver tout ça sur tous tes appareils")
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

    /// Titles for budget preview stay centered; form steps use leading alignment (Practical UI / lean forms).
    var onboardingHeaderIsCentered: Bool {
        self == .budgetPreview
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
