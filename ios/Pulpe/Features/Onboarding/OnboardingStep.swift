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
        case .income: AppLocale.string("Combien gagnes-tu par mois ?")
        case .charges: AppLocale.string("Quelles sont tes charges fixes ?")
        case .savings: AppLocale.string("Combien mets-tu de côté ?")
        case .budgetPreview: AppLocale.string("Ton budget")
        case .registration: AppLocale.string("Crée ton compte")
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
}
